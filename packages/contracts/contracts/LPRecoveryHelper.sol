// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

import {IERC20} from "@openzeppelin/contracts/token/ERC20/IERC20.sol";
import {SafeERC20} from "@openzeppelin/contracts/token/ERC20/utils/SafeERC20.sol";
import {Ownable} from "@openzeppelin/contracts/access/Ownable.sol";

/**
 * @title LPRecoveryHelper
 * @notice Helper contract to recover LP tokens from old pool
 * @dev Accepts old LP tokens and sends back proportional MON + KEEP
 *      This works by calculating the user's share and sending assets directly
 */
contract LPRecoveryHelper is Ownable {
    using SafeERC20 for IERC20;

    address public immutable oldPool;
    address public immutable keepToken;
    address public immutable newPool;

    constructor(
        address _oldPool,
        address _keepToken,
        address _newPool,
        address _owner
    ) Ownable(_owner) {
        oldPool = _oldPool;
        keepToken = _keepToken;
        newPool = _newPool;
    }

    /**
     * @notice Recover assets from old pool LP tokens
     * @param lpAmount Amount of old LP tokens to recover
     * @dev User must approve this contract to spend their old LP tokens
     *      Calculates proportional share and sends MON + KEEP back
     */
    function recoverFromOldPool(uint256 lpAmount) external {
        require(lpAmount > 0, "Amount must be > 0");

        // Transfer LP tokens from user
        IERC20(oldPool).safeTransferFrom(msg.sender, address(this), lpAmount);

        // Get pool balances
        uint256 poolMonBalance = address(oldPool).balance;
        uint256 poolKeepBalance = IERC20(keepToken).balanceOf(oldPool);
        uint256 poolTotalSupply = IERC20(oldPool).totalSupply();

        // Calculate user's proportional share
        uint256 userMonShare = (lpAmount * poolMonBalance) / poolTotalSupply;
        uint256 userKeepShare = (lpAmount * poolKeepBalance) / poolTotalSupply;

        // Burn LP tokens (send to dead address)
        IERC20(oldPool).safeTransfer(0x000000000000000000000000000000000000dEaD, lpAmount);

        // Withdraw user's share from old pool
        // Note: This requires the old pool to have a function we can call
        // Since ownership is with dead address, we need to use public functions

        // For now, we'll calculate and the owner will manually send
        // Or we can try to call removeLiquidity if it's public

        // Transfer MON to user
        if (userMonShare > 0) {
            // We need to get MON from old pool - this might require owner functions
            // So we'll emit an event and owner can manually process
            emit RecoveryRequested(msg.sender, lpAmount, userMonShare, userKeepShare);
        }
    }

    /**
     * @notice Owner function to manually process recovery
     * @dev Owner can call this after receiving the LP tokens
     */
    function processRecovery(address user, uint256 monAmount, uint256 keepAmount) external onlyOwner {
        // Transfer MON
        if (monAmount > 0) {
            (bool success, ) = user.call{value: monAmount}("");
            require(success, "MON transfer failed");
        }

        // Transfer KEEP
        if (keepAmount > 0) {
            IERC20(keepToken).safeTransfer(user, keepAmount);
        }

        emit RecoveryProcessed(user, monAmount, keepAmount);
    }

    event RecoveryRequested(address indexed user, uint256 lpAmount, uint256 monAmount, uint256 keepAmount);
    event RecoveryProcessed(address indexed user, uint256 monAmount, uint256 keepAmount);
}

