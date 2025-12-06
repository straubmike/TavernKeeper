// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

import {CellarHook} from "./CellarHook.sol";
import {Currency} from "@uniswap/v4-core/src/types/Currency.sol";
import {IERC20} from "@openzeppelin/contracts/token/ERC20/IERC20.sol";
import {SafeERC20} from "@openzeppelin/contracts/token/ERC20/utils/SafeERC20.sol";

/**
 * @title CellarHookRecovery
 * @notice Temporary upgrade to recover stuck tokens from CellarHook
 * @dev Removes the `!poolInitialized` check from recovery functions
 */
contract CellarHookRecovery is CellarHook {
    using SafeERC20 for IERC20;

    /**
     * @notice Force recover tokens for a user, bypassing initialization check
     * @param user Address to recover tokens for
     * @param lpTokenAmount Amount of LP tokens to burn for recovery
     */
    function forceRecoverTokensForUser(address user, uint256 lpTokenAmount) external onlyOwner nonReentrant {
        // REMOVED: require(!poolInitialized, "CellarHook: Pool already initialized - recovery disabled");
        
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

    /**
     * @notice Recover ALL stuck KEEP tokens to owner (Emergency Drain)
     * @dev Does not burn LP tokens. Just rescues the asset.
     */
    function emergencyDrainKeep() external onlyOwner {
        uint256 balance = IERC20(Currency.unwrap(KEEP)).balanceOf(address(this));
        require(balance > 0, "No KEEP to drain");
        IERC20(Currency.unwrap(KEEP)).safeTransfer(msg.sender, balance);
    }

    /**
     * @notice Recover ALL stuck MON (Native ETH) to owner (Emergency Drain)
     */
    function emergencyDrainMon() external onlyOwner {
        uint256 balance = address(this).balance;
        require(balance > 0, "No MON to drain");
        (bool success, ) = msg.sender.call{value: balance}("");
        require(success, "MON transfer failed");
    }
}
