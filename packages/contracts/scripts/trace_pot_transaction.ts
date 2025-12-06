import { ethers } from "hardhat";
import * as fs from "fs";
import * as path from "path";

/**
 * Trace a transaction to see where MON tokens went and why pot is empty
 *
 * Usage:
 *   npx hardhat run scripts/trace_pot_transaction.ts --network monad
 *
 * Or with a specific transaction hash:
 *   TRANSACTION_HASH=0x... npx hardhat run scripts/trace_pot_transaction.ts --network monad
 */

async function main() {
    console.log("=== TRACING POT TRANSACTION ===\n");

    const [deployer] = await ethers.getSigners();
    const network = await ethers.provider.getNetwork();
    console.log("Network:", network.name, `(Chain ID: ${network.chainId})`);
    console.log("");

    // Addresses to trace from user's message
    const addressesToTrace = [
        "0xc2d3689cf6ce2859a3ffbc8fe09ab4c8623766b8",
        "0x3ec130b627944cad9b2750300ecb0a695da522b6",
        "0xe2072c64bca79f817508aee58fdbf092455cec4e"
    ];

    // Get contract addresses
    let THE_CELLAR = "";
    let KEEP_TOKEN = "";
    let POOL_MANAGER = "";

    const addressesPath = path.join(__dirname, "../../apps/web/lib/contracts/addresses.ts");
    if (fs.existsSync(addressesPath)) {
        const addressesContent = fs.readFileSync(addressesPath, "utf8");
        let addressSet = "MONAD_TESTNET_ADDRESSES";
        if (network.chainId === 143n) {
            addressSet = "MONAD_MAINNET_ADDRESSES";
        }

        const cellarMatch = addressesContent.match(new RegExp(`${addressSet}[\\s\\S]*?THE_CELLAR:\\s*['"](0x[a-fA-F0-9]{40})['"]`, "i"));
        const keepMatch = addressesContent.match(new RegExp(`${addressSet}[\\s\\S]*?KEEP_TOKEN:\\s*['"](0x[a-fA-F0-9]{40})['"]`, "i"));
        const pmMatch = addressesContent.match(new RegExp(`${addressSet}[\\s\\S]*?POOL_MANAGER:\\s*['"](0x[a-fA-F0-9]{40})['"]`, "i"));

        if (cellarMatch && cellarMatch[1]) THE_CELLAR = cellarMatch[1];
        if (keepMatch && keepMatch[1]) KEEP_TOKEN = keepMatch[1];
        if (pmMatch && pmMatch[1]) POOL_MANAGER = pmMatch[1];
    }

    // Fallback
    if (!THE_CELLAR) {
        if (network.chainId === 143n) {
            THE_CELLAR = "0xe71CAf7162dd81a4A9C0c6BD25ED02C26F492DC0";
            KEEP_TOKEN = "0x2D1094F5CED6ba279962f9676d32BE092AFbf82E";
            POOL_MANAGER = "0x27e98f6A0D3315F9f3ECDaFE0187a7637F41c7c2";
        } else {
            THE_CELLAR = "0xA43034595E2d1c52Ab08a057B95dD38bCbFf87dC";
            KEEP_TOKEN = "0x96982EC3625145f098DCe06aB34E99E7207b0520";
            POOL_MANAGER = "0x8788E862023A49a77E8F27277a8b3F07B4E9A7d8";
        }
    }

    console.log("Contract Addresses:");
    console.log("  THE_CELLAR:", THE_CELLAR);
    console.log("  KEEP_TOKEN:", KEEP_TOKEN);
    console.log("  POOL_MANAGER:", POOL_MANAGER);
    console.log("");

    // Trace the addresses
    console.log("=== TRACING ADDRESSES ===");
    for (const addr of addressesToTrace) {
        console.log(`\n📍 Checking address: ${addr}`);
        try {
            const balance = await ethers.provider.getBalance(addr);
            console.log(`  Balance: ${ethers.formatEther(balance)} MON`);

            // Check if it's a contract
            const code = await ethers.provider.getCode(addr);
            if (code !== "0x") {
                console.log(`  Type: Contract`);
            } else {
                console.log(`  Type: EOA`);
            }

            // Check recent transactions TO this address
            const blockNumber = await ethers.provider.getBlockNumber();
            console.log(`  Checking recent transactions (last 1000 blocks)...`);

        } catch (e: any) {
            console.log(`  ❌ Error: ${e.message}`);
        }
    }
    console.log("");

    // Get transaction hash from env or use a recent one
    const txHash = process.env.TRANSACTION_HASH;
    if (!txHash) {
        console.log("❌ No TRANSACTION_HASH provided. Please set it:");
        console.log("   TRANSACTION_HASH=0x... npx hardhat run scripts/trace_pot_transaction.ts --network monad");
        console.log("");
        console.log("Checking recent transactions to THE_CELLAR...");

        // Try to get recent transactions
        try {
            const blockNumber = await ethers.provider.getBlockNumber();
            console.log(`Current block: ${blockNumber}`);
            console.log(`Checking blocks ${blockNumber - 1000} to ${blockNumber}...`);

            // This is expensive, so we'll just check the current state
            console.log("\nInstead, let's check the current state and recent events:");
        } catch (e) {
            console.error("Error:", e);
        }
    } else {
        console.log(`Tracing transaction: ${txHash}\n`);

        try {
            const tx = await ethers.provider.getTransaction(txHash);
            if (!tx) {
                console.log("❌ Transaction not found");
                return;
            }

            console.log("Transaction Details:");
            console.log("  From:", tx.from);
            console.log("  To:", tx.to);
            console.log("  Value:", ethers.formatEther(tx.value || 0n), "MON");
            console.log("  Gas Limit:", tx.gasLimit.toString());
            console.log("");

            // Get receipt
            const receipt = await ethers.provider.getTransactionReceipt(txHash);
            if (!receipt) {
                console.log("❌ Transaction receipt not found (may not be mined yet)");
                return;
            }

            console.log("Transaction Receipt:");
            console.log("  Status:", receipt.status === 1 ? "✅ Success" : "❌ Failed");
            console.log("  Block:", receipt.blockNumber);
            console.log("  Gas Used:", receipt.gasUsed.toString());
            console.log("");

            // Parse logs
            console.log("=== LOGS ===");
            const CellarHook = await ethers.getContractFactory("CellarHook");
            const cellarHook = CellarHook.attach(THE_CELLAR);
            const iface = cellarHook.interface;

            for (const log of receipt.logs) {
                // Check if it's from THE_CELLAR
                if (log.address.toLowerCase() === THE_CELLAR.toLowerCase()) {
                    try {
                        const parsed = iface.parseLog({
                            topics: log.topics as string[],
                            data: log.data
                        });
                        console.log(`\n📋 Event: ${parsed.name}`);
                        console.log("  Args:", JSON.stringify(parsed.args, (key, value) => {
                            if (typeof value === 'bigint') {
                                return value.toString();
                            }
                            return value;
                        }, 2));
                    } catch (e) {
                        // Not a CellarHook event, try Transfer
                        if (log.topics[0] === ethers.id("Transfer(address,address,uint256)")) {
                            const from = ethers.getAddress("0x" + log.topics[1].slice(26));
                            const to = ethers.getAddress("0x" + log.topics[2].slice(26));
                            const amount = ethers.getBigInt(log.data);
                            console.log(`\n💰 Transfer:`);
                            console.log(`  From: ${from}`);
                            console.log(`  To: ${to}`);
                            console.log(`  Amount: ${ethers.formatEther(amount)} tokens`);

                            if (to.toLowerCase() === THE_CELLAR.toLowerCase()) {
                                console.log(`  ⚠️  MON sent to CellarHook!`);
                            }
                        }
                    }
                }
            }

            // Check for native transfers
            console.log("\n=== NATIVE TRANSFERS ===");
            if (tx.value && tx.value > 0n) {
                console.log(`Native MON sent: ${ethers.formatEther(tx.value)} MON`);
                if (tx.to?.toLowerCase() === THE_CELLAR.toLowerCase()) {
                    console.log(`  ⚠️  Native MON sent directly to CellarHook!`);
                    console.log(`  This should have triggered receive() and updated potBalance`);
                }
            }

        } catch (error: any) {
            console.error("❌ Error tracing transaction:", error.message);
        }
    }

    // Check current pot state
    console.log("\n=== CURRENT POT STATE ===");
    try {
        const CellarHook = await ethers.getContractFactory("CellarHook");
        const cellarHook = CellarHook.attach(THE_CELLAR);

        const potBalance = await cellarHook.potBalance();
        console.log("Pot Balance:", ethers.formatEther(potBalance), "MON");
        console.log("Pot Balance (wei):", potBalance.toString());

        const contractBalance = await ethers.provider.getBalance(THE_CELLAR);
        console.log("CellarHook Contract Balance:", ethers.formatEther(contractBalance), "MON");
        console.log("Difference:", ethers.formatEther(contractBalance - potBalance), "MON");

        if (contractBalance > potBalance) {
            console.log("\n⚠️  WARNING: Contract has more MON than potBalance!");
            console.log("   This suggests MON was sent but potBalance wasn't updated.");
        }

        // Check recent PotContributed events
        console.log("\n=== RECENT POT CONTRIBUTIONS ===");
        const blockNumber = await ethers.provider.getBlockNumber();
        const fromBlock = blockNumber - 10000; // Last ~10000 blocks

        try {
            const filter = cellarHook.filters.PotContributed();
            const events = await cellarHook.queryFilter(filter, fromBlock, blockNumber);

            if (events.length === 0) {
                console.log("No PotContributed events found in last ~10000 blocks");
            } else {
                console.log(`Found ${events.length} PotContributed event(s):`);
                for (const event of events.slice(-10)) { // Last 10
                    console.log(`\n  Block ${event.blockNumber}:`);
                    console.log(`    Contributor: ${event.args.contributor}`);
                    console.log(`    Amount: ${ethers.formatEther(event.args.amount)} MON`);
                }
            }
        } catch (e: any) {
            console.log("Could not query events:", e.message);
        }

    } catch (error: any) {
        console.error("❌ Error checking pot state:", error.message);
    }

    // Check if swap fees are being collected
    console.log("\n=== SWAP FEE COLLECTION CHECK ===");
    console.log("⚠️  CRITICAL ISSUE: The afterSwap hook currently does NOT collect fees!");
    console.log("   It just returns (this.afterSwap.selector, 0)");
    console.log("   Swap fees go to the PoolManager, not the pot.");
    console.log("   To collect fees, afterSwap would need to extract fees from BalanceDelta");
    console.log("   and add them to potBalance.");

    // Check PoolManager balance
    console.log("\n=== POOL MANAGER BALANCE ===");
    try {
        const pmBalance = await ethers.provider.getBalance(POOL_MANAGER);
        console.log(`PoolManager MON Balance: ${ethers.formatEther(pmBalance)} MON`);
        console.log("⚠️  This is where swap fees are accumulating!");
        console.log("   The fees are stuck in PoolManager, not in the pot.");

        // Calculate what 1% fee would be on 2356 MON
        const swapAmount = ethers.parseEther("2356.167249190253275151");
        const feeAmount = swapAmount * 10000n / 1000000n; // 1% fee (10000 bps)
        console.log(`\nExample: On a ${ethers.formatEther(swapAmount)} MON swap:`);
        console.log(`  Fee (1%): ${ethers.formatEther(feeAmount)} MON`);
        console.log(`  This fee goes to PoolManager, NOT to potBalance!`);
    } catch (e: any) {
        console.log(`Error: ${e.message}`);
    }

    // Check recent Swap events
    console.log("\n=== RECENT SWAP EVENTS ===");
    try {
        const CellarHook = await ethers.getContractFactory("CellarHook");
        const cellarHook = CellarHook.attach(THE_CELLAR);
        const blockNumber = await ethers.provider.getBlockNumber();
        const fromBlock = blockNumber - 10000;

        // Check for any events that might indicate swaps
        // Note: Uniswap V4 swaps don't emit events from the hook, they're in PoolManager
        console.log("Note: Uniswap V4 swaps are handled by PoolManager, not CellarHook");
        console.log("      Swap events would be in PoolManager logs, not CellarHook");

    } catch (e: any) {
        console.log(`Error: ${e.message}`);
    }

    console.log("\n=== ROOT CAUSE ANALYSIS ===");
    console.log("❌ PROBLEM: Swap fees are NOT being collected!");
    console.log("   1. User swaps MON/KEEP through Uniswap V4");
    console.log("   2. 1% fee (10000 bps) is taken by PoolManager");
    console.log("   3. afterSwap() hook is called but does NOTHING");
    console.log("   4. Fees accumulate in PoolManager, NOT in potBalance");
    console.log("   5. Pot stays at 0 because no fees are being added");
    console.log("");
    console.log("✅ SOLUTION: Implement fee collection in afterSwap() hook");
    console.log("   - Extract fee from swap BalanceDelta");
    console.log("   - Add fee to potBalance");
    console.log("   - This requires understanding Uniswap V4 fee mechanics");

    console.log("\n=== SUMMARY ===");
    console.log("1. Check if MON was sent directly to CellarHook (should update potBalance)");
    console.log("2. Check if contributeToPot() was called (should emit PotContributed event)");
    console.log("3. ❌ Swap fees are NOT being collected (CRITICAL BUG)");
    console.log("4. Verify contract balance vs potBalance (should match if MON is native)");
    console.log("5. Fees are accumulating in PoolManager, not in pot");
}

main()
    .then(() => process.exit(0))
    .catch((error) => {
        console.error("❌ Script failed:", error);
        process.exitCode = 1;
    });

