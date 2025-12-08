// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

import "./TheCellarV3PriceFix.sol";

/**
 * @title TheCellarV3PotPrice
 * @notice Upgrade to implement pot-based pricing (stable, value-aligned model)
 * @dev This upgrade changes:
 *      - raid() now uses potBalanceMON * (100 + potPriceCoefficient) / 100 for new init price
 *      - Price starts above pot, decays down over epoch (Dutch auction)
 *      - Price exceeds pot for majority of hour, then becomes profitable
 *      - Self-correcting: price tied to actual value in pot
 *
 * @dev Storage compatibility: Inherits from TheCellarV3PriceFix (currently deployed)
 *      to maintain storage layout compatibility. Adds potPriceCoefficient at the end.
 */
contract TheCellarV3PotPrice is TheCellarV3PriceFix {
    // Pot-based pricing coefficient (added at end for storage compatibility)
    // Percentage (10-200) above potBalanceMON for new initPrice
    // Example: 30 = 30% above pot, so if pot = 100 MON, initPrice = 130 MON
    uint256 public potPriceCoefficient;

    /**
     * @notice Override to return pot price coefficient
     */
    function _getPotPriceCoefficient() internal view override returns (uint256) {
        return potPriceCoefficient;
    }

    /**
     * @notice Set pot price coefficient for pot-based pricing
     * @dev Can be called by owner to enable/update pot-based pricing
     * @param _potPriceCoefficient Percentage (10-200) above potBalanceMON for new initPrice
     *        Example: 30 = 30% above pot, so if pot = 100 MON, initPrice = 130 MON
     *        This ensures price starts above pot and decays down, profitable when price < pot
     */
    function setPotPriceCoefficient(uint256 _potPriceCoefficient) external onlyOwner {
        require(_potPriceCoefficient >= 10 && _potPriceCoefficient <= 200, "Coefficient must be between 10 and 200");
        potPriceCoefficient = _potPriceCoefficient;
    }
}

