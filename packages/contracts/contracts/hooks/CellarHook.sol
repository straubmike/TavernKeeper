// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

import {IHooks} from "@uniswap/v4-core/src/interfaces/IHooks.sol";
import {IPoolManager} from "@uniswap/v4-core/src/interfaces/IPoolManager.sol";
import {Hooks} from "@uniswap/v4-core/src/libraries/Hooks.sol";
import {PoolKey} from "@uniswap/v4-core/src/types/PoolKey.sol";
import {PoolId, PoolIdLibrary} from "@uniswap/v4-core/src/types/PoolId.sol";
import {BalanceDelta} from "@uniswap/v4-core/src/types/BalanceDelta.sol";
import {ModifyLiquidityParams, SwapParams} from "@uniswap/v4-core/src/types/PoolOperation.sol";
import {BeforeSwapDelta, BeforeSwapDeltaLibrary} from "@uniswap/v4-core/src/types/BeforeSwapDelta.sol";
import {Currency, CurrencyLibrary} from "@uniswap/v4-core/src/types/Currency.sol";
import {TickMath} from "@uniswap/v4-core/src/libraries/TickMath.sol";
import {StateLibrary} from "@uniswap/v4-core/src/libraries/StateLibrary.sol";
import {BalanceDeltaLibrary} from "@uniswap/v4-core/src/types/BalanceDelta.sol";
import {IUnlockCallback} from "@uniswap/v4-core/src/interfaces/callback/IUnlockCallback.sol";
import {IERC20} from "@openzeppelin/contracts/token/ERC20/IERC20.sol";
import {ERC20Upgradeable} from "@openzeppelin/contracts-upgradeable/token/ERC20/ERC20Upgradeable.sol";
import {SafeERC20} from "@openzeppelin/contracts/token/ERC20/utils/SafeERC20.sol";
import {Strings} from "@openzeppelin/contracts/utils/Strings.sol";
import {OwnableUpgradeable} from "@openzeppelin/contracts-upgradeable/access/OwnableUpgradeable.sol";
import {UUPSUpgradeable} from "@openzeppelin/contracts-upgradeable/proxy/utils/UUPSUpgradeable.sol";
import {Initializable} from "@openzeppelin/contracts-upgradeable/proxy/utils/Initializable.sol";
import "hardhat/console.sol";

/// @notice Error thrown when caller is not PoolManager
error NotPoolManager();

/// @notice Error thrown when hook function is not implemented
error HookNotImplemented();

contract CellarHook is IHooks, IUnlockCallback, ERC20Upgradeable, OwnableUpgradeable, UUPSUpgradeable {
    using SafeERC20 for IERC20;
    using PoolIdLibrary for PoolKey;
    using StateLibrary for IPoolManager;
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
        uint256 liquidityDelta;
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

    function getFlags() public pure returns (uint160, uint160, uint160) {
        return (Hooks.BEFORE_INITIALIZE_FLAG, Hooks.BEFORE_ADD_LIQUIDITY_FLAG, Hooks.BEFORE_SWAP_FLAG);
    }

    function getHookPermissions() public pure returns (Hooks.Permissions memory) {
        return Hooks.Permissions({
            beforeInitialize: true,
            afterInitialize: false,
            beforeAddLiquidity: true,
            afterAddLiquidity: true,
            beforeRemoveLiquidity: false,
            afterRemoveLiquidity: true,
            beforeSwap: true,
            afterSwap: true,
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
        return this.beforeInitialize.selector;
    }

    /// @inheritdoc IHooks
    function afterInitialize(address, PoolKey calldata, uint160, int24) external pure returns (bytes4) {
        return this.afterInitialize.selector;
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
        return (this.afterAddLiquidity.selector, BalanceDelta.wrap(0));
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
        return (this.afterRemoveLiquidity.selector, BalanceDelta.wrap(0));
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
        PoolKey calldata key,
        SwapParams calldata params,
        BalanceDelta,
        bytes calldata
    ) external onlyPoolManager returns (bytes4, int128) {
        // Collect protocol fees and add to pot
        // Note: LP fees (1%) automatically accrue to LPs, but protocol fees can be collected
        _collectProtocolFeesToPot(key);

        return (this.afterSwap.selector, 0);
    }

    /**
     * @notice Collect protocol fees from PoolManager and add to pot
     * @param key The pool key
     * @dev This collects any protocol fees that have been set for this pool
     */
    function _collectProtocolFeesToPot(PoolKey memory key) internal {
        // Check if there are protocol fees accrued for MON
        uint256 protocolFeesMON = poolManager.protocolFeesAccrued(MON);

        if (protocolFeesMON > 0) {
            // Collect protocol fees to this contract
            poolManager.collectProtocolFees(address(this), MON, protocolFeesMON);

            // Add to pot balance
            potBalance += protocolFeesMON;
            emit PotContributed(address(this), protocolFeesMON);
        }

        // Also check KEEP if needed (though pot is in MON)
        // uint256 protocolFeesKEEP = poolManager.protocolFeesAccrued(KEEP);
        // Could convert KEEP to MON or track separately if needed
    }

    /// @inheritdoc IHooks
    function beforeDonate(address, PoolKey calldata, uint256, uint256, bytes calldata) external pure returns (bytes4) {
        return this.beforeDonate.selector;
    }

    /// @inheritdoc IHooks
    function afterDonate(address, PoolKey calldata, uint256, uint256, bytes calldata) external pure returns (bytes4) {
        return this.afterDonate.selector;
    }

    // ---------------------------------------------------------
    // Liquidity Management
    // ---------------------------------------------------------

    /// @notice Initialize the Uniswap V4 pool with an initial price
    /// @param key The pool key identifying the pool
    /// @dev This must be called before addLiquidity() for a new pool
    /// @dev If the pool is already initialized, this will revert
    /// @dev If the pool exists but is broken (price=0, tick=0), this will revert
    function initializePool(PoolKey calldata key) external onlyOwner {
        // Check if pool already exists and is initialized
        (uint160 sqrtPriceX96, int24 tick, , ) = poolManager.getSlot0(key.toId());

        if (sqrtPriceX96 > 0 && tick != 0) {
            revert("CellarHook: Pool already initialized");
        }

        // Calculate initial price for 1:3 ratio (price = 3 KEEP per MON)
        int24 targetTick = 10986; // Tick for price = 3.0 (1.0001^10986 ≈ 3.0)
        uint160 initSqrtPriceX96 = TickMath.getSqrtPriceAtTick(targetTick);

        // Try to initialize - if it fails, pool entry exists but is broken
        console.log("Initializing pool with hooks:", address(key.hooks));
        try poolManager.initialize(key, initSqrtPriceX96) {
            // Pool initialized successfully
            poolInitialized = true;
            emit PoolInitialized(msg.sender, initSqrtPriceX96);
            console.log("Pool initialized with price = 3.0");
        } catch (bytes memory reason) {
            // Pool entry exists but is broken (price = 0) - CANNOT be fixed
            // Uniswap V4 pools cannot be re-initialized
            // revert("CellarHook: Pool is broken (price=0, tick=0). Cannot initialize broken pool. Pool must be recreated with different parameters (fee/tickSpacing).");

            // Bubble up the error for debugging
            assembly {
                revert(add(reason, 32), mload(reason))
            }
        }
    }

    /// @notice Adds liquidity to the Uniswap V4 pool and mints LP tokens
    /// @param key The pool key identifying the pool
    /// @param amountMON Amount of MON tokens to add
    /// @param amountKEEP Amount of KEEP tokens to add (must be 3x amountMON)
    /// @param tickLower Lower tick for the liquidity position (must be valid, not 0)
    /// @param tickUpper Upper tick for the liquidity position (must be valid, not 0)
    function addLiquidity(PoolKey calldata key, uint256 amountMON, uint256 amountKEEP, int24 tickLower, int24 tickUpper) external payable {
        console.log("addLiquidity called");
        console.logInt(tickLower);
        console.logInt(tickUpper);

        // Validate 1:3 MON:KEEP ratio
        require(amountKEEP == amountMON * 3, "CellarHook: Invalid MON:KEEP ratio (must be 1:3)");
        require(amountMON > 0 && amountKEEP > 0, "CellarHook: Amounts must be > 0");

        // Handle tick range - if 0,0 use reasonable range around ACTUAL current price, otherwise validate
        int24 actualTickLower = tickLower;
        int24 actualTickUpper = tickUpper;

        // We'll get the actual pool price first, then calculate range around it
        // This is done after we get sqrtPriceX96 below

        // 1. Snapshot balances before transfer
        uint256 balanceMonBefore;
        uint256 balanceKeepBefore;

        if (Currency.unwrap(MON) == address(0)) {
            balanceMonBefore = address(this).balance - msg.value; // Exclude current msg.value
        } else {
            balanceMonBefore = IERC20(Currency.unwrap(MON)).balanceOf(address(this));
        }
        balanceKeepBefore = IERC20(Currency.unwrap(KEEP)).balanceOf(address(this));

        // 2. Transfer tokens to Hook (or validate ETH)
        // For native currency, we require msg.value >= amountMON (allow small buffer for rounding)
        // The actual amount needed will be determined by Uniswap's modifyLiquidity
        if (Currency.unwrap(MON) == address(0)) {
            require(msg.value >= amountMON, "Insufficient MON sent");
            // Log for debugging
            console.log("Received native MON:", msg.value);
            console.log("Requested amountMON:", amountMON);
        } else {
            IERC20(Currency.unwrap(MON)).safeTransferFrom(msg.sender, address(this), amountMON);
        }
        IERC20(Currency.unwrap(KEEP)).safeTransferFrom(msg.sender, address(this), amountKEEP);

        // 3. Check if pool is initialized and get actual pool price
        // CRITICAL: Pool must be initialized BEFORE adding liquidity
        // Use initializePool() function to initialize a new pool first
        (uint160 sqrtPriceX96, int24 currentTick, , ) = poolManager.getSlot0(key.toId());

        // Check if pool is initialized (has valid price and tick)
        if (sqrtPriceX96 == 0 || currentTick == 0) {
            // Pool is not initialized or is broken
            // Try to detect if it's broken by attempting to check if pool entry exists
            // If initialize() would fail, the pool entry exists but is broken
            revert("CellarHook: Pool is not initialized. Call initializePool() first to initialize the pool before adding liquidity.");
        }

        // Pool is properly initialized - use actual values
        poolInitialized = true;
        console.log("Pool exists and is initialized, using actual price and tick");

        // If pool price is way off from expected, warn but continue
        // The range calculation will ensure both tokens are used if price is within range
        int24 targetTick = 10986; // Tick for price = 3.0 (1.0001^10986 ≈ 3.0)
        int24 tickDifference = currentTick > targetTick ? currentTick - targetTick : targetTick - currentTick;
        if (tickDifference > 5000) {
            console.log("WARNING: Pool price is far from expected (tick 10986 = price 3.0)");
            console.logInt(currentTick);
            console.log("This may cause liquidity issues. Consider recreating pool.");
        }

        // Now handle tick range - if 0,0 use reasonable range around ACTUAL current price
        if (tickLower == 0 && tickUpper == 0) {
            // CRITICAL: Range must include current price so both tokens are needed
            // Use ±20000 ticks around ACTUAL current price (approximately ±200% price range)
            // Round DOWN for lower, UP for upper to ensure current price is within range
            int24 rangeTicks = 20000;

            // Round down to nearest tick spacing for lower
            actualTickLower = ((currentTick - rangeTicks) / key.tickSpacing) * key.tickSpacing;
            // Round up to nearest tick spacing for upper
            actualTickUpper = ((currentTick + rangeTicks + key.tickSpacing - 1) / key.tickSpacing) * key.tickSpacing;

            // Ensure ticks are within bounds
            if (actualTickLower < MIN_TICK) actualTickLower = MIN_TICK;
            if (actualTickUpper > MAX_TICK) actualTickUpper = MAX_TICK;

            // CRITICAL: If bounds forced us to edge, adjust to ensure current price is inside
            if (actualTickLower >= currentTick) {
                // Lower bound too high - move it down
                actualTickLower = ((currentTick / key.tickSpacing) - 1) * key.tickSpacing;
                if (actualTickLower < MIN_TICK) actualTickLower = MIN_TICK;
            }
            if (actualTickUpper <= currentTick) {
                // Upper bound too low - move it up
                actualTickUpper = ((currentTick / key.tickSpacing) + 1) * key.tickSpacing;
                if (actualTickUpper > MAX_TICK) actualTickUpper = MAX_TICK;
            }

            // CRITICAL CHECK: Ensure current price is within range (must be true after adjustments)
            require(currentTick > actualTickLower && currentTick < actualTickUpper,
                "CellarHook: Current price must be within liquidity range");

            console.log("Using tick range around current price:");
            console.logInt(currentTick);
            console.logInt(actualTickLower);
            console.logInt(actualTickUpper);
        } else {
            // Validate provided ticks
            require(tickLower < tickUpper, "CellarHook: tickLower must be < tickUpper");
            require(tickLower >= MIN_TICK && tickUpper <= MAX_TICK, "CellarHook: Ticks out of range");
            require(tickLower % key.tickSpacing == 0 && tickUpper % key.tickSpacing == 0, "CellarHook: Ticks must align with tickSpacing");
        }

        // 4. Calculate liquidityDelta from token amounts using ACTUAL pool price
        // Calculate sqrt prices for tick range
        uint160 sqrtPriceAX96 = TickMath.getSqrtPriceAtTick(actualTickLower);
        uint160 sqrtPriceBX96 = TickMath.getSqrtPriceAtTick(actualTickUpper);

        // Ensure sqrtPriceAX96 < sqrtPriceBX96
        if (sqrtPriceAX96 > sqrtPriceBX96) {
            (sqrtPriceAX96, sqrtPriceBX96) = (sqrtPriceBX96, sqrtPriceAX96);
        }

        // Calculate liquidityDelta using Uniswap V4 formulas with ACTUAL pool price
        // CRITICAL: Current price MUST be within range for both tokens to be used
        uint256 liquidity;
        if (sqrtPriceX96 <= sqrtPriceAX96) {
            // Current price is below range - this should NOT happen if range is calculated correctly
            // Revert to prevent single-sided liquidity
            revert("CellarHook: Current price below liquidity range - range calculation error");
        } else if (sqrtPriceX96 < sqrtPriceBX96) {
            // Current price is in range - use both tokens (CORRECT)
            // Calculate liquidity from both amounts and use the one that ensures both tokens are used
            uint256 liquidity0 = _getLiquidityForAmount0(sqrtPriceX96, sqrtPriceBX96, amountMON);
            uint256 liquidity1 = _getLiquidityForAmount1(sqrtPriceAX96, sqrtPriceX96, amountKEEP);

            // Use the minimum to ensure both tokens are used, but verify both will actually be used
            liquidity = liquidity0 < liquidity1 ? liquidity0 : liquidity1;

            // CRITICAL: Verify that using this liquidity will actually use both tokens
            // Calculate what amounts will be used for this liquidity
            uint256 amount0Used = _getAmount0ForLiquidity(sqrtPriceX96, sqrtPriceBX96, liquidity);
            uint256 amount1Used = _getAmount1ForLiquidity(sqrtPriceAX96, sqrtPriceX96, liquidity);

            // Both amounts must be > 0 to ensure two-sided liquidity
            require(amount0Used > 0 && amount1Used > 0, "CellarHook: Liquidity calculation results in single-sided usage");

            console.log("Price in range - using both tokens");
        } else {
            // Current price is above range - this should NOT happen if range is calculated correctly
            // Revert to prevent single-sided liquidity
            revert("CellarHook: Current price above liquidity range - range calculation error");
        }

        require(liquidity > 0, "CellarHook: Invalid liquidity calculation");

        // 5. Prepare params for modifyLiquidity
        ModifyLiquidityParams memory params = ModifyLiquidityParams({
            tickLower: actualTickLower,
            tickUpper: actualTickUpper,
            liquidityDelta: int256(uint256(liquidity)),
            salt: bytes32(0)
        });

        // 6. Call unlock to execute modifyLiquidity via callback
        bytes memory callbackData = abi.encode(CallbackData({
            key: key,
            params: params,
            amountMON: amountMON,
            liquidityDelta: liquidity,
            sender: msg.sender
        }));

        // Verify we have enough balance before calling unlock
        // For native currency, we should have received msg.value
        if (Currency.unwrap(MON) == address(0)) {
            console.log("Balance before unlock:", address(this).balance);
            console.log("Expected msg.value:", msg.value);
            require(address(this).balance >= amountMON, "CellarHook: Contract balance insufficient before unlock");
        }

        poolManager.unlock(callbackData);

        // 7. Refund Excess Tokens
        _refundExcess(balanceMonBefore, balanceKeepBefore);
    }

    function _refundExcess(uint256 balanceMonBefore, uint256 balanceKeepBefore) internal {
        uint256 balanceMonAfter;
        uint256 balanceKeepAfter;

        if (Currency.unwrap(MON) == address(0)) {
            balanceMonAfter = address(this).balance;
            // Refund excess native MON
            if (balanceMonAfter > balanceMonBefore) {
                uint256 refundMON = balanceMonAfter - balanceMonBefore;
                if (refundMON > 0) {
                    (bool success, ) = payable(msg.sender).call{value: refundMON}("");
                    require(success, "CellarHook: Failed to refund excess MON");
                }
            }
        } else {
            balanceMonAfter = IERC20(Currency.unwrap(MON)).balanceOf(address(this));
            if (balanceMonAfter > balanceMonBefore) {
                uint256 refundMON = balanceMonAfter - balanceMonBefore;
                if (refundMON > 0) {
                    IERC20(Currency.unwrap(MON)).safeTransfer(msg.sender, refundMON);
                }
            }
        }
        balanceKeepAfter = IERC20(Currency.unwrap(KEEP)).balanceOf(address(this));
        if (balanceKeepAfter > balanceKeepBefore) {
            uint256 refundKEEP = balanceKeepAfter - balanceKeepBefore;
            if (refundKEEP > 0) {
                IERC20(Currency.unwrap(KEEP)).safeTransfer(msg.sender, refundKEEP);
            }
        }
    }

    /// @notice Callback called by PoolManager.unlock
    /// @param data Encoded CallbackData
    /// @return bytes Empty bytes
    function unlockCallback(bytes calldata data) external onlyPoolManager returns (bytes memory) {
        CallbackData memory callbackData = abi.decode(data, (CallbackData));

        // 1. Get total liquidity BEFORE adding (to calculate proportional LP tokens)
        uint128 totalLiquidityBefore = poolManager.getLiquidity(callbackData.key.toId());
        uint256 totalSupplyBefore = totalSupply();

        // 2. Call modifyLiquidity (this adds liquidity to the pool)
        (BalanceDelta callerDelta, ) = poolManager.modifyLiquidity(callbackData.key, callbackData.params, "");

        // 3. Settle balance delta - handle token transfers
        _settleBalanceDelta(callbackData.key, callerDelta);

        // 4. Get total liquidity AFTER adding
        uint128 totalLiquidityAfter = poolManager.getLiquidity(callbackData.key.toId());
        uint128 liquidityDelta = totalLiquidityAfter - totalLiquidityBefore;

        // 5. Mint LP Tokens to User - proportional to liquidity delta
        // This ensures LP tokens represent actual pool shares, not fixed 1:1 with MON
        uint256 lpTokens;
        if (totalSupplyBefore == 0) {
            // First mint: Use liquidity delta directly (establishes 1:1 ratio with liquidity units)
            // This means first LP tokens are worth the liquidity they represent
            lpTokens = uint256(liquidityDelta);
        } else {
            // Subsequent mints: Proportional to existing liquidity
            // Formula: lpTokens = (liquidityDelta * totalSupplyBefore) / totalLiquidityBefore
            // This maintains the ratio: new LP tokens represent the same % of pool as liquidity added
            require(totalLiquidityBefore > 0, "CellarHook: Invalid pool state");

            // Calculate proportional LP tokens
            // Use checked math: (liquidityDelta * totalSupplyBefore) / totalLiquidityBefore
            lpTokens = (uint256(liquidityDelta) * totalSupplyBefore) / uint256(totalLiquidityBefore);

            // Ensure we mint at least 1 wei if liquidityDelta > 0 (rounding protection)
            if (lpTokens == 0 && liquidityDelta > 0) {
                lpTokens = 1;
            }
        }

        _mint(callbackData.sender, lpTokens);

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

    /// @notice Calculate amount0 needed for given liquidity when price is in range
    /// Formula: amount0 = L * (sqrt(P_upper) - sqrt(P_current)) / (sqrt(P_upper) * sqrt(P_current) / 2^96)
    /// Inverse of _getLiquidityForAmount0
    function _getAmount0ForLiquidity(uint160 sqrtPriceCurrentX96, uint160 sqrtPriceBX96, uint256 liquidity) internal pure returns (uint256) {
        if (sqrtPriceCurrentX96 > sqrtPriceBX96) {
            (sqrtPriceCurrentX96, sqrtPriceBX96) = (sqrtPriceBX96, sqrtPriceCurrentX96);
        }
        uint256 numerator = liquidity * uint256(sqrtPriceBX96 - sqrtPriceCurrentX96) * 2**96;
        uint256 denominator = uint256(sqrtPriceBX96) * uint256(sqrtPriceCurrentX96);
        return numerator / denominator;
    }

    /// @notice Calculate amount1 needed for given liquidity when price is in range
    /// Formula: amount1 = L * (sqrt(P_current) - sqrt(P_lower)) / 2^96
    /// Inverse of _getLiquidityForAmount1
    function _getAmount1ForLiquidity(uint160 sqrtPriceAX96, uint160 sqrtPriceCurrentX96, uint256 liquidity) internal pure returns (uint256) {
        if (sqrtPriceAX96 > sqrtPriceCurrentX96) {
            (sqrtPriceAX96, sqrtPriceCurrentX96) = (sqrtPriceCurrentX96, sqrtPriceAX96);
        }
        return (liquidity * uint256(sqrtPriceCurrentX96 - sqrtPriceAX96)) / 2**96;
    }

    event DebugSettle(int128 amount0, int128 amount1);



    error DebugError(int128 a0, int128 a1);

    /// @notice Settles balance delta by transferring tokens to/from PoolManager
    /// @notice Settles balance delta by transferring tokens to/from PoolManager
    /// @dev settle() without parameters only settles the last transferred currency
    /// @dev For native currency, use settle{value: amount}() which settles native
    /// @dev For ERC20, transfer then call settle() which settles the last transferred currency
    function _settleBalanceDelta(PoolKey memory key, BalanceDelta delta) internal {
        // Extract amounts from BalanceDelta using BalanceDeltaLibrary
        int128 amount0 = BalanceDeltaLibrary.amount0(delta);
        int128 amount1 = BalanceDeltaLibrary.amount1(delta);

        console.log("Settle Delta:");
        console.logInt(amount0);
        console.logInt(amount1);

        // Collect currencies that need to be settled
            Currency currency0 = key.currency0;
        Currency currency1 = key.currency1;
        bool needsNativeSettle = false;
        uint256 nativeAmount = 0;
        bool needsERC20Settle0 = false;
        uint256 erc20Amount0 = 0;
        bool needsERC20Settle1 = false;
        uint256 erc20Amount1 = 0;

        // Check currency0
            if (amount0 < 0) {
                uint256 amountToSettle = uint256(uint128(-amount0));
                if (Currency.unwrap(currency0) == address(0)) {
                needsNativeSettle = true;
                nativeAmount = amountToSettle;
                uint256 currentBalance = address(this).balance;
                console.log("Native settlement check:");
                console.log("  Required:", amountToSettle);
                console.log("  Available:", currentBalance);
                require(currentBalance >= amountToSettle, string.concat(
                    "CellarHook: Insufficient native balance. Required: ",
                    Strings.toString(amountToSettle),
                    ", Available: ",
                    Strings.toString(currentBalance)
                ));
                } else {
                needsERC20Settle0 = true;
                erc20Amount0 = amountToSettle;
                uint256 balance = IERC20(Currency.unwrap(currency0)).balanceOf(address(this));
                require(balance >= amountToSettle, "CellarHook: Insufficient ERC20 balance");
                }
            } else if (amount0 > 0) {
                uint256 amountToTake = uint256(uint128(amount0));
                poolManager.take(currency0, address(this), amountToTake);
        }

        // Check currency1
            if (amount1 < 0) {
                uint256 amountToSettle = uint256(uint128(-amount1));
            needsERC20Settle1 = true;
            erc20Amount1 = amountToSettle;
            uint256 balance = IERC20(Currency.unwrap(currency1)).balanceOf(address(this));
            require(balance >= amountToSettle, "CellarHook: Insufficient KEEP balance");
            } else if (amount1 > 0) {
                uint256 amountToTake = uint256(uint128(amount1));
                poolManager.take(currency1, address(this), amountToTake);
            }

        // Settle ERC20 currencies first (sync, transfer, then settle)
        // settle() without parameters settles the last transferred currency
        if (needsERC20Settle0) {
            poolManager.sync(currency0); // Sync before settling
            IERC20(Currency.unwrap(currency0)).safeTransfer(address(poolManager), erc20Amount0);
            poolManager.settle();
        }
        if (needsERC20Settle1) {
            poolManager.sync(currency1); // Sync before settling
            IERC20(Currency.unwrap(currency1)).safeTransfer(address(poolManager), erc20Amount1);
            poolManager.settle();
        }

        // Settle native currency last (sync, then settle with value)
        if (needsNativeSettle) {
            poolManager.sync(currency0); // Sync native currency before settling
            poolManager.settle{value: nativeAmount}();
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

        // 3. Setup new auction (glaze-like: use initPrice, not paymentAmount)
        // This ensures price grows over time even if raided at floor
        uint256 newInitPrice = slot0Cache.initPrice * priceMultiplier / PRICE_MULTIPLIER_SCALE;

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

    /**
     * @notice Manually collect protocol fees from PoolManager and add to pot
     * @dev Can be called by anyone to collect accumulated protocol fees
     * @dev This is useful if protocol fees accumulate but afterSwap doesn't collect them
     */
    function collectProtocolFeesToPot() external {
        PoolKey memory key = _getPoolKey();
        _collectProtocolFeesToPot(key);
    }

    /**
     * @notice Get the pool key for this hook's pool
     * @return The PoolKey struct
     */
    function _getPoolKey() internal view returns (PoolKey memory) {
        Currency currency0 = MON < KEEP ? MON : KEEP;
        Currency currency1 = MON < KEEP ? KEEP : MON;

        return PoolKey({
            currency0: currency0,
            currency1: currency1,
            fee: 10000, // 1.0% fee
            tickSpacing: 200,
            hooks: IHooks(address(this))
        });
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
