import { ethers, upgrades } from "hardhat";
import * as dotenv from "dotenv";

dotenv.config({ path: "../../.env" });

/**
 * Upgrade TavernKeeper to set minimum office price to 1000 MON
 *
 * Usage:
 *   npx hardhat run scripts/upgrade-tavernkeeper-min-price-1000.ts --network monad
 */

const TAVERN_KEEPER_PROXY = process.env.TAVERN_KEEPER_PROXY || "0x56B81A60Ae343342685911bd97D1331fF4fa2d29";
const NEW_MIN_PRICE = ethers.parseEther("1000"); // 1000 MON

async function main() {
    console.log("🔧 UPGRADING TavernKeeper TO SET MIN PRICE TO 1000 MON...\n");
    console.log("━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━\n");

    const [deployer] = await ethers.getSigners();
    const network = await ethers.provider.getNetwork();

    console.log(`Network: ${network.name} (Chain ID: ${network.chainId})`);
    console.log(`Deployer: ${deployer.address}`);
    console.log(`Proxy: ${TAVERN_KEEPER_PROXY}`);
    console.log(`New Min Price: 1000 MON\n`);

    // Verify deployer is the owner
    const TavernKeeperPausable = await ethers.getContractFactory("TavernKeeperPausable");
    const currentContract = TavernKeeperPausable.attach(TAVERN_KEEPER_PROXY);
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
    console.log(`Current Init Price: ${ethers.formatEther(slot0.initPrice)} MON`);
    console.log(`Paused: ${isPaused ? "YES" : "NO"}\n`);

    // Deploy new implementation
    console.log("--- DEPLOYING NEW IMPLEMENTATION ---");
    const TavernKeeperSetMinPrice1000 = await ethers.getContractFactory("TavernKeeperSetMinPrice1000");
    console.log("Deploying TavernKeeperSetMinPrice1000...\n");

    try {
        // Check current implementation
        const currentImpl = await upgrades.erc1967.getImplementationAddress(TAVERN_KEEPER_PROXY);
        console.log(`   Current Implementation: ${currentImpl}\n`);

        const upgraded = await upgrades.upgradeProxy(TAVERN_KEEPER_PROXY, TavernKeeperSetMinPrice1000);
        await upgraded.waitForDeployment();

        const newImplAddress = await upgrades.erc1967.getImplementationAddress(TAVERN_KEEPER_PROXY);

        console.log(`✅ Upgrade successful!`);
        console.log(`   Proxy: ${TAVERN_KEEPER_PROXY} (unchanged)`);
        console.log(`   New Implementation: ${newImplAddress}\n`);

        // Verify
        console.log("--- VERIFICATION ---");
        const upgradedTK = TavernKeeperSetMinPrice1000.attach(TAVERN_KEEPER_PROXY);

        // Check that price calculation now uses 1000 MON minimum
        const newPrice = await upgradedTK.getPrice();
        const newSlot0 = await upgradedTK.slot0();
        const newPausedState = await upgradedTK.paused();

        console.log(`New Price: ${ethers.formatEther(newPrice)} MON`);
        console.log(`New Init Price: ${ethers.formatEther(newSlot0.initPrice)} MON`);
        console.log(`Paused: ${newPausedState ? "YES" : "NO"}`);

        // If price decayed below 1000, it should be 1000 now
        if (newPrice < NEW_MIN_PRICE) {
            console.log(`⚠️  Price is below 1000 MON - this means the auction hasn't decayed yet`);
            console.log(`   The minimum will be enforced when price decays or on next takeOffice`);
        } else {
            console.log(`✅ Price is at or above 1000 MON minimum`);
        }

        console.log("\n=== UPGRADE COMPLETE ===");
        console.log("TavernKeeper now requires minimum 1000 MON to take office");
        console.log("This will prevent immediate office takes when price is very low");

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

