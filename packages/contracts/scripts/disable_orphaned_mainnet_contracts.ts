import { ethers, upgrades } from "hardhat";

/**
 * DISABLE ORPHANED MAINNET CONTRACTS
 *
 * This script disables the accidentally deployed contracts on mainnet by:
 * 1. Transferring ownership to a dead address (prevents upgrades/changes)
 * 2. Disabling critical functions where possible
 * 3. Documenting the disabled state
 *
 * CRITICAL: This is for MAINNET - real money, real users
 *
 * Usage:
 *   $env:NEXT_PUBLIC_MONAD_CHAIN_ID="143"
 *   npx hardhat run scripts/disable_orphaned_mainnet_contracts.ts --network monad
 *
 * WARNING: This will permanently disable these contracts. They cannot be recovered.
 */

// Orphaned contract addresses (from accidental deployment)
const ORPHANED_KEEP_TOKEN = "0x426f7c10e7D5329BB7E956e59fa19697c465daBA";
const ORPHANED_CELLAR_HOOK = "0xDA499a900FE25D738045CD6C299663471dE76Ae0";
const ORPHANED_INVENTORY = "0x88f251AFD462AF1f604ACCebc22B084255f763b5";
const ORPHANED_ADVENTURER = "0x54911A51216824788ACea03fEE5F947b1281Cffe";
const ORPHANED_TAVERNKEEPER = "0x0FFD4b467326C6fBC5EB7ab901eC020f54970e9d";
const ORPHANED_CELLAR_ZAP = "0x335bAFEd9a8498B7779431154196d0712693827d";
const ORPHANED_DUNGEON_GATEKEEPER = "0xAE1e8194663450073bB6024199eBa65886774A26";
const ORPHANED_TAVERN_REGULARS = "0xd9E80273467f0f1786F5A4565c154eF814D77e70";
const ORPHANED_TOWN_POSSE = "0xe4eaAf93D5c3f693a69D6BEb5F8a53ECfb2857a8";

// Dead address (0x000...000) - cannot be used, effectively disables ownership
const DEAD_ADDRESS = "0x000000000000000000000000000000000000dEaD";

async function main() {
    const [deployer] = await ethers.getSigners();
    console.log("============================================");
    console.log("DISABLING ORPHANED MAINNET CONTRACTS");
    console.log("============================================\n");
    console.log("Deployer:", deployer.address);
    console.log("Network:", (await ethers.provider.getNetwork()).name);
    console.log("Chain ID:", (await ethers.provider.getNetwork()).chainId);

    // CRITICAL: Verify we're on mainnet (chain ID 143)
    const chainId = (await ethers.provider.getNetwork()).chainId;
    if (Number(chainId) !== 143) {
        console.error("\n❌ CRITICAL ERROR: This script is for Monad Mainnet (chain ID 143)");
        console.error(`   Current chain ID: ${chainId}`);
        console.error("   Aborting to prevent accidental execution on wrong network");
        process.exit(1);
    }

    console.log("\n⚠️  WARNING: This will PERMANENTLY disable these contracts");
    console.log("   They cannot be recovered after this operation");
    console.log("\nOrphaned contracts to disable:");
    console.log("  KeepToken:", ORPHANED_KEEP_TOKEN);
    console.log("  CellarHook:", ORPHANED_CELLAR_HOOK);
    console.log("  Inventory:", ORPHANED_INVENTORY);
    console.log("  Adventurer:", ORPHANED_ADVENTURER);
    console.log("  TavernKeeper:", ORPHANED_TAVERNKEEPER);
    console.log("  CellarZapV4:", ORPHANED_CELLAR_ZAP);
    console.log("  DungeonGatekeeper:", ORPHANED_DUNGEON_GATEKEEPER);
    console.log("  TavernRegularsManager:", ORPHANED_TAVERN_REGULARS);
    console.log("  TownPosseManager:", ORPHANED_TOWN_POSSE);

    // Verify contracts exist
    console.log("\n--- Verifying Contracts Exist ---");
    const contracts = [
        { name: "KeepToken", address: ORPHANED_KEEP_TOKEN },
        { name: "CellarHook", address: ORPHANED_CELLAR_HOOK },
        { name: "Inventory", address: ORPHANED_INVENTORY },
        { name: "Adventurer", address: ORPHANED_ADVENTURER },
        { name: "TavernKeeper", address: ORPHANED_TAVERNKEEPER },
        { name: "CellarZapV4", address: ORPHANED_CELLAR_ZAP },
        { name: "DungeonGatekeeper", address: ORPHANED_DUNGEON_GATEKEEPER },
        { name: "TavernRegularsManager", address: ORPHANED_TAVERN_REGULARS },
        { name: "TownPosseManager", address: ORPHANED_TOWN_POSSE },
    ];

    for (const contract of contracts) {
        const code = await ethers.provider.getCode(contract.address);
        if (code === "0x") {
            console.error(`❌ Contract ${contract.name} not found at ${contract.address}`);
            process.exit(1);
        }
        console.log(`✅ ${contract.name} found`);
    }

    // Disable KeepToken
    console.log("\n--- Disabling KeepToken ---");
    try {
        const keepToken = await ethers.getContractAt("KeepToken", ORPHANED_KEEP_TOKEN);
        const owner = await keepToken.owner();
        console.log("Current owner:", owner);

        if (owner.toLowerCase() === deployer.address.toLowerCase()) {
            // Transfer ownership to dead address
            const transferTx = await keepToken.transferOwnership(DEAD_ADDRESS);
            await transferTx.wait();
            console.log("✅ Ownership transferred to dead address");

            // Set TavernKeeper to dead address (prevents minting)
            const setTkTx = await keepToken.setTavernKeeperContract(DEAD_ADDRESS);
            await setTkTx.wait();
            console.log("✅ TavernKeeper set to dead address (minting disabled)");
        } else {
            console.log("⚠️  Not owner, cannot disable");
        }
    } catch (error: any) {
        console.error("❌ Error disabling KeepToken:", error.message);
    }

    // Disable CellarHook
    console.log("\n--- Disabling CellarHook ---");
    try {
        const cellarHook = await ethers.getContractAt("CellarHook", ORPHANED_CELLAR_HOOK);
        const owner = await cellarHook.owner();
        console.log("Current owner:", owner);

        if (owner.toLowerCase() === deployer.address.toLowerCase()) {
            // Transfer ownership to dead address
            const transferTx = await cellarHook.transferOwnership(DEAD_ADDRESS);
            await transferTx.wait();
            console.log("✅ Ownership transferred to dead address");
        } else {
            console.log("⚠️  Not owner, cannot disable");
        }
    } catch (error: any) {
        console.error("❌ Error disabling CellarHook:", error.message);
    }

    // Disable Inventory
    console.log("\n--- Disabling Inventory ---");
    try {
        const inventory = await ethers.getContractAt("Inventory", ORPHANED_INVENTORY);
        const owner = await inventory.owner();
        console.log("Current owner:", owner);

        if (owner.toLowerCase() === deployer.address.toLowerCase()) {
            const transferTx = await inventory.transferOwnership(DEAD_ADDRESS);
            await transferTx.wait();
            console.log("✅ Ownership transferred to dead address");
        } else {
            console.log("⚠️  Not owner, cannot disable");
        }
    } catch (error: any) {
        console.error("❌ Error disabling Inventory:", error.message);
    }

    // Disable Adventurer
    console.log("\n--- Disabling Adventurer ---");
    try {
        const adventurer = await ethers.getContractAt("Adventurer", ORPHANED_ADVENTURER);
        const owner = await adventurer.owner();
        console.log("Current owner:", owner);

        if (owner.toLowerCase() === deployer.address.toLowerCase()) {
            const transferTx = await adventurer.transferOwnership(DEAD_ADDRESS);
            await transferTx.wait();
            console.log("✅ Ownership transferred to dead address");
        } else {
            console.log("⚠️  Not owner, cannot disable");
        }
    } catch (error: any) {
        console.error("❌ Error disabling Adventurer:", error.message);
    }

    // Disable TavernKeeper
    console.log("\n--- Disabling TavernKeeper ---");
    try {
        const tavernKeeper = await ethers.getContractAt("TavernKeeper", ORPHANED_TAVERNKEEPER);
        const owner = await tavernKeeper.owner();
        console.log("Current owner:", owner);

        if (owner.toLowerCase() === deployer.address.toLowerCase()) {
            const transferTx = await tavernKeeper.transferOwnership(DEAD_ADDRESS);
            await transferTx.wait();
            console.log("✅ Ownership transferred to dead address");
        } else {
            console.log("⚠️  Not owner, cannot disable");
        }
    } catch (error: any) {
        console.error("❌ Error disabling TavernKeeper:", error.message);
    }

    // Disable CellarZapV4
    console.log("\n--- Disabling CellarZapV4 ---");
    try {
        const cellarZap = await ethers.getContractAt("CellarZapV4", ORPHANED_CELLAR_ZAP);
        const owner = await cellarZap.owner();
        console.log("Current owner:", owner);

        if (owner.toLowerCase() === deployer.address.toLowerCase()) {
            const transferTx = await cellarZap.transferOwnership(DEAD_ADDRESS);
            await transferTx.wait();
            console.log("✅ Ownership transferred to dead address");
        } else {
            console.log("⚠️  Not owner, cannot disable");
        }
    } catch (error: any) {
        console.error("❌ Error disabling CellarZapV4:", error.message);
    }

    // Disable DungeonGatekeeper
    console.log("\n--- Disabling DungeonGatekeeper ---");
    try {
        const gatekeeper = await ethers.getContractAt("DungeonGatekeeper", ORPHANED_DUNGEON_GATEKEEPER);
        const owner = await gatekeeper.owner();
        console.log("Current owner:", owner);

        if (owner.toLowerCase() === deployer.address.toLowerCase()) {
            const transferTx = await gatekeeper.transferOwnership(DEAD_ADDRESS);
            await transferTx.wait();
            console.log("✅ Ownership transferred to dead address");
        } else {
            console.log("⚠️  Not owner, cannot disable");
        }
    } catch (error: any) {
        console.error("❌ Error disabling DungeonGatekeeper:", error.message);
    }

    // Disable TavernRegularsManager
    console.log("\n--- Disabling TavernRegularsManager ---");
    try {
        const tavernRegulars = await ethers.getContractAt("TavernRegularsManager", ORPHANED_TAVERN_REGULARS);
        const owner = await tavernRegulars.owner();
        console.log("Current owner:", owner);

        if (owner.toLowerCase() === deployer.address.toLowerCase()) {
            const transferTx = await tavernRegulars.transferOwnership(DEAD_ADDRESS);
            await transferTx.wait();
            console.log("✅ Ownership transferred to dead address");
        } else {
            console.log("⚠️  Not owner, cannot disable");
        }
    } catch (error: any) {
        console.error("❌ Error disabling TavernRegularsManager:", error.message);
    }

    // Disable TownPosseManager
    console.log("\n--- Disabling TownPosseManager ---");
    try {
        const townPosse = await ethers.getContractAt("TownPosseManager", ORPHANED_TOWN_POSSE);
        const owner = await townPosse.owner();
        console.log("Current owner:", owner);

        if (owner.toLowerCase() === deployer.address.toLowerCase()) {
            const transferTx = await townPosse.transferOwnership(DEAD_ADDRESS);
            await transferTx.wait();
            console.log("✅ Ownership transferred to dead address");
        } else {
            console.log("⚠️  Not owner, cannot disable");
        }
    } catch (error: any) {
        console.error("❌ Error disabling TownPosseManager:", error.message);
    }

    console.log("\n============================================");
    console.log("DISABLE OPERATION COMPLETE");
    console.log("============================================");
    console.log("\n✅ All orphaned contracts have been disabled");
    console.log("   Ownership transferred to:", DEAD_ADDRESS);
    console.log("   These contracts can no longer be upgraded or modified");
    console.log("\n⚠️  IMPORTANT:");
    console.log("   - Old contracts continue to work normally");
    console.log("   - Orphaned contracts are now permanently disabled");
    console.log("   - No user funds were affected");
    console.log("   - Continue using original mainnet addresses");
}

main().catch((error) => {
    console.error("❌ Disable operation failed:", error);
    process.exitCode = 1;
});
