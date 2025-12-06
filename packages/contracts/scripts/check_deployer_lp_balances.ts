import { ethers } from "hardhat";

const OLD_POOL = "0x6c7612F44B71E5E6E2bA0FEa799A23786A537755";
const NEW_POOL = "0xe71CAf7162dd81a4A9C0c6BD25ED02C26F492DC0";
const DEPLOYER = "0xD515674a7fE63dFDfd43Fb5647E8B04eEfCEdCAa";

// You can pass an address as an argument: npx hardhat run scripts/check_deployer_lp_balances.ts --network monad -- <address>
async function main() {
    const [signer] = await ethers.getSigners();
    const addressToCheck = process.argv[2] || DEPLOYER;
    
    console.log("=== CHECKING LP BALANCES ===");
    console.log("Signer:", signer.address);
    console.log("Address to check:", addressToCheck);
    console.log("Network:", (await ethers.provider.getNetwork()).name);
    console.log("Chain ID:", (await ethers.provider.getNetwork()).chainId);
    console.log("");

    // Get CellarHook ABI (just the balanceOf function)
    const abi = [
        "function balanceOf(address account) view returns (uint256)",
        "function totalSupply() view returns (uint256)",
        "function potBalance() view returns (uint256)",
        "function poolInitialized() view returns (bool)",
        "function getAuctionPrice() view returns (uint256)",
    ];

    console.log("--- OLD POOL STATUS ---");
    console.log("Address:", OLD_POOL);
    try {
        const oldPool = new ethers.Contract(OLD_POOL, abi, ethers.provider);
        const oldBalance = await oldPool.balanceOf(addressToCheck);
        const oldTotalSupply = await oldPool.totalSupply();
        const oldPotBalance = await oldPool.potBalance();
        const oldInitialized = await oldPool.poolInitialized();
        
        console.log("LP Balance:", ethers.formatEther(oldBalance), "LP");
        console.log("Total Supply:", ethers.formatEther(oldTotalSupply), "LP");
        console.log("Pot Balance:", ethers.formatEther(oldPotBalance), "MON");
        console.log("Pool Initialized:", oldInitialized ? "✅ YES" : "❌ NO");
    } catch (error: any) {
        console.log("❌ Error reading old pool:", error.message);
    }

    console.log("\n--- NEW POOL STATUS ---");
    console.log("Address:", NEW_POOL);
    try {
        const newPool = new ethers.Contract(NEW_POOL, abi, ethers.provider);
        const newBalance = await newPool.balanceOf(addressToCheck);
        const newTotalSupply = await newPool.totalSupply();
        const newPotBalance = await newPool.potBalance();
        const newInitialized = await newPool.poolInitialized();
        const newPrice = await newPool.getAuctionPrice();
        
        console.log("LP Balance:", ethers.formatEther(newBalance), "LP");
        console.log("Total Supply:", ethers.formatEther(newTotalSupply), "LP");
        console.log("Pot Balance:", ethers.formatEther(newPotBalance), "MON");
        console.log("Pool Initialized:", newInitialized ? "✅ YES" : "❌ NO");
        console.log("Current Raid Price:", ethers.formatEther(newPrice), "LP");
    } catch (error: any) {
        console.log("❌ Error reading new pool:", error.message);
    }

    console.log("\n--- RECENT TRANSACTIONS FROM DEPLOYER ---");
    try {
        const currentBlock = await ethers.provider.getBlockNumber();
        const fromBlock = Math.max(0, currentBlock - 1000); // Last ~1000 blocks
        
        // Get recent transactions
        const filter = {
            fromBlock,
            toBlock: currentBlock,
            from: addressToCheck,
        };
        
        const txs = await ethers.provider.getLogs({
            ...filter,
            topics: [
                // Transfer events (ERC20)
                ethers.id("Transfer(address,address,uint256)"),
            ],
        });

        console.log(`Found ${txs.length} Transfer events in last ~1000 blocks`);
        
        // Check for transfers to/from pools
        const poolAddresses = [OLD_POOL.toLowerCase(), NEW_POOL.toLowerCase()];
        const relevantTxs = txs.filter(tx => {
            const to = tx.topics[2] ? ethers.getAddress("0x" + tx.topics[2].slice(26)) : null;
            const from = tx.topics[1] ? ethers.getAddress("0x" + tx.topics[1].slice(26)) : null;
            return (to && poolAddresses.includes(to.toLowerCase())) ||
                   (from && poolAddresses.includes(from.toLowerCase()));
        });

        if (relevantTxs.length > 0) {
            console.log(`\nFound ${relevantTxs.length} relevant LP token transfers:`);
            for (const tx of relevantTxs.slice(0, 10)) { // Show first 10
                const block = await ethers.provider.getBlock(tx.blockNumber);
                const to = tx.topics[2] ? ethers.getAddress("0x" + tx.topics[2].slice(26)) : "unknown";
                const from = tx.topics[1] ? ethers.getAddress("0x" + tx.topics[1].slice(26)) : "unknown";
                const amount = tx.data ? ethers.formatEther(ethers.getBigInt(tx.data)) : "unknown";
                
                const poolName = to.toLowerCase() === NEW_POOL.toLowerCase() ? "NEW POOL" :
                               to.toLowerCase() === OLD_POOL.toLowerCase() ? "OLD POOL" : "OTHER";
                
                console.log(`  Block ${tx.blockNumber} (${new Date(Number(block?.timestamp || 0) * 1000).toISOString()}):`);
                console.log(`    From: ${from}`);
                console.log(`    To: ${to} (${poolName})`);
                console.log(`    Amount: ${amount} LP`);
            }
        } else {
            console.log("No recent LP token transfers found");
        }
    } catch (error: any) {
        console.log("❌ Error checking transactions:", error.message);
    }

    console.log("\n--- FRONTEND CONFIGURATION CHECK ---");
    console.log("Frontend should be using:", NEW_POOL);
    console.log("If frontend shows 0.27 LP:");
    console.log("  - Check if it matches NEW pool balance above");
    console.log("  - If it matches OLD pool, frontend is using wrong address!");
    
    console.log("\n--- RAID BUTTON CONDITIONS ---");
    try {
        const newPool = new ethers.Contract(NEW_POOL, abi, ethers.provider);
        const potBalance = await newPool.potBalance();
        const raidPrice = await newPool.getAuctionPrice();
        const userBalance = await newPool.balanceOf(addressToCheck);
        const hasEnoughLP = userBalance >= raidPrice;
        
        console.log("Pot Balance:", ethers.formatEther(potBalance), "MON");
        console.log("Raid Price:", ethers.formatEther(raidPrice), "LP");
        console.log("Your LP Balance:", ethers.formatEther(userBalance), "LP");
        console.log("Has Enough LP:", hasEnoughLP ? "✅ YES" : "❌ NO");
        console.log("Raid Button Should Show:", 
            (potBalance > 0n && hasEnoughLP) ? "✅ YES" : "❌ NO");
        if (potBalance === 0n) {
            console.log("  Reason: Pot is empty");
        }
        if (!hasEnoughLP) {
            console.log(`  Reason: Need ${ethers.formatEther(raidPrice)} LP, have ${ethers.formatEther(userBalance)} LP`);
        }
    } catch (error: any) {
        console.log("❌ Error checking raid conditions:", error.message);
    }
}

main().catch((error) => {
    console.error("❌ Script failed:", error);
    process.exitCode = 1;
});

