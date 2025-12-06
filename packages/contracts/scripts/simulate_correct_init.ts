import { ethers, network } from "hardhat";

const MAINNET_POOL_MANAGER = "0x27e98f6A0D3315F9f3ECDaFE0187a7637F41c7c2";
const MAINNET_KEEP_TOKEN = "0x2D1094F5CED6ba279962f9676d32BE092AFbf82E";
const DEPLOYER_ADDRESS = "0xD515674a7fE63dFDfd43Fb5647E8B04eEfCEdCAa";
const NEW_POOL_FEE = 10000;
const NEW_POOL_TICK_SPACING = 200;

async function main() {
    console.log("=== SIMULATING CORRECT INITIALIZATION (IMPERSONATION) ===");

    // Impersonate Deployer
    await network.provider.request({
        method: "hardhat_impersonateAccount",
        params: [DEPLOYER_ADDRESS],
    });
    const deployer = await ethers.getSigner(DEPLOYER_ADDRESS);
    console.log("Impersonated Deployer:", deployer.address);

    // 1. Deploy Factory & Implementation (Simulated)
    console.log("\n--- Simulating Deployment ---");
    const Create2Factory = await ethers.getContractFactory("Create2Factory");
    const factorySim = await Create2Factory.deploy();
    await factorySim.waitForDeployment();
    const factoryAddress = await factorySim.getAddress();

    const CellarHook = await ethers.getContractFactory("CellarHook");
    const implementation = await CellarHook.deploy();
    await implementation.waitForDeployment();
    const implementationAddress = await implementation.getAddress();

    const MON_ADDRESS = ethers.ZeroAddress;
    const initPrice = ethers.parseEther("3");
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

    const ERC1967Proxy = await ethers.getContractFactory("ERC1967Proxy");
    const proxyDeployTx = await ERC1967Proxy.getDeployTransaction(implementationAddress, initData);
    const proxyInitCode = proxyDeployTx.data;
    const initCodeHash = ethers.keccak256(proxyInitCode);
    const targetFlags = 0x2DC0;

    let salt = 2000000n;
    let hookAddress = "";
    while (true) {
        const saltHex = ethers.toBeHex(salt, 32);
        const computed = ethers.getCreate2Address(factoryAddress, saltHex, initCodeHash);
        const addrInt = BigInt(computed);
        if ((addrInt & 0x3FFFn) === BigInt(targetFlags)) {
            hookAddress = computed;
            console.log(`Found salt: ${saltHex}`);
            console.log(`Simulated Hook Address: ${hookAddress}`);
            break;
        }
        salt++;
    }

    await factorySim.deploy(salt, proxyInitCode);
    console.log("Simulated Proxy Deployed");

    // 2. Initialize Pool (via CellarHook)
    const currency0 = MON_ADDRESS < MAINNET_KEEP_TOKEN ? MON_ADDRESS : MAINNET_KEEP_TOKEN;
    const currency1 = MON_ADDRESS < MAINNET_KEEP_TOKEN ? MAINNET_KEEP_TOKEN : MON_ADDRESS;

    const poolKey = {
        currency0: currency0,
        currency1: currency1,
        fee: NEW_POOL_FEE,
        tickSpacing: NEW_POOL_TICK_SPACING,
        hooks: hookAddress
    };

    console.log("\n--- Initializing Pool (via CellarHook) ---");
    const cellarHookProxy = CellarHook.attach(hookAddress);

    try {
        await cellarHookProxy.connect(deployer).initializePool(poolKey);
        console.log("✅ Pool Initialized successfully via CellarHook");

        // Check if initialized
        const abiCoder = new ethers.AbiCoder();
        const encoded = abiCoder.encode(
            ["address", "address", "uint24", "int24", "address"],
            [poolKey.currency0, poolKey.currency1, poolKey.fee, poolKey.tickSpacing, poolKey.hooks]
        );
        const poolId = ethers.keccak256(encoded);
        console.log("Computed PoolId:", poolId);

        // Check slot0 via PoolManager
        const poolManager = await ethers.getContractAt("IPoolManager", MAINNET_POOL_MANAGER);
        try {
            const slot0 = await poolManager.getSlot0(poolId);
            console.log("Slot0:", slot0);
            if (slot0[0] === 0n) {
                console.error("❌ Slot0 sqrtPriceX96 is 0! Pool NOT initialized properly?");
            } else {
                console.log("✅ Pool confirmed initialized via getSlot0");
            }
        } catch (e) {
            console.error("❌ Could not get Slot0:", e);
        }

    } catch (error: any) {
        console.error("❌ Pool Initialization Failed:", error.message);
        if (error.data) {
            console.error("Data:", error.data);
            try {
                const decoded = implementation.interface.parseError(error.data);
                console.error("Decoded Error (Hook):", decoded);
            } catch (e) {
                try {
                    const IPoolManager = await ethers.getContractAt("IPoolManager", MAINNET_POOL_MANAGER);
                    const decodedPM = IPoolManager.interface.parseError(error.data);
                    console.error("Decoded Error (PM):", decodedPM);
                } catch (e2) { }
            }
        }
    }

    // 3. Add Liquidity (via CellarHook)
    console.log("\n--- Adding Liquidity (via CellarHook) ---");
    const testAmountMON = ethers.parseEther("0.1");
    const testAmountKEEP = ethers.parseEther("0.3");

    const keepToken = await ethers.getContractAt("IERC20", MAINNET_KEEP_TOKEN);
    // Approve Hook
    await keepToken.connect(deployer).approve(hookAddress, testAmountKEEP);

    try {
        // Pass 0, 0 to let CellarHook calculate range around current price (3.0)
        await cellarHookProxy.connect(deployer).addLiquidity(
            poolKey,
            testAmountMON,
            testAmountKEEP,
            0, // tickLower (0 = auto)
            0, // tickUpper (0 = auto)
            { value: testAmountMON }
        );
        console.log("✅ Liquidity Added successfully via CellarHook");
    } catch (error: any) {
        console.error("❌ Add Liquidity Failed:", error.message);
        if (error.data) {
            try {
                const decoded = implementation.interface.parseError(error.data);
                console.error("Decoded Error (Hook):", decoded);
            } catch (e) {
                try {
                    const IPoolManager = await ethers.getContractAt("IPoolManager", MAINNET_POOL_MANAGER);
                    const decodedPM = IPoolManager.interface.parseError(error.data);
                    console.error("Decoded Error (PM):", decodedPM);
                } catch (e2) {
                    console.error("Could not decode error");
                }
            }
        }
    }
}

main().catch((error) => {
    console.error(error);
    process.exitCode = 1;
});
