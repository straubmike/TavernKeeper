import { ethers, upgrades } from "hardhat";

/**
 * RECOVER AND CLEANUP OLD BROKEN POOL
 * 
 * This script:
 * 1. Upgrades old pool to CellarHookRecovery
 * 2. Recovers all funds (MON and KEEP) from old pool
 * 3. Transfers ownership to dead address (disables pool)
 * 4. Verifies frontend is using new pool
 * 
 * Usage:
 *   npx hardhat run scripts/recover_and_cleanup_old_pool.ts --network monad
 */

const OLD_BROKEN_POOL = "0x6c7612F44B71E5E6E2bA0FEa799A23786A537755";
const NEW_WORKING_POOL = "0xe71CAf7162dd81a4A9C0c6BD25ED02C26F492DC0";
const MAINNET_KEEP_TOKEN = "0x2D1094F5CED6ba279962f9676d32BE092AFbf82E";
const DEAD_ADDRESS = "0x000000000000000000000000000000000000dEaD";

async function main() {
    const [deployer] = await ethers.getSigners();
    console.log("=== RECOVERING AND CLEANING UP OLD POOL ===\n");
    console.log("Deployer:", deployer.address);
    console.log("Network:", (await ethers.provider.getNetwork()).name);
    console.log("Chain ID:", (await ethers.provider.getNetwork()).chainId);

    // Verify we're on mainnet
    const chainId = (await ethers.provider.getNetwork()).chainId;
    if (Number(chainId) !== 143) {
        console.error("❌ ERROR: This script is for Monad Mainnet (chain ID 143)");
        process.exit(1);
    }

    const CellarHook = await ethers.getContractFactory("CellarHook");
    const oldPool = CellarHook.attach(OLD_BROKEN_POOL);

    // Check balances before
    console.log("\n--- Checking Balances Before Recovery ---");
    const nativeBalanceBefore = await ethers.provider.getBalance(OLD_BROKEN_POOL);
    const keepToken = await ethers.getContractAt("IERC20", MAINNET_KEEP_TOKEN);
    const keepBalanceBefore = await keepToken.balanceOf(OLD_BROKEN_POOL);
    const deployerMonBefore = await ethers.provider.getBalance(deployer.address);
    const deployerKeepBefore = await keepToken.balanceOf(deployer.address);

    console.log("Old Pool Native Balance:", ethers.formatEther(nativeBalanceBefore), "MON");
    console.log("Old Pool KEEP Balance:", ethers.formatEther(keepBalanceBefore), "KEEP");
    console.log("Deployer MON Before:", ethers.formatEther(deployerMonBefore), "MON");
    console.log("Deployer KEEP Before:", ethers.formatEther(deployerKeepBefore), "KEEP");

    // Verify ownership
    const owner = await oldPool.owner();
    if (owner.toLowerCase() !== deployer.address.toLowerCase()) {
        console.error("❌ ERROR: Deployer is not the owner of old pool!");
        console.error(`   Owner: ${owner}`);
        console.error(`   Deployer: ${deployer.address}`);
        process.exit(1);
    }
    console.log("✅ Deployer is owner of old pool");

    // Step 1: Upgrade to Recovery version
    console.log("\n--- Step 1: Upgrading to CellarHookRecovery ---");
    const CellarHookRecovery = await ethers.getContractFactory("CellarHookRecovery");
    
    try {
        const recoveryHook = await upgrades.upgradeProxy(OLD_BROKEN_POOL, CellarHookRecovery);
        await recoveryHook.waitForDeployment();
        console.log("✅ Upgraded to CellarHookRecovery");
    } catch (error: any) {
        console.error("❌ Upgrade failed:", error.message);
        throw error;
    }

    // Step 2: Recover funds
    console.log("\n--- Step 2: Recovering Funds ---");
    const recoveryHook = CellarHookRecovery.attach(OLD_BROKEN_POOL);

    // Recover MON
    if (nativeBalanceBefore > 0n) {
        try {
            console.log("Recovering MON...");
            const tx = await recoveryHook.emergencyDrainMon();
            console.log("Tx Hash:", tx.hash);
            await tx.wait();
            console.log("✅ MON recovered!");
        } catch (error: any) {
            console.error("❌ Failed to recover MON:", error.message);
        }
    } else {
        console.log("No MON to recover");
    }

    // Recover KEEP
    if (keepBalanceBefore > 0n) {
        try {
            console.log("Recovering KEEP...");
            const tx = await recoveryHook.emergencyDrainKeep();
            console.log("Tx Hash:", tx.hash);
            await tx.wait();
            console.log("✅ KEEP recovered!");
        } catch (error: any) {
            console.error("❌ Failed to recover KEEP:", error.message);
        }
    } else {
        console.log("No KEEP to recover");
    }

    // Check balances after recovery
    console.log("\n--- Balances After Recovery ---");
    const nativeBalanceAfter = await ethers.provider.getBalance(OLD_BROKEN_POOL);
    const keepBalanceAfter = await keepToken.balanceOf(OLD_BROKEN_POOL);
    const deployerMonAfter = await ethers.provider.getBalance(deployer.address);
    const deployerKeepAfter = await keepToken.balanceOf(deployer.address);

    console.log("Old Pool Native Balance:", ethers.formatEther(nativeBalanceAfter), "MON");
    console.log("Old Pool KEEP Balance:", ethers.formatEther(keepBalanceAfter), "KEEP");
    console.log("Deployer MON After:", ethers.formatEther(deployerMonAfter), "MON");
    console.log("Deployer KEEP After:", ethers.formatEther(deployerKeepAfter), "KEEP");

    const monRecovered = deployerMonAfter - deployerMonBefore;
    const keepRecovered = deployerKeepAfter - deployerKeepBefore;
    console.log("\n--- Recovery Summary ---");
    console.log("MON Recovered:", ethers.formatEther(monRecovered), "MON");
    console.log("KEEP Recovered:", ethers.formatEther(keepRecovered), "KEEP");

    // Step 3: Disable old pool by transferring ownership to dead address
    console.log("\n--- Step 3: Disabling Old Pool ---");
    try {
        const tx = await recoveryHook.transferOwnership(DEAD_ADDRESS);
        console.log("Tx Hash:", tx.hash);
        await tx.wait();
        console.log("✅ Old pool ownership transferred to dead address");
        console.log("   Pool is now disabled and cannot be upgraded or modified");
    } catch (error: any) {
        console.error("❌ Failed to transfer ownership:", error.message);
        throw error;
    }

    // Verify ownership transfer
    const newOwner = await recoveryHook.owner();
    if (newOwner.toLowerCase() === DEAD_ADDRESS.toLowerCase()) {
        console.log("✅ Ownership transfer verified");
    } else {
        console.error("❌ Ownership transfer failed!");
        console.error(`   Expected: ${DEAD_ADDRESS}`);
        console.error(`   Got: ${newOwner}`);
    }

    // Step 4: Verify frontend is using new pool
    console.log("\n--- Step 4: Verifying Frontend Configuration ---");
    const fs = require("fs");
    const path = require("path");
    const addressesPath = path.join(__dirname, "../../apps/web/lib/contracts/addresses.ts");
    
    if (fs.existsSync(addressesPath)) {
        const content = fs.readFileSync(addressesPath, "utf8");
        if (content.includes(NEW_WORKING_POOL)) {
            console.log("✅ Frontend is configured to use new pool");
        } else {
            console.log("⚠️  WARNING: Frontend may not be using new pool address");
        }
        if (content.includes(OLD_BROKEN_POOL)) {
            console.log("⚠️  WARNING: Frontend still references old pool address");
        }
    } else {
        console.log("⚠️  Could not find addresses.ts to verify");
    }

    // Step 5: Final verification
    console.log("\n--- Step 5: Final Verification ---");
    const finalNativeBalance = await ethers.provider.getBalance(OLD_BROKEN_POOL);
    const finalKeepBalance = await keepToken.balanceOf(OLD_BROKEN_POOL);
    
    if (finalNativeBalance === 0n && finalKeepBalance === 0n) {
        console.log("✅ All funds recovered from old pool");
    } else {
        console.log("⚠️  WARNING: Some funds may remain:");
        if (finalNativeBalance > 0n) {
            console.log(`   MON: ${ethers.formatEther(finalNativeBalance)} MON`);
        }
        if (finalKeepBalance > 0n) {
            console.log(`   KEEP: ${ethers.formatEther(finalKeepBalance)} KEEP`);
        }
    }

    console.log("\n============================================");
    console.log("RECOVERY AND CLEANUP COMPLETE");
    console.log("============================================");
    console.log("\nSummary:");
    console.log(`  ✅ Recovered: ${ethers.formatEther(monRecovered)} MON, ${ethers.formatEther(keepRecovered)} KEEP`);
    console.log(`  ✅ Old pool disabled (ownership transferred to dead address)`);
    console.log(`  ✅ Old pool address: ${OLD_BROKEN_POOL}`);
    console.log(`  ✅ New pool address: ${NEW_WORKING_POOL}`);
    console.log("\n⚠️  IMPORTANT:");
    console.log("   - Old pool is now disabled and cannot be used");
    console.log("   - All users should use new pool only");
    console.log("   - Frontend should be pointing to new pool");
}

main().catch((error) => {
    console.error("❌ Recovery failed:", error);
    process.exitCode = 1;
});

