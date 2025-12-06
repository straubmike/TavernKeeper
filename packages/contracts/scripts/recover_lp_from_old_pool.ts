import { ethers } from "hardhat";

const OLD_POOL = "0x6c7612F44B71E5E6E2bA0FEa799A23786A537755";
const MAINNET_KEEP_TOKEN = "0x2D1094F5CED6ba279962f9676d32BE092AFbf82E";
const DEAD_ADDRESS = "0x000000000000000000000000000000000000dEaD";
const USER_ADDRESS = "0xD515674a7fE63dFDfd43Fb5647E8B04eEfCEdCAa"; // Change this if needed

async function main() {
    const [signer] = await ethers.getSigners();
    console.log("=== ANALYZING LP RECOVERY FROM OLD POOL ===");
    console.log("Signer:", signer.address);
    console.log("User to recover for:", USER_ADDRESS);
    console.log("Network:", (await ethers.provider.getNetwork()).name);
    console.log("Chain ID:", (await ethers.provider.getNetwork()).chainId);
    console.log("");

    // Check pool state
    const abi = [
        "function owner() view returns (address)",
        "function balanceOf(address) view returns (uint256)",
        "function totalSupply() view returns (uint256)",
        "function potBalance() view returns (uint256)",
    ];

    const oldPool = new ethers.Contract(OLD_POOL, abi, ethers.provider);
    const keepToken = new ethers.Contract(MAINNET_KEEP_TOKEN, ["function balanceOf(address) view returns (uint256)"], ethers.provider);

    const owner = await oldPool.owner();
    const userLPBalance = await oldPool.balanceOf(USER_ADDRESS);
    const totalSupply = await oldPool.totalSupply();
    const potBalance = await oldPool.potBalance();
    const poolMonBalance = await ethers.provider.getBalance(OLD_POOL);
    const poolKeepBalance = await keepToken.balanceOf(OLD_POOL);

    console.log("--- Old Pool Status ---");
    console.log("Owner:", owner);
    console.log("User LP Balance:", ethers.formatEther(userLPBalance), "LP");
    console.log("Total Supply:", ethers.formatEther(totalSupply), "LP");
    console.log("Pot Balance (state):", ethers.formatEther(potBalance), "MON");
    console.log("Pool MON Balance (native):", ethers.formatEther(poolMonBalance), "MON");
    console.log("Pool KEEP Balance:", ethers.formatEther(poolKeepBalance), "KEEP");
    console.log("");

    // Calculate user's share
    const userSharePercent = (Number(ethers.formatEther(userLPBalance)) / Number(ethers.formatEther(totalSupply))) * 100;
    const userMonShare = (userLPBalance * poolMonBalance) / totalSupply;
    const userKeepShare = (userLPBalance * poolKeepBalance) / totalSupply;

    console.log("--- Recovery Calculation ---");
    console.log("Your share of pool:", userSharePercent.toFixed(2), "%");
    console.log("Your share of MON:", ethers.formatEther(userMonShare), "MON");
    console.log("Your share of KEEP:", ethers.formatEther(userKeepShare), "KEEP");
    console.log("");

    if (owner.toLowerCase() === DEAD_ADDRESS.toLowerCase()) {
        console.log("❌ PROBLEM: Old pool ownership is with dead address");
        console.log("   Cannot use owner-only recovery functions.");
        console.log("");
        console.log("--- RECOVERY OPTIONS ---");
        console.log("");
        console.log("OPTION 1: Manual Recovery (Recommended)");
        console.log("   Since we know your share, we can manually send you:");
        console.log("   -", ethers.formatEther(userMonShare), "MON");
        console.log("   -", ethers.formatEther(userKeepShare), "KEEP");
        console.log("   (From the assets we already recovered or can recover)");
        console.log("");
        console.log("OPTION 2: Try to use public functions");
        console.log("   Check if removeLiquidity or other public functions exist");
        console.log("   that don't require ownership");
        console.log("");
        console.log("⚠️  Note: The old pool's assets are mostly in the PoolManager");
        console.log("   (Uniswap V4 liquidity), not directly in the CellarHook contract.");
        console.log("   To properly recover, we'd need to remove liquidity from Uniswap,");
        console.log("   which requires the pool to be functional.");
        console.log("");
        console.log("💡 RECOMMENDATION:");
        console.log("   Since the old pool is disabled and ownership is with dead address,");
        console.log("   the simplest solution is to manually send you equivalent assets");
        console.log("   based on your LP share. You can then mint new LP in the new pool.");
    } else {
        console.log("✅ We still own the old pool - can use recovery function!");
        console.log("");

        try {
            const CellarHookRecovery = await ethers.getContractFactory("CellarHookRecovery");
            const recoveryPool = CellarHookRecovery.attach(OLD_POOL);

            console.log("Attempting to recover", ethers.formatEther(userLPBalance), "LP...");
            const tx = await recoveryPool.forceRecoverTokensForUser(USER_ADDRESS, userLPBalance);
            console.log("Transaction hash:", tx.hash);
            await tx.wait();
            console.log("✅ Recovery successful!");
        } catch (error: any) {
            console.error("❌ Recovery failed:", error.message);
        }
    }
}

main().catch((error) => {
    console.error("❌ Script failed:", error);
    process.exitCode = 1;
});

