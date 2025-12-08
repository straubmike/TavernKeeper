import * as dotenv from "dotenv";
import { ethers } from "hardhat";

dotenv.config({ path: "../../.env" });

/**
 * Script to check a specific raid transaction and see where the money went
 *
 * Usage: npx hardhat run scripts/check-raid-transaction.ts --network monad
 *
 * Set RAID_TX_HASH environment variable to check a specific transaction
 * Or set USER_ADDRESS to check recent raids by that user
 */

const THE_CELLAR_V3 = "0x32A920be00dfCE1105De0415ba1d4f06942E9ed0";
const TAVERNKEEPER = "0x56B81A60Ae343342685911bd97D1331fF4fa2d29";
const USER_ADDRESS = process.env.USER_ADDRESS || "0xd515674a7fe63dfdfd43fb5647e8b04eefcedcaa";
const RAID_TX_HASH = process.env.RAID_TX_HASH || "";

// Mainnet addresses
const WMON_MAINNET = "0x760AfE86e5de5fa0Ee542fc7B7B713e1c5425701";
const KEEP_TOKEN_MAINNET = "0x2D1094F5CED6ba279962f9676d32BE092AFbf82E";

const CELLAR_ABI = [
    "function raid(uint256 lpBid) external",
    "event Raid(address indexed user, uint256 lpBid, uint256 potPaidMON, uint256 potPaidKEEP, uint256 newInitPrice, uint256 epochId)",
    "function potBalanceMON() external view returns (uint256)",
    "function potBalanceKEEP() external view returns (uint256)",
    "function totalLiquidity() external view returns (uint256)",
];

const WMON_ABI = [
    "function balanceOf(address) external view returns (uint256)",
    "function transfer(address, uint256) external returns (bool)",
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

    console.log("🔍 Checking Raid Transaction\n");
    console.log("━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━\n");

    const cellar = new ethers.Contract(THE_CELLAR_V3, CELLAR_ABI, provider);

    // Check current pot balance
    const currentPotMON = await cellar.potBalanceMON();
    const currentPotKEEP = await cellar.potBalanceKEEP();
    console.log(`💰 Current Pot Balance:`);
    console.log(`   MON: ${ethers.formatEther(currentPotMON)} MON`);
    console.log(`   KEEP: ${ethers.formatEther(currentPotKEEP)} KEEP\n`);

    if (RAID_TX_HASH) {
        // Check specific transaction
        console.log(`📜 Checking Transaction: ${RAID_TX_HASH}\n`);
        await checkTransaction(provider, cellar, RAID_TX_HASH);
    } else {
        // Check recent raids by user
        console.log(`📜 Checking Recent Raids by: ${USER_ADDRESS}\n`);
        console.log(`💡 To check a specific transaction, set RAID_TX_HASH environment variable\n`);
        await checkRecentRaids(provider, cellar, USER_ADDRESS);
    }
}

async function checkTransaction(provider: any, cellar: any, txHash: string) {
    try {
        const tx = await provider.getTransaction(txHash);
        if (!tx) {
            console.error(`❌ Transaction not found: ${txHash}`);
            return;
        }

        const receipt = await provider.getTransactionReceipt(txHash);
        if (!receipt) {
            console.error(`❌ Transaction receipt not found: ${txHash}`);
            return;
        }

        console.log(`Transaction Details:`);
        console.log(`  From: ${tx.from}`);
        console.log(`  To: ${tx.to}`);
        console.log(`  Value: ${ethers.formatEther(tx.value)} MON`);
        console.log(`  Block: ${receipt.blockNumber}`);
        console.log(`  Status: ${receipt.status === 1 ? '✅ Success' : '❌ Failed'}\n`);

        if (receipt.status !== 1) {
            console.log(`⚠️ Transaction failed - no funds were transferred`);
            return;
        }

        // Check if this is a takeOffice transaction instead of a raid
        if (tx.to && tx.to.toLowerCase() === TAVERNKEEPER.toLowerCase()) {
            console.log(`⚠️ This is a TAKE OFFICE transaction, not a RAID transaction!`);
            console.log(`   The user paid ${ethers.formatEther(tx.value)} MON to take the office.\n`);
            await checkTakeOfficeTransaction(provider, tx, receipt);
            return;
        }

        // Check if this is actually a raid transaction
        if (!tx.to || tx.to.toLowerCase() !== THE_CELLAR_V3.toLowerCase()) {
            console.log(`⚠️ This transaction is not to TheCellar contract!`);
            console.log(`   Expected: ${THE_CELLAR_V3}`);
            console.log(`   Got: ${tx.to || 'null'}`);
            console.log(`   This might not be a raid transaction.\n`);
        }

        // Check for Raid events
        const raidFilter = cellar.filters.Raid();
        const events = await cellar.queryFilter(raidFilter, receipt.blockNumber, receipt.blockNumber);

        if (events.length > 0) {
            console.log(`🎯 Found ${events.length} Raid event(s):\n`);
            for (const event of events) {
                const args = event.args;
                if (args) {
                    const user = args[0];
                    const lpBid = args[1];
                    const potPaidMON = args[2];
                    const potPaidKEEP = args[3];
                    console.log(`  User: ${user}`);
                    console.log(`  LP Bid: ${ethers.formatEther(lpBid)} CLP`);
                    console.log(`  Pot Paid MON: ${ethers.formatEther(potPaidMON)} MON`);
                    console.log(`  Pot Paid KEEP: ${ethers.formatEther(potPaidKEEP)} KEEP`);
                    console.log(`  Transaction: ${event.transactionHash}\n`);
                }
            }
        } else {
            console.log(`⚠️ No Raid events found in this transaction`);
        }

        // Check WMON and KEEP token balances (raid pays in tokens, not native MON)
        const WMON_ADDRESS = WMON_MAINNET;
        const KEEP_TOKEN_ADDRESS = KEEP_TOKEN_MAINNET;

        const wmon = new ethers.Contract(WMON_ADDRESS, WMON_ABI, provider);
        const keepToken = new ethers.Contract(KEEP_TOKEN_ADDRESS, KEEP_TOKEN_ABI, provider);

        const beforeBlock = receipt.blockNumber - 1;
        const wmonBefore = await wmon.balanceOf(tx.from, { blockTag: beforeBlock });
        const wmonAfter = await wmon.balanceOf(tx.from, { blockTag: receipt.blockNumber });
        const wmonChange = wmonAfter - wmonBefore;

        const keepBefore = await keepToken.balanceOf(tx.from, { blockTag: beforeBlock });
        const keepAfter = await keepToken.balanceOf(tx.from, { blockTag: receipt.blockNumber });
        const keepChange = keepAfter - keepBefore;

        console.log(`💵 User Token Balance Changes:`);
        console.log(`  WMON Before: ${ethers.formatEther(wmonBefore)} MON`);
        console.log(`  WMON After: ${ethers.formatEther(wmonAfter)} MON`);
        console.log(`  WMON Change: ${wmonChange >= 0n ? '+' : ''}${ethers.formatEther(wmonChange)} MON`);
        console.log(`  KEEP Before: ${ethers.formatEther(keepBefore)} KEEP`);
        console.log(`  KEEP After: ${ethers.formatEther(keepAfter)} KEEP`);
        console.log(`  KEEP Change: ${keepChange >= 0n ? '+' : ''}${ethers.formatEther(keepChange)} KEEP\n`);

        // Account for gas fees (native MON)
        const balanceBefore = await provider.getBalance(tx.from, beforeBlock);
        const balanceAfter = await provider.getBalance(tx.from, receipt.blockNumber);
        const balanceChange = balanceAfter - balanceBefore;
        const gasUsed = receipt.gasUsed;
        const gasPrice = tx.gasPrice || 0n;
        const gasCost = gasUsed * gasPrice;
        console.log(`  Native MON Gas Cost: ${ethers.formatEther(gasCost)} MON`);
        console.log(`  Native MON Balance Change: ${balanceChange >= 0n ? '+' : ''}${ethers.formatEther(balanceChange)} MON\n`);

        // Check pot balance before and after
        try {
            console.log(`📊 Pot Analysis:`);
            if (events.length > 0) {
                const potPaidMON = events[0].args[2];
                const potPaidKEEP = events[0].args[3];
                console.log(`  Pot Paid Out MON: ${ethers.formatEther(potPaidMON)} MON`);
                console.log(`  Pot Paid Out KEEP: ${ethers.formatEther(potPaidKEEP)} KEEP`);
                console.log(`  Expected User Receipt MON: ${ethers.formatEther(potPaidMON)} MON`);
                console.log(`  Expected User Receipt KEEP: ${ethers.formatEther(potPaidKEEP)} KEEP`);

                // Check if user received the funds
                const monMatch = wmonChange === potPaidMON;
                const keepMatch = keepChange === potPaidKEEP;

                if (monMatch && keepMatch) {
                    console.log(`  ✅ User received the expected amounts!`);
                } else {
                    if (!monMatch) {
                        console.log(`  ⚠️ WMON mismatch: received ${ethers.formatEther(wmonChange)} MON, expected ${ethers.formatEther(potPaidMON)} MON`);
                        console.log(`     Difference: ${ethers.formatEther(potPaidMON - wmonChange)} MON`);
                    }
                    if (!keepMatch) {
                        console.log(`  ⚠️ KEEP mismatch: received ${ethers.formatEther(keepChange)} KEEP, expected ${ethers.formatEther(potPaidKEEP)} KEEP`);
                        console.log(`     Difference: ${ethers.formatEther(potPaidKEEP - keepChange)} KEEP`);
                    }
                }
            }
        } catch (e) {
            console.log(`  ⚠️ Could not analyze pot balance: ${e}`);
        }

    } catch (error: any) {
        console.error(`❌ Error checking transaction:`, error.message);
    }
}

async function checkRecentRaids(provider: any, cellar: any, userAddress: string) {
    try {
        const currentBlock = await provider.getBlockNumber();
        // Search more blocks for raids (they're less frequent)
        const fromBlock = Math.max(0, currentBlock - 50000); // Last ~50000 blocks

        console.log(`Searching blocks ${fromBlock} to ${currentBlock} for raids by ${userAddress}...\n`);

        // First try with user address filter
        let raidFilter = cellar.filters.Raid(userAddress);
        let events = await cellar.queryFilter(raidFilter, fromBlock, currentBlock);

        // If no events found, try without filter to see all raids
        if (events.length === 0) {
            console.log(`No raids found for ${userAddress}, checking all recent raids...\n`);
            raidFilter = cellar.filters.Raid();
            events = await cellar.queryFilter(raidFilter, fromBlock, currentBlock);

            // Filter to user's raids manually
            events = events.filter((e: any) => e.args && e.args[0].toLowerCase() === userAddress.toLowerCase());
        }

        if (events.length === 0) {
            console.log(`⚠️ No Raid events found for ${userAddress} in the last ${currentBlock - fromBlock} blocks`);
            console.log(`   Try setting RAID_TX_HASH environment variable to check a specific transaction`);
            return;
        }

        console.log(`Found ${events.length} raid(s) by ${userAddress}:\n`);

        for (let i = 0; i < events.length; i++) {
            const event = events[i];
            const args = event.args;
            if (args) {
                const user = args[0];
                const lpBid = args[1];
                const potPaidMON = args[2];
                const potPaidKEEP = args[3];

                console.log(`━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━`);
                console.log(`Raid #${i + 1}:`);
                console.log(`  Transaction: ${event.transactionHash}`);
                console.log(`  Block: ${event.blockNumber}`);
                console.log(`  LP Bid: ${ethers.formatEther(lpBid)} CLP`);
                console.log(`  Pot Paid MON: ${ethers.formatEther(potPaidMON)} MON`);
                console.log(`  Pot Paid KEEP: ${ethers.formatEther(potPaidKEEP)} KEEP`);

                // Check transaction receipt
                const receipt = await provider.getTransactionReceipt(event.transactionHash);
                if (receipt) {
                    const tx = await provider.getTransaction(event.transactionHash);

                    // Check WMON and KEEP token balances
                    const WMON_ADDRESS = WMON_MAINNET;
                    const KEEP_TOKEN_ADDRESS = KEEP_TOKEN_MAINNET;

                    const wmon = new ethers.Contract(WMON_ADDRESS, WMON_ABI, provider);
                    const keepToken = new ethers.Contract(KEEP_TOKEN_ADDRESS, KEEP_TOKEN_ABI, provider);

                    const wmonBefore = await wmon.balanceOf(user, { blockTag: event.blockNumber - 1 });
                    const wmonAfter = await wmon.balanceOf(user, { blockTag: event.blockNumber });
                    const wmonChange = wmonAfter - wmonBefore;

                    const keepBefore = await keepToken.balanceOf(user, { blockTag: event.blockNumber - 1 });
                    const keepAfter = await keepToken.balanceOf(user, { blockTag: event.blockNumber });
                    const keepChange = keepAfter - keepBefore;

                    const gasUsed = receipt.gasUsed;
                    const gasPrice = tx.gasPrice || 0n;
                    const gasCost = gasUsed * gasPrice;

                    console.log(`  WMON Received: ${ethers.formatEther(wmonChange)} MON`);
                    console.log(`  KEEP Received: ${ethers.formatEther(keepChange)} KEEP`);
                    console.log(`  Gas Cost: ${ethers.formatEther(gasCost)} MON`);

                    const monMatch = wmonChange === potPaidMON;
                    const keepMatch = keepChange === potPaidKEEP;

                    if (monMatch && keepMatch) {
                        console.log(`  ✅ User received the expected amounts!`);
                    } else {
                        if (!monMatch) {
                            console.log(`  ⚠️ WMON mismatch: received ${ethers.formatEther(wmonChange)} MON, expected ${ethers.formatEther(potPaidMON)} MON`);
                        }
                        if (!keepMatch) {
                            console.log(`  ⚠️ KEEP mismatch: received ${ethers.formatEther(keepChange)} KEEP, expected ${ethers.formatEther(potPaidKEEP)} KEEP`);
                        }
                    }
                }
                console.log();
            }
        }

        console.log(`\n💡 To check a specific transaction in detail, set RAID_TX_HASH environment variable:`);
        console.log(`   $env:RAID_TX_HASH="0x..."; npx hardhat run scripts/check-raid-transaction.ts --network monad`);

    } catch (error: any) {
        console.error(`❌ Error checking recent raids:`, error.message);
        if (error.message?.includes('limit')) {
            console.log(`\n💡 Try setting RAID_TX_HASH to check a specific transaction instead`);
        }
    }
}

async function checkTakeOfficeTransaction(provider: any, tx: any, receipt: any) {
    const TAVERNKEEPER_ABI = [
        "event PreviousKingPaid(address indexed miner, uint256 amount)",
        "event TreasuryFee(address indexed treasury, uint256 amount)",
    ];

    const tavernKeeper = new ethers.Contract(TAVERNKEEPER, TAVERNKEEPER_ABI, provider);

    console.log(`📊 Analyzing Take Office Transaction:\n`);

    // Check for PreviousKingPaid events
    const previousKingFilter = tavernKeeper.filters.PreviousKingPaid();
    const previousKingEvents = await tavernKeeper.queryFilter(previousKingFilter, receipt.blockNumber, receipt.blockNumber);

    if (previousKingEvents.length > 0) {
        console.log(`💰 Previous King Payment:`);
        for (const event of previousKingEvents) {
            const args = event.args;
            if (args) {
                const miner = args[0];
                const amount = args[1];
                console.log(`  Previous King: ${miner}`);
                console.log(`  Amount Paid: ${ethers.formatEther(amount)} MON (80% of price)`);

                // Check if user is the previous king
                if (miner.toLowerCase() === tx.from.toLowerCase()) {
                    console.log(`  ✅ YOU are the previous king - you received this payment!`);
                } else {
                    console.log(`  ⚠️ You are NOT the previous king - someone else received this`);
                }
            }
        }
        console.log();
    }

    // Check for TreasuryFee events
    const treasuryFilter = tavernKeeper.filters.TreasuryFee();
    const treasuryEvents = await tavernKeeper.queryFilter(treasuryFilter, receipt.blockNumber, receipt.blockNumber);

    if (treasuryEvents.length > 0) {
        console.log(`🏛️ Treasury Fee:`);
        for (const event of treasuryEvents) {
            const args = event.args;
            if (args) {
                const treasury = args[0];
                const amount = args[1];
                console.log(`  Treasury: ${treasury}`);
                console.log(`  Amount: ${ethers.formatEther(amount)} MON (15% of price)`);
            }
        }
        console.log();
    }

    // Calculate fee breakdown
    const pricePaid = tx.value;
    const totalFee = (pricePaid * 2000n) / 10000n; // 20%
    const devFee = totalFee / 4n; // 5%
    const cellarFee = totalFee - devFee; // 15%
    const minerFee = pricePaid - totalFee; // 80%

    console.log(`💵 Fee Breakdown:`);
    console.log(`  Total Paid: ${ethers.formatEther(pricePaid)} MON`);
    console.log(`  Dev Fee (5%): ${ethers.formatEther(devFee)} MON → Owner`);
    console.log(`  Cellar Fee (15%): ${ethers.formatEther(cellarFee)} MON → Treasury`);
    console.log(`  Previous King (80%): ${ethers.formatEther(minerFee)} MON → Previous King`);
    console.log();

    // Check user's balance change
    const beforeBlock = receipt.blockNumber - 1;
    const balanceBefore = await provider.getBalance(tx.from, beforeBlock);
    const balanceAfter = await provider.getBalance(tx.from, receipt.blockNumber);
    const balanceChange = balanceAfter - balanceBefore;

    const gasUsed = receipt.gasUsed;
    const gasPrice = tx.gasPrice || 0n;
    const gasCost = gasUsed * gasPrice;
    const netChange = balanceChange + gasCost; // Gas is negative, so add it

    console.log(`💵 Your Balance Change:`);
    console.log(`  Before: ${ethers.formatEther(balanceBefore)} MON`);
    console.log(`  After: ${ethers.formatEther(balanceAfter)} MON`);
    console.log(`  Change: ${balanceChange >= 0n ? '+' : ''}${ethers.formatEther(balanceChange)} MON`);
    console.log(`  Gas Cost: ${ethers.formatEther(gasCost)} MON`);
    console.log(`  Net Change: ${netChange >= 0n ? '+' : ''}${ethers.formatEther(netChange)} MON`);

    if (previousKingEvents.length > 0 && previousKingEvents[0].args[0].toLowerCase() === tx.from.toLowerCase()) {
        const received = previousKingEvents[0].args[1];
        console.log(`\n  ✅ You received ${ethers.formatEther(received)} MON as the previous king`);
        console.log(`  ⚠️ But you also paid ${ethers.formatEther(pricePaid)} MON to take it back`);
        console.log(`  📊 Net: ${ethers.formatEther(received - pricePaid)} MON (you lost money taking it from yourself!)`);
    } else {
        console.log(`\n  ⚠️ You paid ${ethers.formatEther(pricePaid)} MON but did NOT receive the previous king payment`);
        console.log(`  📊 Net: -${ethers.formatEther(pricePaid)} MON (you paid to take the office)`);
    }
}

main()
    .then(() => process.exit(0))
    .catch((error) => {
        console.error(error);
        process.exit(1);
    });

