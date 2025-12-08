import * as dotenv from "dotenv";
import { ethers } from "hardhat";

dotenv.config({ path: "../../.env" });

/**
 * Debug script to check what happened with raid transfers
 */

const THE_CELLAR_V3 = "0x32A920be00dfCE1105De0415ba1d4f06942E9ed0";
const RAID_TX = "0x3784f38d1dace7a3637a5cb2fee819ced5e096422bec0a2bc4bea48b719c9574";
const USER_ADDRESS = "0x8DFBdEEC8c5d4970BB5F481C6ec7f73fa1C65be5";

const WMON_MAINNET = "0x3bd359C1119dA7Da1D913D1C4D2B7c461115433A"; // Correct mainnet WMON

const WMON_ABI = [
    "function balanceOf(address) external view returns (uint256)",
    "function transfer(address, uint256) external returns (bool)",
    "event Transfer(address indexed from, address indexed to, uint256 value)",
];

async function main() {
    const [signer] = await ethers.getSigners();
    const provider = signer.provider;
    if (!provider) {
        console.error("❌ No provider available");
        process.exit(1);
    }

    console.log("🔍 Debugging Raid Transfer\n");
    console.log("━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━\n");

    const wmon = new ethers.Contract(WMON_MAINNET, WMON_ABI, provider);

    // Get transaction receipt
    const receipt = await provider.getTransactionReceipt(RAID_TX);
    if (!receipt) {
        console.error("❌ Transaction receipt not found");
        return;
    }

    console.log(`Transaction: ${RAID_TX}`);
    console.log(`Block: ${receipt.blockNumber}`);
    console.log(`Status: ${receipt.status === 1 ? '✅ Success' : '❌ Failed'}\n`);

    // Check for Transfer events from WMON contract
    console.log("📊 Checking WMON Transfer Events:\n");

    // Check transfers FROM TheCellar
    const transferFilterFrom = wmon.filters.Transfer(THE_CELLAR_V3, null);
    const transfersFrom = await wmon.queryFilter(transferFilterFrom, receipt.blockNumber, receipt.blockNumber);

    // Also check all transfers in this block
    const transferFilterAll = wmon.filters.Transfer();
    const transfersAll = await wmon.queryFilter(transferFilterAll, receipt.blockNumber, receipt.blockNumber);

    if (transfersFrom.length === 0) {
        console.log("⚠️ No WMON Transfer events found FROM TheCellar!");
        console.log(`   But found ${transfersAll.length} total WMON transfers in this block.\n`);

        if (transfersAll.length > 0) {
            console.log("   All WMON transfers in this block:\n");
            for (const transfer of transfersAll) {
                const args = transfer.args;
                if (args) {
                    const from = args[0];
                    const to = args[1];
                    const amount = args[2];
                    console.log(`    From: ${from}`);
                    console.log(`    To: ${to}`);
                    console.log(`    Amount: ${ethers.formatEther(amount)} MON`);
                    if (from.toLowerCase() === THE_CELLAR_V3.toLowerCase()) {
                        console.log(`    ✅ This is from TheCellar!`);
                        console.log(`    Expected User: ${USER_ADDRESS}`);
                        console.log(`    Match: ${to.toLowerCase() === USER_ADDRESS.toLowerCase() ? '✅ YES' : '❌ NO - FUNDS WENT TO WRONG ADDRESS!'}\n`);
                    } else {
                        console.log();
                    }
                }
            }
        }
    } else {
        console.log(`Found ${transfersFrom.length} WMON transfer(s) from TheCellar:\n`);
        for (const transfer of transfersFrom) {
            const args = transfer.args;
            if (args) {
                const from = args[0];
                const to = args[1];
                const amount = args[2];
                console.log(`  From: ${from}`);
                console.log(`  To: ${to}`);
                console.log(`  Amount: ${ethers.formatEther(amount)} MON`);
                console.log(`  Expected User: ${USER_ADDRESS}`);
                console.log(`  Match: ${to.toLowerCase() === USER_ADDRESS.toLowerCase() ? '✅ YES' : '❌ NO - FUNDS WENT TO WRONG ADDRESS!'}\n`);
            }
        }
    }

    // Check user's WMON balance at different blocks
    console.log("💵 User WMON Balance History:\n");
    const beforeBlock = receipt.blockNumber - 1;
    const atBlock = receipt.blockNumber;
    const afterBlock = receipt.blockNumber + 1;

    try {
        const balanceBefore = await wmon.balanceOf(USER_ADDRESS, { blockTag: beforeBlock });
        const balanceAt = await wmon.balanceOf(USER_ADDRESS, { blockTag: atBlock });
        const balanceAfter = await wmon.balanceOf(USER_ADDRESS, { blockTag: afterBlock });
        const currentBalance = await wmon.balanceOf(USER_ADDRESS);

        console.log(`  Block ${beforeBlock}: ${ethers.formatEther(balanceBefore)} MON`);
        console.log(`  Block ${atBlock}: ${ethers.formatEther(balanceAt)} MON`);
        console.log(`  Block ${afterBlock}: ${ethers.formatEther(balanceAfter)} MON`);
        console.log(`  Current: ${ethers.formatEther(currentBalance)} MON`);

        const change = balanceAt - balanceBefore;
        console.log(`  Change: ${change >= 0n ? '+' : ''}${ethers.formatEther(change)} MON\n`);
    } catch (e: any) {
        console.log(`  ⚠️ Error checking balances: ${e.message}\n`);
    }

    // Check TheCellar's WMON balance
    console.log("🏛️ TheCellar WMON Balance:\n");
    try {
        const cellarBalanceBefore = await wmon.balanceOf(THE_CELLAR_V3, { blockTag: receipt.blockNumber - 1 });
        const cellarBalanceAfter = await wmon.balanceOf(THE_CELLAR_V3, { blockTag: receipt.blockNumber });
        const currentCellarBalance = await wmon.balanceOf(THE_CELLAR_V3);

        console.log(`  Before Raid: ${ethers.formatEther(cellarBalanceBefore)} MON`);
        console.log(`  After Raid: ${ethers.formatEther(cellarBalanceAfter)} MON`);
        console.log(`  Current: ${ethers.formatEther(currentCellarBalance)} MON`);

        const cellarChange = cellarBalanceAfter - cellarBalanceBefore;
        console.log(`  Change: ${cellarChange >= 0n ? '+' : ''}${ethers.formatEther(cellarChange)} MON\n`);
    } catch (e: any) {
        console.log(`  ⚠️ Error checking cellar balance: ${e.message}\n`);
    }

    // Check all logs in the transaction
    console.log("📜 All Logs in Transaction:\n");
    for (let i = 0; i < receipt.logs.length; i++) {
        const log = receipt.logs[i];
        console.log(`  Log ${i + 1}:`);
        console.log(`    Address: ${log.address}`);
        console.log(`    Topics: ${log.topics.length}`);
        if (log.topics.length > 0) {
            console.log(`    Topic[0]: ${log.topics[0]}`);
        }
        console.log();
    }
}

main()
    .then(() => process.exit(0))
    .catch((error) => {
        console.error(error);
        process.exit(1);
    });

