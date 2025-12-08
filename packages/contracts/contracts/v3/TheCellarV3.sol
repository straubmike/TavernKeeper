
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

    event LiquidityAdded(address indexed user, uint256 amount0, uint256 amount1, uint256 liquidityMinted);
    event LiquidityRemoved(address indexed user, uint256 liquidityBurned, uint256 amount0, uint256 amount1, uint256 feesMon, uint256 feesKeep);
    event FeesCollected(uint256 amount0, uint256 amount1);
    event Raid(address indexed user, uint256 lpBurned, uint256 monPayout, uint256 keepPayout);

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

        emit Raid(recipient, 0, serveMon, serveKeep);
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

        // 1. Burn CLP from User
        cellarToken.transferFrom(msg.sender, address(this), lpAmount);
        cellarToken.burn(address(this), lpAmount);
        totalLiquidity -= lpAmount;

        // 2. Remove Liquidity from V3
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
        INonfungiblePositionManager.CollectParams memory collectUserParams = INonfungiblePositionManager.CollectParams({
            tokenId: tokenId,
            recipient: msg.sender,
            amount0Max: uint128(amount0 + userFees0),
            amount1Max: uint128(amount1 + userFees1)
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

                bool wmonIsToken0 = wmon < keepToken;
                potBalanceMON += wmonIsToken0 ? potCollected0 : potCollected1;
                potBalanceKEEP += wmonIsToken0 ? potCollected1 : potCollected0;
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
     * @param lpBid Amount of CLP to burn.
     */
    function raid(uint256 lpBid) external {
         require(lpBid > 0, "Bid > 0");

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

         emit Raid(msg.sender, lpBid, serveMon, serveKeep);
    }

    function onERC721Received(address, address, uint256, bytes calldata) external pure override returns (bytes4) {
        return this.onERC721Received.selector;
    }
}
