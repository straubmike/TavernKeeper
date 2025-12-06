import { ethers, upgrades } from "hardhat";
import { updateDeploymentTracker } from "./updateDeploymentTracker";
import { updateFrontendAddresses } from "./updateFrontend";

/**
 * Full Localhost Deployment Script
 *
 * Deploys all contracts to localhost (Hardhat node) for testing.
 * This is a complete deployment that matches production structure.
 *
 * Usage:
 *   1. Start Hardhat node: npx hardhat node
 *   2. Fund deployer: npx hardhat run scripts/fundDeployer.ts --network localhost
 *   3. Deploy contracts: npx hardhat run scripts/deploy_localhost.ts --network localhost
 */

async function main() {
    const [deployer] = await ethers.getSigners();
    console.log("=== DEPLOYING TO LOCALHOST ===");
    console.log("Deployer:", deployer.address);

    // Get addresses from environment variables
    // DEPLOYER_ADDRESS: Wallet that receives team/dev fees (5% from TavernKeeper, owner tax from groups)
    const deployerAddress = process.env.DEPLOYER_ADDRESS || deployer.address;

    // FEE_RECIPIENT_ADDRESS: Wallet that receives Inventory contract fees (loot claiming)
    const feeRecipientAddress = process.env.FEE_RECIPIENT_ADDRESS || deployerAddress;

    // TREASURY_ADDRESS: Wallet that receives 5% from group manager fees (TavernRegulars/TownPosse)
    // If not set, defaults to deployer address
    const treasuryAddress = process.env.TREASURY_ADDRESS || deployerAddress;

    console.log("\n--- Address Configuration ---");
    console.log("Deployer Wallet (team/dev fees):", deployerAddress);
    console.log("Fee Recipient (Inventory fees):", feeRecipientAddress);
    console.log("Treasury (group fees 5%):", treasuryAddress);

    const balance = await ethers.provider.getBalance(deployer.address);
    console.log("Deployer balance:", ethers.formatEther(balance), "ETH");

    if (balance < ethers.parseEther("1")) {
        console.warn("⚠️  Low balance! Run scripts/fundDeployer.ts first");
    }

    // 1. Deploy ERC-6551 Registry (if not already deployed)
    console.log("\n--- Deploying ERC-6551 Registry ---");
    const ERC6551Registry = await ethers.getContractFactory("ERC6551Registry");
    let registryAddress: string;

    // Check if registry already exists (you might want to reuse it)
    const existingRegistry = process.env.LOCALHOST_ERC6551_REGISTRY;
    if (existingRegistry && existingRegistry !== "0x0000000000000000000000000000000000000000") {
        console.log("Using existing registry:", existingRegistry);
        registryAddress = existingRegistry;
    } else {
        const registry = await ERC6551Registry.deploy();
        await registry.waitForDeployment();
        registryAddress = await registry.getAddress();
        console.log("ERC6551 Registry:", registryAddress);
    }

    // 2. Deploy ERC-6551 Account Implementation
    console.log("\n--- Deploying ERC-6551 Account Implementation ---");
    const ERC6551Account = await ethers.getContractFactory("ERC6551Account");
    const accountImpl = await ERC6551Account.deploy();
    await accountImpl.waitForDeployment();
    const accountImplAddress = await accountImpl.getAddress();
    console.log("ERC6551 Account Implementation:", accountImplAddress);

    // 3. Deploy PoolManager
    console.log("\n--- Deploying PoolManager ---");
    const PoolManagerArtifact = await ethers.getContractFactory("PoolManager");
    const poolManager = await PoolManagerArtifact.deploy(deployerAddress);
    await poolManager.waitForDeployment();
    const poolManagerAddress = await poolManager.getAddress();
    console.log("PoolManager:", poolManagerAddress);

    // 4. Deploy KeepToken (UUPS)
    console.log("\n--- Deploying KeepToken (UUPS) ---");
    const KeepToken = await ethers.getContractFactory("KeepToken");
    const keepTokenProxy = await upgrades.deployProxy(KeepToken, [deployerAddress, deployerAddress], { kind: 'uups' });
    await keepTokenProxy.waitForDeployment();
    const keepTokenAddress = await keepTokenProxy.getAddress();
    const keepTokenImplAddress = await upgrades.erc1967.getImplementationAddress(keepTokenAddress);
    console.log("KeepToken Proxy:", keepTokenAddress);
    console.log("KeepToken Implementation:", keepTokenImplAddress);

    // 5. Deploy CellarHook (UUPS)
    console.log("\n--- Deploying CellarHook (UUPS) ---");
    const CellarHook = await ethers.getContractFactory("CellarHook");

    const MON = "0x0000000000000000000000000000000000000000"; // Native ETH
    const KEEP = keepTokenAddress;
    const initPrice = ethers.parseEther("100");
    const epochPeriod = 3600; // 1 hour
    const priceMultiplier = ethers.parseEther("1.1"); // 110%
    const minInitPrice = ethers.parseEther("1"); // 1 ETH

    const cellarHookProxy = await upgrades.deployProxy(
        CellarHook,
        [
            poolManagerAddress,
            MON,
            KEEP,
            initPrice,
            epochPeriod,
            priceMultiplier,
            minInitPrice,
            deployerAddress // owner
        ],
        { kind: 'uups', initializer: 'initialize' }
    );
    await cellarHookProxy.waitForDeployment();
    const hookAddress = await cellarHookProxy.getAddress();
    const hookImplAddress = await upgrades.erc1967.getImplementationAddress(hookAddress);
    console.log("CellarHook Proxy:", hookAddress);
    console.log("CellarHook Implementation:", hookImplAddress);

    // 6. Deploy Inventory (UUPS)
    console.log("\n--- Deploying Inventory (UUPS) ---");
    const Inventory = await ethers.getContractFactory("Inventory");
    const inventoryProxy = await upgrades.deployProxy(Inventory, [feeRecipientAddress], { kind: 'uups' });
    await inventoryProxy.waitForDeployment();
    const inventoryAddress = await inventoryProxy.getAddress();
    const inventoryImplAddress = await upgrades.erc1967.getImplementationAddress(inventoryAddress);
    console.log("Inventory Proxy:", inventoryAddress);
    console.log("Inventory Implementation:", inventoryImplAddress);

    // 7. Deploy Adventurer (UUPS)
    console.log("\n--- Deploying Adventurer (UUPS) ---");
    const Adventurer = await ethers.getContractFactory("Adventurer");
    const adventurerProxy = await upgrades.deployProxy(
        Adventurer,
        [],
        { kind: 'uups', initializer: 'initialize' }
    );
    await adventurerProxy.waitForDeployment();
    const adventurerAddress = await adventurerProxy.getAddress();
    const adventurerImplAddress = await upgrades.erc1967.getImplementationAddress(adventurerAddress);
    console.log("Adventurer Proxy:", adventurerAddress);
    console.log("Adventurer Implementation:", adventurerImplAddress);

    // 8. Deploy TavernKeeper (UUPS)
    console.log("\n--- Deploying TavernKeeper (UUPS) ---");
    const TavernKeeper = await ethers.getContractFactory("TavernKeeper");
    const tavernKeeper = await upgrades.deployProxy(TavernKeeper, [], { kind: 'uups' });
    await tavernKeeper.waitForDeployment();
    const tavernKeeperAddress = await tavernKeeper.getAddress();
    const tavernKeeperImplAddress = await upgrades.erc1967.getImplementationAddress(tavernKeeperAddress);
    console.log("TavernKeeper Proxy:", tavernKeeperAddress);
    console.log("TavernKeeper Implementation:", tavernKeeperImplAddress);

    // 9. Deploy DungeonGatekeeper (UUPS)
    console.log("\n--- Deploying DungeonGatekeeper (UUPS) ---");
    const DungeonGatekeeper = await ethers.getContractFactory("DungeonGatekeeper");
    const gatekeeper = await upgrades.deployProxy(DungeonGatekeeper, [deployerAddress, deployerAddress], { kind: 'uups' });
    await gatekeeper.waitForDeployment();
    const gatekeeperAddress = await gatekeeper.getAddress();
    const gatekeeperImplAddress = await upgrades.erc1967.getImplementationAddress(gatekeeperAddress);
    console.log("DungeonGatekeeper Proxy:", gatekeeperAddress);
    console.log("DungeonGatekeeper Implementation:", gatekeeperImplAddress);

    // 10. Deploy CellarZapV4 (UUPS)
    console.log("\n--- Deploying CellarZapV4 (UUPS) ---");
    const CellarZapV4 = await ethers.getContractFactory("CellarZapV4");
    const zapProxy = await upgrades.deployProxy(
        CellarZapV4,
        [
            poolManagerAddress,
            hookAddress,
            MON,
            KEEP,
            deployerAddress
        ],
        { kind: 'uups', initializer: 'initialize' }
    );
    await zapProxy.waitForDeployment();
    const zapAddress = await zapProxy.getAddress();
    const zapImplAddress = await upgrades.erc1967.getImplementationAddress(zapAddress);
    console.log("CellarZapV4 Proxy:", zapAddress);
    console.log("CellarZapV4 Implementation:", zapImplAddress);

    // 11. Deploy Tavern Regulars Manager
    console.log("\n--- Deploying Tavern Regulars Manager ---");
    const TavernRegularsManager = await ethers.getContractFactory("TavernRegularsManager");
    const tavernRegularsImpl = await TavernRegularsManager.deploy();
    await tavernRegularsImpl.waitForDeployment();
    const tavernRegularsImplAddress = await tavernRegularsImpl.getAddress();

    const tavernRegularsProxy = await upgrades.deployProxy(
        TavernRegularsManager,
        [
            hookAddress,
            zapAddress,
            poolManagerAddress,
            MON,
            KEEP,
            treasuryAddress, // treasury (5% from group fees)
            deployerAddress // owner (team fees, owner tax)
        ],
        { kind: "uups", initializer: "initialize" }
    );
    await tavernRegularsProxy.waitForDeployment();
    const tavernRegularsAddress = await tavernRegularsProxy.getAddress();
    console.log("Tavern Regulars Manager Proxy:", tavernRegularsAddress);
    console.log("Tavern Regulars Manager Implementation:", tavernRegularsImplAddress);

    // 12. Deploy Town Posse Manager
    console.log("\n--- Deploying Town Posse Manager ---");
    const TownPosseManager = await ethers.getContractFactory("TownPosseManager");
    const townPosseImpl = await TownPosseManager.deploy();
    await townPosseImpl.waitForDeployment();
    const townPosseImplAddress = await townPosseImpl.getAddress();

    // Tier thresholds (configurable - adjust as needed)
    const BRONZE_THRESHOLD = ethers.parseEther("1000"); // 1000 MON
    const SILVER_THRESHOLD = ethers.parseEther("10000"); // 10000 MON
    const GOLD_THRESHOLD = ethers.parseEther("100000"); // 100000 MON

    const townPosseProxy = await upgrades.deployProxy(
        TownPosseManager,
        [
            hookAddress,
            zapAddress,
            poolManagerAddress,
            MON,
            KEEP,
            treasuryAddress, // treasury (5% from group fees)
            BRONZE_THRESHOLD,
            SILVER_THRESHOLD,
            GOLD_THRESHOLD,
            deployerAddress // owner (team fees, owner tax)
        ],
        { kind: "uups", initializer: "initialize" }
    );
    await townPosseProxy.waitForDeployment();
    const townPosseAddress = await townPosseProxy.getAddress();
    console.log("Town Posse Manager Proxy:", townPosseAddress);
    console.log("Town Posse Manager Implementation:", townPosseImplAddress);

    // 13. Configure Contracts
    console.log("\n--- Configuring Contracts ---");

    // Wire KeepToken <-> TavernKeeper
    console.log("Setting TavernKeeper on KeepToken...");
    await (await keepTokenProxy.setTavernKeeperContract(tavernKeeperAddress)).wait();

    console.log("Setting KeepToken on TavernKeeper...");
    await (await tavernKeeper.setKeepTokenContract(keepTokenAddress)).wait();

    // Initialize TavernKeeper V2 with CellarHook as treasury
    console.log("Initializing TavernKeeper V2 (Treasury = CellarHook)...");
    await (await tavernKeeper.initializeOfficeV2(hookAddress)).wait();

    // Set pricing signer (use deployer if not set)
    const envSigner = process.env.NEXT_PUBLIC_PRICING_SIGNER_ADDRESS;
    console.log("DEBUG: NEXT_PUBLIC_PRICING_SIGNER_ADDRESS from env:", envSigner);

    const pricingSigner = envSigner || deployer.address;
    console.log("DEBUG: Final pricingSigner to be set:", pricingSigner);

    console.log("Setting pricing signer on TavernKeeper...");
    await (await tavernKeeper.setSigner(pricingSigner)).wait();
    console.log("✓ Pricing signer set:", pricingSigner);

    console.log("Setting contracts on Adventurer...");
    await (await adventurerProxy.setContracts(tavernKeeperAddress, registryAddress, accountImplAddress)).wait();

    // 14. Initialize Pool with Initial Liquidity
    console.log("\n--- Initializing Pool with Initial Liquidity ---");
    try {
        // Mint KEEP tokens to deployer for initial liquidity
        console.log("Minting KEEP tokens for pool initialization...");
        const keepTokenContract = await ethers.getContractAt("KeepToken", keepTokenAddress);
        const currentTK = await keepTokenContract.tavernKeeperContract();
        const keepOwner = await keepTokenContract.owner();

        // Temporarily set deployer as TavernKeeper to mint
        if (keepOwner.toLowerCase() === deployerAddress.toLowerCase()) {
            await (await keepTokenContract.setTavernKeeperContract(deployerAddress)).wait();
            await (await keepTokenContract.mint(deployerAddress, ethers.parseEther("10000"))).wait();
            // Restore original TavernKeeper
            if (currentTK !== ethers.ZeroAddress) {
                await (await keepTokenContract.setTavernKeeperContract(currentTK)).wait();
            }
            console.log("✓ Minted KEEP tokens");
        } else {
            console.log("⚠️  Deployer is not KeepToken owner, skipping KEEP mint");
        }

        // Approve KEEP for CellarHook
        const keepToken = await ethers.getContractAt("IERC20", keepTokenAddress);
        const initialKEEP = ethers.parseEther("3");
        await (await keepToken.approve(hookAddress, initialKEEP)).wait();
        console.log("✓ Approved KEEP for CellarHook");

        // Construct PoolKey
        const poolKey = {
            currency0: MON,
            currency1: KEEP,
            fee: 10000,
            tickSpacing: 200,
            hooks: hookAddress
        };

        // First, initialize the pool
        console.log("Initializing pool...");
        const cellarHook = await ethers.getContractAt("CellarHook", hookAddress);
        try {
            const initPoolTx = await cellarHook.initializePool(poolKey);
            await initPoolTx.wait();
            console.log("✅ Pool initialized successfully!");
        } catch (error: any) {
            if (error.message.includes("already initialized")) {
                console.log("⚠️  Pool already initialized, continuing...");
            } else if (error.message.includes("broken")) {
                console.error("❌ Pool is broken and cannot be initialized");
                console.error("   You may need to use different pool parameters (fee/tickSpacing)");
                throw error;
            } else {
                throw error;
            }
        }

        // Then add initial liquidity: 1 MON, 3 KEEP
        const initialMON = ethers.parseEther("1");
        console.log("Adding initial liquidity: 1 MON, 3 KEEP...");
        const addLiquidityTx = await cellarHook.addLiquidity(
            poolKey,
            initialMON,
            initialKEEP,
            0,
            0,
            { value: initialMON }
        );
        await addLiquidityTx.wait();
        console.log("✅ Initial liquidity added!");
        console.log("   - 1 MON");
        console.log("   - 3 KEEP");
        console.log("   - Price: 3 KEEP per MON");
    } catch (error: any) {
        console.error("❌ ERROR initializing pool:", error.message);
        console.error("   Pool may need to be initialized manually");
        // Don't exit - continue with deployment
    }

    // 15. Update Frontend & Tracker
    console.log("\n--- Updating Frontend & Tracker ---");
    await updateFrontendAddresses({
        ERC6551_REGISTRY: registryAddress,
        ERC6551_IMPLEMENTATION: accountImplAddress,
        KEEP_TOKEN: keepTokenAddress,
        KEEP_TOKEN_IMPL: keepTokenImplAddress,
        INVENTORY: inventoryAddress,
        INVENTORY_IMPL: inventoryImplAddress,
        ADVENTURER: adventurerAddress,
        ADVENTURER_IMPL: adventurerImplAddress,
        TAVERNKEEPER: tavernKeeperAddress,
        TAVERNKEEPER_IMPL: tavernKeeperImplAddress,
        THE_CELLAR: hookAddress,
        THE_CELLAR_IMPL: hookImplAddress,
        DUNGEON_GATEKEEPER: gatekeeperAddress,
        DUNGEON_GATEKEEPER_IMPL: gatekeeperImplAddress,
        CELLAR_ZAP: zapAddress,
        CELLAR_ZAP_IMPL: zapImplAddress,
        POOL_MANAGER: poolManagerAddress,
        TAVERN_REGULARS_MANAGER: tavernRegularsAddress,
        TOWN_POSSE_MANAGER: townPosseAddress
    });

    await updateDeploymentTracker({
        ERC6551_REGISTRY: registryAddress,
        ERC6551_IMPLEMENTATION: accountImplAddress,
        KEEP_TOKEN: keepTokenAddress,
        CELLAR_HOOK: hookAddress,
        TAVERNKEEPER: tavernKeeperAddress,
        DUNGEON_GATEKEEPER: gatekeeperAddress,
        CELLAR_ZAP: zapAddress,
        POOL_MANAGER: poolManagerAddress,
        INVENTORY: inventoryAddress,
        ADVENTURER: adventurerAddress,
        TAVERN_REGULARS_MANAGER: tavernRegularsAddress,
        TOWN_POSSE_MANAGER: townPosseAddress
    });

    console.log("\n============================================");
    console.log("LOCALHOST DEPLOYMENT COMPLETE");
    console.log("============================================");
    console.log("\nContract Addresses (Proxies):");
    console.log("ERC6551 Registry:", registryAddress);
    console.log("ERC6551 Implementation:", accountImplAddress);
    console.log("KeepToken Proxy:", keepTokenAddress);
    console.log("KeepToken Implementation:", keepTokenImplAddress);
    console.log("Inventory Proxy:", inventoryAddress);
    console.log("Inventory Implementation:", inventoryImplAddress);
    console.log("Adventurer Proxy:", adventurerAddress);
    console.log("Adventurer Implementation:", adventurerImplAddress);
    console.log("TavernKeeper Proxy:", tavernKeeperAddress);
    console.log("TavernKeeper Implementation:", tavernKeeperImplAddress);
    console.log("DungeonGatekeeper Proxy:", gatekeeperAddress);
    console.log("DungeonGatekeeper Implementation:", gatekeeperImplAddress);
    console.log("CellarHook Proxy:", hookAddress);
    console.log("CellarHook Implementation:", hookImplAddress);
    console.log("CellarZapV4 Proxy:", zapAddress);
    console.log("CellarZapV4 Implementation:", zapImplAddress);
    console.log("PoolManager:", poolManagerAddress);
    console.log("Tavern Regulars Manager:", tavernRegularsAddress);
    console.log("Town Posse Manager:", townPosseAddress);
    console.log("\n✅ Frontend addresses updated!");
    console.log("\n⚠️  CRITICAL: Set NEXT_PUBLIC_USE_LOCALHOST=true in .env.local");
    console.log("   Without this, the app will use Monad testnet addresses!");
    console.log("   This will cause ZERO ADDRESS errors and break everything!");
    console.log("\n✅ Ready to test on localhost!");
}

main().catch((error) => {
    console.error(error);
    process.exitCode = 1;
});
