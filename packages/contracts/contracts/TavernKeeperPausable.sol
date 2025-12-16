// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

import "./TavernKeeperSetMinPrice.sol";

/**
 * @title TavernKeeperPausable
 * @notice Upgrade to add pause functionality for takeOffice and emergency transfer to deployer (v4.4.0)
 * @dev Adds simple pause mechanism, pause/unpause functions, and emergencyTransferToDeployer
 *      Extends TavernKeeperSetMinPrice to preserve storage layout
 *
 * ════════════════════════════════════════════════════════════════════════════════
 * VERSION TRACKING - READ THIS BEFORE MAKING CHANGES
 * ════════════════════════════════════════════════════════════════════════════════
 *
 * VERSION: v4.4.0
 * DEPLOYED: 2025-01-10
 * IMPLEMENTATION: TBD
 * PROXY: 0x56B81A60Ae343342685911bd97D1331fF4fa2d29
 *
 * UPGRADE CHAIN:
 *   TavernKeeperV3 (v4.2.0) → TavernKeeperSetMinPrice (v4.3.0) → TavernKeeperPausable (v4.4.0) [CURRENT]
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
contract TavernKeeperPausable is TavernKeeperSetMinPrice {

    // Storage variable added at the end to preserve layout
    // Initialized to false (unpaused) by default
    bool private _paused;

    error Paused();

    event OfficePaused(address indexed by);
    event OfficeUnpaused(address indexed by);
    event EmergencyTransfer(address indexed from, address indexed to, address indexed by);

    /**
     * @notice Check if contract is paused
     * @return bool True if paused, false otherwise
     */
    function paused() public view returns (bool) {
        return _paused;
    }

    /**
     * @notice Modifier to check if contract is not paused
     */
    modifier whenNotPaused() {
        if (_paused) revert Paused();
        _;
    }

    /**
     * @notice Pause the takeOffice function
     * @dev Only owner can pause. When paused, takeOffice will revert.
     */
    function pause() public onlyOwner {
        _paused = true;
        emit OfficePaused(msg.sender);
    }

    /**
     * @notice Unpause the takeOffice function
     * @dev Only owner can unpause. Restores normal operation.
     */
    function unpause() public onlyOwner {
        _paused = false;
        emit OfficeUnpaused(msg.sender);
    }

    /**
     * @notice Emergency function to transfer office to deployer without payment
     * @dev Only owner can call. Transfers office to owner() (deployer) without any payment.
     *      Mints KEEP rewards to previous manager if applicable.
     *      Does NOT require pause to be active.
     * @param uri Optional message/URI for the office
     */
    function emergencyTransferToDeployer(string memory uri) public onlyOwner {
        Slot0 memory slot0Cache = slot0;
        address previousMiner = slot0Cache.miner;
        address deployer = owner();

        // If deployer is already the manager, do nothing
        if (previousMiner == deployer) {
            return;
        }

        // Mint KEEP rewards to previous manager if applicable
        if (keepToken != address(0) && previousMiner != address(0)) {
            uint40 claimStartTime = officeLastClaimTime > 0
                ? officeLastClaimTime
                : slot0Cache.startTime;

            uint256 mineTime = block.timestamp - claimStartTime;
            uint256 minedAmount = mineTime * slot0Cache.dps;

            if (minedAmount > 0) {
                IKeepToken(keepToken).mint(previousMiner, minedAmount);
                emit OfficeEarningsClaimed(previousMiner, minedAmount);
            }
        }

        // Update slot0 to transfer to deployer
        unchecked {
            slot0Cache.epochId++;
        }
        // Keep the same initPrice and startTime (no price change)
        officeLastClaimTime = 0;
        slot0Cache.miner = deployer;
        slot0Cache.dps = _getDpsFromTime(block.timestamp);
        slot0Cache.uri = uri;

        slot0 = slot0Cache;

        emit EmergencyTransfer(previousMiner, deployer, msg.sender);
        emit OfficeTaken(deployer, 0, 0, uri); // price = 0, paidAmount = 0
    }

    /**
     * @notice Pause and transfer office to deployer in one transaction
     * @dev Convenience function that pauses and transfers to deployer
     * @param uri Optional message/URI for the office
     */
    function pauseAndTransferToDeployer(string memory uri) public onlyOwner {
        pause();
        emergencyTransferToDeployer(uri);
    }

    /**
     * @notice Override takeOffice to add pause check
     * @dev Reverts if contract is paused
     */
    function takeOffice(
        uint256 epochId,
        uint256 deadline,
        uint256 maxPrice,
        string memory uri
    ) public payable virtual override whenNotPaused returns (uint256 price) {
        return super.takeOffice(epochId, deadline, maxPrice, uri);
    }
}

