import { ethers, network } from "hardhat";
import fs from "fs";
import path from "path";

/**
 * SIMULATION SCRIPT FOR MONAD MAINNET DEPLOYMENT & UPGRADE
 *
 * This script:
 * 1. Impersonates the deployer
 * 2. Deploys a new CellarHook implementation
 * 3. Creates a new ERC1967Proxy with different hook address (mined salt)
 * 4. Initializes it with NEW pool parameters
 * 5. Upgrades TownPosseManager and TavernRegularsManager
 * 6. Updates TavernKeeper treasury
 */

const MAINNET_POOL_MANAGER = "0x27e98f6A0D3315F9f3ECDaFE0187a7637F41c7c2";
const MAINNET_KEEP_TOKEN = "0x2D1094F5CED6ba279962f9676d32BE092AFbf82E";
const DEPLOYER_ADDRESS = "0xD515674a7fE63dFDfd43Fb5647E8B04eEfCEdCAa";

// NEW pool parameters
const NEW_POOL_FEE = 10000; // 1.0% fee
const NEW_POOL_TICK_SPACING = 200;

async function main() {
    console.log("=== SIMULATING FULL DEPLOYMENT & UPGRADE (IMPERSONATION) ===\n");

    // Impersonate Deployer
    await network.provider.request({
        method: "hardhat_impersonateAccount",
        params: [DEPLOYER_ADDRESS],
    });
    const deployer = await ethers.getSigner(DEPLOYER_ADDRESS);
    console.log("Impersonated Deployer:", deployer.address);

    console.log("\n--- New Pool Parameters ---");
    console.log("Fee:", NEW_POOL_FEE, "(1.0%)");
    console.log("Tick Spacing:", NEW_POOL_TICK_SPACING);

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

    // Target Flags: 0x2DC0
    const targetFlags = 0x2DC0;
    console.log("\n--- Mining Salt for New Hook Address (ERC1967Proxy) ---");
    console.log("Target flags: 0x2DC0");

    let salt = 2000000n; // Start higher
    let hookAddress = "";

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
    }

    // Deploy ERC1967Proxy
    console.log("\n--- Deploying ERC1967Proxy ---");
    const deployTx = await factory.deploy(salt, proxyInitCode, { gasLimit: 10000000 });
    await deployTx.wait();
    console.log("ERC1967Proxy deployed to:", hookAddress);

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

    try {
        console.log("Calling cellarHook.initializePool...");
        const tx = await cellarHook.connect(deployer).initializePool(poolKey);
        await tx.wait();
        console.log("✅ Pool Initialized successfully");
    } catch (error: any) {
        console.error("❌ Pool Initialization Failed:", error.message);
    }

    // ---------------------------------------------------------
    // 4. Add Liquidity (via CellarHook)
    // ---------------------------------------------------------
    console.log("\n--- Adding Liquidity ---");

    const amountMON = ethers.parseEther("0.1");
    const amountKEEP = ethers.parseEther("0.3"); // 1:3 ratio

    console.log("Approving KEEP...");
    const keepToken = await ethers.getContractAt("IERC20", MAINNET_KEEP_TOKEN);
    await keepToken.connect(deployer).approve(hookAddress, amountKEEP);
    console.log("KEEP approved");

    try {
        console.log("Calling cellarHook.addLiquidity...");
        // Pass 0, 0 for ticks to let CellarHook calculate range around current price
        const tx = await cellarHook.connect(deployer).addLiquidity(
            poolKey,
            amountMON,
            amountKEEP,
            0, // tickLower (auto)
            0, // tickUpper (auto)
            { value: amountMON }
        );
        await tx.wait();
        console.log("✅ Liquidity Added successfully");
    } catch (error: any) {
        console.error("❌ Add Liquidity Failed:", error.message);
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
        const TownPosseManager = await ethers.getContractFactory("TownPosseManager", deployer);
        const { upgrades } = require("hardhat");

        // Pass factory directly (not connected) - upgrades plugin will use the signer from factory
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
        const TavernRegularsManager = await ethers.getContractFactory("TavernRegularsManager", deployer);
        const { upgrades } = require("hardhat");

        // Pass factory directly (not connected) - upgrades plugin will use the signer from factory
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
        const tx = await tavernKeeper.connect(deployer).setTreasury(hookAddress);
        await tx.wait();
        console.log("✅ TavernKeeper treasury updated to new CellarHook");
    } catch (error: any) {
        console.error("❌ Failed to update TavernKeeper:", error.message);
    }

    console.log("\n============================================");
    console.log("SIMULATION COMPLETE");
    console.log("============================================");
}

main().catch((error) => {
    console.error("❌ Simulation failed:", error);
    process.exitCode = 1;
});
