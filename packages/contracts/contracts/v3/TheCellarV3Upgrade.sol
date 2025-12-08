// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

import "./TheCellarV3.sol";

interface IWMON {
    function deposit() external payable;
}

/**
 * @title TheCellarV3Upgrade
 * @notice Upgrade to add receive() and sweetenPot() functions for accepting office fees and manual contributions
 */
contract TheCellarV3Upgrade is TheCellarV3 {
    // event PotContributed(address indexed contributor, uint256 amount);
    // event PotSweetened(address indexed contributor, uint256 amount); // Inherited from Base

    /**
     * @notice Receives native MON tokens from office fees and wraps to WMON
     * @dev Called when TavernKeeper sends office fees (15% of office price)
     *      Automatically wraps MON to WMON and adds to potBalanceMON
     */
     /*
    receive() external payable override {
        if (msg.value > 0 && wmon != address(0)) {
            // Wrap native MON to WMON
            IWMON(wmon).deposit{value: msg.value}();

            // Add wrapped WMON to pot
            potBalanceMON += msg.value;

            emit PotContributed(msg.sender, msg.value);
        }
    }
    */

    /**
     * @notice Manually add MON to the cellar pot (sweeten the pot)
     * @dev Wraps native MON to WMON and adds to potBalanceMON
     *      Anyone can call this to contribute to the pot
     */
     /*
    function sweetenPot() external payable {
        require(msg.value > 0, "Must send MON");
        require(wmon != address(0), "WMON not set");

        // Wrap native MON to WMON
        IWMON(wmon).deposit{value: msg.value}();

        // Add wrapped WMON to pot
        potBalanceMON += msg.value;

        emit PotSweetened(msg.sender, msg.value);
    }
    */
}
