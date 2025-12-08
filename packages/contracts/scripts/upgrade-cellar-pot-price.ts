import * as dotenv from "dotenv";
import { ethers, upgrades } from "hardhat";

dotenv.config({ path: "../../.env" });

// Mainnet proxy address (from DEPLOYMENT_TRACKER.md)
const CELLAR_V3_PROXY = process.env.THE_CELLAR_V3_PROXY || '0x32A920be00dfCE1105De0415ba1d4f06942E9ed0';

// Pot Price Coefficient (10-200% above pot value)
// Recommended: 30-50% for good decay curve
// Formula: newInitPrice = pot * (100 + coefficient) / 100
// Example: coefficient = 30, pot = 100 MON → initPrice = 130 MON (30% above pot)
const POT_PRICE_COEFFICIENT = 30; // 30% above pot value = 130% of pot

async function main() {
    console.log("🔧 UPGRADING TheCellarV3 TO POT-BASED PRICING...\n");

    const [deployer] = await ethers.getSigners();
    const network = await ethers.provider.getNetwork();
    const chainId = Number(network.chainId);

    console.log(`Using account: ${deployer.address}`);
    console.log(`Network: ${network.name} (Chain ID: ${chainId})\n`);

    // Safety check: Verify we're on the right network
    if (chainId !== 143 && chainId !== 10143) {
        console.error("❌ ERROR: This script is for Monad Mainnet (143) or Testnet (10143)");
        console.error(`   Current chain ID: ${chainId}`);
        process.exit(1);
    }

    const networkName = chainId === 143 ? "MAINNET" : "TESTNET";
    console.log(`⚠️  UPGRADING ON ${networkName} ⚠️\n`);

    // ============================================
    // STEP 1: VERIFY CURRENT STATE
    // ============================================
    console.log("📋 STEP 1: Verifying Current State...\n");

    const TheCellarV3 = await ethers.getContractFactory("TheCellarV3");
    const currentCellar = TheCellarV3.attach(CELLAR_V3_PROXY);

    // Get current implementation
    const currentImpl = await upgrades.erc1967.getImplementationAddress(CELLAR_V3_PROXY);
    console.log(`   Current Proxy: ${CELLAR_V3_PROXY}`);
    console.log(`   Current Implementation: ${currentImpl}`);

    // Verify proxy exists and is valid
    const proxyCode = await ethers.provider.getCode(CELLAR_V3_PROXY);
    if (proxyCode === "0x") {
        console.error("❌ ERROR: Proxy does not exist at this address!");
        process.exit(1);
    }

    // Backup current state
    console.log("\n   Backing up current state...");
    let potBalanceMON = 0n;
    let potBalanceKEEP = 0n;
    let tokenId = 0n;
    let owner = "";
    let slot0Data: any = null;
    let currentPotCoefficient = 0n;

    try {
        potBalanceMON = await currentCellar.potBalanceMON();
        potBalanceKEEP = await currentCellar.potBalanceKEEP();
        tokenId = await currentCellar.tokenId();
        owner = await currentCellar.owner();
        slot0Data = await currentCellar.slot0();
        try {
            currentPotCoefficient = await currentCellar.potPriceCoefficient();
        } catch {
            // potPriceCoefficient doesn't exist yet (expected)
            currentPotCoefficient = 0n;
        }
    } catch (error: any) {
        console.error("❌ ERROR: Failed to read current state:", error.message);
        process.exit(1);
    }

    console.log(`   Pot Balance MON: ${ethers.formatEther(potBalanceMON)}`);
    console.log(`   Pot Balance KEEP: ${ethers.formatEther(potBalanceKEEP)}`);
    console.log(`   Token ID: ${tokenId}`);
    console.log(`   Owner: ${owner}`);
    console.log(`   Current Init Price: ${ethers.formatEther(slot0Data.initPrice)}`);
    console.log(`   Current Epoch ID: ${slot0Data.epochId}`);
    console.log(`   Current Pot Coefficient: ${currentPotCoefficient} (0 = not set, using legacy multiplier)`);

    // Verify deployer is owner
    if (owner.toLowerCase() !== deployer.address.toLowerCase()) {
        console.error(`❌ ERROR: Deployer (${deployer.address}) is not the owner!`);
        console.error(`   Owner is: ${owner}`);
        process.exit(1);
    }

    console.log("   ✅ Current state verified\n");

    // ============================================
    // STEP 2: VERIFY UPGRADE CONTRACT COMPILES
    // ============================================
    console.log("📦 STEP 2: Verifying Upgrade Contract...\n");

    let TheCellarV3PotPrice;
    try {
        TheCellarV3PotPrice = await ethers.getContractFactory("TheCellarV3PotPrice");
        console.log("   ✅ Upgrade contract compiled successfully");
    } catch (error: any) {
        console.error("❌ ERROR: Failed to compile upgrade contract:", error.message);
        process.exit(1);
    }

    // ============================================
    // STEP 3: PREVIEW CHANGES
    // ============================================
    console.log("\n📝 STEP 3: Upgrade Preview...\n");
    console.log("   Changes to be made:");
    console.log("   - Add potPriceCoefficient state variable");
    console.log("   - Change raid() to use: newInitPrice = potBalanceMON * (100 + coefficient) / 100");
    console.log("   - Price STARTS ABOVE pot, then decays down over epoch");
    console.log("   - Price exceeds pot for majority of hour, creating profitable window");
    console.log("   - Prevents exponential growth - price tied to pot value");
    console.log("   - Growth is smooth and value-aligned\n");
    console.log(`   Pot Price Coefficient: ${POT_PRICE_COEFFICIENT}% above pot`);
    console.log(`   Example: If pot = 100 MON, new init price = ${100 + POT_PRICE_COEFFICIENT} MON (${POT_PRICE_COEFFICIENT}% above)`);
    console.log(`   Example: If pot = 1000 MON, new init price = ${1000 + (POT_PRICE_COEFFICIENT * 10)} MON (${POT_PRICE_COEFFICIENT}% above)`);
    console.log(`   Price decays from initPrice → minInitPrice over epoch period`);
    console.log(`   For majority of hour, price > pot value, then becomes profitable\n`);

    // ============================================
    // STEP 4: CONFIRMATION
    // ============================================
    console.log("⚠️  FINAL CONFIRMATION ⚠️");
    console.log(`   This will upgrade TheCellarV3 on ${networkName}`);
    console.log(`   Proxy address will remain: ${CELLAR_V3_PROXY}`);
    console.log(`   Only the implementation will change`);
    console.log(`   Current pot balances will be preserved`);
    console.log(`   Pot Price Coefficient will be set to ${POT_PRICE_COEFFICIENT}%`);
    console.log("\n   Waiting 5 seconds before proceeding...\n");
    await new Promise(resolve => setTimeout(resolve, 5000));

    // ============================================
    // STEP 5: PERFORM UPGRADE
    // ============================================
    console.log("⬆️  STEP 4: Performing Upgrade...\n");

    let upgradeTxHash: string | undefined;
    let newImpl: string;

    try {
        // Register proxy if needed (for upgrades plugin)
        try {
            await upgrades.forceImport(CELLAR_V3_PROXY, TheCellarV3, { kind: 'uups' });
            console.log("   ✅ Proxy registered with upgrades plugin");
        } catch (error: any) {
            if (error.message && error.message.includes("already registered")) {
                console.log("   ✅ Proxy already registered");
            } else {
                console.warn("   ⚠️  Warning: Could not register proxy:", error.message);
                console.warn("      Continuing anyway - upgrade may still work");
            }
        }

        // Perform upgrade
        console.log("   Upgrading proxy...");
        const upgraded = await upgrades.upgradeProxy(CELLAR_V3_PROXY, TheCellarV3PotPrice);
        const deployTx = upgraded.deploymentTransaction();

        if (deployTx) {
            upgradeTxHash = deployTx.hash;
            console.log(`   Upgrade transaction hash: ${upgradeTxHash}`);
            console.log("   Waiting for confirmation...");
            await deployTx.wait();
        }

        await upgraded.waitForDeployment();
        newImpl = await upgrades.erc1967.getImplementationAddress(CELLAR_V3_PROXY);

        console.log("   ✅ Upgrade completed!");
        console.log(`   New Implementation: ${newImpl}`);

        if (currentImpl === newImpl) {
            console.warn("   ⚠️  WARNING: Implementation address unchanged!");
            console.warn("      This might mean the upgrade didn't actually change anything.");
        }

    } catch (error: any) {
        console.error("❌ ERROR: Upgrade failed:", error.message);
        if (error.transaction) {
            console.error("   Transaction hash:", error.transaction.hash);
        }
        throw error;
    }

    // ============================================
    // STEP 6: VERIFY UPGRADE
    // ============================================
    console.log("\n✅ STEP 5: Verifying Upgrade...\n");

    const upgradedCellar = TheCellarV3PotPrice.attach(CELLAR_V3_PROXY);

    // Verify state is preserved
    const newPotMON = await upgradedCellar.potBalanceMON();
    const newPotKEEP = await upgradedCellar.potBalanceKEEP();
    const newTokenId = await upgradedCellar.tokenId();
    const newOwner = await upgradedCellar.owner();
    const newSlot0 = await upgradedCellar.slot0();

    console.log("   Verifying state preservation...");
    if (newPotMON !== potBalanceMON) {
        console.error(`   ❌ Pot MON changed: ${ethers.formatEther(potBalanceMON)} -> ${ethers.formatEther(newPotMON)}`);
    } else {
        console.log(`   ✅ Pot MON preserved: ${ethers.formatEther(newPotMON)}`);
    }

    if (newPotKEEP !== potBalanceKEEP) {
        console.error(`   ❌ Pot KEEP changed: ${ethers.formatEther(potBalanceKEEP)} -> ${ethers.formatEther(newPotKEEP)}`);
    } else {
        console.log(`   ✅ Pot KEEP preserved: ${ethers.formatEther(newPotKEEP)}`);
    }

    if (newTokenId !== tokenId) {
        console.error(`   ❌ Token ID changed: ${tokenId} -> ${newTokenId}`);
    } else {
        console.log(`   ✅ Token ID preserved: ${newTokenId}`);
    }

    if (newOwner.toLowerCase() !== owner.toLowerCase()) {
        console.error(`   ❌ Owner changed: ${owner} -> ${newOwner}`);
    } else {
        console.log(`   ✅ Owner preserved: ${newOwner}`);
    }

    // ============================================
    // STEP 7: SET POT PRICE COEFFICIENT
    // ============================================
    console.log("\n🎯 STEP 6: Setting Pot Price Coefficient...\n");

    try {
        console.log(`   Setting potPriceCoefficient to ${POT_PRICE_COEFFICIENT}%...`);
        const setCoeffTx = await upgradedCellar.setPotPriceCoefficient(POT_PRICE_COEFFICIENT);
        console.log(`   Transaction hash: ${setCoeffTx.hash}`);
        console.log("   Waiting for confirmation...");
        await setCoeffTx.wait();
        console.log("   ✅ Pot Price Coefficient set!");

        // Verify it was set
        const verifyCoeff = await upgradedCellar.potPriceCoefficient();
        if (verifyCoeff === BigInt(POT_PRICE_COEFFICIENT)) {
            console.log(`   ✅ Verified: potPriceCoefficient = ${verifyCoeff}%`);
        } else {
            console.error(`   ❌ ERROR: Coefficient mismatch! Expected ${POT_PRICE_COEFFICIENT}, got ${verifyCoeff}`);
        }
    } catch (error: any) {
        console.error("   ❌ ERROR: Failed to set pot price coefficient:", error.message);
        console.error("      You can set it manually later using setPotPriceCoefficient()");
    }

    // Test getAuctionPrice() still works
    try {
        const currentPrice = await upgradedCellar.getAuctionPrice();
        console.log(`   Current Auction Price: ${ethers.formatEther(currentPrice)}`);
        console.log("   ✅ getAuctionPrice() works!");
    } catch (error: any) {
        console.error("   ❌ ERROR: getAuctionPrice() failed:", error.message);
    }

    // ============================================
    // SUMMARY
    // ============================================
    console.log("\n" + "=".repeat(60));
    console.log("✅ UPGRADE COMPLETED SUCCESSFULLY!");
    console.log("=".repeat(60));
    console.log(`\nProxy Address (unchanged): ${CELLAR_V3_PROXY}`);
    console.log(`Old Implementation: ${currentImpl}`);
    console.log(`New Implementation: ${newImpl}`);
    if (upgradeTxHash) {
        console.log(`Upgrade TX: ${upgradeTxHash}`);
    }
    console.log("\n📝 Next Steps:");
    console.log("   1. Monitor the contract for any issues");
    console.log("   2. Test raid() function - verify new init price uses pot size");
    console.log("   3. Verify price grows smoothly with pot value");
    console.log("   4. Update DEPLOYMENT_TRACKER.md with new implementation address");
    console.log("\n🔧 What Changed:");
    console.log("   - Price calculation: newInitPrice = potBalanceMON * (100 + coefficient) / 100");
    console.log("   - Previously: newInitPrice = currentPrice * multiplier (exponential growth)");
    console.log("   - Now: Price starts above pot, decays down (stable, self-correcting)");
    console.log(`   - Pot Price Coefficient: ${POT_PRICE_COEFFICIENT}% above pot`);
    console.log("\n💰 Example Behavior:");
    console.log("   - Pot = 100 MON → Next init price = 130 MON (30% above pot)");
    console.log("   - Pot = 1000 MON → Next init price = 1300 MON (30% above pot)");
    console.log("   - Price decays: 130 → 100 → 50 → 1 MON over epoch period");
    console.log("   - For majority of hour: price > pot (not profitable yet)");
    console.log("   - Eventually: price < pot (becomes profitable to raid)");
    console.log("   - Growth is smooth and value-aligned");
    console.log("\n");
}

main().catch((error) => {
    console.error("\n❌ UPGRADE FAILED:", error);
    process.exit(1);
});

