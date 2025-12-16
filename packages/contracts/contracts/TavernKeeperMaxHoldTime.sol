// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

import "./TavernKeeperCooldown.sol";

/**
 * @title TavernKeeperMaxHoldTime
 * @notice Upgrade to add 4-hour maximum hold time for office (v4.7.0)
 * @dev Automatically kicks office holder if they hold for more than 4 hours
 *      Extends TavernKeeperCooldown to preserve storage layout
 *
 * ════════════════════════════════════════════════════════════════════════════════
 * VERSION TRACKING - READ THIS BEFORE MAKING CHANGES
 * ════════════════════════════════════════════════════════════════════════════════
 *
 * VERSION: v4.7.0
 * DEPLOYED: TBD
 * IMPLEMENTATION: TBD
 * PROXY: 0x56B81A60Ae343342685911bd97D1331fF4fa2d29
 *
 * UPGRADE CHAIN:
 *   TavernKeeperV3 (v4.2.0)
 *   → TavernKeeperSetMinPrice (v4.3.0)
 *   → TavernKeeperPausable (v4.4.0)
 *   → TavernKeeperSetMinPrice1000 (v4.5.0)
 *   → TavernKeeperCooldown (v4.6.0)
 *   → TavernKeeperMaxHoldTime (v4.7.0) [CURRENT]
 *
 * ════════════════════════════════════════════════════════════════════════════════
 */
contract TavernKeeperMaxHoldTime is TavernKeeperCooldown {

    uint256 public constant MAX_HOLD_TIME = 4 hours;

    error MaxHoldTimeExceeded(uint256 timeHeld, uint256 maxHoldTime);
    event OfficeHolderKicked(address indexed holder, uint256 timeHeld);

    /**
     * @notice Check if current office holder has exceeded max hold time
     * @return hasExceeded True if holder has held office longer than MAX_HOLD_TIME
     * @return timeHeld Seconds the current holder has held the office
     * @return timeRemaining Seconds until max hold time is reached (0 if exceeded)
     */
    function checkMaxHoldTime() public view returns (bool hasExceeded, uint256 timeHeld, uint256 timeRemaining) {
        Slot0 memory slot0Cache = slot0;

        if (slot0Cache.miner == address(0)) {
            return (false, 0, MAX_HOLD_TIME);
        }

        timeHeld = block.timestamp - slot0Cache.startTime;

        if (timeHeld >= MAX_HOLD_TIME) {
            return (true, timeHeld, 0);
        }

        timeRemaining = MAX_HOLD_TIME - timeHeld;
        return (false, timeHeld, timeRemaining);
    }

    /**
     * @notice Get time remaining before current holder is kicked
     * @return timeRemaining Seconds until max hold time (0 if exceeded or no holder)
     */
    function getTimeUntilKick() public view returns (uint256 timeRemaining) {
        (, , timeRemaining) = checkMaxHoldTime();
        return timeRemaining;
    }

    /**
     * @notice Override takeOffice to check max hold time and auto-kick if exceeded
     * @dev If current holder has held > 4 hours, automatically transfers to deployer
     *      and then allows new person to take office
     */
    function takeOffice(
        uint256 epochId,
        uint256 deadline,
        uint256 maxPrice,
        string memory uri
    ) public payable override whenNotPaused nonReentrant returns (uint256 price) {
        Slot0 memory slot0Cache = slot0;

        // Check if current holder has exceeded max hold time
        if (slot0Cache.miner != address(0)) {
            uint256 timeHeld = block.timestamp - slot0Cache.startTime;

            if (timeHeld >= MAX_HOLD_TIME) {
                // Auto-kick: Transfer to deployer first
                address previousMiner = slot0Cache.miner;
                address deployer = owner();

                // Mint KEEP rewards to previous holder if applicable
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

                // Update slot0 to transfer to deployer (temporary holder)
                unchecked {
                    slot0Cache.epochId++;
                }
                officeLastClaimTime = 0;
                slot0Cache.miner = deployer;
                slot0Cache.dps = _getDpsFromTime(block.timestamp);
                slot0Cache.uri = "Auto-kicked: Max hold time exceeded";
                // Reset startTime so deployer's hold time starts now
                slot0Cache.startTime = uint40(block.timestamp);
                slot0 = slot0Cache;

                emit OfficeHolderKicked(previousMiner, timeHeld);
                emit EmergencyTransfer(previousMiner, deployer, msg.sender);
                emit OfficeTaken(deployer, 0, 0, "Auto-kicked: Max hold time exceeded");
            }
        }

        // Now proceed with normal takeOffice logic (will take from current holder, which may now be deployer)
        return super.takeOffice(epochId, deadline, maxPrice, uri);
    }
}

