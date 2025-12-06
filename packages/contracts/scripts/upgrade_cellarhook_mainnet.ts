import { ethers, upgrades } from "hardhat";
import { updateDeploymentTracker } from "./updateDeploymentTracker";
import { updateFrontendAddresses } from "./updateFrontend";

/**
 * Upgrade script for CellarHook on Monad Mainnet
 *
 * This upgrade includes:
 * - sqrtPriceX96 fix: Uses TickMath.getSqrtPriceAtTick(10986) for correct price = 3.0
 * - Settlement fix: Added poolManager.sync() calls before settling currencies
 * - Pool price fix: Reads actual pool price using StateLibrary.getSlot0() instead of hardcoded value
 * - Balance handling: Improved error messages and refund logic
 * - Broken pool detection: Detects and prevents adding liquidity to broken pools (price=0)
 * - Two-sided liquidity enforcement: Ensures current price is always within liquidity range
 * - Dynamic tick range: Calculates range around actual pool price to require both tokens
 *
 * Usage:
 *   $env:NEXT_PUBLIC_MONAD_CHAIN_ID="143"  # Mainnet chain ID
 *   npx hardhat run scripts/upgrade_cellarhook_mainnet.ts --network monad
 *
 * Environment variables (optional):
 *   CELLAR_HOOK_PROXY=0x... (CellarHook proxy address, defaults to mainnet address)
 *   PRIVATE_KEY=0x... (Deployer private key)
 */

// Mainnet proxy address
const MAINNET_CELLAR_HOOK_PROXY = "0x6c7612F44B71E5E6E2bA0FEa799A23786A537755";

async function main() {
    const [deployer] = await ethers.getSigners();
    console.log("=== UPGRADING CELLARHOOK ON MONAD MAINNET ===");
    console.log("Deployer:", deployer.address);
    console.log("Network:", (await ethers.provider.getNetwork()).name);
    console.log("Chain ID:", (await ethers.provider.getNetwork()).chainId);

    // Verify we're on mainnet (chain ID 143)
    const chainId = (await ethers.provider.getNetwork()).chainId;
    if (Number(chainId) !== 143) {
        console.error("❌ ERROR: This script is for Monad Mainnet (chain ID 143)");
        console.error(`   Current chain ID: ${chainId}`);
        console.error("   Set NEXT_PUBLIC_MONAD_CHAIN_ID=143 to use mainnet");
        process.exit(1);
    }

    // Get proxy address from env or use mainnet default
    const CELLAR_HOOK_PROXY = process.env.CELLAR_HOOK_PROXY || MAINNET_CELLAR_HOOK_PROXY;

    console.log("\n--- Proxy Address ---");
    console.log("CellarHook Proxy:", CELLAR_HOOK_PROXY);

    // Verify proxy exists
    const hookCode = await ethers.provider.getCode(CELLAR_HOOK_PROXY);
    if (hookCode === "0x") {
        console.error("❌ CellarHook proxy not found at:", CELLAR_HOOK_PROXY);
        process.exit(1);
    }
    console.log("✅ Proxy verified");

    // Check deployer balance
    const balance = await ethers.provider.getBalance(deployer.address);
    console.log("Deployer balance:", ethers.formatEther(balance), "MON");
    if (balance < ethers.parseEther("0.1")) {
        console.warn("⚠️  Low balance! Ensure you have enough MON for gas.");
    }

    // Get current implementation
    const currentHookImpl = await upgrades.erc1967.getImplementationAddress(CELLAR_HOOK_PROXY);
    console.log("\n--- Current Implementation ---");
    console.log("Current CellarHook Implementation:", currentHookImpl);

    // Upgrade CellarHook
    console.log("\n--- Upgrading CellarHook ---");
    const CellarHookFactory = await ethers.getContractFactory("CellarHook");

    console.log("Deploying new implementation and upgrading proxy...");
        console.log("This includes fixes:");
        console.log("  - sqrtPriceX96: Uses TickMath.getSqrtPriceAtTick(10986) for price = 3.0");
        console.log("  - Settlement: Added poolManager.sync() calls before settling currencies");
        console.log("  - Pool Initialization: Fixed to handle already-initialized pools gracefully");
        console.log("  - Broken Pool Detection: Prevents adding liquidity to broken pools (price=0)");
        console.log("  - Two-Sided Liquidity: Enforces current price within range to require both tokens");
        console.log("  - Dynamic Tick Range: Calculates range around actual pool price");

    const cellarHook = await upgrades.upgradeProxy(CELLAR_HOOK_PROXY, CellarHookFactory);
    await cellarHook.waitForDeployment();

    const newHookImpl = await upgrades.erc1967.getImplementationAddress(CELLAR_HOOK_PROXY);
    console.log("\n✅ CellarHook Upgraded");
    console.log("   Proxy (unchanged):", CELLAR_HOOK_PROXY);
    console.log("   Old Implementation:", currentHookImpl);
    console.log("   New Implementation:", newHookImpl);

    if (currentHookImpl === newHookImpl) {
        console.warn("⚠️  WARNING: Implementation address unchanged - upgrade may not have deployed new code");
    }

    // Update Frontend Addresses
    console.log("\n--- Updating Frontend Addresses ---");
    try {
        await updateFrontendAddresses({
            THE_CELLAR: CELLAR_HOOK_PROXY,
            THE_CELLAR_IMPL: newHookImpl
        });
        console.log("✅ Frontend addresses updated");
    } catch (error: any) {
        console.warn("⚠️  Warning: Could not update frontend addresses:", error.message);
        console.warn("   Please update apps/web/lib/contracts/addresses.ts manually:");
        console.warn(`   THE_CELLAR_IMPL: ${newHookImpl}`);
    }

    // Update Deployment Tracker
    console.log("\n--- Updating Deployment Tracker ---");
    try {
        await updateDeploymentTracker({
            CELLAR_HOOK: CELLAR_HOOK_PROXY
        });
        console.log("✅ Deployment tracker updated");
    } catch (error: any) {
        console.warn("⚠️  Warning: Could not update deployment tracker:", error.message);
    }

    // Print summary
    console.log("\n============================================");
    console.log("UPGRADE COMPLETE");
    console.log("============================================");
    console.log("\nUpgraded Contract:");
    console.log("CellarHook:");
    console.log(`   Proxy: ${CELLAR_HOOK_PROXY}`);
    console.log(`   Old Impl: ${currentHookImpl}`);
    console.log(`   New Impl: ${newHookImpl}`);

    console.log("\n=== FIXES INCLUDED ===");
    console.log("1. sqrtPriceX96 Fix:");
    console.log("   - Uses TickMath.getSqrtPriceAtTick(10986) for correct price = 3.0");
    console.log("   - Location: CellarHook.sol line 337-338");
    console.log("\n2. Settlement Fix:");
    console.log("   - Added poolManager.sync() calls before settling currencies");
    console.log("   - Location: CellarHook.sol _settleBalanceDelta() function");
    console.log("\n3. Pool Initialization Fix:");
    console.log("   - Fixed to handle already-initialized pools gracefully");
    console.log("   - Location: CellarHook.sol addLiquidity() function");
    console.log("\n4. Broken Pool Detection:");
    console.log("   - Detects pools with price=0 and reverts to prevent broken state");
    console.log("   - Location: CellarHook.sol addLiquidity() function");
    console.log("\n5. Two-Sided Liquidity Enforcement:");
    console.log("   - Ensures current price is always within liquidity range");
    console.log("   - Prevents single-sided liquidity additions");
    console.log("   - Location: CellarHook.sol addLiquidity() function");

    console.log("\n=== NEXT STEPS ===");
    console.log("1. Verify upgrade on block explorer:");
    console.log(`   https://monadscan.com/address/${newHookImpl}`);
    console.log("\n2. Test liquidity addition (small amount):");
    console.log("   npx hardhat run scripts/test_liquidity_addition.ts --network monad");
    console.log("\n3. Verify pool initializes with correct price (≈ 3.0)");
    console.log("\n4. Update DEPLOYMENT_TRACKER.md with upgrade details:");
    console.log(`   - Add v3.0.0 entry: ${newHookImpl}`);
    console.log(`   - Document: sqrtPriceX96 fix + sync() settlement fix`);
}

main().catch((error) => {
    console.error("❌ Upgrade failed:", error);
    process.exitCode = 1;
});
