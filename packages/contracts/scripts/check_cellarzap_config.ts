import { ethers } from "hardhat";

const CELLAR_ZAP = "0xf7248a01051bf297Aa56F12a05e7209C60Fc5863";
const OLD_POOL = "0x6c7612F44B71E5E6E2bA0FEa799A23786A537755";
const NEW_POOL = "0xe71CAf7162dd81a4A9C0c6BD25ED02C26F492DC0";

async function main() {
    const [signer] = await ethers.getSigners();
    console.log("=== CHECKING CELLARZAP CONFIGURATION ===");
    console.log("Signer:", signer.address);
    console.log("Network:", (await ethers.provider.getNetwork()).name);
    console.log("Chain ID:", (await ethers.provider.getNetwork()).chainId);
    console.log("");

    // CellarZap ABI - just the cellarHook getter
    const abi = [
        "function cellarHook() view returns (address)",
    ];

    try {
        const cellarZap = new ethers.Contract(CELLAR_ZAP, abi, ethers.provider);
        const configuredHook = await cellarZap.cellarHook();

        console.log("--- CellarZap Configuration ---");
        console.log("CellarZap Address:", CELLAR_ZAP);
        console.log("Configured CellarHook:", configuredHook);
        console.log("");

        if (configuredHook.toLowerCase() === OLD_POOL.toLowerCase()) {
            console.log("❌ PROBLEM FOUND: CellarZap is pointing to OLD POOL!");
            console.log("   This is why your LP mint went to the old pool.");
            console.log("   You need to update CellarZap to point to the new pool.");
        } else if (configuredHook.toLowerCase() === NEW_POOL.toLowerCase()) {
            console.log("✅ CellarZap is correctly pointing to NEW POOL");
        } else {
            console.log("⚠️  CellarZap is pointing to an unknown address:", configuredHook);
        }

        console.log("\n--- Pool Addresses ---");
        console.log("OLD POOL:", OLD_POOL);
        console.log("NEW POOL:", NEW_POOL);

    } catch (error: any) {
        console.error("❌ Error reading CellarZap:", error.message);
    }
}

main().catch((error) => {
    console.error("❌ Script failed:", error);
    process.exitCode = 1;
});

