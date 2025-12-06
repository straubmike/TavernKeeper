import { ethers, upgrades } from "hardhat";
import * as fs from "fs";
import * as path from "path";

/**
 * Deploy SwapRouterV4 for Uniswap V4 swaps
 *
 * Usage:
 *   npx hardhat run scripts/deploy_swap_router.ts --network monad
 */

async function main() {
    console.log("=== DEPLOYING SWAP ROUTER V4 ===\n");

    const [deployer] = await ethers.getSigners();
    console.log("Deployer:", deployer.address);
    console.log("Balance:", ethers.formatEther(await ethers.provider.getBalance(deployer.address)), "MON\n");

    const network = await ethers.provider.getNetwork();
    console.log("Network:", network.name, `(Chain ID: ${network.chainId})\n`);

    // Get PoolManager address
    let POOL_MANAGER = "";
    const addressesPath = path.join(__dirname, "../../apps/web/lib/contracts/addresses.ts");
    if (fs.existsSync(addressesPath)) {
        const addressesContent = fs.readFileSync(addressesPath, "utf8");
        let addressSet = "MONAD_TESTNET_ADDRESSES";
        if (network.chainId === 143n) {
            addressSet = "MONAD_MAINNET_ADDRESSES";
        }
        const pmMatch = addressesContent.match(new RegExp(`${addressSet}[\\s\\S]*?POOL_MANAGER:\\s*['"](0x[a-fA-F0-9]{40})['"]`, "i"));
        if (pmMatch && pmMatch[1]) POOL_MANAGER = pmMatch[1];
    }

    // Fallback
    if (!POOL_MANAGER) {
        if (network.chainId === 143n) {
            POOL_MANAGER = "0x27e98f6A0D3315F9f3ECDaFE0187a7637F41c7c2";
        } else {
            POOL_MANAGER = "0x8788E862023A49a77E8F27277a8b3F07B4E9A7d8";
        }
    }

    console.log("PoolManager:", POOL_MANAGER);
    console.log("");

    // Deploy SwapRouterV4
    console.log("Deploying SwapRouterV4...");
    const SwapRouterV4 = await ethers.getContractFactory("SwapRouterV4");
    const swapRouter = await SwapRouterV4.deploy(POOL_MANAGER);
    await swapRouter.waitForDeployment();
    const routerAddress = await swapRouter.getAddress();

    console.log("✅ SwapRouterV4 deployed!");
    console.log("   Address:", routerAddress);
    console.log("");

    // Verify deployment
    const poolManager = await swapRouter.poolManager();
    console.log("Verification:");
    console.log("   PoolManager:", poolManager);
    if (poolManager.toLowerCase() === POOL_MANAGER.toLowerCase()) {
        console.log("   ✅ PoolManager set correctly");
    } else {
        console.log("   ❌ PoolManager mismatch!");
    }

    console.log("\n=== DEPLOYMENT COMPLETE ===");
    console.log("SwapRouterV4:", routerAddress);
    console.log("\nNext steps:");
    console.log("1. Update addresses.ts with SWAP_ROUTER_V4 address");
    console.log("2. Update frontend to use this router for swaps");
}

main()
    .then(() => process.exit(0))
    .catch((error) => {
        console.error("❌ Deployment failed:", error);
        process.exitCode = 1;
    });

