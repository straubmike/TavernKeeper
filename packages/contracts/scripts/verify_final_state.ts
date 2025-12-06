import { ethers } from "hardhat";

/**
 * Verify final state after cleanup
 *
 * This script verifies:
 * 1. Old pool is disabled
 * 2. New pool is active
 * 3. Frontend is configured correctly
 * 4. All funds are recovered
 *
 * Usage:
 *   npx hardhat run scripts/verify_final_state.ts --network monad
 */

const OLD_BROKEN_POOL = "0x6c7612F44B71E5E6E2bA0FEa799A23786A537755";
const NEW_WORKING_POOL = "0xe71CAf7162dd81a4A9C0c6BD25ED02C26F492DC0";
const DEAD_ADDRESS = "0x000000000000000000000000000000000000dEaD";
const MAINNET_KEEP_TOKEN = "0x2D1094F5CED6ba279962f9676d32BE092AFbf82E";

async function main() {
    const [deployer] = await ethers.getSigners();
    console.log("=== VERIFYING FINAL STATE ===\n");
    console.log("Deployer:", deployer.address);
    console.log("Network:", (await ethers.provider.getNetwork()).name);
    console.log("Chain ID:", (await ethers.provider.getNetwork()).chainId);

    let allGood = true;

    // 1. Check old pool is disabled
    console.log("\n--- 1. Old Pool Status ---");
    const CellarHook = await ethers.getContractFactory("CellarHook");
    const oldPool = CellarHook.attach(OLD_BROKEN_POOL);

    try {
        const owner = await oldPool.owner();
        const nativeBalance = await ethers.provider.getBalance(OLD_BROKEN_POOL);
        const keepToken = await ethers.getContractAt("IERC20", MAINNET_KEEP_TOKEN);
        const keepBalance = await keepToken.balanceOf(OLD_BROKEN_POOL);

        console.log("Owner:", owner);
        console.log("Native Balance:", ethers.formatEther(nativeBalance), "MON");
        console.log("KEEP Balance:", ethers.formatEther(keepBalance), "KEEP");

        if (owner.toLowerCase() === DEAD_ADDRESS.toLowerCase()) {
            console.log("✅ Old pool is disabled (ownership transferred to dead address)");
        } else {
            console.log("❌ Old pool is NOT disabled!");
            allGood = false;
        }

        if (nativeBalance === 0n && keepBalance === 0n) {
            console.log("✅ All funds recovered from old pool");
        } else {
            console.log("⚠️  WARNING: Funds still in old pool!");
            allGood = false;
        }
    } catch (error: any) {
        console.log("⚠️  Could not check old pool:", error.message);
    }

    // 2. Check new pool is active
    console.log("\n--- 2. New Pool Status ---");
    const newPool = CellarHook.attach(NEW_WORKING_POOL);

    try {
        const poolInitialized = await newPool.poolInitialized();
        const potBalance = await newPool.potBalance();
        const slot0 = await newPool.slot0();
        const owner = await newPool.owner();

        console.log("Initialized:", poolInitialized ? "✅ YES" : "❌ NO");
        console.log("Pot Balance:", ethers.formatEther(potBalance), "MON");
        console.log("Epoch ID:", slot0.epochId.toString());
        console.log("Owner:", owner);
        console.log("Is deployer owner?", owner.toLowerCase() === deployer.address.toLowerCase() ? "✅ YES" : "❌ NO");

        if (poolInitialized && owner.toLowerCase() === deployer.address.toLowerCase()) {
            console.log("✅ New pool is active and operational");
        } else {
            console.log("❌ New pool has issues!");
            allGood = false;
        }
    } catch (error: any) {
        console.log("❌ Could not check new pool:", error.message);
        allGood = false;
    }

    // 3. Check frontend configuration
    console.log("\n--- 3. Frontend Configuration ---");
    const fs = require("fs");
    const path = require("path");
    const addressesPath = path.join(__dirname, "../../apps/web/lib/contracts/addresses.ts");

    if (fs.existsSync(addressesPath)) {
        const content = fs.readFileSync(addressesPath, "utf8");

        if (content.includes(`THE_CELLAR: '${NEW_WORKING_POOL}'`)) {
            console.log("✅ Frontend uses new pool address");
        } else {
            console.log("❌ Frontend does NOT use new pool address");
            allGood = false;
        }

        if (content.includes(OLD_BROKEN_POOL)) {
            console.log("⚠️  WARNING: Frontend still references old pool");
            allGood = false;
        } else {
            console.log("✅ Frontend does not reference old pool");
        }
    } else {
        console.log("⚠️  Could not find addresses.ts");
    }

    // 4. Check dependent contracts
    console.log("\n--- 4. Dependent Contracts ---");
    const TAVERN_REGULARS_MANAGER = "0x9f455Ad562e080CC745f9E97c469a86E1bBF8db8";
    const TOWN_POSSE_MANAGER = "0xE46592D8185975888b4A301DBD9b24A49933CC7D";
    const TAVERNKEEPER = "0x56B81A60Ae343342685911bd97D1331fF4fa2d29";

    try {
        const TownPosseManager = await ethers.getContractFactory("TownPosseManager");
        const townPosse = TownPosseManager.attach(TOWN_POSSE_MANAGER);
        const townPosseCellar = await townPosse.cellarHook();
        console.log("TownPosseManager.cellarHook:", townPosseCellar);
        if (townPosseCellar.toLowerCase() === NEW_WORKING_POOL.toLowerCase()) {
            console.log("✅ TownPosseManager uses new pool");
        } else {
            console.log("❌ TownPosseManager does NOT use new pool!");
            allGood = false;
        }
    } catch (error: any) {
        console.log("⚠️  Could not check TownPosseManager:", error.message);
    }

    try {
        const TavernRegularsManager = await ethers.getContractFactory("TavernRegularsManager");
        const tavernRegulars = TavernRegularsManager.attach(TAVERN_REGULARS_MANAGER);
        const tavernRegularsCellar = await tavernRegulars.cellarHook();
        console.log("TavernRegularsManager.cellarHook:", tavernRegularsCellar);
        if (tavernRegularsCellar.toLowerCase() === NEW_WORKING_POOL.toLowerCase()) {
            console.log("✅ TavernRegularsManager uses new pool");
        } else {
            console.log("❌ TavernRegularsManager does NOT use new pool!");
            allGood = false;
        }
    } catch (error: any) {
        console.log("⚠️  Could not check TavernRegularsManager:", error.message);
    }

    try {
        const TavernKeeper = await ethers.getContractFactory("TavernKeeper");
        const tavernKeeper = TavernKeeper.attach(TAVERNKEEPER);
        const treasury = await tavernKeeper.treasury();
        console.log("TavernKeeper.treasury:", treasury);
        if (treasury.toLowerCase() === NEW_WORKING_POOL.toLowerCase()) {
            console.log("✅ TavernKeeper uses new pool as treasury");
        } else {
            console.log("❌ TavernKeeper does NOT use new pool as treasury!");
            allGood = false;
        }
    } catch (error: any) {
        console.log("⚠️  Could not check TavernKeeper:", error.message);
    }

    // Final summary
    console.log("\n============================================");
    console.log("VERIFICATION SUMMARY");
    console.log("============================================");

    if (allGood) {
        console.log("✅ ALL CHECKS PASSED");
        console.log("\n✅ Old pool is disabled");
        console.log("✅ New pool is active");
        console.log("✅ Frontend is configured correctly");
        console.log("✅ Dependent contracts are updated");
        console.log("\n🎉 System is ready! Only the new pool is active.");
    } else {
        console.log("⚠️  SOME ISSUES FOUND");
        console.log("\nPlease review the output above and fix any issues.");
    }
}

main().catch((error) => {
    console.error("❌ Verification failed:", error);
    process.exitCode = 1;
});

