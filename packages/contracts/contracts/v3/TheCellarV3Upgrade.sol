// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

import "./TheCellarV3.sol";

/**
 * @title TheCellarV3Upgrade
 * @notice Upgrade to add Dutch auction functionality for raid pricing
 * @dev This upgrade adds:
 *      - Dutch auction state variables (already in base contract)
 *      - Initialization function for auction parameters
 *      - Price calculation and enforcement in raid()
 */
contract TheCellarV3Upgrade is TheCellarV3 {

    bool private auctionInitialized;

    error AuctionNotInitialized();

    /**
     * @notice Initialize Dutch auction parameters
     * @dev Can only be called once, by owner
     * @param _initPrice Initial auction price (in CLP tokens)
     * @param _epochPeriod Duration of each epoch in seconds
     * @param _priceMultiplier Multiplier for next epoch price (e.g., 2e18 for 2x) - Legacy, kept for compatibility
     * @param _minInitPrice Minimum floor price (e.g., 1e18 for 1 MON)
     */
    function initializeAuction(
        uint256 _initPrice,
        uint256 _epochPeriod,
        uint256 _priceMultiplier,
        uint256 _minInitPrice
    ) external onlyOwner {
        require(!auctionInitialized, "Auction already initialized");
        require(_initPrice >= _minInitPrice, "Init price too low");
        require(_initPrice <= ABS_MAX_INIT_PRICE, "Init price too high");
        require(_epochPeriod >= MIN_EPOCH_PERIOD && _epochPeriod <= MAX_EPOCH_PERIOD, "Invalid epoch period");
        require(_priceMultiplier >= MIN_PRICE_MULTIPLIER && _priceMultiplier <= MAX_PRICE_MULTIPLIER, "Invalid multiplier");
        require(_minInitPrice >= ABS_MIN_INIT_PRICE && _minInitPrice <= ABS_MAX_INIT_PRICE, "Invalid min init price");

        epochPeriod = _epochPeriod;
        priceMultiplier = _priceMultiplier;
        minInitPrice = _minInitPrice;

        // Initialize slot0 if not already initialized
        if (slot0.epochId == 0) {
            slot0.initPrice = uint192(_initPrice);
            slot0.startTime = uint40(block.timestamp);
            slot0.locked = 1; // Unlocked
            slot0.epochId = 1;
        }

        auctionInitialized = true;
    }


}
