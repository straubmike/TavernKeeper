import { ethers } from "hardhat";

/**
 * Check ALL contracts for recoverable funds
 *
 * Usage:
 *   npx hardhat run scripts/check_all_recoverable_funds.ts --network monad
 */

// All known contract addresses
const CONTRACTS = {
    // Old broken pool
    OLD_BROKEN_POOL: "0x6c7612F44B71E5E6E2bA0FEa799A23786A537755",

    // Previous new pool (v1)
    OLD_NEW_POOL_V1: "0xaDF53E062195C20DAD2E52b76550f0a266e40ac0",

    // Current new pool (v2) - should be 0
    CURRENT_POOL: "0xe71CAf7162dd81a4A9C0c6BD25ED02C26F492DC0",

    // Orphaned contracts
    ORPHANED_KEEP_TOKEN: "0x426f7c10e7D5329BB7E956e59fa19697c465daBA",
    ORPHANED_CELLAR_HOOK: "0xDA499a900FE25D738045CD6C299663471dE76Ae0",

    // PoolManager (for stuck liquidity)
    POOL_MANAGER: "0x27e98f6A0D3315F9f3ECDaFE0187a7637F41c7c2",
};

const MAINNET_KEEP_TOKEN = "0x2D1094F5CED6ba279962f9676d32BE092AFbf82E";

async function checkContract(name: string, address: string) {
    console.log(`\n--- ${name} ---`);
    console.log(`Address: ${address}`);

    const nativeBalance = await ethers.provider.getBalance(address);
    console.log(`Native Balance: ${ethers.formatEther(nativeBalance)} MON`);

    // Try to read potBalance if it's a CellarHook
    try {
        const CellarHook = await ethers.getContractFactory("CellarHook");
        const contract = CellarHook.attach(address);
        const potBalance = await contract.potBalance();
        console.log(`potBalance (state): ${ethers.formatEther(potBalance)} MON`);

        if (potBalance.toString() !== nativeBalance.toString()) {
            console.log(`⚠️  MISMATCH: potBalance != native balance`);
            console.log(`   Difference: ${ethers.formatEther(nativeBalance - potBalance)} MON`);
        }

        // Check if owner can recover
        try {
            const owner = await contract.owner();
            const [deployer] = await ethers.getSigners();
            const isOwner = owner.toLowerCase() === deployer.address.toLowerCase();
            console.log(`Owner: ${owner}`);
            console.log(`Can recover: ${isOwner ? "✅ YES" : "❌ NO"}`);
        } catch (e) {
            console.log(`Owner check: Not upgradeable or no owner function`);
        }
    } catch (error: any) {
        // Not a CellarHook or can't read
        console.log(`(Not a CellarHook or can't read potBalance)`);
    }

    // Check KEEP balance if it's an ERC20 contract
    try {
        const keepToken = await ethers.getContractAt("IERC20", MAINNET_KEEP_TOKEN);
        const keepBalance = await keepToken.balanceOf(address);
        if (keepBalance > 0n) {
            console.log(`KEEP Balance: ${ethers.formatEther(keepBalance)} KEEP`);
        }
    } catch (e) {
        // Not relevant
    }

    return {
        name,
        address,
        nativeBalance,
        recoverable: nativeBalance > 0n
    };
}

async function main() {
    const [deployer] = await ethers.getSigners();
    console.log("=== CHECKING ALL RECOVERABLE FUNDS ===\n");
    console.log("Deployer:", deployer.address);
    console.log("Network:", (await ethers.provider.getNetwork()).name);
    console.log("Chain ID:", (await ethers.provider.getNetwork()).chainId);

    const results = [];

    // Check all contracts
    for (const [name, address] of Object.entries(CONTRACTS)) {
        const result = await checkContract(name, address);
        results.push(result);
    }

    // Summary
    console.log("\n============================================");
    console.log("RECOVERY SUMMARY");
    console.log("============================================");

    const recoverable = results.filter(r => r.recoverable);

    if (recoverable.length === 0) {
        console.log("✅ No recoverable funds found");
    } else {
        console.log(`⚠️  Found ${recoverable.length} contract(s) with recoverable funds:\n`);

        let totalRecoverable = 0n;
        for (const r of recoverable) {
            console.log(`  ${r.name}:`);
            console.log(`    Address: ${r.address}`);
            console.log(`    Amount: ${ethers.formatEther(r.nativeBalance)} MON`);
            totalRecoverable += r.nativeBalance;
        }

        console.log(`\n  Total Recoverable: ${ethers.formatEther(totalRecoverable)} MON`);
    }

    // Check PoolManager for stuck liquidity
    console.log("\n--- PoolManager Stuck Liquidity ---");
    console.log("Note: PoolManager tokens are likely NOT recoverable (broken pool)");
    const keepToken = await ethers.getContractAt("IERC20", MAINNET_KEEP_TOKEN);
    const pmKeep = await keepToken.balanceOf(CONTRACTS.POOL_MANAGER);
    const pmMon = await ethers.provider.getBalance(CONTRACTS.POOL_MANAGER);
    console.log(`MON in PoolManager: ${ethers.formatEther(pmMon)} MON`);
    console.log(`KEEP in PoolManager: ${ethers.formatEther(pmKeep)} KEEP`);
    if (pmMon > 0n || pmKeep > 0n) {
        console.log(`⚠️  PoolManager has tokens, but likely NOT recoverable (broken pool)`);
    }
}

main().catch((error) => {
    console.error("❌ Check failed:", error);
    process.exitCode = 1;
});

