import * as dotenv from "dotenv";
import { ethers } from "hardhat";

dotenv.config({ path: "../../.env" });

/**
 * Script to find recent raid transactions
 *
 * Usage: npx hardhat run scripts/find-recent-raids.ts --network monad
 */

const THE_CELLAR_V3 = "0x32A920be00dfCE1105De0415ba1d4f06942E9ed0";
const WMON_MAINNET = "0x760AfE86e5de5fa0Ee542fc7B7B713e1c5425701";
const KEEP_TOKEN_MAINNET = "0x2D1094F5CED6ba279962f9676d32BE092AFbf82E";

const CELLAR_ABI = [
    "event Raid(address indexed user, uint256 lpBid, uint256 potPaidMON, uint256 potPaidKEEP, uint256 newInitPrice, uint256 epochId)",
];

const WMON_ABI = [
    "function balanceOf(address) external view returns (uint256)",
];

const KEEP_TOKEN_ABI = [
    "function balanceOf(address) external view returns (uint256)",
];

async function main() {
    const [signer] = await ethers.getSigners();
    const provider = signer.provider;
    if (!provider) {
        console.error("❌ No provider available");
        process.exit(1);
    }

    console.log("🔍 Finding Recent Raid Transactions\n");
    console.log("━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━\n");

    const cellar = new ethers.Contract(THE_CELLAR_V3, CELLAR_ABI, provider);
    const wmon = new ethers.Contract(WMON_MAINNET, WMON_ABI, provider);
    const keepToken = new ethers.Contract(KEEP_TOKEN_MAINNET, KEEP_TOKEN_ABI, provider);

    const currentBlock = await provider.getBlockNumber();
    // Search in chunks of 100 blocks (provider limit)
    const chunkSize = 100;
    const searchBlocks = 10000; // Search last 10k blocks
    const fromBlock = Math.max(0, currentBlock - searchBlocks);

    console.log(`Searching blocks ${fromBlock} to ${currentBlock} for all raids (in chunks of ${chunkSize})...\n`);

    const events: any[] = [];
    for (let start = fromBlock; start <= currentBlock; start += chunkSize) {
        const end = Math.min(start + chunkSize - 1, currentBlock);
        try {
            const raidFilter = cellar.filters.Raid();
            const chunkEvents = await cellar.queryFilter(raidFilter, start, end);
            events.push(...chunkEvents);
        } catch (e) {
            // Skip chunk if error
            console.log(`  Skipping blocks ${start}-${end} due to error`);
        }
    }

    if (events.length === 0) {
        console.log(`⚠️ No Raid events found in the last ${currentBlock - fromBlock} blocks`);
        return;
    }

    console.log(`Found ${events.length} raid(s) total:\n`);

    for (let i = 0; i < events.length; i++) {
        const event = events[i];
        const args = event.args;
        if (args) {
            const user = args[0];
            const lpBid = args[1];
            const potPaidMON = args[2];
            const potPaidKEEP = args[3];
            const newInitPrice = args[4];
            const epochId = args[5];

            const block = await provider.getBlock(event.blockNumber);
            const timestamp = block ? new Date(block.timestamp * 1000).toISOString() : 'unknown';

            console.log(`━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━`);
            console.log(`Raid #${i + 1} (Epoch ${epochId}):`);
            console.log(`  Transaction: ${event.transactionHash}`);
            console.log(`  Block: ${event.blockNumber} (${timestamp})`);
            console.log(`  User: ${user}`);
            console.log(`  LP Bid: ${ethers.formatEther(lpBid)} CLP`);
            console.log(`  Pot Paid MON: ${ethers.formatEther(potPaidMON)} MON`);
            console.log(`  Pot Paid KEEP: ${ethers.formatEther(potPaidKEEP)} KEEP`);
            console.log(`  New Init Price: ${ethers.formatEther(newInitPrice)} CLP`);

            // Check if user received the funds - use current block for balance check
            try {
                const receipt = await provider.getTransactionReceipt(event.transactionHash);
                if (receipt) {
                    // Check balances at the block of the transaction
                    const wmonBefore = await wmon.balanceOf(user, { blockTag: event.blockNumber - 1 }).catch(() => 0n);
                    const wmonAfter = await wmon.balanceOf(user, { blockTag: event.blockNumber }).catch(() => 0n);
                    const wmonChange = wmonAfter - wmonBefore;

                    const keepBefore = await keepToken.balanceOf(user, { blockTag: event.blockNumber - 1 }).catch(() => 0n);
                    const keepAfter = await keepToken.balanceOf(user, { blockTag: event.blockNumber }).catch(() => 0n);
                    const keepChange = keepAfter - keepBefore;

                    console.log(`  WMON Received: ${ethers.formatEther(wmonChange)} MON`);
                    console.log(`  KEEP Received: ${ethers.formatEther(keepChange)} KEEP`);

                    const monMatch = wmonChange === potPaidMON;
                    const keepMatch = keepChange === potPaidKEEP;

                    if (monMatch && keepMatch) {
                        console.log(`  ✅ User received the expected amounts!`);
                    } else {
                        if (!monMatch) {
                            console.log(`  ⚠️ WMON mismatch: received ${ethers.formatEther(wmonChange)} MON, expected ${ethers.formatEther(potPaidMON)} MON`);
                            console.log(`     Difference: ${ethers.formatEther(potPaidMON - wmonChange)} MON MISSING!`);
                        }
                        if (!keepMatch) {
                            console.log(`  ⚠️ KEEP mismatch: received ${ethers.formatEther(keepChange)} KEEP, expected ${ethers.formatEther(potPaidKEEP)} KEEP`);
                            console.log(`     Difference: ${ethers.formatEther(potPaidKEEP - keepChange)} KEEP MISSING!`);
                        }
                    }

                    // Also check current balance to see if they have it now
                    const currentWmonBalance = await wmon.balanceOf(user).catch(() => 0n);
                    const currentKeepBalance = await keepToken.balanceOf(user).catch(() => 0n);
                    console.log(`  Current WMON Balance: ${ethers.formatEther(currentWmonBalance)} MON`);
                    console.log(`  Current KEEP Balance: ${ethers.formatEther(currentKeepBalance)} KEEP`);
                }
            } catch (e: any) {
                console.log(`  ⚠️ Could not verify token balances: ${e.message}`);
            }
            console.log();
        }
    }

    console.log(`\n💡 To check a specific transaction in detail, use:`);
    console.log(`   $env:RAID_TX_HASH="0x..."; npx hardhat run scripts/check-raid-transaction.ts --network monad`);
}

main()
    .then(() => process.exit(0))
    .catch((error) => {
        console.error(error);
        process.exit(1);
    });

