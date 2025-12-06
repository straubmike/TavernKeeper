import { ethers, network } from "hardhat";

const MAINNET_POOL_MANAGER = "0x27e98f6A0D3315F9f3ECDaFE0187a7637F41c7c2";
const MAINNET_KEEP_TOKEN = "0x2D1094F5CED6ba279962f9676d32BE092AFbf82E";
const DEPLOYER_ADDRESS = "0xD515674a7fE63dFDfd43Fb5647E8B04eEfCEdCAa";
const NEW_POOL_FEE = 10000;
const NEW_POOL_TICK_SPACING = 200;

async function main() {
    console.log("=== DIAGNOSING MAINNET FAILURE (IMPERSONATION) ===");

    // Impersonate the real deployer
    await network.provider.request({
        method: "hardhat_impersonateAccount",
        params: [DEPLOYER_ADDRESS],
    });
    const deployer = await ethers.getSigner(DEPLOYER_ADDRESS);
    console.log("Impersonated Deployer:", deployer.address);

    // 1. Simulate Deployment to get Hook Address
    console.log("\n--- Simulating Deployment on Mainnet Fork ---");
    const Create2Factory = await ethers.getContractFactory("Create2Factory");
    const factorySim = await Create2Factory.deploy(); // Deploy new factory for simulation
    await factorySim.waitForDeployment();
    const factoryAddress = await factorySim.getAddress();
    console.log("Simulated Factory:", factoryAddress);

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

    // 2. Simulate initializePool
    const cellarHook = CellarHook.attach(hookAddress);
    const SQRT_PRICE_X96 = 137235188737522533037775022161n;

    const currency0 = MON_ADDRESS < MAINNET_KEEP_TOKEN ? MON_ADDRESS : MAINNET_KEEP_TOKEN;
    const currency1 = MON_ADDRESS < MAINNET_KEEP_TOKEN ? MAINNET_KEEP_TOKEN : MON_ADDRESS;

    const poolKey = {
        currency0: currency0,
        currency1: currency1,
        fee: NEW_POOL_FEE,
        tickSpacing: NEW_POOL_TICK_SPACING,
        hooks: hookAddress
    };

    console.log("\n--- Attempting initializePool (Simulation) ---");
    try {
        await cellarHook.connect(deployer).initializePool.staticCall(poolKey, SQRT_PRICE_X96);
        console.log("✅ initializePool simulation SUCCESS");
    } catch (error: any) {
        console.error("❌ initializePool simulation FAILED");
        console.error("Reason:", error.message);
        if (error.data) {
            console.error("Data:", error.data);
            try {
                const decoded = cellarHook.interface.parseError(error.data);
                console.error("Decoded Error (Hook):", decoded);
            } catch (e) {
                try {
                    const IPoolManager = await ethers.getContractAt("IPoolManager", MAINNET_POOL_MANAGER);
                    const decodedPM = IPoolManager.interface.parseError(error.data);
                    console.error("Decoded Error (PoolManager):", decodedPM);
                } catch (e2) {
                    console.error("Could not decode error data");
                }
            }
        }
    }

    // 3. Simulate addLiquidity
    console.log("\n--- Attempting addLiquidity (Simulation) ---");
    const testAmountMON = ethers.parseEther("0.1");
    const testAmountKEEP = ethers.parseEther("0.3");

    const keepToken = await ethers.getContractAt("IERC20", MAINNET_KEEP_TOKEN);

    // Check balance of impersonated deployer
    const balance = await keepToken.balanceOf(deployer.address);
    console.log("Deployer KEEP Balance:", ethers.formatEther(balance));

    await keepToken.connect(deployer).approve(hookAddress, testAmountKEEP);

    try {
        await cellarHook.connect(deployer).addLiquidity.staticCall(
            poolKey,
            testAmountMON,
            testAmountKEEP,
            0,
            0,
            { value: testAmountMON }
        );
        console.log("✅ addLiquidity simulation SUCCESS");
    } catch (error: any) {
        console.error("❌ addLiquidity simulation FAILED");
        console.error("Reason:", error.message);
        if (error.data) {
            console.error("Data:", error.data);
            try {
                const decoded = cellarHook.interface.parseError(error.data);
                console.error("Decoded Error:", decoded);
            } catch (e) {
                console.error("Could not decode error data");
            }
        }
    }
}

main().catch((error) => {
    console.error(error);
    process.exitCode = 1;
});
