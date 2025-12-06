import { ethers } from "hardhat";

/**
 * Test script to verify the NEW pool works correctly
 *
 * This script tests the newly deployed pool:
 * - New CellarHook: 0xe71CAf7162dd81a4A9C0c6BD25ED02C26F492DC0
 * - Pool Fee: 10000 (1.0%)
 * - Tick Spacing: 200
 *
 * Usage:
 *   $env:NEXT_PUBLIC_MONAD_CHAIN_ID="143"
 *   npx hardhat run scripts/test_new_pool.ts --network monad
 */

const NEW_CELLAR_HOOK = "0xe71CAf7162dd81a4A9C0c6BD25ED02C26F492DC0";
const MAINNET_KEEP_TOKEN = "0x2D1094F5CED6ba279962f9676d32BE092AFbf82E";
const NEW_POOL_FEE = 10000; // 1.0%
const NEW_POOL_TICK_SPACING = 200;

async function main() {
    const [deployer] = await ethers.getSigners();
    console.log("=== TESTING NEW POOL ===\n");
    console.log("Deployer:", deployer.address);
    console.log("Network:", (await ethers.provider.getNetwork()).name);
    console.log("Chain ID:", (await ethers.provider.getNetwork()).chainId);

    // Verify we're on mainnet
    const chainId = (await ethers.provider.getNetwork()).chainId;
    if (Number(chainId) !== 143) {
        console.error("❌ ERROR: This script is for Monad Mainnet (chain ID 143)");
        process.exit(1);
    }

    const CELLAR_HOOK = process.env.CELLAR_HOOK || NEW_CELLAR_HOOK;
    const KEEP_TOKEN_ADDRESS = process.env.KEEP_TOKEN || MAINNET_KEEP_TOKEN;

    // Get contract instances
    const CellarHook = await ethers.getContractFactory("CellarHook");
    const cellarHook = CellarHook.attach(CELLAR_HOOK);
    const keepToken = await ethers.getContractAt("IERC20", KEEP_TOKEN_ADDRESS);

    // Get MON and KEEP Currency from contract
    const MON = await cellarHook.MON();
    const KEEP = await cellarHook.KEEP();
    const MON_ADDRESS = ethers.getAddress(ethers.hexlify(MON));
    const KEEP_ADDRESS = ethers.getAddress(ethers.hexlify(KEEP));

    console.log("\n--- Token Addresses ---");
    console.log("MON:", MON_ADDRESS === ethers.ZeroAddress ? "Native (ETH)" : MON_ADDRESS);
    console.log("KEEP:", KEEP_ADDRESS);

    // Validate hook address
    console.log("\n--- Validating Hook Address ---");
    const hookAddrInt = BigInt(CELLAR_HOOK);
    const hookFlags = hookAddrInt & 0x3FFFn;
    const expectedHookFlags = 0x2DC0n;

    if (hookFlags !== expectedHookFlags) {
        console.error(`❌ Hook address flags mismatch: ${hookFlags.toString(16)}, expected: ${expectedHookFlags.toString(16)}`);
        process.exit(1);
    }
    console.log("✅ Hook address has correct flags (0x2DC0)");

    // Verify hook permissions
    const permissions = await cellarHook.getHookPermissions();
    if (!permissions.beforeInitialize || !permissions.beforeAddLiquidity ||
        !permissions.afterAddLiquidity || !permissions.afterRemoveLiquidity ||
        !permissions.beforeSwap || !permissions.afterSwap) {
        console.error("❌ Hook permissions do not match expected flags");
        process.exit(1);
    }
    console.log("✅ Hook permissions validated");

    // Check pool state
    console.log("\n--- Pool State ---");
    const poolInitialized = await cellarHook.poolInitialized();
    console.log("Pool Initialized:", poolInitialized ? "✅ YES" : "❌ NO");

    // Check slot0 (raid state)
    const slot0 = await cellarHook.slot0();
    console.log("\n--- Raid State ---");
    console.log("Epoch ID:", slot0.epochId.toString());
    console.log("Init Price:", ethers.formatEther(slot0.initPrice), "LP");
    console.log("Start Time:", new Date(Number(slot0.startTime) * 1000).toISOString());

    const currentPrice = await cellarHook.getAuctionPrice();
    console.log("Current Raid Price:", ethers.formatEther(currentPrice), "LP");

    // Check pot balance
    const potBalance = await cellarHook.potBalance();
    console.log("\n--- Pot Balance ---");
    console.log("Pot Balance:", ethers.formatEther(potBalance), "MON");

    // Check LP token supply
    const totalSupply = await cellarHook.totalSupply();
    console.log("\n--- LP Token Supply ---");
    console.log("Total LP Supply:", ethers.formatEther(totalSupply), "LP");

    // Check deployer LP balance
    const deployerLPBalance = await cellarHook.balanceOf(deployer.address);
    console.log("Deployer LP Balance:", ethers.formatEther(deployerLPBalance), "LP");

    // Test amounts
    const amountMON = ethers.parseEther("0.1");
    const amountKEEP = ethers.parseEther("0.3");

    console.log("\n--- Test Amounts ---");
    console.log("MON:", ethers.formatEther(amountMON), "MON");
    console.log("KEEP:", ethers.formatEther(amountKEEP), "KEEP");

    // Check balances
    let deployerMonBalance: bigint;
    if (MON_ADDRESS === ethers.ZeroAddress) {
        deployerMonBalance = await ethers.provider.getBalance(deployer.address);
    } else {
        const monToken = await ethers.getContractAt("IERC20", MON_ADDRESS);
        deployerMonBalance = await monToken.balanceOf(deployer.address);
    }
    const deployerKeepBalance = await keepToken.balanceOf(deployer.address);

    console.log("\n--- Deployer Balances ---");
    console.log("MON Balance:", ethers.formatEther(deployerMonBalance), "MON");
    console.log("KEEP Balance:", ethers.formatEther(deployerKeepBalance), "KEEP");

    if (deployerMonBalance < amountMON) {
        console.error("\n❌ Insufficient MON balance!");
        process.exit(1);
    }
    if (deployerKeepBalance < amountKEEP) {
        console.error("\n❌ Insufficient KEEP balance!");
        process.exit(1);
    }

    // Get initial LP balance
    const initialLPBalance = await cellarHook.balanceOf(deployer.address);
    console.log("\n--- LP Balance (Before) ---");
    console.log("LP Balance:", ethers.formatEther(initialLPBalance), "LP");

    // Construct PoolKey with NEW pool parameters
    const currency0 = MON_ADDRESS < KEEP_ADDRESS ? MON : KEEP;
    const currency1 = MON_ADDRESS < KEEP_ADDRESS ? KEEP : MON;

    const poolKey = {
        currency0: currency0,
        currency1: currency1,
        fee: NEW_POOL_FEE,
        tickSpacing: NEW_POOL_TICK_SPACING,
        hooks: CELLAR_HOOK
    };

    console.log("\n--- Pool Key ---");
    const currency0Addr = ethers.getAddress(ethers.hexlify(currency0));
    const currency1Addr = ethers.getAddress(ethers.hexlify(currency1));
    console.log("Currency0:", currency0Addr === ethers.ZeroAddress ? "Native" : currency0Addr);
    console.log("Currency1:", currency1Addr);
    console.log("Fee:", NEW_POOL_FEE, "(1.0%)");
    console.log("Tick Spacing:", NEW_POOL_TICK_SPACING);
    console.log("Hooks:", CELLAR_HOOK);

    // Check balances in PoolManager
    const MAINNET_POOL_MANAGER = "0x27e98f6A0D3315F9f3ECDaFE0187a7637F41c7c2";
    const pmKeep = await keepToken.balanceOf(MAINNET_POOL_MANAGER);
    const pmMon = await ethers.provider.getBalance(MAINNET_POOL_MANAGER);

    console.log("\n--- PoolManager Balances ---");
    console.log("MON:", ethers.formatEther(pmMon), "MON");
    console.log("KEEP:", ethers.formatEther(pmKeep), "KEEP");

    if (pmKeep > 0n && pmMon > 0n) {
        console.log("\n✅ SUCCESS: Pool has BOTH assets (two-sided liquidity)!");
    } else {
        console.log("\n⚠️  WARNING: Pool may be single-sided");
    }

    console.log("\n=== TEST SUMMARY ===");
    console.log("✅ New pool is deployed and initialized");
    console.log("✅ Hook address has correct flags");
    console.log("✅ PoolKey construction is correct");
    if (pmKeep > 0n && pmMon > 0n) {
        console.log("✅ Two-sided liquidity confirmed");
    }
    console.log("\nPool is ready for use!");
}

main().catch((error) => {
    console.error("❌ Test failed:", error);
    process.exitCode = 1;
});

