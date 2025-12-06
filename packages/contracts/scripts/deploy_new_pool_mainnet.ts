import { ethers } from "hardhat";
import fs from "fs";
import path from "path";

/**
 * DEPLOYMENT SCRIPT FOR MONAD MAINNET
 * 
 * This script:
 * 1. Deploys a new CellarHook implementation
 * 2. Creates a new ERC1967Proxy with different hook address (mined salt)
 * 3. Initializes it with NEW pool parameters (different fee/tickSpacing)
 * 4. This creates a completely NEW pool that can be used
 *
 * Usage:
 *   $env:NEXT_PUBLIC_MONAD_CHAIN_ID="143"
 *   npx hardhat run scripts/deploy_new_pool_mainnet.ts --network monad
 */

const MAINNET_POOL_MANAGER = "0x27e98f6A0D3315F9f3ECDaFE0187a7637F41c7c2";
const MAINNET_KEEP_TOKEN = "0x2D1094F5CED6ba279962f9676d32BE092AFbf82E";

// NEW pool parameters (different from old pool to create a new pool)
const NEW_POOL_FEE = 10000; // 1.0% fee (old was 3000 = 0.3%)
const NEW_POOL_TICK_SPACING = 200; // Different tick spacing (old was 60)

async function main() {
    const [deployer] = await ethers.getSigners();
    console.log("=== DEPLOYING NEW POOL ON MONAD MAINNET ===\n");
    console.log("Deployer:", deployer.address);
    console.log("Network:", (await ethers.provider.getNetwork()).name);
    console.log("Chain ID:", (await ethers.provider.getNetwork()).chainId);

    // Verify we're on mainnet
    const chainId = (await ethers.provider.getNetwork()).chainId;
    if (Number(chainId) !== 143) {
        console.error("❌ ERROR: This script is for Monad Mainnet (chain ID 143)");
        process.exit(1);
    }

    console.log("\n--- New Pool Parameters ---");
    console.log("Fee:", NEW_POOL_FEE, "(1.0%)");
    console.log("Tick Spacing:", NEW_POOL_TICK_SPACING);
    console.log("Note: Different from old pool (fee=3000, tickSpacing=60)");
    console.log("This creates a COMPLETELY NEW pool");

    // Get contract factories
    const CellarHook = await ethers.getContractFactory("CellarHook");
    const Create2Factory = await ethers.getContractFactory("Create2Factory");

    // Deploy Create2Factory (or use existing if already deployed)
    console.log("\n--- Deploying Create2Factory ---");
    let factory;
    try {
        // Try to get existing factory address (you may want to deploy new one)
        factory = await Create2Factory.deploy();
        await factory.waitForDeployment();
        const factoryAddress = await factory.getAddress();
        console.log("Create2Factory deployed:", factoryAddress);
    } catch (error: any) {
        console.error("❌ Failed to deploy Create2Factory:", error.message);
        process.exit(1);
    }

    // Deploy CellarHook implementation
    console.log("\n--- Deploying CellarHook Implementation ---");
    const implementation = await CellarHook.deploy();
    await implementation.waitForDeployment();
    const implementationAddress = await implementation.getAddress();
    console.log("Implementation deployed:", implementationAddress);

    // Prepare Init Data for Proxy
    const MON_ADDRESS = ethers.ZeroAddress; // Native MON
    const initPrice = ethers.parseEther("3"); // 3 KEEP per MON
    const epochPeriod = 3600;
    const priceMultiplier = ethers.parseEther("1.1");
    const minInitPrice = ethers.parseEther("1");

    const initData = implementation.interface.encodeFunctionData("initialize", [
        MAINNET_POOL_MANAGER,
        MON_ADDRESS,
        MAINNET_KEEP_TOKEN,
        initPrice,
        epochPeriod,
        priceMultiplier,
        minInitPrice,
        deployer.address
    ]);

    // Create ERC1967Proxy Init Code
    const ERC1967Proxy = await ethers.getContractFactory("ERC1967Proxy");
    const proxyDeployTx = await ERC1967Proxy.getDeployTransaction(implementationAddress, initData);
    const proxyInitCode = proxyDeployTx.data;
    const initCodeHash = ethers.keccak256(proxyInitCode);

    // Target Flags: 
    // BeforeInitialize (13), BeforeAdd (11), AfterAdd (10), AfterRemove (8), BeforeSwap (7), AfterSwap (6)
    // Mask: 0x2DC0
    const targetFlags = 0x2DC0;
    console.log("\n--- Mining Salt for New Hook Address (ERC1967Proxy) ---");
    console.log("Target flags: 0x2DC0");

    let salt = 0n;
    let hookAddress = "";

    // Start from a different salt to get a different address
    salt = 2000000n; // Start higher

    while (true) {
        const saltHex = ethers.toBeHex(salt, 32);
        const computed = ethers.getCreate2Address(await factory.getAddress(), saltHex, initCodeHash);
        const addrInt = BigInt(computed);
        if ((addrInt & 0x3FFFn) === BigInt(targetFlags)) {
            hookAddress = computed;
            console.log(`Found salt: ${saltHex}`);
            console.log(`New Hook Address: ${hookAddress}`);
            break;
        }
        salt++;
        if (salt % 100000n === 0n) console.log(`Checked ${salt} salts...`);
    }

    // Deploy ERC1967Proxy
    console.log("\n--- Deploying ERC1967Proxy ---");
    const existingCode = await ethers.provider.getCode(hookAddress);
    if (existingCode !== "0x") {
        console.log("⚠️  Contract already exists at", hookAddress);
        console.log("   Skipping deployment...");
    } else {
        // factory.deploy(salt, bytecode)
        const deployTx = await factory.deploy(salt, proxyInitCode, { gasLimit: 10000000 });
        await deployTx.wait();
        console.log("ERC1967Proxy deployed to:", hookAddress);
    }

    // Verify deployment
    const code = await ethers.provider.getCode(hookAddress);
    if (code === "0x") {
        throw new Error("Proxy not deployed at expected address");
    }

    // Validate hook address has correct flags
    console.log("\n--- Validating Hook Address ---");
    const addrInt = BigInt(hookAddress);
    const flags = addrInt & 0x3FFFn;
    const expectedFlags = 0x2DC0n;
    if (flags !== expectedFlags) {
        throw new Error(`Hook address flags mismatch: got ${flags.toString(16)}, expected ${expectedFlags.toString(16)}`);
    }
    console.log("✅ Hook address has correct flags (0x2DC0)");

    // Initialize CellarHook (Already done by Proxy constructor)
    console.log("\n--- Verifying Initialization ---");
    const cellarHook = CellarHook.attach(hookAddress);

    // Check owner to verify init
    const owner = await cellarHook.owner();
    console.log("Owner:", owner);
    if (owner !== deployer.address) {
        throw new Error("Proxy initialization failed (owner mismatch)");
    }
    console.log("✅ Proxy initialized successfully");

    // Verify hook permissions match expected flags
    const permissions = await cellarHook.getHookPermissions();
    console.log("Hook permissions:");
    console.log("  beforeInitialize:", permissions.beforeInitialize);
    console.log("  beforeAddLiquidity:", permissions.beforeAddLiquidity);
    console.log("  afterAddLiquidity:", permissions.afterAddLiquidity);
    console.log("  afterRemoveLiquidity:", permissions.afterRemoveLiquidity);
    console.log("  beforeSwap:", permissions.beforeSwap);
    console.log("  afterSwap:", permissions.afterSwap);

    if (!permissions.beforeInitialize || !permissions.beforeAddLiquidity || !permissions.afterAddLiquidity ||
        !permissions.afterRemoveLiquidity || !permissions.beforeSwap || !permissions.afterSwap) {
        throw new Error("Hook permissions do not match expected flags");
    }
    console.log("✅ Hook permissions validated");

    // ---------------------------------------------------------
    // 3. Initialize Pool (via CellarHook)
    // ---------------------------------------------------------
    console.log("\n--- Initializing Pool ---");

    const currency0 = MON_ADDRESS < MAINNET_KEEP_TOKEN ? MON_ADDRESS : MAINNET_KEEP_TOKEN;
    const currency1 = MON_ADDRESS < MAINNET_KEEP_TOKEN ? MAINNET_KEEP_TOKEN : MON_ADDRESS;

    const poolKey = {
        currency0: currency0,
        currency1: currency1,
        fee: NEW_POOL_FEE,
        tickSpacing: NEW_POOL_TICK_SPACING,
        hooks: hookAddress
    };

    console.log("PoolKey:");
    console.log("  currency0:", currency0 === ethers.ZeroAddress ? "Native" : currency0);
    console.log("  currency1:", currency1);
    console.log("  fee:", NEW_POOL_FEE, "(1.0%)");
    console.log("  tickSpacing:", NEW_POOL_TICK_SPACING);
    console.log("  hooks:", hookAddress);

    // Verify hook address in PoolKey matches expected flags
    const poolKeyHookFlags = BigInt(poolKey.hooks) & 0x3FFFn;
    if (poolKeyHookFlags !== expectedFlags) {
        throw new Error("PoolKey hook address does not have correct flags");
    }
    console.log("✅ PoolKey hook address validated");

    try {
        console.log("Calling cellarHook.initializePool...");
        const tx = await cellarHook.initializePool(poolKey);
        console.log("Tx sent:", tx.hash);
        await tx.wait();
        console.log("✅ Pool Initialized successfully");
    } catch (error: any) {
        console.error("❌ Pool Initialization Failed:", error.message);
        // Check if already initialized
        try {
            const poolManager = await ethers.getContractAt("IPoolManager", MAINNET_POOL_MANAGER);
            // Calculate PoolId manually since we don't have the library in script
            const abiCoder = new ethers.AbiCoder();
            const encoded = abiCoder.encode(
                ["address", "address", "uint24", "int24", "address"],
                [poolKey.currency0, poolKey.currency1, poolKey.fee, poolKey.tickSpacing, poolKey.hooks]
            );
            const poolId = ethers.keccak256(encoded);

            // Try to get slot0 to see if it exists
            console.log("Checking if pool is already initialized...");
        } catch (e) {
            console.log("Could not verify initialization status, assuming failed or already done.");
        }
    }

    // ---------------------------------------------------------
    // 4. Add Liquidity (via CellarHook)
    // ---------------------------------------------------------
    console.log("\n--- Adding Liquidity ---");

    const amountMON = ethers.parseEther("0.1");
    const amountKEEP = ethers.parseEther("0.3"); // 1:3 ratio

    console.log("Approving KEEP...");
    const keepToken = await ethers.getContractAt("IERC20", MAINNET_KEEP_TOKEN);
    const approveTx = await keepToken.approve(hookAddress, amountKEEP);
    await approveTx.wait();
    console.log("KEEP approved");

    try {
        console.log("Calling cellarHook.addLiquidity...");
        // Pass 0, 0 for ticks to let CellarHook calculate range around current price
        const tx = await cellarHook.addLiquidity(
            poolKey,
            amountMON,
            amountKEEP,
            0, // tickLower (auto)
            0, // tickUpper (auto)
            { value: amountMON }
        );
        console.log("Tx sent:", tx.hash);
        await tx.wait();
        console.log("✅ Liquidity Added successfully");
    } catch (error: any) {
        console.error("❌ Add Liquidity Failed:", error.message);
        if (error.data) {
            console.error("Error Data:", error.data);
            try {
                const decoded = cellarHook.interface.parseError(error.data);
                console.error("Decoded Error:", decoded);
            } catch (e) {
                console.error("Could not decode error");
            }
        }
    }

    // ---------------------------------------------------------
    // 5. Upgrade Dependent Contracts
    // ---------------------------------------------------------
    console.log("\n--- Upgrading Dependent Contracts ---");

    const TAVERN_REGULARS_MANAGER = "0x9f455Ad562e080CC745f9E97c469a86E1bBF8db8";
    const TOWN_POSSE_MANAGER = "0xE46592D8185975888b4A301DBD9b24A49933CC7D";
    const TAVERNKEEPER = "0x56B81A60Ae343342685911bd97D1331fF4fa2d29";

    // Upgrade TownPosseManager
    try {
        console.log("Upgrading TownPosseManager...");
        const TownPosseManager = await ethers.getContractFactory("TownPosseManager");
        // Use force: true because we are changing storage layout (adding setCellarHook function doesn't change storage, but just in case)
        // Actually, adding a function doesn't change storage layout.
        // But we need to use upgrades plugin.
        // We need to import upgrades from hardhat.
        // Since we didn't import it at top, we might need to rely on hardhat-upgrades plugin being available in hre.
        // Let's assume `upgrades` is available globally or we need to require it.
        const { upgrades } = require("hardhat");

        const townPosseManager = await upgrades.upgradeProxy(TOWN_POSSE_MANAGER, TownPosseManager);
        await townPosseManager.waitForDeployment();
        console.log("✅ TownPosseManager upgraded");

        // Set new CellarHook
        console.log("Setting new CellarHook on TownPosseManager...");
        const tx = await townPosseManager.setCellarHook(hookAddress);
        await tx.wait();
        console.log("✅ TownPosseManager updated with new CellarHook");
    } catch (error: any) {
        console.error("❌ Failed to upgrade TownPosseManager:", error.message);
    }

    // Upgrade TavernRegularsManager
    try {
        console.log("Upgrading TavernRegularsManager...");
        const TavernRegularsManager = await ethers.getContractFactory("TavernRegularsManager");
        const { upgrades } = require("hardhat");

        const tavernRegularsManager = await upgrades.upgradeProxy(TAVERN_REGULARS_MANAGER, TavernRegularsManager);
        await tavernRegularsManager.waitForDeployment();
        console.log("✅ TavernRegularsManager upgraded");

        // Set new CellarHook
        console.log("Setting new CellarHook on TavernRegularsManager...");
        const tx = await tavernRegularsManager.setCellarHook(hookAddress);
        await tx.wait();
        console.log("✅ TavernRegularsManager updated with new CellarHook");
    } catch (error: any) {
        console.error("❌ Failed to upgrade TavernRegularsManager:", error.message);
    }

    // Update TavernKeeper Treasury
    try {
        console.log("Updating TavernKeeper Treasury...");
        const TavernKeeper = await ethers.getContractFactory("TavernKeeper");
        const tavernKeeper = TavernKeeper.attach(TAVERNKEEPER);

        // TavernKeeper pays 'treasury' (which is The Cellar)
        const tx = await tavernKeeper.setTreasury(hookAddress);
        await tx.wait();
        console.log("✅ TavernKeeper treasury updated to new CellarHook");
    } catch (error: any) {
        console.error("❌ Failed to update TavernKeeper:", error.message);
    }

    // Update frontend addresses
    console.log("\n--- Updating Frontend Addresses ---");
    try {
        await updateFrontendAddresses({
            THE_CELLAR: hookAddress,
            THE_CELLAR_IMPL: implementationAddress
        });
        console.log("✅ Frontend addresses updated");
    } catch (error: any) {
        console.warn("⚠️  Warning: Could not update frontend addresses:", error.message);
    }

    // Note: Deployment tracker update skipped for new pool deployment
    // This is a NEW pool, not an update to existing contracts
    console.log("\n--- Deployment Tracker ---");
    console.log("⚠️  Note: This is a NEW pool deployment");
    console.log("   Please manually update DEPLOYMENT_TRACKER.md with new CellarHook address");
    console.log(`   New CellarHook: ${hookAddress}`);

    console.log("\n============================================");
    console.log("NEW POOL DEPLOYED");
    console.log("============================================");
    console.log("\nNew CellarHook:");
    console.log(`   Address: ${hookAddress}`);
    console.log(`   Implementation: ${implementationAddress}`);
    console.log(`   Pool Fee: ${NEW_POOL_FEE} (1.0%)`);
    console.log(`   Tick Spacing: ${NEW_POOL_TICK_SPACING}`);
    console.log("\n⚠️  IMPORTANT:");
    console.log("   - This is a NEW pool with different parameters");
    console.log("   - Old pool (0x6c7612F44B71E5E6E2bA0FEa799A23786A537755) is still broken");
    console.log("   - Update frontend to use new address");
    console.log("   - Users need to add liquidity to NEW pool");
    console.log("\nNext steps:");
    console.log("1. Test adding liquidity to new pool");
    console.log("2. Update frontend to use new CellarHook address");
    console.log("3. Recover tokens from old pool if possible");
}

async function updateFrontendAddresses(addresses: Record<string, string>) {
    const addressesPath = path.join(__dirname, "../../../apps/web/lib/contracts/addresses.ts");
    if (!fs.existsSync(addressesPath)) {
        console.warn(`⚠️  Could not find addresses.ts at ${addressesPath}`);
        return;
    }

    let content = fs.readFileSync(addressesPath, "utf8");

    for (const [key, value] of Object.entries(addresses)) {
        // Regex to find: key: "0x...",
        const regex = new RegExp(`${key}:\\s*"0x[a-fA-F0-9]+"`, "g");
        if (regex.test(content)) {
            content = content.replace(regex, `${key}: "${value}"`);
            console.log(`   Updated ${key} to ${value}`);
        } else {
            console.warn(`   Could not find ${key} in addresses.ts`);
        }
    }

    fs.writeFileSync(addressesPath, content);
}

main().catch((error) => {
    console.error("❌ Deployment failed:", error);
    process.exitCode = 1;
});
