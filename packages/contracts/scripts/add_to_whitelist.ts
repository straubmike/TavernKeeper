import { ethers } from "hardhat";

/**
 * Add address to whitelist for both TavernKeeper and Adventurer contracts
 *
 * Usage:
 *   npx hardhat run scripts/add_to_whitelist.ts --network monad
 *   npx hardhat run scripts/add_to_whitelist.ts --network monadTestnet
 */

// Contract addresses - update based on network
// Mainnet addresses (from addresses.ts)
const TAVERN_KEEPER_MAINNET = "0x56B81A60Ae343342685911bd97D1331fF4fa2d29";
const ADVENTURER_MAINNET = "0xb138Bf579058169e0657c12Fd9cc1267CAFcb935";

// Testnet addresses (from addresses.ts)
const TAVERN_KEEPER_TESTNET = "0xFaC0786eF353583FBD43Ee7E7e84836c1857A381";
const ADVENTURER_TESTNET = "0x4Fff2Ce5144989246186462337F0eE2C086F913E";

// Use environment variable or default to mainnet
const TAVERN_KEEPER = process.env.TAVERN_KEEPER_ADDRESS || TAVERN_KEEPER_MAINNET;
const ADVENTURER = process.env.ADVENTURER_ADDRESS || ADVENTURER_MAINNET;

// Address to whitelist
const ADDRESS_TO_WHITELIST = "0x3ec3a92e44952bae7ea96fd9c1c3f6b65c9a1b6d";

async function main() {
    const [deployer] = await ethers.getSigners();
    console.log("🔧 ADDING ADDRESS TO WHITELIST...\n");
    console.log(`Deployer: ${deployer.address}`);
    console.log(`Address to whitelist: ${ADDRESS_TO_WHITELIST}\n`);

    // TavernKeeper
    console.log("📝 Adding to TavernKeeper whitelist...");
    const tk = await ethers.getContractAt("TavernKeeper", TAVERN_KEEPER);

    const tkWhitelisted = await tk.whitelist(ADDRESS_TO_WHITELIST);
    if (!tkWhitelisted) {
        const tx1 = await tk.addToWhitelist(ADDRESS_TO_WHITELIST);
        await tx1.wait();
        console.log(`✅ Added to TavernKeeper whitelist (tx: ${tx1.hash})`);
    } else {
        console.log(`✅ Already whitelisted on TavernKeeper`);
    }

    console.log();

    // Adventurer
    console.log("📝 Adding to Adventurer whitelist...");
    const adv = await ethers.getContractAt("Adventurer", ADVENTURER);

    const advWhitelisted = await adv.whitelist(ADDRESS_TO_WHITELIST);
    if (!advWhitelisted) {
        const tx2 = await adv.addToWhitelist(ADDRESS_TO_WHITELIST);
        await tx2.wait();
        console.log(`✅ Added to Adventurer whitelist (tx: ${tx2.hash})`);
    } else {
        console.log(`✅ Already whitelisted on Adventurer`);
    }

    console.log("\n✅ Address successfully whitelisted!");
}

main().catch((error) => {
    console.error("❌ Error:", error);
    process.exitCode = 1;
});

