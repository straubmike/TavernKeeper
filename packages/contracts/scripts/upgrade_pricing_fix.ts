import { ethers, upgrades } from "hardhat";
import { updateFrontendAddresses } from "./updateFrontend";
import { updateDeploymentTracker } from "./updateDeploymentTracker";

async function main() {
    const [deployer] = await ethers.getSigners();
    console.log("=== UPGRADING PRICING LOGIC ===");
    console.log("Deployer:", deployer.address);

    // Get Proxy Addresses from Environment or Hardcoded (Fallback)
    // Ideally these should come from the deployment tracker or env
    // For this script, we will try to read them from env or use the ones from previous deployment logs if available
    // But since we don't have easy access to dynamic env vars here without dotenv loading, 
    // we will rely on the user providing them or hardcoding the known ones from the project context if possible.
    // However, to be safe and robust, we will try to read from the addresses file or expect them in env.

    // Let's assume the user has the addresses in their .env or we can fetch them from the tracker if we had one loaded.
    // Since we don't want to hardcode addresses that might change, we will check for them.

    const TAVERNKEEPER_PROXY = process.env.TAVERNKEEPER_ADDRESS;
    const CELLAR_HOOK_PROXY = process.env.CELLAR_HOOK_ADDRESS || process.env.THE_CELLAR_ADDRESS;

    if (!TAVERNKEEPER_PROXY || !CELLAR_HOOK_PROXY) {
        console.error("❌ Missing Proxy Addresses in Environment Variables!");
        console.error("Please set TAVERNKEEPER_ADDRESS and CELLAR_HOOK_ADDRESS in your .env file.");
        process.exit(1);
    }

    console.log("TavernKeeper Proxy:", TAVERNKEEPER_PROXY);
    console.log("CellarHook Proxy:", CELLAR_HOOK_PROXY);

    // 1. Upgrade TavernKeeper
    console.log("\n--- Upgrading TavernKeeper ---");
    const TavernKeeper = await ethers.getContractFactory("TavernKeeper");

    // Validate implementation
    const currentTavernKeeperImpl = await upgrades.erc1967.getImplementationAddress(TAVERNKEEPER_PROXY);
    console.log("Current TavernKeeper Impl:", currentTavernKeeperImpl);

    const tavernKeeper = await upgrades.upgradeProxy(TAVERNKEEPER_PROXY, TavernKeeper);
    await tavernKeeper.waitForDeployment();

    const newTavernKeeperImpl = await upgrades.erc1967.getImplementationAddress(TAVERNKEEPER_PROXY);
    console.log("✅ TavernKeeper Upgraded. New Impl:", newTavernKeeperImpl);

    // 2. Upgrade CellarHook
    console.log("\n--- Upgrading CellarHook ---");
    const CellarHook = await ethers.getContractFactory("CellarHook");

    // Validate implementation
    const currentCellarHookImpl = await upgrades.erc1967.getImplementationAddress(CELLAR_HOOK_PROXY);
    console.log("Current CellarHook Impl:", currentCellarHookImpl);

    const cellarHook = await upgrades.upgradeProxy(CELLAR_HOOK_PROXY, CellarHook);
    await cellarHook.waitForDeployment();

    const newCellarHookImpl = await upgrades.erc1967.getImplementationAddress(CELLAR_HOOK_PROXY);
    console.log("✅ CellarHook Upgraded. New Impl:", newCellarHookImpl);

    // 3. Update Frontend Addresses
    console.log("\n--- Updating Frontend Addresses ---");
    await updateFrontendAddresses({
        TAVERNKEEPER: TAVERNKEEPER_PROXY,
        TAVERNKEEPER_IMPL: newTavernKeeperImpl,
        THE_CELLAR: CELLAR_HOOK_PROXY,
        THE_CELLAR_IMPL: newCellarHookImpl
    });

    // 4. Update Deployment Tracker (Optional but good practice)
    await updateDeploymentTracker({
        TAVERNKEEPER: TAVERNKEEPER_PROXY,
        CELLAR_HOOK: CELLAR_HOOK_PROXY
    });

    console.log("\n============================================");
    console.log("UPGRADE COMPLETE");
    console.log("============================================");
}

main().catch((error) => {
    console.error(error);
    process.exitCode = 1;
});
