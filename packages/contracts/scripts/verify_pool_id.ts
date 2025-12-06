import { ethers } from "hardhat";
import * as fs from "fs";
import * as path from "path";

/**
 * Verify the pool ID calculation matches on-chain
 *
 * Usage:
 *   npx hardhat run scripts/verify_pool_id.ts --network monad
 */
async function main() {
    console.log("=== VERIFYING POOL ID ===\n");

    const [deployer] = await ethers.getSigners();
    const network = await ethers.provider.getNetwork();
    const chainId = network.chainId;

    console.log("Network:", network.name, "(Chain ID:", chainId + ")");
    console.log("Deployer:", deployer.address);

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

    // Extract addresses using regex - need to find the specific address set first
    const addressSetMatch = new RegExp(`${addressSet}\\s*=\\s*\\{([^}]+)\\}`, "s").exec(addressesContent);
    if (!addressSetMatch) {
        throw new Error(`Address set ${addressSet} not found in addresses.ts`);
    }
    const addressSetContent = addressSetMatch[1];

    // Extract addresses from the specific address set
    const extractAddress = (name: string): string => {
        const regex = new RegExp(`${name}:\\s*['"](0x[a-fA-F0-9]{40})['"]`, "g");
        const match = regex.exec(addressSetContent);
        if (!match) {
            throw new Error(`Address ${name} not found in ${addressSet}`);
        }
        return match[1];
    };

    const addresses = {
        POOL_MANAGER: extractAddress("POOL_MANAGER"),
        THE_CELLAR: extractAddress("THE_CELLAR"),
        KEEP_TOKEN: extractAddress("KEEP_TOKEN"),
    };
    const poolManagerAddress = addresses.POOL_MANAGER;
    const cellarHookAddress = addresses.THE_CELLAR;
    const keepTokenAddress = addresses.KEEP_TOKEN;

    console.log("\nContract Addresses:");
    console.log("  PoolManager:", poolManagerAddress);
    console.log("  CellarHook:", cellarHookAddress);
    console.log("  KEEP Token:", keepTokenAddress);

    // Create pool key
    const poolKey = {
        currency0: ethers.ZeroAddress, // MON (native)
        currency1: keepTokenAddress,
        fee: 10000, // 1%
        tickSpacing: 200,
        hooks: cellarHookAddress,
    };

    console.log("\nPool Key:");
    console.log("  Currency0 (MON):", poolKey.currency0);
    console.log("  Currency1 (KEEP):", poolKey.currency1);
    console.log("  Fee:", poolKey.fee);
    console.log("  Tick Spacing:", poolKey.tickSpacing);
    console.log("  Hooks:", poolKey.hooks);

    // Calculate pool ID (same as frontend)
    const encoded = ethers.AbiCoder.defaultAbiCoder().encode(
        ["address", "address", "uint24", "int24", "address"],
        [poolKey.currency0, poolKey.currency1, poolKey.fee, poolKey.tickSpacing, poolKey.hooks]
    );
    const poolId = ethers.keccak256(encoded);

    console.log("\nCalculated Pool ID:", poolId);

    // Try to read pool state
    const poolManager = await ethers.getContractAt("IPoolManager", poolManagerAddress);

    try {
        const slot0 = await poolManager.getSlot0(poolId);
        console.log("\n✅ Pool is initialized!");
        console.log("  sqrtPriceX96:", slot0.sqrtPriceX96.toString());
        console.log("  tick:", slot0.tick.toString());
        console.log("  protocolFee:", slot0.protocolFee.toString());
        console.log("  lpFee:", slot0.lpFee.toString());

        const liquidity = await poolManager.getLiquidity(poolId);
        console.log("  liquidity:", liquidity.toString());
    } catch (error: any) {
        console.error("\n❌ Pool NOT initialized or pool ID is wrong!");
        console.error("  Error:", error.message);

        // Try to check if pool exists with different methods
        console.log("\nTrying alternative checks...");

        // Check if CellarHook has poolInitialized()
        try {
            const cellarHook = await ethers.getContractAt("CellarHook", cellarHookAddress);
            const poolInitialized = await cellarHook.poolInitialized();
            console.log("  CellarHook.poolInitialized():", poolInitialized);

            if (poolInitialized) {
                console.log("  ⚠️  CellarHook says pool is initialized, but PoolManager.getSlot0() fails!");
                console.log("  This suggests the pool ID calculation might be wrong.");
            }
        } catch (e: any) {
            console.error("  Could not check CellarHook.poolInitialized():", e.message);
        }
    }

    // Also check what the frontend is calculating
    console.log("\n=== FRONTEND POOL ID CHECK ===");
    console.log("The frontend calculates pool ID as:");
    console.log("  keccak256(encodeAbiParameters([address, address, uint24, int24, address], [currency0, currency1, fee, tickSpacing, hooks]))");
    console.log("\nVerify this matches the calculated pool ID above.");
}

main()
    .then(() => process.exit(0))
    .catch((error) => {
        console.error(error);
        process.exit(1);
    });

