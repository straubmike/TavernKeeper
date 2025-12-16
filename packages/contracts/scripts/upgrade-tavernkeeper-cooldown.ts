import { ethers, upgrades } from "hardhat";
import * as dotenv from "dotenv";

dotenv.config({ path: "../../.env" });

/**
 * Upgrade TavernKeeper to add 24-hour cooldown per wallet for taking office
 *
 * Usage:
 *   npx hardhat run scripts/upgrade-tavernkeeper-cooldown.ts --network monad
 */

const TAVERN_KEEPER_PROXY = process.env.TAVERN_KEEPER_PROXY || "0x56B81A60Ae343342685911bd97D1331fF4fa2d29";

async function main() {
    console.log("🔧 UPGRADING TavernKeeper TO ADD 24-HOUR COOLDOWN PER WALLET...\n");
    console.log("━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━\n");

    const [deployer] = await ethers.getSigners();
    const network = await ethers.provider.getNetwork();

    console.log(`Network: ${network.name} (Chain ID: ${network.chainId})`);
    console.log(`Deployer: ${deployer.address}`);
    console.log(`Proxy: ${TAVERN_KEEPER_PROXY}`);
    console.log(`Cooldown Period: 24 hours\n`);

    // Verify deployer is the owner
    const TavernKeeperSetMinPrice1000 = await ethers.getContractFactory("TavernKeeperSetMinPrice1000");
    const currentContract = TavernKeeperSetMinPrice1000.attach(TAVERN_KEEPER_PROXY);
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
    console.log(`Paused: ${isPaused ? "YES" : "NO"}\n`);

    // Deploy new implementation
    console.log("--- DEPLOYING NEW IMPLEMENTATION ---");
    const TavernKeeperCooldown = await ethers.getContractFactory("TavernKeeperCooldown");
    console.log("Deploying TavernKeeperCooldown...\n");

    try {
        // Check current implementation
        const currentImpl = await upgrades.erc1967.getImplementationAddress(TAVERN_KEEPER_PROXY);
        console.log(`   Current Implementation: ${currentImpl}\n`);

        const upgraded = await upgrades.upgradeProxy(TAVERN_KEEPER_PROXY, TavernKeeperCooldown);
        await upgraded.waitForDeployment();

        const newImplAddress = await upgrades.erc1967.getImplementationAddress(TAVERN_KEEPER_PROXY);

        console.log(`✅ Upgrade successful!`);
        console.log(`   Proxy: ${TAVERN_KEEPER_PROXY} (unchanged)`);
        console.log(`   New Implementation: ${newImplAddress}\n`);

        // Verify
        console.log("--- VERIFICATION ---");
        const upgradedTK = TavernKeeperCooldown.attach(TAVERN_KEEPER_PROXY);

        const cooldownPeriod = await upgradedTK.COOLDOWN_PERIOD();
        const newPausedState = await upgradedTK.paused();
        const slot0After = await upgradedTK.getSlot0();

        const cooldownPeriodNum = Number(cooldownPeriod);
        console.log(`Cooldown Period: ${cooldownPeriod.toString()} seconds (${cooldownPeriodNum / 3600} hours)`);
        console.log(`Paused: ${newPausedState ? "YES" : "NO"}`);
        console.log(`Current Manager: ${slot0After.miner}`);
        console.log(`Current Epoch ID: ${slot0After.epochId}`);

        // Test the canClaimOffice function
        const testWallet = deployer.address;
        const [canClaim, timeRemaining] = await upgradedTK.canClaimOffice(testWallet);
        console.log(`\nTest: Can ${testWallet} claim office?`);
        console.log(`   Can Claim: ${canClaim ? "YES" : "NO"}`);
        if (!canClaim) {
            const timeRemainingNum = Number(timeRemaining);
            console.log(`   Time Remaining: ${timeRemaining.toString()} seconds (${timeRemainingNum / 3600} hours)`);
        }

        console.log("\n=== UPGRADE COMPLETE ===");
        console.log("TavernKeeper now enforces 24-hour cooldown per wallet");
        console.log("Each wallet can only take the office once every 24 hours");

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

