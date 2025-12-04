// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

import {IHooks} from "@uniswap/v4-core/src/interfaces/IHooks.sol";
import {IPoolManager} from "@uniswap/v4-core/src/interfaces/IPoolManager.sol";
import {Hooks} from "@uniswap/v4-core/src/libraries/Hooks.sol";
import {PoolKey} from "@uniswap/v4-core/src/types/PoolKey.sol";
import {BalanceDelta} from "@uniswap/v4-core/src/types/BalanceDelta.sol";
import {ModifyLiquidityParams, SwapParams} from "@uniswap/v4-core/src/types/PoolOperation.sol";
import {BeforeSwapDelta, BeforeSwapDeltaLibrary} from "@uniswap/v4-core/src/types/BeforeSwapDelta.sol";
import {Currency, CurrencyLibrary} from "@uniswap/v4-core/src/types/Currency.sol";
import {TickMath} from "@uniswap/v4-core/src/libraries/TickMath.sol";
import {BalanceDeltaLibrary} from "@uniswap/v4-core/src/types/BalanceDelta.sol";
import {IUnlockCallback} from "@uniswap/v4-core/src/interfaces/callback/IUnlockCallback.sol";
import {IERC20} from "@openzeppelin/contracts/token/ERC20/IERC20.sol";
import {ERC20Upgradeable} from "@openzeppelin/contracts-upgradeable/token/ERC20/ERC20Upgradeable.sol";
import {SafeERC20} from "@openzeppelin/contracts/token/ERC20/utils/SafeERC20.sol";
import {OwnableUpgradeable} from "@openzeppelin/contracts-upgradeable/access/OwnableUpgradeable.sol";
import {UUPSUpgradeable} from "@openzeppelin/contracts-upgradeable/proxy/utils/UUPSUpgradeable.sol";
import {Initializable} from "@openzeppelin/contracts-upgradeable/proxy/utils/Initializable.sol";

/// @notice Error thrown when caller is not PoolManager
error NotPoolManager();

/// @notice Error thrown when hook function is not implemented
error HookNotImplemented();

contract CellarHook is IHooks, IUnlockCallback, ERC20Upgradeable, OwnableUpgradeable, UUPSUpgradeable {
    using SafeERC20 for IERC20;
    using CurrencyLibrary for Currency;
    using BeforeSwapDeltaLibrary for BeforeSwapDelta;

    // PoolManager - stored as state variable (was immutable in BaseHook)
    IPoolManager public poolManager;

    // The Pot (Accumulated Fees)
    // Note: In upgradeable contracts, immutable variables must become state variables
    Currency public MON;
    Currency public KEEP;

    uint256 public potBalance;

    // Anti-Sandwich Protection
    mapping(address => uint256) public lastTradeBlock;

    /*----------  CONSTANTS  --------------------------------------------*/

    uint256 public constant MIN_EPOCH_PERIOD = 1 hours;
    uint256 public constant MAX_EPOCH_PERIOD = 365 days;
    uint256 public constant MIN_PRICE_MULTIPLIER = 1.1e18; // 110%
    uint256 public constant MAX_PRICE_MULTIPLIER = 3e18; // 300%
    uint256 public constant ABS_MIN_INIT_PRICE = 1e18; // 1 MON
    uint256 public constant ABS_MAX_INIT_PRICE = type(uint192).max;
    uint256 public constant PRICE_MULTIPLIER_SCALE = 1e18;

    // Uniswap V4 tick constants
    int24 public constant MIN_TICK = -887272;
    int24 public constant MAX_TICK = 887272;

    /*----------  STATE VARIABLES  --------------------------------------*/

    // Note: In upgradeable contracts, immutable variables must become state variables
    uint256 public epochPeriod;
    uint256 public priceMultiplier;
    uint256 public minInitPrice;

    struct Slot0 {
        uint8 locked;
        uint16 epochId;
        uint192 initPrice;
        uint40 startTime;
    }

    Slot0 public slot0;

    // Track if pool has been initialized (prevents recovery after pool is live)
    // MUST be at the end of state variables for upgrade compatibility
    bool public poolInitialized;

    struct CallbackData {
        PoolKey key;
        ModifyLiquidityParams params;
        uint256 amountMON;
        address sender;
    }

    event Raid(address indexed raider, uint256 paymentAmount, uint256 rewardAmount, uint256 newInitPrice, uint256 newEpochId);
    event PotContributed(address indexed contributor, uint256 amount);
    event PoolInitialized(address indexed initializer, uint160 sqrtPriceX96);
    event TokensRecovered(address indexed user, uint256 lpTokensBurned, uint256 monRecovered, uint256 keepRecovered);

    /// @custom:oz-upgrades-unsafe-allow constructor
    constructor() {
        _disableInitializers();
    }

    function initialize(
        IPoolManager _poolManager,
        Currency _mon,
        Currency _keep,
        uint256 _initPrice,
        uint256 _epochPeriod,
        uint256 _priceMultiplier,
        uint256 _minInitPrice,
        address _owner
    ) public initializer {
        // Initialize ERC20
        __ERC20_init("Cellar LP", "CLP");

        // Initialize Ownable
        __Ownable_init(_owner);

        // Initialize UUPS
        __UUPSUpgradeable_init();

        // Set state variables
        poolManager = _poolManager;
        MON = _mon;
        KEEP = _keep;

        // Auction Init - validation
        require(_initPrice >= _minInitPrice, "Init price too low");
        require(_initPrice <= ABS_MAX_INIT_PRICE, "Init price too high");
        require(_epochPeriod >= MIN_EPOCH_PERIOD && _epochPeriod <= MAX_EPOCH_PERIOD, "Invalid epoch period");
        require(_priceMultiplier >= MIN_PRICE_MULTIPLIER && _priceMultiplier <= MAX_PRICE_MULTIPLIER, "Invalid multiplier");
        require(_minInitPrice >= ABS_MIN_INIT_PRICE && _minInitPrice <= ABS_MAX_INIT_PRICE, "Invalid min init price");

        epochPeriod = _epochPeriod;
        priceMultiplier = _priceMultiplier;
        minInitPrice = _minInitPrice;

        // Initialize slot0
        slot0.initPrice = uint192(_initPrice);
        slot0.startTime = uint40(block.timestamp);
        slot0.locked = 1; // Unlocked

        // Initialize potBalance to 0
        potBalance = 0;

        // Pool not initialized yet
        poolInitialized = false;
    }

    function _authorizeUpgrade(address newImplementation) internal override onlyOwner {}

    /// @notice Only allow calls from the PoolManager contract
    modifier onlyPoolManager() {
        if (msg.sender != address(poolManager)) revert NotPoolManager();
        _;
    }

    function getHookPermissions() public pure returns (Hooks.Permissions memory) {
        return Hooks.Permissions({
            beforeInitialize: false,
            afterInitialize: false,
            beforeAddLiquidity: true, // To mint LP tokens
            afterAddLiquidity: false,
            beforeRemoveLiquidity: true, // To burn LP tokens (if we allowed removal)
            afterRemoveLiquidity: false,
            beforeSwap: true, // Anti-Sandwich
            afterSwap: true, // Fee Collection
            beforeDonate: false,
            afterDonate: false,
            beforeSwapReturnDelta: false,
            afterSwapReturnDelta: false,
            afterAddLiquidityReturnDelta: false,
            afterRemoveLiquidityReturnDelta: false
        });
    }

    // ---------------------------------------------------------
    // Hook Interface Implementation (IHooks)
    // ---------------------------------------------------------

    /// @inheritdoc IHooks
    function beforeInitialize(address, PoolKey calldata, uint160) external pure returns (bytes4) {
        revert HookNotImplemented();
    }

    /// @inheritdoc IHooks
    function afterInitialize(address, PoolKey calldata, uint160, int24) external pure returns (bytes4) {
        revert HookNotImplemented();
    }

    /// @inheritdoc IHooks
    function beforeAddLiquidity(
        address sender,
        PoolKey calldata key,
        ModifyLiquidityParams calldata params,
        bytes calldata hookData
    ) external onlyPoolManager returns (bytes4) {
        // Implementation can be added here if needed
        // For now, just return the function selector
        return this.beforeAddLiquidity.selector;
    }

    /// @inheritdoc IHooks
    function afterAddLiquidity(
        address,
        PoolKey calldata,
        ModifyLiquidityParams calldata,
        BalanceDelta,
        BalanceDelta,
        bytes calldata
    ) external pure returns (bytes4, BalanceDelta) {
        revert HookNotImplemented();
    }

    /// @inheritdoc IHooks
    function beforeRemoveLiquidity(
        address sender,
        PoolKey calldata key,
        ModifyLiquidityParams calldata params,
        bytes calldata hookData
    ) external onlyPoolManager returns (bytes4) {
        // Implementation can be added here if needed
        // For now, just return the function selector
        return this.beforeRemoveLiquidity.selector;
    }

    /// @inheritdoc IHooks
    function afterRemoveLiquidity(
        address,
        PoolKey calldata,
        ModifyLiquidityParams calldata,
        BalanceDelta,
        BalanceDelta,
        bytes calldata
    ) external pure returns (bytes4, BalanceDelta) {
        revert HookNotImplemented();
    }

    /// @inheritdoc IHooks
    function beforeSwap(address sender, PoolKey calldata key, SwapParams calldata params, bytes calldata hookData)
        external
        onlyPoolManager
        returns (bytes4, BeforeSwapDelta, uint24)
    {
        // Anti-Sandwich Protection
        require(lastTradeBlock[sender] != block.number, "Same block trade");
        lastTradeBlock[sender] = block.number;

        // Return empty BeforeSwapDelta (no delta, no fee override)
        // BeforeSwapDelta is a type alias for int256
        BeforeSwapDelta delta = BeforeSwapDelta.wrap(0);
        return (this.beforeSwap.selector, delta, 0);
    }

    /// @inheritdoc IHooks
    function afterSwap(
        address,
        PoolKey calldata,
        SwapParams calldata,
        BalanceDelta,
        bytes calldata
    ) external onlyPoolManager returns (bytes4, int128) {
        // Fee collection can be implemented here if needed
        // For now, return no delta
        return (this.afterSwap.selector, 0);
    }

    /// @inheritdoc IHooks
    function beforeDonate(address, PoolKey calldata, uint256, uint256, bytes calldata) external pure returns (bytes4) {
        revert HookNotImplemented();
    }

    /// @inheritdoc IHooks
    function afterDonate(address, PoolKey calldata, uint256, uint256, bytes calldata) external pure returns (bytes4) {
        revert HookNotImplemented();
    }

    // ---------------------------------------------------------
    // Liquidity Management
    // ---------------------------------------------------------

    /// @notice Adds liquidity to the Uniswap V4 pool and mints LP tokens
    /// @param key The pool key identifying the pool
    /// @param amountMON Amount of MON tokens to add
    /// @param amountKEEP Amount of KEEP tokens to add (must be 3x amountMON)
    /// @param tickLower Lower tick for the liquidity position (must be valid, not 0)
    /// @param tickUpper Upper tick for the liquidity position (must be valid, not 0)
    function addLiquidity(PoolKey calldata key, uint256 amountMON, uint256 amountKEEP, int24 tickLower, int24 tickUpper) external payable {
        // Validate 1:3 MON:KEEP ratio
        require(amountKEEP == amountMON * 3, "CellarHook: Invalid MON:KEEP ratio (must be 1:3)");
        require(amountMON > 0 && amountKEEP > 0, "CellarHook: Amounts must be > 0");

        // Handle tick range - if 0,0 use reasonable range around current price, otherwise validate
        int24 actualTickLower = tickLower;
        int24 actualTickUpper = tickUpper;
        if (tickLower == 0 && tickUpper == 0) {
            // Use reasonable range around current price (price = 3, tick ≈ 10986)
            // Use ±20000 ticks around current price (approximately ±200% price range)
            // Round to nearest tick spacing
            int24 currentTick = 10986; // Approximate tick for price = 3
            int24 rangeTicks = 20000;
            actualTickLower = ((currentTick - rangeTicks) / key.tickSpacing) * key.tickSpacing;
            actualTickUpper = ((currentTick + rangeTicks) / key.tickSpacing) * key.tickSpacing;

            // Ensure ticks are within bounds
            if (actualTickLower < MIN_TICK) actualTickLower = MIN_TICK;
            if (actualTickUpper > MAX_TICK) actualTickUpper = MAX_TICK;
        } else {
            // Validate provided ticks
            require(tickLower < tickUpper, "CellarHook: tickLower must be < tickUpper");
            require(tickLower >= MIN_TICK && tickUpper <= MAX_TICK, "CellarHook: Ticks out of range");
            require(tickLower % key.tickSpacing == 0 && tickUpper % key.tickSpacing == 0, "CellarHook: Ticks must align with tickSpacing");
        }

        // 1. Transfer tokens to Hook
        if (Currency.unwrap(MON) == address(0)) {
            require(msg.value == amountMON, "Incorrect MON");
        } else {
            IERC20(Currency.unwrap(MON)).safeTransferFrom(msg.sender, address(this), amountMON);
        }
        IERC20(Currency.unwrap(KEEP)).safeTransferFrom(msg.sender, address(this), amountKEEP);

        // 2. Ensure pool is initialized
        // Calculate sqrtPriceX96 for 1:3 ratio (price = 3 KEEP per MON)
        // sqrt(3) * 2^96 ≈ 1373075539065492859289024128 (calculated)
        uint160 sqrtPriceX96 = 1373075539065492859289024128; // sqrt(3) * 2^96

        // Try to initialize - if pool already exists, this will revert but we'll catch it
        try poolManager.initialize(key, sqrtPriceX96) {
            // Pool initialized successfully
            if (!poolInitialized) {
                poolInitialized = true;
                emit PoolInitialized(msg.sender, sqrtPriceX96);
            }
        } catch {
            // Pool already exists or initialization failed - continue
            // If pool doesn't exist and init failed, modifyLiquidity will revert
            // Mark as initialized if modifyLiquidity succeeds (pool exists)
            poolInitialized = true;
        }

        // 3. Calculate liquidityDelta from token amounts
        // Calculate sqrt prices for tick range
        uint160 sqrtPriceAX96 = TickMath.getSqrtPriceAtTick(actualTickLower);
        uint160 sqrtPriceBX96 = TickMath.getSqrtPriceAtTick(actualTickUpper);

        // Ensure sqrtPriceAX96 < sqrtPriceBX96
        if (sqrtPriceAX96 > sqrtPriceBX96) {
            (sqrtPriceAX96, sqrtPriceBX96) = (sqrtPriceBX96, sqrtPriceAX96);
        }

        // Calculate liquidityDelta using Uniswap V4 formulas
        uint256 liquidity;
        if (sqrtPriceX96 <= sqrtPriceAX96) {
            // Current price is below range - all token0
            liquidity = _getLiquidityForAmount0(sqrtPriceAX96, sqrtPriceBX96, amountMON);
        } else if (sqrtPriceX96 < sqrtPriceBX96) {
            // Current price is in range - use both tokens
            uint256 liquidity0 = _getLiquidityForAmount0(sqrtPriceX96, sqrtPriceBX96, amountMON);
            uint256 liquidity1 = _getLiquidityForAmount1(sqrtPriceAX96, sqrtPriceX96, amountKEEP);
            liquidity = liquidity0 < liquidity1 ? liquidity0 : liquidity1;
        } else {
            // Current price is above range - all token1
            liquidity = _getLiquidityForAmount1(sqrtPriceAX96, sqrtPriceBX96, amountKEEP);
        }

        require(liquidity > 0, "CellarHook: Invalid liquidity calculation");

        // 4. Prepare params for modifyLiquidity
        ModifyLiquidityParams memory params = ModifyLiquidityParams({
            tickLower: actualTickLower,
            tickUpper: actualTickUpper,
            liquidityDelta: int256(uint256(liquidity)),
            salt: bytes32(0)
        });

        // 5. Call unlock to execute modifyLiquidity via callback
        bytes memory callbackData = abi.encode(CallbackData({
            key: key,
            params: params,
            amountMON: amountMON,
            sender: msg.sender
        }));

        poolManager.unlock(callbackData);
    }

    /// @notice Callback called by PoolManager.unlock
    /// @param data Encoded CallbackData
    /// @return bytes Empty bytes
    function unlockCallback(bytes calldata data) external onlyPoolManager returns (bytes memory) {
        CallbackData memory callbackData = abi.decode(data, (CallbackData));

        // 1. Call modifyLiquidity
        (BalanceDelta callerDelta, ) = poolManager.modifyLiquidity(callbackData.key, callbackData.params, "");

        // 2. Settle balance delta - handle token transfers
        _settleBalanceDelta(callbackData.key, callerDelta);

        // 3. Mint LP Tokens to User
        // Mint 1 LP per 1 MON (with 3 KEEP required per MON to maintain 1:3 ratio)
        uint256 liquidityMinted = callbackData.amountMON;

        _mint(callbackData.sender, liquidityMinted);

        return "";
    }

    /// @notice Helper function to calculate liquidity for amount0
    /// Formula: L = amount0 * sqrt(P_upper) * sqrt(P_lower) / (sqrt(P_upper) - sqrt(P_lower))
    /// All prices are in Q96 format (multiplied by 2^96)
    function _getLiquidityForAmount0(uint160 sqrtPriceAX96, uint160 sqrtPriceBX96, uint256 amount0) internal pure returns (uint256) {
        if (sqrtPriceAX96 > sqrtPriceBX96) {
            (sqrtPriceAX96, sqrtPriceBX96) = (sqrtPriceBX96, sqrtPriceAX96);
        }
        // Multiply sqrt prices (result is in Q192), divide by 2^96 to get Q96
        uint256 numerator = amount0 * uint256(sqrtPriceAX96) * uint256(sqrtPriceBX96);
        uint256 denominator = uint256(sqrtPriceBX96 - sqrtPriceAX96) * 2**96;
        return numerator / denominator;
    }

    /// @notice Helper function to calculate liquidity for amount1
    /// Formula: L = amount1 / (sqrt(P_upper) - sqrt(P_lower))
    /// All prices are in Q96 format
    function _getLiquidityForAmount1(uint160 sqrtPriceAX96, uint160 sqrtPriceBX96, uint256 amount1) internal pure returns (uint256) {
        if (sqrtPriceAX96 > sqrtPriceBX96) {
            (sqrtPriceAX96, sqrtPriceBX96) = (sqrtPriceBX96, sqrtPriceAX96);
        }
        // Multiply amount1 by 2^96 to match Q96 format of price difference
        return (amount1 * 2**96) / uint256(sqrtPriceBX96 - sqrtPriceAX96);
    }

    /// @notice Settles balance delta by transferring tokens to/from PoolManager
    function _settleBalanceDelta(PoolKey memory key, BalanceDelta delta) internal {
        // Extract amounts from BalanceDelta using BalanceDeltaLibrary
        int128 amount0 = BalanceDeltaLibrary.amount0(delta);
        int128 amount1 = BalanceDeltaLibrary.amount1(delta);

        // Handle currency0 (MON)
        if (amount0 != 0) {
            Currency currency0 = key.currency0;
            if (amount0 < 0) {
                // User owes tokens to pool - settle
                uint256 amountToSettle = uint256(uint128(-amount0));
                if (Currency.unwrap(currency0) == address(0)) {
                    // Native currency - send ETH with settle
                    poolManager.settle{value: amountToSettle}();
                } else {
                    // ERC20 - sync, transfer, then settle
                    poolManager.sync(currency0);
                    IERC20(Currency.unwrap(currency0)).safeTransfer(address(poolManager), amountToSettle);
                    poolManager.settle();
                }
            } else if (amount0 > 0) {
                // Pool owes tokens to user - take
                uint256 amountToTake = uint256(uint128(amount0));
                poolManager.take(currency0, address(this), amountToTake);
            }
        }

        // Handle currency1 (KEEP) - always ERC20
        if (amount1 != 0) {
            Currency currency1 = key.currency1;
            if (amount1 < 0) {
                // User owes tokens to pool - settle
                uint256 amountToSettle = uint256(uint128(-amount1));
                poolManager.sync(currency1);
                IERC20(Currency.unwrap(currency1)).safeTransfer(address(poolManager), amountToSettle);
                poolManager.settle();
            } else if (amount1 > 0) {
                // Pool owes tokens to user - take
                uint256 amountToTake = uint256(uint128(amount1));
                poolManager.take(currency1, address(this), amountToTake);
            }
        }
    }

    // ---------------------------------------------------------
    // The "Raid" (Blaze) Logic
    // ---------------------------------------------------------

    function raid(uint256 maxPaymentAmount) external nonReentrant returns (uint256 paymentAmount) {
        Slot0 memory slot0Cache = slot0;

        // Calculate Price
        paymentAmount = getPriceFromCache(slot0Cache);

        if (paymentAmount > maxPaymentAmount) revert("Price too high");
        if (balanceOf(msg.sender) < paymentAmount) revert("Insufficient LP");

        // 1. Burn LP Tokens (Payment)
        _burn(msg.sender, paymentAmount);

        // 2. Send Pot to User
        uint256 reward = potBalance;
        potBalance = 0; // Reset pot

        if (Currency.unwrap(MON) == address(0)) {
            (bool success, ) = msg.sender.call{value: reward}("");
            require(success, "Transfer failed");
        } else {
            IERC20(Currency.unwrap(MON)).safeTransfer(msg.sender, reward);
        }

        // 3. Setup new auction
        uint256 newInitPrice = paymentAmount * priceMultiplier / PRICE_MULTIPLIER_SCALE;

        if (newInitPrice > ABS_MAX_INIT_PRICE) {
            newInitPrice = ABS_MAX_INIT_PRICE;
        } else if (newInitPrice < minInitPrice) {
            newInitPrice = minInitPrice;
        }

        unchecked {
            slot0Cache.epochId++;
        }
        slot0Cache.initPrice = uint192(newInitPrice);
        slot0Cache.startTime = uint40(block.timestamp);

        slot0 = slot0Cache;

        emit Raid(msg.sender, paymentAmount, reward, newInitPrice, slot0Cache.epochId);
    }

    function getPriceFromCache(Slot0 memory slot0Cache) internal view returns (uint256) {
        uint256 timePassed = block.timestamp - slot0Cache.startTime;

        if (timePassed > epochPeriod) {
            return minInitPrice;
        }

        uint256 calculatedPrice = slot0Cache.initPrice - slot0Cache.initPrice * timePassed / epochPeriod;
        return calculatedPrice < minInitPrice ? minInitPrice : calculatedPrice;
    }

    function getAuctionPrice() public view returns (uint256) {
        return getPriceFromCache(slot0);
    }

    modifier nonReentrant() {
        require(slot0.locked == 1, "Reentrancy");
        slot0.locked = 2;
        _;
        slot0.locked = 1;
    }

    /**
     * @notice Receives native MON tokens and updates potBalance
     * @dev This function is called when native tokens are sent to the contract.
     *      It increments potBalance to track accumulated fees.
     */
    receive() external payable {
        // Only update potBalance if receiving native MON (address(0))
        // ERC20 tokens would be transferred via safeTransferFrom
        if (Currency.unwrap(MON) == address(0) && msg.value > 0) {
            potBalance += msg.value;
        }
    }

    /**
     * @notice Allows external contracts (e.g., Bar Regulars, Town Posse) to contribute native MON to the pot
     * @dev Only works when MON is native (address(0))
     *      For ERC20 MON, use contributeToPotERC20()
     *      Maintains backward compatibility with receive() function
     */
    function contributeToPot() external payable {
        require(Currency.unwrap(MON) == address(0), "Use contributeToPotERC20 for ERC20");
        if (msg.value > 0) {
            potBalance += msg.value;
            emit PotContributed(msg.sender, msg.value);
        }
    }

    /**
     * @notice Contribute ERC20 MON tokens to the pot
     * @param amount Amount of MON tokens to contribute
     * @dev Caller must approve this contract to spend MON tokens
     */
    function contributeToPotERC20(uint256 amount) external {
        require(Currency.unwrap(MON) != address(0), "MON is native");
        require(amount > 0, "Amount must be > 0");

        IERC20(Currency.unwrap(MON)).safeTransferFrom(msg.sender, address(this), amount);
        potBalance += amount;
        emit PotContributed(msg.sender, amount);
    }

    // ---------------------------------------------------------
    // Token Recovery (for stuck tokens from failed liquidity additions)
    // ---------------------------------------------------------

    /**
     * @notice Recover tokens from failed liquidity additions (before pool was initialized)
     * @param lpTokenAmount Amount of LP tokens to burn for recovery
     * @dev Only works if pool hasn't been initialized yet
     *      Users get back MON+KEEP proportional to their LP token balance (1 LP = 1 MON + 3 KEEP)
     *      This allows users to recover tokens that were sent but never made it into pools
     */
    function recoverStuckTokens(uint256 lpTokenAmount) external nonReentrant {
        require(!poolInitialized, "CellarHook: Pool already initialized - recovery disabled");
        require(lpTokenAmount > 0, "CellarHook: Amount must be > 0");
        require(balanceOf(msg.sender) >= lpTokenAmount, "CellarHook: Insufficient LP tokens");

        // Calculate proportional recovery (1 LP = 1 MON + 3 KEEP based on original addLiquidity ratio)
        uint256 monAmount = lpTokenAmount;
        uint256 keepAmount = lpTokenAmount * 3;

        // Check contract has enough tokens
        uint256 contractMonBalance;
        uint256 contractKeepBalance;

        if (Currency.unwrap(MON) == address(0)) {
            // Native MON
            contractMonBalance = address(this).balance;
        } else {
            // ERC20 MON
            contractMonBalance = IERC20(Currency.unwrap(MON)).balanceOf(address(this));
        }
        contractKeepBalance = IERC20(Currency.unwrap(KEEP)).balanceOf(address(this));

        require(contractMonBalance >= monAmount, "CellarHook: Insufficient MON in contract");
        require(contractKeepBalance >= keepAmount, "CellarHook: Insufficient KEEP in contract");

        // Burn LP tokens
        _burn(msg.sender, lpTokenAmount);

        // Transfer MON back to user
        if (Currency.unwrap(MON) == address(0)) {
            // Native MON - send ETH
            (bool success, ) = msg.sender.call{value: monAmount}("");
            require(success, "CellarHook: MON transfer failed");
        } else {
            // ERC20 MON
            IERC20(Currency.unwrap(MON)).safeTransfer(msg.sender, monAmount);
        }

        // Transfer KEEP back to user (always ERC20)
        IERC20(Currency.unwrap(KEEP)).safeTransfer(msg.sender, keepAmount);

        emit TokensRecovered(msg.sender, lpTokenAmount, monAmount, keepAmount);
    }

    /**
     * @notice Owner-only recovery function for edge cases
     * @param user Address to recover tokens for
     * @param lpTokenAmount Amount of LP tokens to burn for recovery
     * @dev Only works if pool hasn't been initialized yet
     *      Allows owner to help users recover tokens in special circumstances
     */
    function recoverTokensForUser(address user, uint256 lpTokenAmount) external onlyOwner nonReentrant {
        require(!poolInitialized, "CellarHook: Pool already initialized - recovery disabled");
        require(lpTokenAmount > 0, "CellarHook: Amount must be > 0");
        require(balanceOf(user) >= lpTokenAmount, "CellarHook: Insufficient LP tokens");

        // Calculate proportional recovery (1 LP = 1 MON + 3 KEEP)
        uint256 monAmount = lpTokenAmount;
        uint256 keepAmount = lpTokenAmount * 3;

        // Check contract has enough tokens
        uint256 contractMonBalance;
        uint256 contractKeepBalance;

        if (Currency.unwrap(MON) == address(0)) {
            contractMonBalance = address(this).balance;
        } else {
            contractMonBalance = IERC20(Currency.unwrap(MON)).balanceOf(address(this));
        }
        contractKeepBalance = IERC20(Currency.unwrap(KEEP)).balanceOf(address(this));

        require(contractMonBalance >= monAmount, "CellarHook: Insufficient MON in contract");
        require(contractKeepBalance >= keepAmount, "CellarHook: Insufficient KEEP in contract");

        // Burn LP tokens from user
        _burn(user, lpTokenAmount);

        // Transfer MON back to user
        if (Currency.unwrap(MON) == address(0)) {
            (bool success, ) = user.call{value: monAmount}("");
            require(success, "CellarHook: MON transfer failed");
        } else {
            IERC20(Currency.unwrap(MON)).safeTransfer(user, monAmount);
        }

        // Transfer KEEP back to user
        IERC20(Currency.unwrap(KEEP)).safeTransfer(user, keepAmount);

        emit TokensRecovered(user, lpTokenAmount, monAmount, keepAmount);
    }
}
