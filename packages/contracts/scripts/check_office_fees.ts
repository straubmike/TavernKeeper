import { ethers } from "hardhat";
import * as fs from "fs";
import * as path from "path";

/**
 * Check if office fees are being sent to CellarHook and why pot is empty
 *
 * Usage:
 *   npx hardhat run scripts/check_office_fees.ts --network monad
 */

async function main() {
    console.log("=== CHECKING OFFICE FEES TO CELLAR ===\n");

    const [deployer] = await ethers.getSigners();
    const network = await ethers.provider.getNetwork();
    console.log("Network:", network.name, `(Chain ID: ${network.chainId})`);
    console.log("");

    // Get contract addresses
    let THE_CELLAR = "";
    let TAVERN_KEEPER = "";

    const addressesPath = path.join(__dirname, "../../apps/web/lib/contracts/addresses.ts");
    if (fs.existsSync(addressesPath)) {
        const addressesContent = fs.readFileSync(addressesPath, "utf8");
        let addressSet = "MONAD_TESTNET_ADDRESSES";
        if (network.chainId === 143n) {
            addressSet = "MONAD_MAINNET_ADDRESSES";
        }

        const cellarMatch = addressesContent.match(new RegExp(`${addressSet}[\\s\\S]*?THE_CELLAR:\\s*['"](0x[a-fA-F0-9]{40})['"]`, "i"));
        const tkMatch = addressesContent.match(new RegExp(`${addressSet}[\\s\\S]*?TAVERN_KEEPER:\\s*['"](0x[a-fA-F0-9]{40})['"]`, "i"));

        if (cellarMatch && cellarMatch[1]) THE_CELLAR = cellarMatch[1];
        if (tkMatch && tkMatch[1]) TAVERN_KEEPER = tkMatch[1];
    }

    // Fallback
    if (!THE_CELLAR) {
        if (network.chainId === 143n) {
            THE_CELLAR = "0xe71CAf7162dd81a4A9C0c6BD25ED02C26F492DC0";
            TAVERN_KEEPER = "0x56B81A60Ae343342685911bd97D1331fF4fa2d29"; // Mainnet
        } else {
            THE_CELLAR = "0xA43034595E2d1c52Ab08a057B95dD38bCbFf87dC";
            TAVERN_KEEPER = "0xFaC0786eF353583FBD43Ee7E7e84836c1857A381"; // Testnet
        }
    }

    // Also try to get from addresses.ts if not found
    if (!TAVERN_KEEPER || TAVERN_KEEPER === "0x0000000000000000000000000000000000000000") {
        const addressesPath = path.join(__dirname, "../../apps/web/lib/contracts/addresses.ts");
        if (fs.existsSync(addressesPath)) {
            const addressesContent = fs.readFileSync(addressesPath, "utf8");
            let addressSet = "MONAD_TESTNET_ADDRESSES";
            if (network.chainId === 143n) {
                addressSet = "MONAD_MAINNET_ADDRESSES";
            }
            const tkMatch = addressesContent.match(new RegExp(`${addressSet}[\\s\\S]*?TAVERNKEEPER:\\s*['"](0x[a-fA-F0-9]{40})['"]`, "i"));
            if (tkMatch && tkMatch[1]) TAVERN_KEEPER = tkMatch[1];
        }
    }

    console.log("Contract Addresses:");
    console.log("  THE_CELLAR:", THE_CELLAR);
    console.log("  TAVERN_KEEPER:", TAVERN_KEEPER);
    console.log("");

    // Check TavernKeeper treasury
    console.log("=== TAVERN KEEPER CONFIGURATION ===");
    try {
        const TavernKeeper = await ethers.getContractFactory("TavernKeeper");
        const tavernKeeper = TavernKeeper.attach(TAVERN_KEEPER);

        const treasury = await tavernKeeper.treasury();
        console.log("TavernKeeper Treasury:", treasury);
        console.log("Expected (THE_CELLAR):", THE_CELLAR);

        if (treasury.toLowerCase() === THE_CELLAR.toLowerCase()) {
            console.log("✅ Treasury is correctly set to CellarHook!");
        } else {
            console.log("❌ PROBLEM: Treasury is NOT set to CellarHook!");
            console.log("   Treasury:", treasury);
            console.log("   CellarHook:", THE_CELLAR);
            console.log("   This means office fees are going to the wrong address!");
        }

        // Check if treasury is zero
        if (treasury === ethers.ZeroAddress) {
            console.log("❌ CRITICAL: Treasury is address(0)!");
            console.log("   Office fees are going to owner() instead of CellarHook!");
        }

    } catch (error: any) {
        console.error("❌ Error reading TavernKeeper:", error.message);
        console.log("   TAVERN_KEEPER address might be wrong or contract not found");
    }

    // Check CellarHook pot balance
    console.log("\n=== CELLAR HOOK POT STATE ===");
    try {
        const CellarHook = await ethers.getContractFactory("CellarHook");
        const cellarHook = CellarHook.attach(THE_CELLAR);

        const potBalance = await cellarHook.potBalance();
        const contractBalance = await ethers.provider.getBalance(THE_CELLAR);

        console.log("Pot Balance:", ethers.formatEther(potBalance), "MON");
        console.log("Contract Balance:", ethers.formatEther(contractBalance), "MON");
        console.log("Difference:", ethers.formatEther(contractBalance - potBalance), "MON");

        if (contractBalance > potBalance) {
            console.log("\n⚠️  WARNING: Contract has MON but potBalance is lower!");
            console.log("   This means MON was sent but receive() didn't update potBalance");
            console.log("   OR receive() was called but Currency.unwrap(MON) check failed");
        }

        if (contractBalance === 0n && potBalance === 0n) {
            console.log("\n⚠️  No MON in contract at all - fees might be going elsewhere");
        }

    } catch (error: any) {
        console.error("❌ Error reading CellarHook:", error.message);
    }

    // Check recent TreasuryFee events
    console.log("\n=== RECENT TREASURY FEE EVENTS ===");
    try {
        const TavernKeeper = await ethers.getContractFactory("TavernKeeper");
        const tavernKeeper = TavernKeeper.attach(TAVERN_KEEPER);
        const blockNumber = await ethers.provider.getBlockNumber();
        const fromBlock = Math.max(0, blockNumber - 50000); // Last ~50000 blocks

        const filter = tavernKeeper.filters.TreasuryFee();
        const events = await tavernKeeper.queryFilter(filter, fromBlock, blockNumber);

        if (events.length === 0) {
            console.log("No TreasuryFee events found in last ~50000 blocks");
            console.log("   This could mean:");
            console.log("   1. No one has taken office recently");
            console.log("   2. Treasury is address(0) so fees go to owner()");
        } else {
            console.log(`Found ${events.length} TreasuryFee event(s):`);
            let totalFees = 0n;
            for (const event of events.slice(-20)) { // Last 20
                const amount = event.args.amount || 0n;
                totalFees += amount;
                console.log(`\n  Block ${event.blockNumber}:`);
                console.log(`    Treasury: ${event.args.treasury}`);
                console.log(`    Amount: ${ethers.formatEther(amount)} MON`);

                if (event.args.treasury.toLowerCase() !== THE_CELLAR.toLowerCase()) {
                    console.log(`    ⚠️  Going to wrong address! Should be ${THE_CELLAR}`);
                }
            }
            console.log(`\n  Total Fees Sent: ${ethers.formatEther(totalFees)} MON`);
        }
    } catch (e: any) {
        console.log("Could not query events:", e.message);
    }

    // Check recent PotContributed events
    console.log("\n=== RECENT POT CONTRIBUTIONS ===");
    try {
        const CellarHook = await ethers.getContractFactory("CellarHook");
        const cellarHook = CellarHook.attach(THE_CELLAR);
        const blockNumber = await ethers.provider.getBlockNumber();
        const fromBlock = Math.max(0, blockNumber - 50000);

        const filter = cellarHook.filters.PotContributed();
        const events = await cellarHook.queryFilter(filter, fromBlock, blockNumber);

        if (events.length === 0) {
            console.log("No PotContributed events found");
            console.log("   This means contributeToPot() was never called");
            console.log("   OR receive() was called but doesn't emit events");
        } else {
            console.log(`Found ${events.length} PotContributed event(s):`);
            let totalContributions = 0n;
            for (const event of events.slice(-20)) {
                const amount = event.args.amount || 0n;
                totalContributions += amount;
                console.log(`\n  Block ${event.blockNumber}:`);
                console.log(`    Contributor: ${event.args.contributor}`);
                console.log(`    Amount: ${ethers.formatEther(amount)} MON`);
            }
            console.log(`\n  Total Contributions: ${ethers.formatEther(totalContributions)} MON`);
        }
    } catch (e: any) {
        console.log("Could not query events:", e.message);
    }

    console.log("\n=== ROOT CAUSE ANALYSIS ===");
    console.log("If pot is 0 but office fees are being paid:");
    console.log("1. Check if TavernKeeper.treasury == CellarHook address");
    console.log("2. Check if receive() is being called (check PotContributed events)");
    console.log("3. Check if Currency.unwrap(MON) == address(0) in receive()");
    console.log("4. Check if fees are going to owner() instead (treasury == address(0))");
}

main()
    .then(() => process.exit(0))
    .catch((error) => {
        console.error("❌ Script failed:", error);
        process.exitCode = 1;
    });

