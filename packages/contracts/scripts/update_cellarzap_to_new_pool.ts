import { ethers, upgrades } from "hardhat";

const CELLAR_ZAP = "0xf7248a01051bf297Aa56F12a05e7209C60Fc5863";
const NEW_POOL = "0xe71CAf7162dd81a4A9C0c6BD25ED02C26F492DC0";
const OLD_POOL = "0x6c7612F44B71E5E6E2bA0FEa799A23786A537755";

async function main() {
    const [deployer] = await ethers.getSigners();
    console.log("=== UPDATING CELLARZAP TO NEW POOL ===");
    console.log("Deployer:", deployer.address);
    console.log("Network:", (await ethers.provider.getNetwork()).name);
    console.log("Chain ID:", (await ethers.provider.getNetwork()).chainId);
    console.log("");

    // Verify we're on mainnet
    const chainId = (await ethers.provider.getNetwork()).chainId;
    if (Number(chainId) !== 143) {
        console.error("❌ ERROR: This script is for Monad Mainnet (chain ID 143)");
        process.exit(1);
    }

    // Check current configuration
    console.log("--- Checking Current Configuration ---");
    const abi = ["function cellarHook() view returns (address)"];
    const cellarZap = new ethers.Contract(CELLAR_ZAP, abi, ethers.provider);
    const currentHook = await cellarZap.cellarHook();
    console.log("Current CellarHook:", currentHook);

    if (currentHook.toLowerCase() === NEW_POOL.toLowerCase()) {
        console.log("✅ CellarZap is already pointing to NEW POOL!");
        console.log("No update needed.");
        return;
    }

    if (currentHook.toLowerCase() === OLD_POOL.toLowerCase()) {
        console.log("❌ CellarZap is pointing to OLD POOL - needs update!");
    } else {
        console.log("⚠️  CellarZap is pointing to unknown address - will update to NEW POOL");
    }

    // Upgrade CellarZap to add setCellarHook function
    console.log("\n--- Upgrading CellarZap Contract ---");
    console.log("This will add the setCellarHook function");

    const CellarZapV4 = await ethers.getContractFactory("CellarZapV4");

    try {
        const upgraded = await upgrades.upgradeProxy(CELLAR_ZAP, CellarZapV4);
        await upgraded.waitForDeployment();
        console.log("✅ CellarZap upgraded successfully");

        const newImpl = await upgrades.erc1967.getImplementationAddress(CELLAR_ZAP);
        console.log("New Implementation:", newImpl);
    } catch (error: any) {
        console.error("❌ Upgrade failed:", error.message);
        if (error.data) {
            console.error("Error data:", error.data);
        }
        process.exit(1);
    }

    // Update cellarHook address
    console.log("\n--- Updating CellarHook Address ---");
    const CellarZapWithSetter = await ethers.getContractFactory("CellarZapV4");
    const cellarZapInstance = CellarZapWithSetter.attach(CELLAR_ZAP);

    try {
        console.log("Setting cellarHook to:", NEW_POOL);
        const tx = await cellarZapInstance.setCellarHook(NEW_POOL);
        console.log("Transaction hash:", tx.hash);
        await tx.wait();
        console.log("✅ CellarHook address updated!");

        // Verify
        const updatedHook = await cellarZapInstance.cellarHook();
        if (updatedHook.toLowerCase() === NEW_POOL.toLowerCase()) {
            console.log("✅ Verification: CellarZap now points to NEW POOL");
        } else {
            console.error("❌ Verification failed: Still pointing to", updatedHook);
        }
    } catch (error: any) {
        console.error("❌ Failed to update cellarHook:", error.message);
        if (error.data) {
            console.error("Error data:", error.data);
        }
        process.exit(1);
    }

    console.log("\n=== UPDATE COMPLETE ===");
    console.log("CellarZap is now configured to use the NEW POOL");
    console.log("Future LP mints will go to the new pool!");
}

main().catch((error) => {
    console.error("❌ Script failed:", error);
    process.exitCode = 1;
});

