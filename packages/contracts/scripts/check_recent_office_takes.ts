import { ethers } from "hardhat";
import * as fs from "fs";
import * as path from "path";

/**
 * Check recent office takes and calculate expected pot balance
 */

async function main() {
    console.log("=== CHECKING RECENT OFFICE TAKES ===\n");

    const network = await ethers.provider.getNetwork();
    console.log("Network:", network.name, `(Chain ID: ${network.chainId})`);
    console.log("");

    let THE_CELLAR = "0xe71CAf7162dd81a4A9C0c6BD25ED02C26F492DC0";
    let TAVERN_KEEPER = "0x56B81A60Ae343342685911bd97D1331fF4fa2d29";

    if (network.chainId !== 143n) {
        THE_CELLAR = "0xA43034595E2d1c52Ab08a057B95dD38bCbFf87dC";
        TAVERN_KEEPER = "0xFaC0786eF353583FBD43Ee7E7e84836c1857A381";
    }

    console.log("Contracts:");
    console.log("  TavernKeeper:", TAVERN_KEEPER);
    console.log("  CellarHook:", THE_CELLAR);
    console.log("");

    // Get current pot balance
    const CellarHook = await ethers.getContractFactory("CellarHook");
    const cellarHook = CellarHook.attach(THE_CELLAR);
    const currentPotBalance = await cellarHook.potBalance();
    console.log("Current Pot Balance:", ethers.formatEther(currentPotBalance), "MON");
    console.log("");

    // Check TavernKeeper slot0 to see current state
    const TavernKeeper = await ethers.getContractFactory("TavernKeeper");
    const tavernKeeper = TavernKeeper.attach(TAVERN_KEEPER);

    const slot0 = await tavernKeeper.slot0();
    console.log("TavernKeeper State:");
    console.log("  Epoch ID:", slot0.epochId.toString());
    console.log("  Current Miner:", slot0.miner);
    if (slot0.price) {
        console.log("  Current Price:", ethers.formatEther(slot0.price), "MON");
    } else {
        const currentPrice = await tavernKeeper.getPrice();
        console.log("  Current Price (from getPrice):", ethers.formatEther(currentPrice), "MON");
    }
    console.log("");

    // Try to get recent events in smaller chunks
    const blockNumber = await ethers.provider.getBlockNumber();
    console.log("Current Block:", blockNumber);
    console.log("Checking last 1000 blocks for events...\n");

    // Check TreasuryFee events (smaller range)
    try {
        const fromBlock = Math.max(0, blockNumber - 1000);
        const filter = tavernKeeper.filters.TreasuryFee();
        const events = await tavernKeeper.queryFilter(filter, fromBlock, blockNumber);

        if (events.length === 0) {
            console.log("No TreasuryFee events in last 1000 blocks");
        } else {
            console.log(`Found ${events.length} TreasuryFee event(s) in last 1000 blocks:\n`);
            let totalFees = 0n;
            for (const event of events) {
                const amount = event.args.amount || 0n;
                totalFees += amount;
                const block = await ethers.provider.getBlock(event.blockNumber);
                console.log(`  Block ${event.blockNumber} (${new Date(Number(block?.timestamp || 0) * 1000).toISOString()}):`);
                console.log(`    Treasury: ${event.args.treasury}`);
                console.log(`    Amount: ${ethers.formatEther(amount)} MON`);
                console.log(`    Expected in pot: ${ethers.formatEther(amount)} MON`);
                console.log("");
            }
            console.log(`Total Fees Sent: ${ethers.formatEther(totalFees)} MON`);
            console.log(`Current Pot: ${ethers.formatEther(currentPotBalance)} MON`);

            if (totalFees > currentPotBalance) {
                console.log(`\n⚠️  WARNING: More fees were sent (${ethers.formatEther(totalFees)}) than pot has (${ethers.formatEther(currentPotBalance)})!`);
                console.log(`   Missing: ${ethers.formatEther(totalFees - currentPotBalance)} MON`);
                console.log(`   This suggests fees were sent but not added to potBalance!`);
            } else if (currentPotBalance > totalFees) {
                console.log(`\n✅ Pot has more than recent fees (${ethers.formatEther(currentPotBalance - totalFees)} MON extra)`);
                console.log(`   This could be from older fees or other contributions`);
            }
        }
    } catch (e: any) {
        console.log("Error querying events:", e.message);
    }

    // Check if receive() is working by checking contract balance vs potBalance
    const contractBalance = await ethers.provider.getBalance(THE_CELLAR);
    console.log("\n=== BALANCE CHECK ===");
    console.log("Contract Balance:", ethers.formatEther(contractBalance), "MON");
    console.log("Pot Balance:", ethers.formatEther(currentPotBalance), "MON");

    if (contractBalance === currentPotBalance) {
        console.log("✅ Balances match - receive() is working correctly!");
    } else if (contractBalance > currentPotBalance) {
        console.log(`⚠️  Contract has more MON (${ethers.formatEther(contractBalance - currentPotBalance)} MON extra)`);
        console.log("   This means MON was sent but receive() didn't update potBalance");
    } else {
        console.log(`⚠️  Pot has more than contract balance (unusual)`);
    }
}

main()
    .then(() => process.exit(0))
    .catch((error) => {
        console.error("❌ Script failed:", error);
        process.exitCode = 1;
    });

