import * as fs from "fs";
import { ethers, upgrades } from "hardhat";
import * as path from "path";

/**
 * Upgrade CellarHook on localhost with the pool initialization fix
 * This upgrades the existing proxy to the new implementation
 */

async function main() {
    console.log("=== UPGRADING CELLARHOOK ON LOCALHOST ===");
    const [deployer] = await ethers.getSigners();
    console.log("Deployer:", deployer.address);

    // Read addresses from addresses.ts
    // Try multiple potential paths
    const potentialPaths = [
        "C:\\Users\\epj33\\Desktop\\InnKeeper\\apps\\web\\lib\\contracts\\addresses.ts",
        path.join(process.cwd(), "..", "apps", "web", "lib", "contracts", "addresses.ts"),
        path.join(process.cwd(), "..", "..", "apps", "web", "lib", "contracts", "addresses.ts"),
        path.join(__dirname, "..", "..", "apps", "web", "lib", "contracts", "addresses.ts")
    ];

    let addressesPath = "";
    for (const p of potentialPaths) {
        if (fs.existsSync(p)) {
            addressesPath = p;
            break;
        }
    }

    let CELLAR_HOOK_PROXY = "";

    if (addressesPath) {
        console.log("Reading addresses from:", addressesPath);
        const addressesContent = fs.readFileSync(addressesPath, "utf-8");

        // Robust regex to find LOCALHOST_ADDRESSES and THE_CELLAR
        // Handles optional whitespace, newlines, and 'as Address'
        const localhostMatch = addressesContent.match(/LOCALHOST_ADDRESSES[\s\S]*?THE_CELLAR:\s*['"](0x[a-fA-F0-9]{40})['"]/);

        if (localhostMatch && localhostMatch[1]) {
            CELLAR_HOOK_PROXY = localhostMatch[1];
        }
    } else {
        console.error("❌ addresses.ts not found in any expected location");
    }

    if (!CELLAR_HOOK_PROXY) {
        console.error("❌ Could not find CELLAR_HOOK_PROXY in addresses.ts");
        process.exit(1);
    }

    console.log("CellarHook Proxy:", CELLAR_HOOK_PROXY);

    // Deploy new implementation
    console.log("\n--- Deploying New Implementation ---");
    const CellarHook = await ethers.getContractFactory("CellarHook");
    const newImplementation = await CellarHook.deploy();
    await newImplementation.waitForDeployment();
    const newImplAddress = await newImplementation.getAddress();
    console.log("New Implementation:", newImplAddress);

    // Upgrade proxy
    console.log("\n--- Upgrading Proxy ---");
    const proxy = await upgrades.upgradeProxy(CELLAR_HOOK_PROXY, CellarHook);
    await proxy.waitForDeployment();
    console.log("✅ Proxy upgraded successfully!");

    // Verify upgrade
    console.log("\n--- Verifying Upgrade ---");
    const implementationAddress = await upgrades.erc1967.getImplementationAddress(CELLAR_HOOK_PROXY);
    console.log("Current Implementation:", implementationAddress);

    if (implementationAddress.toLowerCase() === newImplAddress.toLowerCase()) {
        console.log("✅ Upgrade verified - implementation matches");
    } else {
        console.log("⚠️  Implementation address mismatch");
    }

    console.log("\n=== UPGRADE COMPLETE ===");
    console.log("You can now test the pool initialization fix");
}

main().catch((error) => {
    console.error("❌ Upgrade failed:", error);
    process.exitCode = 1;
});
