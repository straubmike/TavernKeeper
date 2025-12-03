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

contract CellarHook is IHooks, ERC20Upgradeable, OwnableUpgradeable, UUPSUpgradeable {
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

    event Raid(address indexed raider, uint256 paymentAmount, uint256 rewardAmount, uint256 newInitPrice, uint256 newEpochId);
    event PotContributed(address indexed contributor, uint256 amount);

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

    function addLiquidity(PoolKey calldata key, uint256 amountMON, uint256 amountKEEP, int24 tickLower, int24 tickUpper) external payable {
        // Validate 1:3 MON:KEEP ratio
        require(amountKEEP == amountMON * 3, "CellarHook: Invalid MON:KEEP ratio (must be 1:3)");

        // 1. Transfer tokens to Hook
        if (Currency.unwrap(MON) == address(0)) {
            require(msg.value == amountMON, "Incorrect MON");
        } else {
            IERC20(Currency.unwrap(MON)).safeTransferFrom(msg.sender, address(this), amountMON);
        }
        IERC20(Currency.unwrap(KEEP)).safeTransferFrom(msg.sender, address(this), amountKEEP);

        // 2. Approve PoolManager
        if (Currency.unwrap(MON) != address(0)) IERC20(Currency.unwrap(MON)).forceApprove(address(poolManager), amountMON);
        IERC20(Currency.unwrap(KEEP)).forceApprove(address(poolManager), amountKEEP);

        // 3. Add Liquidity to PoolManager (Simplified placeholder)
        // poolManager.modifyLiquidity(...)

        // 4. Mint LP Tokens to User
        // Mint 1 LP per 1 MON (with 3 KEEP required per MON to maintain 1:3 ratio)
        uint256 liquidityMinted = amountMON;

        _mint(msg.sender, liquidityMinted);
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
}
