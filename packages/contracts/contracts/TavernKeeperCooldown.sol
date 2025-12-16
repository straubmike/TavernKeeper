// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

import "./TavernKeeperSetMinPrice1000.sol";

/**
 * @title TavernKeeperCooldown
 * @notice Upgrade to add 24-hour cooldown per wallet for taking office (v4.6.0)
 * @dev Adds mapping to track last claim time per address and enforces 24-hour cooldown
 *      Extends TavernKeeperSetMinPrice1000 to preserve storage layout
 *
 * ════════════════════════════════════════════════════════════════════════════════
 * VERSION TRACKING - READ THIS BEFORE MAKING CHANGES
 * ════════════════════════════════════════════════════════════════════════════════
 *
 * VERSION: v4.6.0
 * DEPLOYED: TBD
 * IMPLEMENTATION: TBD
 * PROXY: 0x56B81A60Ae343342685911bd97D1331fF4fa2d29
 *
 * UPGRADE CHAIN:
 *   TavernKeeperV3 (v4.2.0)
 *   → TavernKeeperSetMinPrice (v4.3.0)
 *   → TavernKeeperPausable (v4.4.0)
 *   → TavernKeeperSetMinPrice1000 (v4.5.0)
 *   → TavernKeeperCooldown (v4.6.0) [CURRENT]
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
contract TavernKeeperCooldown is TavernKeeperSetMinPrice1000 {

    // Storage variable added at the end to preserve layout
    mapping(address => uint256) private _lastOfficeClaimTime;

    uint256 public constant COOLDOWN_PERIOD = 24 hours;

    error CooldownActive(uint256 timeRemaining);
    event OfficeCooldownSet(address indexed wallet, uint256 claimTime);

    /**
     * @notice Get the last time an address claimed the office
     * @param wallet The wallet address to check
     * @return The timestamp of the last claim, or 0 if never claimed
     */
    function getLastOfficeClaimTime(address wallet) public view returns (uint256) {
        return _lastOfficeClaimTime[wallet];
    }

    /**
     * @notice Check if a wallet can claim the office (cooldown expired)
     * @param wallet The wallet address to check
     * @return canClaim True if cooldown has expired
     * @return timeRemaining Seconds remaining in cooldown (0 if can claim)
     */
    function canClaimOffice(address wallet) public view returns (bool canClaim, uint256 timeRemaining) {
        uint256 lastClaim = _lastOfficeClaimTime[wallet];
        if (lastClaim == 0) {
            return (true, 0);
        }

        uint256 timeSinceLastClaim = block.timestamp - lastClaim;
        if (timeSinceLastClaim >= COOLDOWN_PERIOD) {
            return (true, 0);
        }

        timeRemaining = COOLDOWN_PERIOD - timeSinceLastClaim;
        return (false, timeRemaining);
    }

    /**
     * @notice Override takeOffice to add 24-hour cooldown check per wallet
     * @dev Reverts if wallet has claimed office within last 24 hours
     */
    function takeOffice(
        uint256 epochId,
        uint256 deadline,
        uint256 maxPrice,
        string memory uri
    ) public payable virtual override whenNotPaused nonReentrant returns (uint256 price) {
        // Check cooldown
        uint256 lastClaim = _lastOfficeClaimTime[msg.sender];
        if (lastClaim > 0) {
            uint256 timeSinceLastClaim = block.timestamp - lastClaim;
            if (timeSinceLastClaim < COOLDOWN_PERIOD) {
                uint256 timeRemaining = COOLDOWN_PERIOD - timeSinceLastClaim;
                revert CooldownActive(timeRemaining);
            }
        }

        // Call parent implementation
        price = super.takeOffice(epochId, deadline, maxPrice, uri);

        // Update last claim time for this wallet
        _lastOfficeClaimTime[msg.sender] = block.timestamp;
        emit OfficeCooldownSet(msg.sender, block.timestamp);

        return price;
    }
}

