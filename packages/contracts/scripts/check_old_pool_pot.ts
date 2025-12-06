import { ethers } from "hardhat";

/**
 * Check the old broken pool's pot balance and state
 *
 * Usage:
 *   npx hardhat run scripts/check_old_pool_pot.ts --network monad
 */

const OLD_BROKEN_POOL = "0x6c7612F44B71E5E6E2bA0FEa799A23786A537755";

async function main() {
    const [deployer] = await ethers.getSigners();
    console.log("=== CHECKING OLD BROKEN POOL STATE ===\n");
    console.log("Deployer:", deployer.address);
    console.log("Network:", (await ethers.provider.getNetwork()).name);
    console.log("Chain ID:", (await ethers.provider.getNetwork()).chainId);

    const CellarHook = await ethers.getContractFactory("CellarHook");
    const oldPool = CellarHook.attach(OLD_BROKEN_POOL);

    console.log("\n--- Old Pool Address ---");
    console.log("Address:", OLD_BROKEN_POOL);

    // Check native balance
    const nativeBalance = await ethers.provider.getBalance(OLD_BROKEN_POOL);
    console.log("\n--- Native Balance ---");
    console.log("Native Balance:", ethers.formatEther(nativeBalance), "MON");

    // Check potBalance
    try {
        const potBalance = await oldPool.potBalance();
        console.log("\n--- Pot Balance ---");
        console.log("potBalance (state):", ethers.formatEther(potBalance), "MON");

        if (potBalance.toString() !== nativeBalance.toString()) {
            console.log("\n⚠️  WARNING: potBalance != native balance!");
            console.log("   Difference:", ethers.formatEther(nativeBalance - potBalance), "MON");
        } else {
            console.log("\n✅ potBalance matches native balance");
        }
    } catch (error: any) {
        console.log("\n⚠️  Could not read potBalance:", error.message);
    }

    // Check slot0 (raid state)
    try {
        const slot0 = await oldPool.slot0();
        console.log("\n--- Raid State ---");
        console.log("Epoch ID:", slot0.epochId.toString());
        console.log("Init Price:", ethers.formatEther(slot0.initPrice), "LP");
        console.log("Start Time:", new Date(Number(slot0.startTime) * 1000).toISOString());

        const currentPrice = await oldPool.getAuctionPrice();
        console.log("Current Raid Price:", ethers.formatEther(currentPrice), "LP");
    } catch (error: any) {
        console.log("\n⚠️  Could not read slot0:", error.message);
    }

    // Check LP token supply
    try {
        const totalSupply = await oldPool.totalSupply();
        console.log("\n--- LP Token Supply ---");
        console.log("Total LP Supply:", ethers.formatEther(totalSupply), "LP");
    } catch (error: any) {
        console.log("\n⚠️  Could not read totalSupply:", error.message);
    }

    // Check owner
    try {
        const owner = await oldPool.owner();
        console.log("\n--- Owner ---");
        console.log("Owner:", owner);
        console.log("Is deployer owner?", owner.toLowerCase() === deployer.address.toLowerCase() ? "✅ YES" : "❌ NO");
    } catch (error: any) {
        console.log("\n⚠️  Could not read owner:", error.message);
    }

    console.log("\n=== SUMMARY ===");
    if (nativeBalance > 0n) {
        console.log("⚠️  OLD POOL HAS FUNDS THAT NEED RECOVERY!");
        console.log(`   Amount: ${ethers.formatEther(nativeBalance)} MON`);
        console.log("   Action: Need to recover these funds");
    } else {
        console.log("✅ Old pool has no funds to recover");
    }
}

main().catch((error) => {
    console.error("❌ Check failed:", error);
    process.exitCode = 1;
});

