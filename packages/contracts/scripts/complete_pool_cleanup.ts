import { ethers, upgrades } from "hardhat";
import fs from "fs";
import path from "path";

/**
 * COMPLETE POOL CLEANUP AND RECOVERY
 *
 * This script performs complete cleanup:
 * 1. Recovers funds from old broken pool
 * 2. Disables old broken pool
 * 3. Disables orphaned contracts
 * 4. Verifies frontend configuration
 * 5. Creates final status report
 *
 * Usage:
 *   npx hardhat run scripts/complete_pool_cleanup.ts --network monad
 */

const OLD_BROKEN_POOL = "0x6c7612F44B71E5E6E2bA0FEa799A23786A537755";
const NEW_WORKING_POOL = "0xe71CAf7162dd81a4A9C0c6BD25ED02C26F492DC0";
const MAINNET_KEEP_TOKEN = "0x2D1094F5CED6ba279962f9676d32BE092AFbf82E";
const DEAD_ADDRESS = "0x000000000000000000000000000000000000dEaD";

// Orphaned contracts
const ORPHANED_CONTRACTS = {
    KEEP_TOKEN: "0x426f7c10e7D5329BB7E956e59fa19697c465daBA",
    CELLAR_HOOK: "0xDA499a900FE25D738045CD6C299663471dE76Ae0",
    INVENTORY: "0x88f251AFD462AF1f604ACCebc22B084255f763b5",
    ADVENTURER: "0x54911A51216824788ACea03fEE5F947b1281Cffe",
    TAVERNKEEPER: "0x0FFD4b467326C6fBC5EB7ab901eC020f54970e9d",
    CELLAR_ZAP: "0x335bAFEd9a8498B7779431154196d0712693827d",
    DUNGEON_GATEKEEPER: "0xAE1e8194663450073bB6024199eBa65886774A26",
    TAVERN_REGULARS: "0xd9E80273467f0f1786F5A4565c154eF814D77e70",
    TOWN_POSSE: "0xe4eaAf93D5c3f693a69D6BEb5F8a53ECfb2857a8",
};

async function recoverOldPool() {
    console.log("\n============================================");
    console.log("STEP 1: RECOVERING OLD POOL FUNDS");
    console.log("============================================");

    const [deployer] = await ethers.getSigners();
    const CellarHook = await ethers.getContractFactory("CellarHook");
    const oldPool = CellarHook.attach(OLD_BROKEN_POOL);

    // Check balances
    const nativeBalance = await ethers.provider.getBalance(OLD_BROKEN_POOL);
    const keepToken = await ethers.getContractAt("IERC20", MAINNET_KEEP_TOKEN);
    const keepBalance = await keepToken.balanceOf(OLD_BROKEN_POOL);

    console.log("Old Pool Balances:");
    console.log("  MON:", ethers.formatEther(nativeBalance), "MON");
    console.log("  KEEP:", ethers.formatEther(keepBalance), "KEEP");

    if (nativeBalance === 0n && keepBalance === 0n) {
        console.log("✅ No funds to recover");
        return { monRecovered: 0n, keepRecovered: 0n };
    }

    // Verify ownership
    const owner = await oldPool.owner();
    if (owner.toLowerCase() !== deployer.address.toLowerCase()) {
        console.error("❌ ERROR: Not owner of old pool!");
        throw new Error("Not owner");
    }

    // Upgrade to recovery version
    console.log("\nUpgrading to CellarHookRecovery...");
    const CellarHookRecovery = await ethers.getContractFactory("CellarHookRecovery");
    const recoveryHook = await upgrades.upgradeProxy(OLD_BROKEN_POOL, CellarHookRecovery);
    await recoveryHook.waitForDeployment();
    console.log("✅ Upgraded to recovery version");

    // Recover funds
    const deployerMonBefore = await ethers.provider.getBalance(deployer.address);
    const deployerKeepBefore = await keepToken.balanceOf(deployer.address);

    if (nativeBalance > 0n) {
        const tx = await recoveryHook.emergencyDrainMon();
        await tx.wait();
        console.log("✅ MON recovered");
    }

    if (keepBalance > 0n) {
        const tx = await recoveryHook.emergencyDrainKeep();
        await tx.wait();
        console.log("✅ KEEP recovered");
    }

    const deployerMonAfter = await ethers.provider.getBalance(deployer.address);
    const deployerKeepAfter = await keepToken.balanceOf(deployer.address);

    return {
        monRecovered: deployerMonAfter - deployerMonBefore,
        keepRecovered: deployerKeepAfter - deployerKeepBefore
    };
}

async function disableOldPool() {
    console.log("\n============================================");
    console.log("STEP 2: DISABLING OLD POOL");
    console.log("============================================");

    const [deployer] = await ethers.getSigners();
    const CellarHookRecovery = await ethers.getContractFactory("CellarHookRecovery");
    const oldPool = CellarHookRecovery.attach(OLD_BROKEN_POOL);

    const owner = await oldPool.owner();
    if (owner.toLowerCase() !== deployer.address.toLowerCase()) {
        console.log("⚠️  Not owner, cannot disable");
        return false;
    }

    const tx = await oldPool.transferOwnership(DEAD_ADDRESS);
    await tx.wait();
    console.log("✅ Old pool ownership transferred to dead address");
    console.log("   Pool is now permanently disabled");

    // Verify
    const newOwner = await oldPool.owner();
    if (newOwner.toLowerCase() === DEAD_ADDRESS.toLowerCase()) {
        console.log("✅ Disable verified");
        return true;
    }
    return false;
}

async function disableOrphanedContract(name: string, address: string, contractType: string) {
    try {
        const contract = await ethers.getContractAt(contractType, address);
        const owner = await contract.owner();
        const [deployer] = await ethers.getSigners();

        if (owner.toLowerCase() !== deployer.address.toLowerCase()) {
            console.log(`  ⚠️  ${name}: Not owner, skipping`);
            return false;
        }

        const tx = await contract.transferOwnership(DEAD_ADDRESS);
        await tx.wait();
        console.log(`  ✅ ${name}: Disabled`);
        return true;
    } catch (error: any) {
        console.log(`  ⚠️  ${name}: ${error.message}`);
        return false;
    }
}

async function disableOrphanedContracts() {
    console.log("\n============================================");
    console.log("STEP 3: DISABLING ORPHANED CONTRACTS");
    console.log("============================================");

    let disabled = 0;
    let skipped = 0;

    // KeepToken needs special handling
    console.log("\nDisabling KeepToken...");
    try {
        const keepToken = await ethers.getContractAt("KeepToken", ORPHANED_CONTRACTS.KEEP_TOKEN);
        const [deployer] = await ethers.getSigners();
        const owner = await keepToken.owner();

        if (owner.toLowerCase() === deployer.address.toLowerCase()) {
            await keepToken.transferOwnership(DEAD_ADDRESS);
            await keepToken.setTavernKeeperContract(DEAD_ADDRESS);
            console.log("  ✅ KeepToken: Disabled");
            disabled++;
        } else {
            console.log("  ⚠️  KeepToken: Not owner, skipping");
            skipped++;
        }
    } catch (error: any) {
        console.log(`  ⚠️  KeepToken: ${error.message}`);
        skipped++;
    }

    // Disable other contracts
    const contracts = [
        { name: "CellarHook", address: ORPHANED_CONTRACTS.CELLAR_HOOK, type: "CellarHook" },
        { name: "Inventory", address: ORPHANED_CONTRACTS.INVENTORY, type: "Inventory" },
        { name: "Adventurer", address: ORPHANED_CONTRACTS.ADVENTURER, type: "Adventurer" },
        { name: "TavernKeeper", address: ORPHANED_CONTRACTS.TAVERNKEEPER, type: "TavernKeeper" },
        { name: "CellarZapV4", address: ORPHANED_CONTRACTS.CELLAR_ZAP, type: "CellarZapV4" },
        { name: "DungeonGatekeeper", address: ORPHANED_CONTRACTS.DUNGEON_GATEKEEPER, type: "DungeonGatekeeper" },
        { name: "TavernRegularsManager", address: ORPHANED_CONTRACTS.TAVERN_REGULARS, type: "TavernRegularsManager" },
        { name: "TownPosseManager", address: ORPHANED_CONTRACTS.TOWN_POSSE, type: "TownPosseManager" },
    ];

    for (const contract of contracts) {
        const result = await disableOrphanedContract(contract.name, contract.address, contract.type);
        if (result) disabled++;
        else skipped++;
    }

    console.log(`\n✅ Disabled: ${disabled} contracts`);
    console.log(`⚠️  Skipped: ${skipped} contracts`);
}

async function verifyFrontend() {
    console.log("\n============================================");
    console.log("STEP 4: VERIFYING FRONTEND CONFIGURATION");
    console.log("============================================");

    const addressesPath = path.join(__dirname, "../../apps/web/lib/contracts/addresses.ts");

    if (!fs.existsSync(addressesPath)) {
        console.log("⚠️  Could not find addresses.ts");
        return false;
    }

    const content = fs.readFileSync(addressesPath, "utf8");
    let issues = [];

    // Check mainnet addresses
    if (content.includes(`THE_CELLAR: '${NEW_WORKING_POOL}'`)) {
        console.log("✅ Frontend uses new pool address");
    } else {
        issues.push("Frontend may not be using new pool address");
    }

    if (content.includes(OLD_BROKEN_POOL)) {
        issues.push("Frontend still references old broken pool");
    }

    if (issues.length > 0) {
        console.log("⚠️  Issues found:");
        issues.forEach(issue => console.log(`   - ${issue}`));
        return false;
    }

    console.log("✅ Frontend configuration is correct");
    return true;
}

async function verifyNewPool() {
    console.log("\n============================================");
    console.log("STEP 5: VERIFYING NEW POOL STATUS");
    console.log("============================================");

    const CellarHook = await ethers.getContractFactory("CellarHook");
    const newPool = CellarHook.attach(NEW_WORKING_POOL);

    const poolInitialized = await newPool.poolInitialized();
    const potBalance = await newPool.potBalance();
    const slot0 = await newPool.slot0();
    const owner = await newPool.owner();
    const [deployer] = await ethers.getSigners();

    console.log("New Pool Status:");
    console.log("  Initialized:", poolInitialized ? "✅ YES" : "❌ NO");
    console.log("  Pot Balance:", ethers.formatEther(potBalance), "MON");
    console.log("  Epoch ID:", slot0.epochId.toString());
    console.log("  Owner:", owner);
    console.log("  Is deployer owner?", owner.toLowerCase() === deployer.address.toLowerCase() ? "✅ YES" : "❌ NO");

    if (poolInitialized && owner.toLowerCase() === deployer.address.toLowerCase()) {
        console.log("✅ New pool is operational");
        return true;
    }
    return false;
}

async function main() {
    const [deployer] = await ethers.getSigners();
    console.log("=== COMPLETE POOL CLEANUP AND RECOVERY ===\n");
    console.log("Deployer:", deployer.address);
    console.log("Network:", (await ethers.provider.getNetwork()).name);
    console.log("Chain ID:", (await ethers.provider.getNetwork()).chainId);

    // Verify mainnet
    const chainId = (await ethers.provider.getNetwork()).chainId;
    if (Number(chainId) !== 143) {
        console.error("❌ ERROR: This script is for Monad Mainnet (chain ID 143)");
        process.exit(1);
    }

    const results = {
        recovery: { monRecovered: 0n, keepRecovered: 0n },
        oldPoolDisabled: false,
        orphanedDisabled: 0,
        frontendVerified: false,
        newPoolVerified: false,
    };

    try {
        // Step 1: Recover old pool
        results.recovery = await recoverOldPool();

        // Step 2: Disable old pool
        results.oldPoolDisabled = await disableOldPool();

        // Step 3: Disable orphaned contracts
        await disableOrphanedContracts();

        // Step 4: Verify frontend
        results.frontendVerified = await verifyFrontend();

        // Step 5: Verify new pool
        results.newPoolVerified = await verifyNewPool();

    } catch (error: any) {
        console.error("\n❌ Error during cleanup:", error.message);
        throw error;
    }

    // Final report
    console.log("\n============================================");
    console.log("CLEANUP COMPLETE - FINAL REPORT");
    console.log("============================================");
    console.log("\nRecovery:");
    console.log(`  MON: ${ethers.formatEther(results.recovery.monRecovered)} MON`);
    console.log(`  KEEP: ${ethers.formatEther(results.recovery.keepRecovered)} KEEP`);
    console.log("\nStatus:");
    console.log(`  Old Pool Disabled: ${results.oldPoolDisabled ? "✅ YES" : "❌ NO"}`);
    console.log(`  Frontend Verified: ${results.frontendVerified ? "✅ YES" : "❌ NO"}`);
    console.log(`  New Pool Verified: ${results.newPoolVerified ? "✅ YES" : "❌ NO"}`);
    console.log("\nAddresses:");
    console.log(`  Old Pool (DISABLED): ${OLD_BROKEN_POOL}`);
    console.log(`  New Pool (ACTIVE): ${NEW_WORKING_POOL}`);
    console.log("\n✅ Cleanup complete! Only the new pool should be used now.");
}

main().catch((error) => {
    console.error("❌ Cleanup failed:", error);
    process.exitCode = 1;
});

