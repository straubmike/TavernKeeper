// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

import "./TavernKeeperPausable.sol";

/**
 * @title TavernKeeperSetMinPrice1000
 * @notice Upgrade to set minimum office price to 1000 MON (v4.5.0)
 * @dev Overrides _getPriceFromCache and takeOffice to use 1000 MON minimum instead of 100 MON
 *      Extends TavernKeeperPausable to preserve storage layout and pause functionality
 *
 * ════════════════════════════════════════════════════════════════════════════════
 * VERSION TRACKING - READ THIS BEFORE MAKING CHANGES
 * ════════════════════════════════════════════════════════════════════════════════
 *
 * VERSION: v4.5.0
 * DEPLOYED: TBD
 * IMPLEMENTATION: TBD
 * PROXY: 0x56B81A60Ae343342685911bd97D1331fF4fa2d29
 *
 * UPGRADE CHAIN:
 *   TavernKeeperV3 (v4.2.0) → TavernKeeperSetMinPrice (v4.3.0) → TavernKeeperPausable (v4.4.0) → TavernKeeperSetMinPrice1000 (v4.5.0) [CURRENT]
 *
 * ⚠️  CRITICAL RULES FOR UPGRADES:
 *   1. ALWAYS check DEPLOYMENT_TRACKER.md to see what's actually deployed
 *   2. NEVER delete contracts in the active upgrade chain
 *   3. When creating a new upgrade:
 *      a. Create a NEW contract file (e.g., TavernKeeperV4.sol)
 *      b. Extend the CURRENT deployed version (check DEPLOYMENT_TRACKER.md)
 *      c. Update this header with new version info
 *      d. Update DEPLOYMENT_TRACKER.md immediately after deployment
 *      e. DELETE old unused contracts (not in the active chain)
 *   4. Storage layout MUST be preserved - use `npx hardhat storage-layout-diff`
 *   5. Mark functions as `virtual` if they need to be overridden
 *
 * ════════════════════════════════════════════════════════════════════════════════
 */
contract TavernKeeperSetMinPrice1000 is TavernKeeperPausable {

    uint256 private constant NEW_MIN_INIT_PRICE = 1000 ether; // 1000 MON

    /**
     * @notice Override _getPriceFromCache to use 1000 MON minimum
     */
    function _getPriceFromCache(Slot0 memory slot0Cache) internal view override returns (uint256) {
        uint256 timePassed = block.timestamp - slot0Cache.startTime;

        if (timePassed > EPOCH_PERIOD) {
            return NEW_MIN_INIT_PRICE;
        }

        uint256 calculatedPrice = slot0Cache.initPrice - slot0Cache.initPrice * timePassed / EPOCH_PERIOD;
        return calculatedPrice < NEW_MIN_INIT_PRICE ? NEW_MIN_INIT_PRICE : calculatedPrice;
    }

    /**
     * @notice Override takeOffice to use 1000 MON minimum for new init price
     * @dev Still includes pause check via whenNotPaused modifier from parent
     */
    function takeOffice(
        uint256 epochId,
        uint256 deadline,
        uint256 maxPrice,
        string memory uri
    ) public payable virtual override whenNotPaused nonReentrant returns (uint256 price) {
        if (block.timestamp > deadline) revert Expired();

        Slot0 memory slot0Cache = slot0;

        if (epochId != 0 && uint16(epochId) != slot0Cache.epochId) revert EpochIdMismatch();

        price = _getPriceFromCache(slot0Cache);
        if (price > maxPrice) revert MaxPriceExceeded();
        if (msg.value < price) revert("Insufficient payment");

        uint256 excess = msg.value - price;
        if (excess > 0) {
            (bool successRefund, ) = payable(msg.sender).call{value: excess}("");
            require(successRefund, "Refund failed");
        }

        if (price > 0) {
            uint256 totalFee = price * FEE / DIVISOR;
            uint256 minerFee = price - totalFee;

            uint256 devFee = totalFee / 4;
            uint256 cellarFee = totalFee - devFee;

            (bool successDev, ) = payable(owner()).call{value: devFee}("");
            require(successDev, "Dev transfer failed");

            if (treasury != address(0)) {
                (bool successTreasury, ) = payable(treasury).call{value: cellarFee}("");
                require(successTreasury, "Treasury transfer failed");
                emit TreasuryFee(treasury, cellarFee);
            } else {
                (bool successOwner, ) = payable(owner()).call{value: cellarFee}("");
                require(successOwner, "Owner transfer failed");
            }

            if (slot0Cache.miner != address(0)) {
                (bool successMiner, ) = payable(slot0Cache.miner).call{value: minerFee}("");
                require(successMiner, "Miner transfer failed");
                emit PreviousKingPaid(slot0Cache.miner, minerFee);
            }
        }

        uint256 newInitPrice = price * NEW_PRICE_MULTIPLIER / PRECISION;

        if (newInitPrice > ABS_MAX_INIT_PRICE) {
            newInitPrice = ABS_MAX_INIT_PRICE;
        } else if (newInitPrice < NEW_MIN_INIT_PRICE) {
            newInitPrice = NEW_MIN_INIT_PRICE;
        }

        uint256 mineTime = block.timestamp - slot0Cache.startTime;
        uint256 minedAmount = mineTime * slot0Cache.dps;

        if (keepToken != address(0) && slot0Cache.miner != address(0)) {
            IKeepToken(keepToken).mint(slot0Cache.miner, minedAmount);
            emit OfficeEarningsClaimed(slot0Cache.miner, minedAmount);
        }

        unchecked {
            slot0Cache.epochId++;
        }
        slot0Cache.initPrice = uint192(newInitPrice);
        slot0Cache.startTime = uint40(block.timestamp);
        officeLastClaimTime = 0;
        slot0Cache.miner = msg.sender;
        slot0Cache.dps = _getDpsFromTime(block.timestamp);
        slot0Cache.uri = uri;

        slot0 = slot0Cache;

        emit OfficeTaken(msg.sender, price, price, uri);

        return price;
    }
}

