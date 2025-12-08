
// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

import "@openzeppelin/contracts-upgradeable/access/OwnableUpgradeable.sol";
import "@openzeppelin/contracts-upgradeable/proxy/utils/UUPSUpgradeable.sol";
import "@openzeppelin/contracts/token/ERC20/IERC20.sol";
import "@openzeppelin/contracts/token/ERC721/IERC721Receiver.sol";
import "./CellarToken.sol";

// Minimal Interface for Position Manager
interface INonfungiblePositionManager {
    struct DecreaseLiquidityParams {
        uint256 tokenId;
        uint128 liquidity;
        uint256 amount0Min;
        uint256 amount1Min;
        uint256 deadline;
    }

    struct MintParams {
        address token0;
        address token1;
        uint24 fee;
        int24 tickLower;
        int24 tickUpper;
        uint256 amount0Desired;
        uint256 amount1Desired;
        uint256 amount0Min;
        uint256 amount1Min;
        address recipient;
        uint256 deadline;
    }

    struct IncreaseLiquidityParams {
        uint256 tokenId;
        uint256 amount0Desired;
        uint256 amount1Desired;
        uint256 amount0Min;
        uint256 amount1Min;
        uint256 deadline;
    }

    struct CollectParams {
        uint256 tokenId;
        address recipient;
        uint128 amount0Max;
        uint128 amount1Max;
    }

    function decreaseLiquidity(DecreaseLiquidityParams calldata params) external payable returns (uint256 amount0, uint256 amount1);
    function mint(MintParams calldata params) external payable returns (uint256 tokenId, uint128 liquidity, uint256 amount0, uint256 amount1);
    function increaseLiquidity(IncreaseLiquidityParams calldata params) external payable returns (uint128 liquidity, uint256 amount0, uint256 amount1);
    function collect(CollectParams calldata params) external payable returns (uint256 amount0, uint256 amount1);
    function burn(uint256 tokenId) external payable;
    function positions(uint256 tokenId) external view returns (uint96 nonce, address operator, address token0, address token1, uint24 fee, int24 tickLower, int24 tickUpper, uint128 liquidity, uint256 feeGrowthInside0LastX128, uint256 feeGrowthInside1LastX128, uint128 tokensOwed0, uint128 tokensOwed1);
}

contract TheCellarV3 is Initializable, OwnableUpgradeable, UUPSUpgradeable, IERC721Receiver {

    INonfungiblePositionManager public positionManager;
    CellarToken public cellarToken;

    uint256 public constant POOL_FEE = 10000; // 1%
    int24 public constant TICK_SPACING = 200;

    // Dutch Auction Constants
    uint256 public constant MIN_EPOCH_PERIOD = 1 hours;
    uint256 public constant MAX_EPOCH_PERIOD = 365 days;
    uint256 public constant MIN_PRICE_MULTIPLIER = 1.1e18; // 110%
    uint256 public constant MAX_PRICE_MULTIPLIER = 3e18; // 300%
    uint256 public constant ABS_MIN_INIT_PRICE = 1e18; // 1 MON minimum
    uint256 public constant ABS_MAX_INIT_PRICE = type(uint192).max;
    uint256 public constant PRICE_MULTIPLIER_SCALE = 1e18;

    // The single NFT Position ID this Cellar manages
    uint256 public tokenId;

    // Pot Balance (fees collected)
    // token0 = WMON (usually), token1 = KEEP
    address public wmon;
    address public keepToken;

    uint256 public potBalanceMON;
    uint256 public potBalanceKEEP;

    // Track total liquidity to calculate proportional fee shares
    uint256 public totalLiquidity;

    // Deployer address that receives all swap fees
    address public deployerAddress;

    // Dutch Auction State
    uint256 public epochPeriod;
    uint256 public priceMultiplier; // Legacy - kept for compatibility, but not used for new price calculation
    uint256 public minInitPrice;

    struct Slot0 {
        uint8 locked; // 1 if unlocked, 2 if locked
        uint16 epochId; // intentionally overflowable
        uint192 initPrice;
        uint40 startTime;
    }

    Slot0 public slot0;

    error Reentrancy();

    modifier nonReentrant() {
        if (slot0.locked == 2) revert Reentrancy();
        slot0.locked = 2;
        _;
        slot0.locked = 1;
    }

    modifier nonReentrantView() {
        if (slot0.locked == 2) revert Reentrancy();
        _;
    }

    event LiquidityAdded(address indexed user, uint256 amount0, uint256 amount1, uint256 liquidityMinted);
    event LiquidityRemoved(address indexed user, uint256 liquidityBurned, uint256 amount0, uint256 amount1, uint256 feesMon, uint256 feesKeep);
    event FeesCollected(uint256 amount0, uint256 amount1);
    event Raid(address indexed user, uint256 lpBurned, uint256 monPayout, uint256 keepPayout, uint256 newInitPrice, uint256 newEpochId);

    /// @custom:oz-upgrades-unsafe-allow constructor
    constructor() {
        _disableInitializers();
    }

    function initialize(address _positionManager, address _cellarToken, address _wmon, address _keepToken, address _deployerAddress) public initializer {
        __Ownable_init(msg.sender);
        __UUPSUpgradeable_init();

        positionManager = INonfungiblePositionManager(_positionManager);
        cellarToken = CellarToken(_cellarToken);
        wmon = _wmon;
        keepToken = _keepToken;
        deployerAddress = _deployerAddress;
    }

    function _authorizeUpgrade(address newImplementation) internal override onlyOwner {}

    function setConfig(address _wmon, address _keepToken) external onlyOwner {
        wmon = _wmon;
        keepToken = _keepToken;
    }

    /**
     * @notice Emergency function to drain pot (owner only).
     * @dev Use this if raid() fails due to harvest() issues.
     */
    function emergencyDrainPot(address recipient) external onlyOwner {
        uint256 serveMon = potBalanceMON;
        uint256 serveKeep = potBalanceKEEP;

        potBalanceMON = 0;
        potBalanceKEEP = 0;

        if (serveMon > 0) IERC20(wmon).transfer(recipient, serveMon);
        if (serveKeep > 0) IERC20(keepToken).transfer(recipient, serveKeep);

        // Emergency drain doesn't update auction state, so pass current values or 0
        Slot0 memory slot0Cache = slot0;
        uint256 currentInitPrice = slot0Cache.epochId > 0 ? slot0Cache.initPrice : 0;
        uint256 currentEpochId = slot0Cache.epochId;

        emit Raid(recipient, 0, serveMon, serveKeep, currentInitPrice, currentEpochId);
    }

    /**
     * @notice Adds liquidity to the Cellar (Uniswap V3 Position).
     * @dev User must approve tokens first.
     */
    /**
     * @notice Adds liquidity to the Cellar (Uniswap V3 Position).
     * @dev User must approve tokens first.
     */
    function addLiquidity(uint256 amountMonDesired, uint256 amountKeepDesired) external returns (uint256 liquidity) {
        // 1. Transfer tokens from user
        if (amountMonDesired > 0) IERC20(wmon).transferFrom(msg.sender, address(this), amountMonDesired);
        if (amountKeepDesired > 0) IERC20(keepToken).transferFrom(msg.sender, address(this), amountKeepDesired);

        // 2. Approve PositionManager
        IERC20(wmon).approve(address(positionManager), amountMonDesired);
        IERC20(keepToken).approve(address(positionManager), amountKeepDesired);

        // 3. Determine Token Order
        bool wmonIsToken0 = wmon < keepToken;
        address token0 = wmonIsToken0 ? wmon : keepToken;
        address token1 = wmonIsToken0 ? keepToken : wmon;

        uint256 amount0Desired = wmonIsToken0 ? amountMonDesired : amountKeepDesired;
        uint256 amount1Desired = wmonIsToken0 ? amountKeepDesired : amountMonDesired;

        uint256 amount0;
        uint256 amount1;

        if (tokenId == 0) {
            // First time: Mint new position
            INonfungiblePositionManager.MintParams memory params = INonfungiblePositionManager.MintParams({
                token0: token0,
                token1: token1,
                fee: 10000,
                tickLower: -887200,
                tickUpper: 887200,
                amount0Desired: amount0Desired,
                amount1Desired: amount1Desired,
                amount0Min: 0,
                amount1Min: 0,
                recipient: address(this),
                deadline: block.timestamp
            });

            (tokenId, liquidity, amount0, amount1) = positionManager.mint(params);
        } else {
            // Increase existing position
            INonfungiblePositionManager.IncreaseLiquidityParams memory params = INonfungiblePositionManager.IncreaseLiquidityParams({
                tokenId: tokenId,
                amount0Desired: amount0Desired,
                amount1Desired: amount1Desired,
                amount0Min: 0,
                amount1Min: 0,
                deadline: block.timestamp
            });

            (liquidity, amount0, amount1) = positionManager.increaseLiquidity(params);
        }

        // 4. Mint CellarTokens (CLP) 1:1 with Liquidity amount
        cellarToken.mint(msg.sender, uint256(liquidity));
        totalLiquidity += uint256(liquidity);

        // 5. Refund unused tokens (Logic matches sorted tokens)
        uint256 usedMon = wmonIsToken0 ? amount0 : amount1;
        uint256 usedKeep = wmonIsToken0 ? amount1 : amount0;

        if (usedMon < amountMonDesired) IERC20(wmon).transfer(msg.sender, amountMonDesired - usedMon);
        if (usedKeep < amountKeepDesired) IERC20(keepToken).transfer(msg.sender, amountKeepDesired - usedKeep);

        emit LiquidityAdded(msg.sender, usedMon, usedKeep, liquidity);
    }

    /**
     * @notice Collects all fees from the V3 position and sends to deployer address.
     */
    /**
     * @notice Collects all fees from the V3 position and sends to deployer address.
     * @dev Restricted to owner (manual capability only).
     */
    function harvest() public onlyOwner {
        if (tokenId == 0) return;
        require(deployerAddress != address(0), "Deployer address not set");

        INonfungiblePositionManager.CollectParams memory params = INonfungiblePositionManager.CollectParams({
            tokenId: tokenId,
            recipient: deployerAddress, // Send directly to deployer address from .env
            amount0Max: type(uint128).max,
            amount1Max: type(uint128).max
        });

        (uint256 collected0, uint256 collected1) = positionManager.collect(params);

        bool wmonIsToken0 = wmon < keepToken;
        uint256 collectedMon = wmonIsToken0 ? collected0 : collected1;
        uint256 collectedKeep = wmonIsToken0 ? collected1 : collected0;

        emit FeesCollected(collectedMon, collectedKeep);
    }

    /**
     * @notice Recover Liquidity (Burn CLP -> Get Principal + 90% of Fees).
     * @param lpAmount Amount of CLP to burn.
     * @dev Collects user's proportional share of fees: 90% to user, 10% to pot.
     */
    function withdraw(uint256 lpAmount) external {
        require(tokenId != 0, "No position");
        require(lpAmount > 0, "Zero amount");
        require(totalLiquidity >= lpAmount, "Insufficient total liquidity");

        // Check actual position liquidity before attempting withdrawal
        (,,,,,,,uint128 positionLiquidity,,,,) = positionManager.positions(tokenId);
        require(positionLiquidity > 0, "No liquidity in position");

        // Ensure we don't try to withdraw more than the position has
        // This can happen if CLP was minted incorrectly or liquidity was removed without burning CLP
        uint256 maxWithdrawable = positionLiquidity < totalLiquidity ? uint256(positionLiquidity) : totalLiquidity;
        require(lpAmount <= maxWithdrawable, "Insufficient position liquidity");

        // Check for uint128 overflow
        require(lpAmount <= type(uint128).max, "Amount exceeds uint128 max");

        // 1. Burn CLP from User
        cellarToken.transferFrom(msg.sender, address(this), lpAmount);
        cellarToken.burn(address(this), lpAmount);
        totalLiquidity -= lpAmount;

        // 2. Remove Liquidity from V3
        // Safe cast: we already checked lpAmount <= type(uint128).max and lpAmount <= maxWithdrawable
        uint128 liquidityToRemove = uint128(lpAmount);

        INonfungiblePositionManager.DecreaseLiquidityParams memory params = INonfungiblePositionManager.DecreaseLiquidityParams({
            tokenId: tokenId,
            liquidity: liquidityToRemove,
            amount0Min: 0,
            amount1Min: 0,
            deadline: block.timestamp
        });

        (uint256 amount0, uint256 amount1) = positionManager.decreaseLiquidity(params);

        // 3. Read position to get current fee state BEFORE collecting
        (,,,,,,, ,,,uint128 tokensOwed0Before,uint128 tokensOwed1Before) = positionManager.positions(tokenId);

        // 4. Calculate user's proportional share of total fees based on their liquidity
        // User owns (lpAmount / totalLiquidity) of the position
        // Note: totalLiquidity was just decreased, so we use (totalLiquidity + lpAmount) which is the pre-burn total
        uint256 totalLiquidityBefore = totalLiquidity + lpAmount;

        // Safety check for math
        uint256 userFeeShare0 = totalLiquidityBefore > 0 ? (uint256(tokensOwed0Before) * lpAmount) / totalLiquidityBefore : 0;
        uint256 userFeeShare1 = totalLiquidityBefore > 0 ? (uint256(tokensOwed1Before) * lpAmount) / totalLiquidityBefore : 0;

        // Split fees: 90% to user, 10% to pot
        uint256 userFees0 = (userFeeShare0 * 90) / 100;
        uint256 userFees1 = (userFeeShare1 * 90) / 100;
        uint256 potFees0 = userFeeShare0 - userFees0;
        uint256 potFees1 = userFeeShare1 - userFees1;

        // 5. Collect principal + user's 90% of fees to user
        // Note: amount0/amount1 from decreaseLiquidity are principal amounts
        // We add the user's fee share
        // Check for uint128 overflow when casting
        uint256 totalAmount0 = amount0 + userFees0;
        uint256 totalAmount1 = amount1 + userFees1;

        uint128 amount0Max = totalAmount0 > type(uint128).max ? type(uint128).max : uint128(totalAmount0);
        uint128 amount1Max = totalAmount1 > type(uint128).max ? type(uint128).max : uint128(totalAmount1);

        INonfungiblePositionManager.CollectParams memory collectUserParams = INonfungiblePositionManager.CollectParams({
            tokenId: tokenId,
            recipient: msg.sender,
            amount0Max: amount0Max,
            amount1Max: amount1Max
        });

        positionManager.collect(collectUserParams);

        // 6. Collect 10% of user's fee share to pot (if any)
        // Note: After the first collect, tokensOwed may have decreased, so we check availability
        if (potFees0 > 0 || potFees1 > 0) {
            // Read position again to see what's left after user collection
            (,,,,,,, ,,,uint128 tokensOwed0After,uint128 tokensOwed1After) = positionManager.positions(tokenId);

            // Collect up to the pot's share, but don't exceed what's available
            uint128 potCollect0 = potFees0 > tokensOwed0After ? tokensOwed0After : uint128(potFees0);
            uint128 potCollect1 = potFees1 > tokensOwed1After ? tokensOwed1After : uint128(potFees1);

            if (potCollect0 > 0 || potCollect1 > 0) {
                INonfungiblePositionManager.CollectParams memory collectPotParams = INonfungiblePositionManager.CollectParams({
                    tokenId: tokenId,
                    recipient: address(this),
                    amount0Max: potCollect0,
                    amount1Max: potCollect1
                });

                (uint256 potCollected0, uint256 potCollected1) = positionManager.collect(collectPotParams);

                bool _wmonIsToken0 = wmon < keepToken;
                potBalanceMON += _wmonIsToken0 ? potCollected0 : potCollected1;
                potBalanceKEEP += _wmonIsToken0 ? potCollected1 : potCollected0;
            }
        }

        bool wmonIsToken0 = wmon < keepToken;
        uint256 amountMon = wmonIsToken0 ? amount0 : amount1;
        uint256 amountKeep = wmonIsToken0 ? amount1 : amount0;
        uint256 feesMon = wmonIsToken0 ? userFees0 : userFees1;
        uint256 feesKeep = wmonIsToken0 ? userFees1 : userFees0;

        emit LiquidityRemoved(msg.sender, lpAmount, amountMon, amountKeep, feesMon, feesKeep);
    }

    /**
     * @notice Raid the pot (Burn CLP -> Get Share of Fees).
     * @param lpBid Amount of CLP to burn. Must be >= current auction price.
     */
    function raid(uint256 lpBid) external nonReentrant {
        require(lpBid > 0, "Bid > 0");
        require(epochPeriod > 0, "Auction not initialized");

        Slot0 memory slot0Cache = slot0;

        // Calculate current auction price
        uint256 currentPrice = getPriceFromCache(slot0Cache);
        require(lpBid >= currentPrice, "Bid too low");

        // 1. Burn Bid
        cellarToken.transferFrom(msg.sender, address(this), lpBid);
        cellarToken.burn(address(this), lpBid);

        // 2. Payout (Dump Pot)
        uint256 serveMon = potBalanceMON;
        uint256 serveKeep = potBalanceKEEP;

        potBalanceMON = 0;
        potBalanceKEEP = 0;

        if (serveMon > 0) IERC20(wmon).transfer(msg.sender, serveMon);
        if (serveKeep > 0) IERC20(keepToken).transfer(msg.sender, serveKeep);

        // 3. Setup new auction (use pot size for stable, value-based pricing)
        // Price = potBalanceMON * (100 + potPriceCoefficient) / 100
        // This ensures price STARTS ABOVE pot, then decays down over the epoch
        // Price exceeds pot for majority of hour, creating profitable window when price < pot
        uint256 newInitPrice = 0;
        uint256 coeff = _getPotPriceCoefficient();
        if (coeff > 0) {
            // Use pot-based pricing (new stable model)
            // Formula: newInitPrice = serveMon * (100 + coefficient) / 100
            // Example: pot = 100 MON, coefficient = 30 → initPrice = 130 MON (30% above pot)
            // Price decays from 130 → 1 over epoch period
            // For majority of hour, price > 100 MON (pot value), then becomes profitable
            newInitPrice = serveMon * (100 + coeff) / 100;
        } else {
            // Fallback to legacy multiplier-based pricing if coefficient not set
            newInitPrice = currentPrice * priceMultiplier / PRICE_MULTIPLIER_SCALE;
        }

        // Ensure price is within bounds
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

        emit Raid(msg.sender, lpBid, serveMon, serveKeep, newInitPrice, slot0Cache.epochId);
    }

    /**
     * @notice Get current auction price from cache
     * @param slot0Cache The Slot0 struct containing epoch state
     * @return price The current auction price (decays over time, minimum is minInitPrice)
     */
    function getPriceFromCache(Slot0 memory slot0Cache) internal view returns (uint256) {
        uint256 timePassed = block.timestamp - slot0Cache.startTime;

        if (timePassed > epochPeriod) {
            return minInitPrice;
        }

        uint256 calculatedPrice = slot0Cache.initPrice - slot0Cache.initPrice * timePassed / epochPeriod;
        return calculatedPrice < minInitPrice ? minInitPrice : calculatedPrice;
    }

    /**
     * @notice Get current auction price
     * @return price The current auction price
     */
    function getAuctionPrice() external view nonReentrantView returns (uint256) {
        return getPriceFromCache(slot0);
    }

    /**
     * @notice Get pot price coefficient (virtual function for upgrade contracts to override)
     * @return coefficient The pot price coefficient (0 = use legacy multiplier)
     */
    function _getPotPriceCoefficient() internal view virtual returns (uint256) {
        return 0; // Default: use legacy multiplier
    }

    /**
     * @notice Handle incoming native MON (e.g. from The Office).
     * @dev Wraps MON to WMON and updates pot balance.
     */
    event PotSweetened(address indexed contributor, uint256 amount);

    /**
     * @notice Handle incoming native MON (e.g. from The Office).
     * @dev Wraps MON to WMON and updates pot balance.
     */
    receive() external payable {
        if (msg.value > 0) {
            // Wrap MON -> WMON
            (bool success, ) = wmon.call{value: msg.value}(abi.encodeWithSignature("deposit()"));
            require(success, "WMON deposit failed");

            // Update Accounting
            potBalanceMON += msg.value;

            // Emit event (reusing FeesCollected for simplicity, effectively 0 KEEP collected here)
            emit FeesCollected(msg.value, 0);
        }
    }

    /**
     * @notice Manually add MON to the cellar pot (sweeten the pot)
     * @dev Wraps native MON to WMON and adds to potBalanceMON
     */
    function sweetenPot() external payable {
        require(msg.value > 0, "Must send MON");

        // Wrap native MON to WMON
        (bool success, ) = wmon.call{value: msg.value}(abi.encodeWithSignature("deposit()"));
        require(success, "WMON deposit failed");

        // Add wrapped WMON to pot
        potBalanceMON += msg.value;

        emit PotSweetened(msg.sender, msg.value);
    }

    function onERC721Received(address, address, uint256, bytes calldata) external pure override returns (bytes4) {
        return this.onERC721Received.selector;
    }
}
