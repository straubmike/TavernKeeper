import { ethers } from "hardhat";
import * as dotenv from "dotenv";

dotenv.config({ path: "../../.env" });

/**
 * Check ALL cellar contracts to find where the funds are
 *
 * Usage:
 *   npx hardhat run scripts/check_all_cellars.ts --network monad
 */

// All known cellar addresses
const CELLAR_ADDRESSES = {
    THE_CELLAR_V3: "0x32A920be00dfCE1105De0415ba1d4f06942E9ed0", // TheCellarV3 (V3 wrapper)
    OLD_CELLAR_HOOK: "0xe71CAf7162dd81a4A9C0c6BD25ED02C26F492DC0", // Old CellarHook (from localhost/mainnet fallback)
    CELLAR_HOOK_MAINNET: "0x6c7612F44B71E5E6E2bA0FEa799A23786A537755", // CellarHook from DEPLOYMENT_TRACKER
};

// ABI for checking pot balances
const CELLAR_V3_ABI = [
    "function potBalanceMON() external view returns (uint256)",
    "function potBalanceKEEP() external view returns (uint256)",
    "function cellarToken() external view returns (address)",
    "function tokenId() external view returns (uint256)",
    "function owner() external view returns (address)",
    "function deployerAddress() external view returns (address)",
];

const CELLAR_HOOK_ABI = [
    "function potBalance() external view returns (uint256)",
    "function owner() external view returns (address)",
];

async function checkCellarV3(address: string, name: string) {
    try {
        const cellar = await ethers.getContractAt(CELLAR_V3_ABI, address);

        const [potMON, potKEEP, cellarToken, tokenId, owner, deployerAddr] = await Promise.all([
            cellar.potBalanceMON().catch(() => 0n),
            cellar.potBalanceKEEP().catch(() => 0n),
            cellar.cellarToken().catch(() => ethers.ZeroAddress),
            cellar.tokenId().catch(() => 0n),
            cellar.owner().catch(() => ethers.ZeroAddress),
            cellar.deployerAddress().catch(() => ethers.ZeroAddress),
        ]);

        console.log(`\n--- ${name} (${address}) ---`);
        console.log(`Type: TheCellarV3`);
        console.log(`Pot MON: ${ethers.formatEther(potMON)} MON`);
        console.log(`Pot KEEP: ${ethers.formatEther(potKEEP)} KEEP`);
        console.log(`CellarToken (CLP): ${cellarToken}`);
        console.log(`Token ID: ${tokenId.toString()}`);
        console.log(`Owner: ${owner}`);
        console.log(`Deployer Address: ${deployerAddr}`);

        if (potMON > 0n || potKEEP > 0n) {
            console.log(`⚠️  HAS FUNDS!`);
        }

        return { address, type: "TheCellarV3", potMON, potKEEP, hasFunds: potMON > 0n || potKEEP > 0n };
    } catch (error: any) {
        if (error.message.includes("contract does not exist") || error.message.includes("code")) {
            console.log(`\n--- ${name} (${address}) ---`);
            console.log(`❌ Contract does not exist or is not TheCellarV3`);
            return null;
        }
        throw error;
    }
}

async function checkCellarHook(address: string, name: string) {
    try {
        const hook = await ethers.getContractAt(CELLAR_HOOK_ABI, address);

        const [potBalance, owner] = await Promise.all([
            hook.potBalance().catch(() => 0n),
            hook.owner().catch(() => ethers.ZeroAddress),
        ]);

        console.log(`\n--- ${name} (${address}) ---`);
        console.log(`Type: CellarHook (V4)`);
        console.log(`Pot Balance: ${ethers.formatEther(potBalance)} MON`);
        console.log(`Owner: ${owner}`);

        if (potBalance > 0n) {
            console.log(`⚠️  HAS FUNDS!`);
        }

        return { address, type: "CellarHook", potBalance, hasFunds: potBalance > 0n };
    } catch (error: any) {
        if (error.message.includes("contract does not exist") || error.message.includes("code")) {
            console.log(`\n--- ${name} (${address}) ---`);
            console.log(`❌ Contract does not exist or is not CellarHook`);
            return null;
        }
        throw error;
    }
}

async function main() {
    const [deployer] = await ethers.getSigners();
    console.log("=== CHECKING ALL CELLAR CONTRACTS ===");
    console.log("Deployer:", deployer.address);
    console.log();

    const results: any[] = [];

    // Check TheCellarV3
    const v3Result = await checkCellarV3(CELLAR_ADDRESSES.THE_CELLAR_V3, "TheCellarV3 (Mainnet)");
    if (v3Result) results.push(v3Result);

    // Check Old CellarHook
    const oldHookResult = await checkCellarHook(CELLAR_ADDRESSES.OLD_CELLAR_HOOK, "Old CellarHook");
    if (oldHookResult) results.push(oldHookResult);

    // Check CellarHook Mainnet
    const hookResult = await checkCellarHook(CELLAR_ADDRESSES.CELLAR_HOOK_MAINNET, "CellarHook (Mainnet)");
    if (hookResult) results.push(hookResult);

    // Check TavernKeeper treasury
    console.log("\n--- TavernKeeper Treasury Check ---");
    const TAVERN_KEEPER = "0x56B81A60Ae343342685911bd97D1331fF4fa2d29";
    try {
        const tk = await ethers.getContractAt("TavernKeeper", TAVERN_KEEPER);
        const treasury = await tk.treasury();
        console.log(`TavernKeeper Treasury: ${treasury}`);

        // Check if treasury is one of our cellar addresses
        const treasuryLower = treasury.toLowerCase();
        if (treasuryLower === CELLAR_ADDRESSES.THE_CELLAR_V3.toLowerCase()) {
            console.log("✅ Treasury is set to TheCellarV3");
        } else if (treasuryLower === CELLAR_ADDRESSES.OLD_CELLAR_HOOK.toLowerCase()) {
            console.log("⚠️  Treasury is set to OLD CellarHook!");
        } else if (treasuryLower === CELLAR_ADDRESSES.CELLAR_HOOK_MAINNET.toLowerCase()) {
            console.log("⚠️  Treasury is set to CellarHook (V4)");
        } else {
            console.log(`⚠️  Treasury is set to unknown address: ${treasury}`);
        }
    } catch (error: any) {
        console.error("Error checking TavernKeeper:", error.message);
    }

    // Summary
    console.log("\n=== SUMMARY ===");
    const contractsWithFunds = results.filter(r => r.hasFunds);
    if (contractsWithFunds.length === 0) {
        console.log("✅ No cellar contracts have funds");
    } else {
        console.log(`⚠️  Found ${contractsWithFunds.length} cellar contract(s) with funds:`);
        contractsWithFunds.forEach(r => {
            if (r.type === "TheCellarV3") {
                console.log(`  - ${r.address}: ${ethers.formatEther(r.potMON)} MON, ${ethers.formatEther(r.potKEEP)} KEEP`);
            } else {
                console.log(`  - ${r.address}: ${ethers.formatEther(r.potBalance)} MON`);
            }
        });
    }

    // Check which one frontend is using
    console.log("\n=== FRONTEND CONFIGURATION ===");
    console.log("Mainnet THE_CELLAR (from addresses.ts): 0x32A920be00dfCE1105De0415ba1d4f06942E9ed0");
    console.log("This should match TheCellarV3 address above.");
}

main().catch((error) => {
    console.error(error);
    process.exitCode = 1;
});

