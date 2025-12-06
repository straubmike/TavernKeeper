import { ethers } from "hardhat";

/**
 * Check pool state and balances
 *
 * This script:
 * 1. Gets the pool state (price, tick, liquidity) via CellarHook
 * 2. Shows actual MON and KEEP balances in PoolManager
 * 3. Shows balances in CellarHook
 *
 * Usage:
 *   npx hardhat run scripts/check_pool_state.ts --network monad
 */

const MAINNET_CELLAR_HOOK_PROXY = "0xe71CAf7162dd81a4A9C0c6BD25ED02C26F492DC0"; // Latest pool (fee=10000, tickSpacing=200) - deployed 2025-01-XX
const MAINNET_POOL_MANAGER = "0x27e98f6A0D3315F9f3ECDaFE0187a7637F41c7c2";
const MAINNET_KEEP_TOKEN = "0x2D1094F5CED6ba279962f9676d32BE092AFbf82E";
const STATE_VIEW_ADDRESS = "0x77395f3b2e73ae90843717371294fa97cc419d64"; // Uniswap V4 StateView on Monad

async function main() {
    const [deployer] = await ethers.getSigners();
    console.log("=== CHECKING POOL STATE ===\n");
    console.log("Deployer:", deployer.address);
    const networkName = (await ethers.provider.getNetwork()).name;
    console.log("Network:", networkName);

    let CELLAR_HOOK_PROXY = "";
    let POOL_MANAGER = "";
    let KEEP_TOKEN_ADDRESS = "";
    let STATE_VIEW = "";

    if (networkName === "localhost" || networkName === "hardhat") {
        console.log("Detected Localhost. Reading addresses from addresses.ts...");

        // Robust path finding for addresses.ts
        const fs = require("fs");
        const path = require("path");
        const potentialPaths = [
            "C:\\Users\\epj33\\Desktop\\InnKeeper\\apps\\web\\lib\\contracts\\addresses.ts",
            path.join(process.cwd(), "..", "apps", "web", "lib", "contracts", "addresses.ts"),
            path.join(process.cwd(), "..", "..", "apps", "web", "lib", "contracts", "addresses.ts"),
            path.join(__dirname, "..", "..", "apps", "web", "lib", "contracts", "addresses.ts")
        ];

        let addressesPath = "";
        for (const p of potentialPaths) {
            if (fs.existsSync(p)) {
                addressesPath = p;
                break;
            }
        }

        if (addressesPath) {
            const addressesContent = fs.readFileSync(addressesPath, "utf-8");
            // Robust regex to find LOCALHOST_ADDRESSES
            const localhostMatch = addressesContent.match(/LOCALHOST_ADDRESSES[\s\S]*?THE_CELLAR:\s*['"](0x[a-fA-F0-9]{40})['"]/);
            const pmMatch = addressesContent.match(/LOCALHOST_ADDRESSES[\s\S]*?POOL_MANAGER:\s*['"](0x[a-fA-F0-9]{40})['"]/);
            const keepMatch = addressesContent.match(/LOCALHOST_ADDRESSES[\s\S]*?KEEP_TOKEN:\s*['"](0x[a-fA-F0-9]{40})['"]/);

            if (localhostMatch && localhostMatch[1]) CELLAR_HOOK_PROXY = localhostMatch[1];
            if (pmMatch && pmMatch[1]) POOL_MANAGER = pmMatch[1];
            if (keepMatch && keepMatch[1]) KEEP_TOKEN_ADDRESS = keepMatch[1];
        } else {
            console.error("❌ addresses.ts not found. Cannot run on localhost without it.");
            process.exit(1);
        }
    } else {
        // Mainnet / Testnet defaults
        CELLAR_HOOK_PROXY = process.env.CELLAR_HOOK_PROXY || MAINNET_CELLAR_HOOK_PROXY;
        POOL_MANAGER = process.env.POOL_MANAGER || MAINNET_POOL_MANAGER;
        KEEP_TOKEN_ADDRESS = process.env.KEEP_TOKEN || MAINNET_KEEP_TOKEN;
        STATE_VIEW = STATE_VIEW_ADDRESS;
    }

    if (!CELLAR_HOOK_PROXY || !POOL_MANAGER || !KEEP_TOKEN_ADDRESS) {
        console.error("❌ Missing contract addresses.");
        console.log("CellarHook:", CELLAR_HOOK_PROXY);
        console.log("PoolManager:", POOL_MANAGER);
        console.log("KeepToken:", KEEP_TOKEN_ADDRESS);
        process.exit(1);
    }

    console.log("DEBUG: POOL_MANAGER Address:", POOL_MANAGER);

    // Get contract instances

    const CellarHook = await ethers.getContractFactory("CellarHook");
    const cellarHook = CellarHook.attach(CELLAR_HOOK_PROXY);

    // Use IPoolManager artifact which should have the view functions defined in the interface
    const poolManager = await ethers.getContractAt("IPoolManager", POOL_MANAGER);
    const keepToken = await ethers.getContractAt("IERC20", KEEP_TOKEN_ADDRESS);

    // Get MON and KEEP Currency from contract
    const MON = await cellarHook.MON();
    const KEEP = await cellarHook.KEEP();
    const MON_ADDRESS = ethers.getAddress(ethers.hexlify(MON));
    const KEEP_ADDRESS = ethers.getAddress(ethers.hexlify(KEEP));

    console.log("\n--- Token Addresses ---");
    console.log("MON:", MON_ADDRESS === ethers.ZeroAddress ? "Native (ETH)" : MON_ADDRESS);
    console.log("KEEP:", KEEP_ADDRESS);

    // Sort currencies for PoolKey (currency0 < currency1)
    const currency0 = MON_ADDRESS < KEEP_ADDRESS ? MON : KEEP;
    const currency1 = MON_ADDRESS < KEEP_ADDRESS ? KEEP : MON;
    const isMONCurrency0 = MON_ADDRESS < KEEP_ADDRESS;

    // Define pools to check
    const poolsToCheck = [
        { name: "Default Pool (Broken)", fee: 10000, tickSpacing: 200 },
        { name: "New Pool (Fixed)", fee: 3000, tickSpacing: 60 }
    ];

    for (const poolConfig of poolsToCheck) {
        console.log(`\n\n=============================================`);
        console.log(`=== CHECKING: ${poolConfig.name} ===`);
        console.log(`=============================================`);

        // Construct PoolKey
        const poolKey = {
            currency0: currency0,
            currency1: currency1,
            fee: poolConfig.fee,
            tickSpacing: poolConfig.tickSpacing,
            hooks: CELLAR_HOOK_PROXY,
        };

        console.log("\n--- Pool Key ---");
        const currency0Addr = ethers.getAddress(ethers.hexlify(currency0));
        const currency1Addr = ethers.getAddress(ethers.hexlify(currency1));
        console.log("Currency0:", currency0Addr === ethers.ZeroAddress ? "Native" : currency0Addr);
        console.log("Currency1:", currency1Addr);
        console.log(`Fee: ${poolConfig.fee}`);
        console.log(`Tick Spacing: ${poolConfig.tickSpacing}`);
        console.log("Hooks:", CELLAR_HOOK_PROXY);

        // Compute poolId (keccak256 of encoded PoolKey)
        const poolId = ethers.keccak256(
            ethers.AbiCoder.defaultAbiCoder().encode(
                ["address", "address", "uint24", "int24", "address"],
                [currency0Addr, currency1Addr, poolConfig.fee, poolConfig.tickSpacing, CELLAR_HOOK_PROXY]
            )
        );

        // Get pool state
        console.log("\n--- Pool State ---");
        try {
            let sqrtPriceX96 = 0n;
            let tick = 0;
            let liquidity = 0n;

            // Try to use getSlot0 if available (e.g. via StateView or if artifact has it)
            // If not, fall back to extsload which is definitely exposed on PoolManager
            try {
                if (STATE_VIEW && networkName !== "localhost" && networkName !== "hardhat") {
                    const STATE_VIEW_ABI = [
                        {
                            name: 'getSlot0',
                            type: 'function',
                            stateMutability: 'view',
                            inputs: [{ name: 'poolId', type: 'bytes32' }],
                            outputs: [
                                { name: 'sqrtPriceX96', type: 'uint160' },
                                { name: 'tick', type: 'int24' },
                                { name: 'protocolFee', type: 'uint24' },
                                { name: 'lpFee', type: 'uint24' }
                            ]
                        },
                        {
                            name: 'getLiquidity',
                            type: 'function',
                            stateMutability: 'view',
                            inputs: [{ name: 'poolId', type: 'bytes32' }],
                            outputs: [{ name: 'liquidity', type: 'uint128' }]
                        }
                    ];
                    const stateView = new ethers.Contract(STATE_VIEW, STATE_VIEW_ABI, deployer);
                    const slot0Result = await stateView.getSlot0(poolId);
                    sqrtPriceX96 = slot0Result[0] || slot0Result.sqrtPriceX96;
                    tick = Number(slot0Result[1] || slot0Result.tick);

                    const liquidityResult = await stateView.getLiquidity(poolId);
                    liquidity = liquidityResult[0] || liquidityResult;
                } else {
                    // Try direct call first
                    try {
                        const slot0Result = await poolManager.getSlot0(poolId);
                        sqrtPriceX96 = slot0Result[0] || slot0Result.sqrtPriceX96;
                        tick = Number(slot0Result[1] || slot0Result.tick);
                        liquidity = await poolManager.getLiquidity(poolId);
                    } catch (e: any) {
                        // Fallback to extsload
                        // _pools mapping is at slot 0 (usually) in PoolManager
                        // mapping(PoolId => Pool.State) internal _pools;
                        // Pool.State struct starts with Slot0 (packed)
                        // Slot0: uint160 sqrtPriceX96, int24 tick, uint24 protocolFee, uint24 lpFee
                        // All fit in one 256-bit slot.
                        // Storage slot = keccak256(poolId . 0)

                        // Note: In some V4 versions, _pools might be at a different slot.
                        // But usually it's the first state variable.
                        const POOLS_SLOT = 0;
                        const slot0StorageSlot = ethers.keccak256(
                            ethers.AbiCoder.defaultAbiCoder().encode(["bytes32", "uint256"], [poolId, POOLS_SLOT])
                        );

                        // Use explicit signature for overloaded function
                        const value = await poolManager["extsload(bytes32)"](slot0StorageSlot);

                        // Decode packed Slot0
                        // Layout (from LSB): sqrtPriceX96 (160), tick (24), protocolFee (24), lpFee (24)
                        const valueBigInt = BigInt(value);
                        sqrtPriceX96 = valueBigInt & ((1n << 160n) - 1n);
                        const tickBits = (valueBigInt >> 160n) & ((1n << 24n) - 1n);
                        // Handle signed int24 for tick
                        tick = Number(tickBits);
                        if (tickBits & (1n << 23n)) { // if sign bit is set
                            tick = Number(tickBits) - (1 << 24);
                        }

                        // Liquidity is in the next slot?
                        // Pool.State: Slot0 slot0; uint256 feeGrowthGlobal0X128; uint256 feeGrowthGlobal1X128; uint128 liquidity;
                        // So liquidity is at slot + 3
                        // slot0 (0), feeGrowth0 (1), feeGrowth1 (2), liquidity (3)
                        const liquidityStorageSlot = BigInt(slot0StorageSlot) + 3n;
                        const liquidityValue = await poolManager["extsload(bytes32)"](ethers.toBeHex(liquidityStorageSlot, 32));
                        liquidity = BigInt(liquidityValue) & ((1n << 128n) - 1n); // uint128

                        console.log("⚠️  Used extsload fallback to read state");
                    }
                }
            } catch (e) {
                throw e;
            }

            if (sqrtPriceX96 === 0n) {
                console.log("❌ Pool NOT initialized (price=0)");
            } else {
                console.log("✅ Pool exists and is initialized!");
                console.log("sqrtPriceX96:", sqrtPriceX96.toString());
                console.log("Tick:", tick.toString());

                // Calculate price from sqrtPriceX96
                // Price = (sqrtPriceX96 / 2^96)^2
                const Q96 = 2n ** 96n;
                const sqrtPrice = Number(sqrtPriceX96) / Number(Q96);
                const price = sqrtPrice * sqrtPrice;

                if (isMONCurrency0) {
                    // MON is currency0, KEEP is currency1
                    // Price = amount1 / amount0 = KEEP / MON
                    console.log("\n--- Price ---");
                    console.log(`Price: ${price.toFixed(6)} KEEP per MON`);
                    console.log(`(1 MON = ${price.toFixed(6)} KEEP)`);
                } else {
                    // KEEP is currency0, MON is currency1
                    // Price = amount1 / amount0 = MON / KEEP
                    const inversePrice = 1 / price;
                    console.log("\n--- Price ---");
                    console.log(`Price: ${inversePrice.toFixed(6)} MON per KEEP`);
                    console.log(`(1 KEEP = ${inversePrice.toFixed(6)} MON)`);
                    console.log(`(1 MON = ${price.toFixed(6)} KEEP)`);
                }
            }

            console.log("\n--- Pool Liquidity ---");
            console.log("Liquidity:", liquidity.toString());

        } catch (error: any) {
            console.log("❌ Error reading pool state:", error.message);
            console.log("   Pool may not be initialized yet");
        }
    }

    // Check actual balances in PoolManager
    console.log("\n\n=============================================");
    console.log("=== GLOBAL BALANCES ===");
    console.log("=============================================");
    console.log("\n--- PoolManager Balances ---");
    let pmMonBalance: bigint;
    if (MON_ADDRESS === ethers.ZeroAddress) {
        pmMonBalance = await ethers.provider.getBalance(POOL_MANAGER);
    } else {
        const monToken = await ethers.getContractAt("IERC20", MON_ADDRESS);
        pmMonBalance = await monToken.balanceOf(POOL_MANAGER);
    }
    const pmKeepBalance = await keepToken.balanceOf(POOL_MANAGER);

    console.log("MON Balance:", ethers.formatEther(pmMonBalance), "MON");
    console.log("KEEP Balance:", ethers.formatEther(pmKeepBalance), "KEEP");

    // Check Hook balances (should be minimal if settled correctly)
    console.log("\n--- CellarHook Balances ---");
    let hookMonBalance: bigint;
    if (MON_ADDRESS === ethers.ZeroAddress) {
        hookMonBalance = await ethers.provider.getBalance(CELLAR_HOOK_PROXY);
    } else {
        const monToken = await ethers.getContractAt("IERC20", MON_ADDRESS);
        hookMonBalance = await monToken.balanceOf(CELLAR_HOOK_PROXY);
    }
    const hookKeepBalance = await keepToken.balanceOf(CELLAR_HOOK_PROXY);

    console.log("MON Balance:", ethers.formatEther(hookMonBalance), "MON");
    console.log("KEEP Balance:", ethers.formatEther(hookKeepBalance), "KEEP");

    if (hookMonBalance > 0n || hookKeepBalance > 0n) {
        console.log("\n⚠️  Warning: Some tokens still in CellarHook (should be minimal if settled correctly)");
    }
}


main().catch((error) => {
    console.error("❌ Script failed:", error);
    process.exitCode = 1;
});
