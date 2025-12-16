import { ethers, upgrades } from "hardhat";
import * as dotenv from "dotenv";

dotenv.config({ path: "../../.env" });

/**
 * Upgrade TavernKeeper to add 4-hour maximum hold time
 *
 * Usage:
 *   npx hardhat run scripts/upgrade-tavernkeeper-max-hold-time.ts --network monad
 */

const TAVERN_KEEPER_PROXY = process.env.TAVERN_KEEPER_PROXY || "0x56B81A60Ae343342685911bd97D1331fF4fa2d29";

async function main() {
    console.log("🔧 UPGRADING TavernKeeper TO ADD 4-HOUR MAX HOLD TIME...\n");
    console.log("━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━\n");

    const [deployer] = await ethers.getSigners();
    const network = await ethers.provider.getNetwork();

    console.log(`Network: ${network.name} (Chain ID: ${network.chainId})`);
    console.log(`Deployer: ${deployer.address}`);
    console.log(`Proxy: ${TAVERN_KEEPER_PROXY}`);
    console.log(`Max Hold Time: 4 hours\n`);

    // Verify deployer is the owner
    const TavernKeeperCooldown = await ethers.getContractFactory("TavernKeeperCooldown");
    const currentContract = TavernKeeperCooldown.attach(TAVERN_KEEPER_PROXY);
    const owner = await currentContract.owner();

    if (owner.toLowerCase() !== deployer.address.toLowerCase()) {
        console.error(`❌ Error: You are not the owner!`);
        console.error(`   Your address: ${deployer.address}`);
        console.error(`   Owner address: ${owner}`);
        process.exit(1);
    }

    // Check current state
    console.log("--- CURRENT STATE ---");
    const slot0 = await currentContract.getSlot0();
    const currentPrice = await currentContract.getPrice();
    const isPaused = await currentContract.paused();

    console.log(`Current Price: ${ethers.formatEther(currentPrice)} MON`);
    console.log(`Current Manager: ${slot0.miner}`);
    console.log(`Current Epoch ID: ${slot0.epochId}`);
    console.log(`Start Time: ${slot0.startTime.toString()}`);

    if (slot0.miner !== ethers.ZeroAddress) {
        const timeHeld = Number(await ethers.provider.getBlock('latest')) - Number(slot0.startTime);
        const hoursHeld = timeHeld / 3600;
        console.log(`Time Held: ${hoursHeld.toFixed(2)} hours`);
    }

    console.log(`Paused: ${isPaused ? "YES" : "NO"}\n`);

    // Deploy new implementation
    console.log("--- DEPLOYING NEW IMPLEMENTATION ---");
    const TavernKeeperMaxHoldTime = await ethers.getContractFactory("TavernKeeperMaxHoldTime");
    console.log("Deploying TavernKeeperMaxHoldTime...\n");

    try {
        // Check current implementation
        const currentImpl = await upgrades.erc1967.getImplementationAddress(TAVERN_KEEPER_PROXY);
        console.log(`   Current Implementation: ${currentImpl}\n`);

        const upgraded = await upgrades.upgradeProxy(TAVERN_KEEPER_PROXY, TavernKeeperMaxHoldTime);
        await upgraded.waitForDeployment();

        const newImplAddress = await upgrades.erc1967.getImplementationAddress(TAVERN_KEEPER_PROXY);

        console.log(`✅ Upgrade successful!`);
        console.log(`   Proxy: ${TAVERN_KEEPER_PROXY} (unchanged)`);
        console.log(`   New Implementation: ${newImplAddress}\n`);

        // Verify
        console.log("--- VERIFICATION ---");
        const upgradedTK = TavernKeeperMaxHoldTime.attach(TAVERN_KEEPER_PROXY);

        const maxHoldTime = await upgradedTK.MAX_HOLD_TIME();
        const newPausedState = await upgradedTK.paused();
        const slot0After = await upgradedTK.getSlot0();
        const [hasExceeded, timeHeld, timeRemaining] = await upgradedTK.checkMaxHoldTime();

        const maxHoldTimeNum = Number(maxHoldTime);
        console.log(`Max Hold Time: ${maxHoldTime.toString()} seconds (${maxHoldTimeNum / 3600} hours)`);
        console.log(`Paused: ${newPausedState ? "YES" : "NO"}`);
        console.log(`Current Manager: ${slot0After.miner}`);
        console.log(`Current Epoch ID: ${slot0After.epochId}`);

        if (slot0After.miner !== ethers.ZeroAddress) {
            const timeHeldNum = Number(timeHeld);
            const timeRemainingNum = Number(timeRemaining);
            console.log(`\nHold Time Status:`);
            console.log(`   Has Exceeded: ${hasExceeded ? "YES ⚠️" : "NO ✅"}`);
            console.log(`   Time Held: ${timeHeldNum} seconds (${(timeHeldNum / 3600).toFixed(2)} hours)`);
            if (!hasExceeded) {
                console.log(`   Time Until Kick: ${timeRemainingNum} seconds (${(timeRemainingNum / 3600).toFixed(2)} hours)`);
            }
        }

        console.log("\n=== UPGRADE COMPLETE ===");
        console.log("TavernKeeper now automatically kicks office holders after 4 hours");
        console.log("Office holders will be automatically transferred to deployer if they hold > 4 hours");

    } catch (error: any) {
        console.error(`❌ Upgrade failed!`);
        console.error(`   Error: ${error.message}`);
        if (error.reason) {
            console.error(`   Reason: ${error.reason}`);
        }
        process.exit(1);
    }
}

main()
    .then(() => process.exit(0))
    .catch((error) => {
        console.error(error);
        process.exit(1);
    });

