import { ethers } from "hardhat";
import * as dotenv from "dotenv";

dotenv.config({ path: "../../.env" });

/**
 * Set TheCellarV3 minimum raid price to 1000 CLP
 *
 * Note: TheCellarV3SetMinPrice contract already has setMinInitPrice() function,
 * so we just need to call it - no upgrade needed.
 *
 * Usage:
 *   npx hardhat run scripts/set-cellar-min-price-1000.ts --network monad
 */

const CELLAR_V3_PROXY = process.env.THE_CELLAR_V3_PROXY || "0x32A920be00dfCE1105De0415ba1d4f06942E9ed0";
const NEW_MIN_INIT_PRICE = ethers.parseEther("1000"); // 1000 CLP

async function main() {
    console.log("🔧 SETTING TheCellarV3 MIN PRICE TO 1000 CLP...\n");
    console.log("━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━\n");

    const [deployer] = await ethers.getSigners();
    const network = await ethers.provider.getNetwork();

    console.log(`Network: ${network.name} (Chain ID: ${network.chainId})`);
    console.log(`Deployer: ${deployer.address}`);
    console.log(`Proxy: ${CELLAR_V3_PROXY}`);
    console.log(`New Min Init Price: 1000 CLP\n`);

    // Get current contract (TheCellarV3SetMinPrice has the setMinInitPrice function)
    const TheCellarV3SetMinPrice = await ethers.getContractFactory("TheCellarV3SetMinPrice");
    const cellar = TheCellarV3SetMinPrice.attach(CELLAR_V3_PROXY);

    // Verify deployer is the owner
    const owner = await cellar.owner();
    if (owner.toLowerCase() !== deployer.address.toLowerCase()) {
        console.error(`❌ Error: You are not the owner!`);
        console.error(`   Your address: ${deployer.address}`);
        console.error(`   Owner address: ${owner}`);
        process.exit(1);
    }

    // Check current state
    console.log("--- CURRENT STATE ---");
    const currentMinPrice = await cellar.minInitPrice();
    const currentPotMON = await cellar.potBalanceMON();
    const currentPotKEEP = await cellar.potBalanceKEEP();

    console.log(`Current minInitPrice: ${ethers.formatEther(currentMinPrice)} CLP`);
    console.log(`Current Pot MON: ${ethers.formatEther(currentPotMON)} MON`);
    console.log(`Current Pot KEEP: ${ethers.formatEther(currentPotKEEP)} KEEP\n`);

    if (currentMinPrice === NEW_MIN_INIT_PRICE) {
        console.log(`⚠️  Min price is already set to 1000 CLP!`);
        return;
    }

    // Set the new min price
    console.log("--- SETTING NEW MIN PRICE ---");
    console.log(`Calling setMinInitPrice(${ethers.formatEther(NEW_MIN_INIT_PRICE)} CLP)...\n`);

    try {
        const setMinTx = await cellar.setMinInitPrice(NEW_MIN_INIT_PRICE);
        console.log(`⏳ Transaction sent: ${setMinTx.hash}`);
        const receipt = await setMinTx.wait();
        console.log(`✅ Transaction confirmed!`);
        console.log(`   Block: ${receipt.blockNumber}\n`);

        // Verify
        console.log("--- VERIFICATION ---");
        const newMinPrice = await cellar.minInitPrice();
        console.log(`New minInitPrice: ${ethers.formatEther(newMinPrice)} CLP`);

        if (newMinPrice === NEW_MIN_INIT_PRICE) {
            console.log(`✅ SUCCESS: Min price is now 1000 CLP`);
        } else {
            console.log(`❌ ERROR: Min price mismatch!`);
            console.log(`   Expected: ${ethers.formatEther(NEW_MIN_INIT_PRICE)} CLP`);
            console.log(`   Got: ${ethers.formatEther(newMinPrice)} CLP`);
        }

        // Check pot is still intact
        const newPotMON = await cellar.potBalanceMON();
        const newPotKEEP = await cellar.potBalanceKEEP();
        console.log(`Pot MON after update: ${ethers.formatEther(newPotMON)} MON`);
        console.log(`Pot KEEP after update: ${ethers.formatEther(newPotKEEP)} KEEP`);

        if (newPotMON === currentPotMON && newPotKEEP === currentPotKEEP) {
            console.log(`✅ Pot balances preserved`);
        } else {
            console.log(`⚠️  Pot balances changed during update`);
        }

        console.log("\n=== UPDATE COMPLETE ===");
        console.log("TheCellarV3 now requires minimum 1000 CLP to raid");
        console.log("This matches the office minimum price increase (100 → 1000)");

    } catch (error: any) {
        console.error(`❌ Transaction failed!`);
        console.error(`   Error: ${error.message}`);
        if (error.reason) {
            console.error(`   Reason: ${error.reason}`);
        }
        process.exit(1);
    }
}

main()
    .then(() => process.exit(0))
    .catch((error) => {
        console.error(error);
        process.exit(1);
    });

