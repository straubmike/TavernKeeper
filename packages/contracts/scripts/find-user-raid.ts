import * as dotenv from "dotenv";
import { ethers } from "hardhat";

dotenv.config({ path: "../../.env" });

/**
 * Find raids by a specific user address
 */

const THE_CELLAR_V3 = "0x32A920be00dfCE1105De0415ba1d4f06942E9ed0";
const USER_ADDRESS = process.env.USER_ADDRESS || "0xd515674a7fe63dfdfd43fb5647e8b04eefcedcaa";

const CELLAR_ABI = [
    "event Raid(address indexed user, uint256 lpBid, uint256 potPaidMON, uint256 potPaidKEEP, uint256 newInitPrice, uint256 epochId)",
];

async function main() {
    const [signer] = await ethers.getSigners();
    const provider = signer.provider;
    if (!provider) {
        console.error("❌ No provider available");
        process.exit(1);
    }

    console.log(`🔍 Finding Raids by: ${USER_ADDRESS}\n`);
    console.log("━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━\n");

    const cellar = new ethers.Contract(THE_CELLAR_V3, CELLAR_ABI, provider);

    const currentBlock = await provider.getBlockNumber();
    const chunkSize = 100;
    const searchBlocks = 50000;
    const fromBlock = Math.max(0, currentBlock - searchBlocks);

    console.log(`Searching blocks ${fromBlock} to ${currentBlock} (in chunks of ${chunkSize})...\n`);

    const events: any[] = [];
    for (let start = fromBlock; start <= currentBlock; start += chunkSize) {
        const end = Math.min(start + chunkSize - 1, currentBlock);
        try {
            const raidFilter = cellar.filters.Raid(USER_ADDRESS);
            const chunkEvents = await cellar.queryFilter(raidFilter, start, end);
            events.push(...chunkEvents);
        } catch (e) {
            // Skip chunk if error
        }
    }

    if (events.length === 0) {
        console.log(`⚠️ No Raid events found for ${USER_ADDRESS} in the last ${currentBlock - fromBlock} blocks`);
        console.log(`\n💡 Possible reasons:`);
        console.log(`   1. You raided from a different wallet address`);
        console.log(`   2. The raid happened more than ${searchBlocks} blocks ago`);
        console.log(`   3. You haven't raided yet`);
        return;
    }

    console.log(`Found ${events.length} raid(s) by ${USER_ADDRESS}:\n`);

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
            console.log();
        }
    }
}

main()
    .then(() => process.exit(0))
    .catch((error) => {
        console.error(error);
        process.exit(1);
    });

