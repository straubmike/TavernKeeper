import { ethers } from "hardhat";
import * as fs from "fs";
import * as path from "path";

async function main() {
    console.log("=== TESTING SWAP ===");

    const [signer] = await ethers.getSigners();
    console.log("Signer:", signer.address);
    console.log("Balance:", ethers.formatEther(await ethers.provider.getBalance(signer.address)), "MON");

    const network = await ethers.provider.getNetwork();
    const chainId = network.chainId;
    console.log("Network:", network.name, "(Chain ID:", chainId + ")");

    // Get addresses from addresses.ts
    const addressesPath = path.join(__dirname, "../../../apps/web/lib/contracts/addresses.ts");
    if (!fs.existsSync(addressesPath)) {
        throw new Error(`Addresses file not found: ${addressesPath}`);
    }

    const addressesContent = fs.readFileSync(addressesPath, "utf8");
    let addressSet = "MONAD_TESTNET_ADDRESSES";
    if (chainId === 143n) {
        addressSet = "MONAD_MAINNET_ADDRESSES";
    } else if (chainId === 31337n) {
        addressSet = "LOCALHOST_ADDRESSES";
    }

    // Extract addresses using regex - find the specific address set first
    const addressSetRegex = new RegExp(`${addressSet}\\s*=\\s*\\{([^}]+)\\}`, "s");
    const addressSetMatch = addressesContent.match(addressSetRegex);
    if (!addressSetMatch) {
        throw new Error(`Address set ${addressSet} not found`);
    }
    const addressSetContent = addressSetMatch[1];

    const extractAddress = (name: string): string => {
        const regex = new RegExp(`${name}:\\s*['"](0x[a-fA-F0-9]{40})['"]`, "i");
        const match = addressSetContent.match(regex);
        if (!match) {
            throw new Error(`Address ${name} not found in ${addressSet}`);
        }
        return match[1];
    };

    const SWAP_ROUTER_V4 = extractAddress("SWAP_ROUTER_V4");
    const POOL_MANAGER = extractAddress("POOL_MANAGER");
    const KEEP_TOKEN = extractAddress("KEEP_TOKEN");
    const THE_CELLAR = extractAddress("THE_CELLAR");

    console.log("\nContract Addresses:");
    console.log("  SwapRouterV4:", SWAP_ROUTER_V4);
    console.log("  PoolManager:", POOL_MANAGER);
    console.log("  KEEP Token:", KEEP_TOKEN);
    console.log("  The Cellar:", THE_CELLAR);

    if (SWAP_ROUTER_V4 === '0x0000000000000000000000000000000000000000') {
        throw new Error("SWAP_ROUTER_V4 not deployed on this network!");
    }

    // Get SwapRouterV4 contract
    const SwapRouterV4 = await ethers.getContractAt(
        "SwapRouterV4",
        SWAP_ROUTER_V4
    );

    // Verify PoolManager
    const poolManagerAddress = await SwapRouterV4.poolManager();
    console.log("\n✅ SwapRouterV4 PoolManager:", poolManagerAddress);
    if (poolManagerAddress.toLowerCase() !== POOL_MANAGER.toLowerCase()) {
        throw new Error(`PoolManager mismatch! Expected ${POOL_MANAGER}, got ${poolManagerAddress}`);
    }

    // Pool key parameters (from CellarHook)
    const poolKey = {
        currency0: "0x0000000000000000000000000000000000000000", // MON (native)
        currency1: KEEP_TOKEN, // KEEP
        fee: 10000, // 1%
        tickSpacing: 200,
        hooks: THE_CELLAR, // CellarHook
    };

    console.log("\nPool Key:");
    console.log("  Currency0 (MON):", poolKey.currency0);
    console.log("  Currency1 (KEEP):", poolKey.currency1);
    console.log("  Fee:", poolKey.fee);
    console.log("  Tick Spacing:", poolKey.tickSpacing);
    console.log("  Hooks:", poolKey.hooks);

    // Check user balances
    const monBalance = await ethers.provider.getBalance(signer.address);
    const keepToken = await ethers.getContractAt("KeepToken", KEEP_TOKEN);
    const keepBalance = await keepToken.balanceOf(signer.address);

    console.log("\nUser Balances:");
    console.log("  MON:", ethers.formatEther(monBalance));
    console.log("  KEEP:", ethers.formatEther(keepBalance));

    // Test swap: MON -> KEEP (small amount)
    const swapAmount = ethers.parseEther("0.01"); // 0.01 MON
    console.log("\n🔄 Testing Swap: MON -> KEEP");
    console.log("  Amount:", ethers.formatEther(swapAmount), "MON");

    // Swap params
    const swapParams = {
        zeroForOne: true, // MON -> KEEP
        amountSpecified: swapAmount, // Positive for exact input
        sqrtPriceLimitX96: 0, // No price limit
    };

    console.log("\nSwap Params:");
    console.log("  zeroForOne:", swapParams.zeroForOne);
    console.log("  amountSpecified:", ethers.formatEther(swapParams.amountSpecified), "MON");
    console.log("  sqrtPriceLimitX96:", swapParams.sqrtPriceLimitX96);

    try {
        // Execute swap
        console.log("\n📤 Executing swap...");
        const tx = await SwapRouterV4.swapExactInput(
            poolKey,
            swapParams,
            signer.address,
            { value: swapAmount }
        );

        console.log("  Transaction hash:", tx.hash);
        console.log("  Waiting for confirmation...");

        const receipt = await tx.wait();
        console.log("  ✅ Swap confirmed!");
        console.log("  Gas used:", receipt.gasUsed.toString());

        // Check new balances
        const newMonBalance = await ethers.provider.getBalance(signer.address);
        const newKeepBalance = await keepToken.balanceOf(signer.address);

        console.log("\nNew Balances:");
        console.log("  MON:", ethers.formatEther(newMonBalance));
        console.log("  KEEP:", ethers.formatEther(newKeepBalance));

        const monDiff = monBalance - newMonBalance;
        const keepDiff = newKeepBalance - keepBalance;

        console.log("\nSwap Results:");
        console.log("  MON spent:", ethers.formatEther(monDiff));
        console.log("  KEEP received:", ethers.formatEther(keepDiff));

        if (keepDiff > 0n) {
            console.log("\n✅ Swap successful!");
        } else {
            console.log("\n⚠️ Swap completed but no KEEP received (check pool liquidity)");
        }
    } catch (error: any) {
        console.error("\n❌ Swap failed!");
        console.error("  Error:", error.message);
        if (error.data) {
            console.error("  Data:", error.data);
        }
        if (error.reason) {
            console.error("  Reason:", error.reason);
        }
        throw error;
    }
}

main()
    .then(() => process.exit(0))
    .catch((error) => {
        console.error(error);
        process.exit(1);
    });

