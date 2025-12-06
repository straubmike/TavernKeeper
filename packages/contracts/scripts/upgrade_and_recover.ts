
import { ethers, upgrades } from "hardhat";

/**
 * Script to upgrade CellarHook to Recovery version and rescue tokens
 *
 * Usage:
 *   npx hardhat run scripts/upgrade_and_recover.ts --network monad
 */

const CELLAR_HOOK_PROXY = "0x6c7612F44B71E5E6E2bA0FEa799A23786A537755";

async function main() {
    const [deployer] = await ethers.getSigners();
    console.log("=== RECOVERING STUCK TOKENS ===\n");
    console.log("Deployer:", deployer.address);

    // 1. Deploy Recovery Implementation and Upgrade Proxy
    console.log("\n--- Upgrading to CellarHookRecovery ---");
    const CellarHookRecovery = await ethers.getContractFactory("CellarHookRecovery");

    // Validate upgrade safety (might warn about state variables, but we are appending or reusing)
    // We inherit CellarHook so storage layout should be compatible
    console.log("Upgrading proxy...");
    const recoveryHook = await upgrades.upgradeProxy(CELLAR_HOOK_PROXY, CellarHookRecovery);
    await recoveryHook.waitForDeployment();
    console.log("✅ Upgraded to CellarHookRecovery");

    // 2. Check Balance Before
    const KEEP_ADDRESS = "0x2D1094F5CED6ba279962f9676d32BE092AFbf82E";
    const keepToken = await ethers.getContractAt("IERC20", KEEP_ADDRESS);

    const hookBalanceBefore = await keepToken.balanceOf(CELLAR_HOOK_PROXY);
    const userBalanceBefore = await keepToken.balanceOf(deployer.address);

    console.log("\n--- Balances Before ---");
    console.log("Hook KEEP:", ethers.formatEther(hookBalanceBefore));
    console.log("User KEEP:", ethers.formatEther(userBalanceBefore));

    // Removed early exit to allow MON recovery even if KEEP is 0
    // if (hookBalanceBefore === 0n) { ... }

    // 3. Execute Recovery
    // We use emergencyDrainKeep to just get the tokens back without burning LP (since LP burn might fail logic)
    // Or we can use forceRecoverTokensForUser if we want to burn LP.
    // Let's use emergencyDrainKeep for safety first.
    console.log("\n--- Draining Tokens ---");
    // Drain KEEP
    try {
        const tx = await recoveryHook.emergencyDrainKeep();
        console.log("Tx Hash (KEEP):", tx.hash);
        await tx.wait();
        console.log("✅ Drained KEEP!");
    } catch (e) {
        console.log("⚠️  Failed to drain KEEP (maybe 0 balance?):", e.message);
    }

    // Drain MON
    try {
        const tx = await recoveryHook.emergencyDrainMon();
        console.log("Tx Hash (MON):", tx.hash);
        await tx.wait();
        console.log("✅ Drained MON!");
    } catch (e) {
        console.log("⚠️  Failed to drain MON (maybe 0 balance?):", e.message);
    }

    // 4. Check Balance After
    const hookBalanceAfter = await keepToken.balanceOf(CELLAR_HOOK_PROXY);
    const userBalanceAfter = await keepToken.balanceOf(deployer.address);

    console.log("\n--- Balances After ---");
    console.log("Hook KEEP:", ethers.formatEther(hookBalanceAfter));
    console.log("User KEEP:", ethers.formatEther(userBalanceAfter));
    console.log("Recovered:", ethers.formatEther(userBalanceAfter - userBalanceBefore));

    console.log("\n=== RECOVERY COMPLETE ===");
}

main().catch((error) => {
    console.error("❌ Script failed:", error);
    process.exitCode = 1;
});
