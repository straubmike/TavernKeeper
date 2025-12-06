import * as fs from "fs";
import { ethers } from "hardhat";
import * as path from "path";

/**
 * One-off script to initialize the pool with initial liquidity
 * Run this after deploy_localhost.ts if the pool wasn't initialized
 */

async function main() {
    console.log("=== INITIALIZING POOL ON LOCALHOST ===\n");
    const [deployer] = await ethers.getSigners();
    console.log("Deployer:", deployer.address);

    // Read addresses from addresses.ts
    const addressesPath = path.join(process.cwd(), "../../apps/web/lib/contracts/addresses.ts");
    const addressesContent = fs.readFileSync(addressesPath, "utf8");

    // Extract LOCALHOST_ADDRESSES
    const lines = addressesContent.split('\n');
    let localhostStart = -1;
    let localhostEnd = -1;

    for (let i = 0; i < lines.length; i++) {
        if (lines[i].includes('export const LOCALHOST_ADDRESSES')) {
            localhostStart = i;
        }
        if (localhostStart >= 0 && lines[i].trim() === '};' && i > localhostStart) {
            localhostEnd = i;
            break;
        }
    }

    if (localhostStart < 0 || localhostEnd < 0) {
        throw new Error("Could not find LOCALHOST_ADDRESSES in addresses.ts");
    }

    const localhostSection = lines.slice(localhostStart, localhostEnd + 1).join('\n');
    const cellarMatch = localhostSection.match(/THE_CELLAR:\s*['"](0x[a-fA-F0-9]{40})['"]/);
    const keepMatch = localhostSection.match(/KEEP_TOKEN:\s*['"](0x[a-fA-F0-9]{40})['"]/);
    const poolManagerMatch = localhostSection.match(/POOL_MANAGER:\s*['"](0x[a-fA-F0-9]{40})['"]/);

    if (!cellarMatch || !keepMatch || !poolManagerMatch) {
        throw new Error("Could not find required addresses in LOCALHOST_ADDRESSES");
    }

    const CELLAR_HOOK = cellarMatch[1];
    const KEEP_TOKEN = keepMatch[1];
    const POOL_MANAGER = poolManagerMatch[1];

    console.log("CellarHook:", CELLAR_HOOK);
    console.log("KeepToken:", KEEP_TOKEN);
    console.log("PoolManager:", POOL_MANAGER);

    // Get contracts
    const cellarHook = await ethers.getContractAt("CellarHook", CELLAR_HOOK);
    const keepToken = await ethers.getContractAt("KeepToken", KEEP_TOKEN);
    const keepTokenERC20 = await ethers.getContractAt("IERC20", KEEP_TOKEN);

    // Check if pool is already initialized
    const MON = await cellarHook.MON();
    const KEEP = await cellarHook.KEEP();
    const poolKey = {
        currency0: MON,
        currency1: KEEP,
        fee: 10000,
        tickSpacing: 200,
        hooks: CELLAR_HOOK
    };

    try {
        // Try to read pool state
        const poolManager = await ethers.getContractAt("PoolManager", POOL_MANAGER);
        const poolId = ethers.solidityPackedKeccak256(
            ["address", "address", "uint24", "int24", "address"],
            [poolKey.currency0, poolKey.currency1, poolKey.fee, poolKey.tickSpacing, poolKey.hooks]
        );

        // Check if pool exists and is initialized
        const StateView = await ethers.getContractFactory("StateView");
        const stateView = await StateView.deploy(POOL_MANAGER);
        await stateView.waitForDeployment();

        try {
            const slot0 = await stateView.getSlot0(poolId);
            const sqrtPriceX96 = slot0.sqrtPriceX96;
            const tick = slot0.tick;

            if (sqrtPriceX96 !== 0n && tick !== 0) {
                console.log("\n✅ Pool is already initialized!");
                console.log("   sqrtPriceX96:", sqrtPriceX96.toString());
                console.log("   tick:", tick.toString());
                console.log("\nNo action needed.");
                return;
            }
        } catch (e) {
            // Pool doesn't exist or is broken, need to initialize
            console.log("\n⚠️  Pool is not initialized, proceeding with initialization...");
        }
    } catch (e) {
        console.log("\n⚠️  Could not check pool state, proceeding with initialization...");
    }

    // Mint KEEP tokens if needed
    console.log("\n--- Minting KEEP Tokens ---");
    const keepBalance = await keepTokenERC20.balanceOf(deployer.address);
    const neededKEEP = ethers.parseEther("3");

    if (keepBalance < neededKEEP) {
        console.log("Current KEEP balance:", ethers.formatEther(keepBalance));
        console.log("Need:", ethers.formatEther(neededKEEP));

        const keepOwner = await keepToken.owner();
        if (keepOwner.toLowerCase() === deployer.address.toLowerCase()) {
            const currentTK = await keepToken.tavernKeeperContract();
            console.log("Temporarily setting deployer as TavernKeeper to mint...");
            await (await keepToken.setTavernKeeperContract(deployer.address)).wait();

            await (await keepToken.mint(deployer.address, ethers.parseEther("10000"))).wait();
            console.log("✅ Minted KEEP tokens");

            if (currentTK !== ethers.ZeroAddress) {
                await (await keepToken.setTavernKeeperContract(currentTK)).wait();
                console.log("✅ Restored original TavernKeeper");
            }
        } else {
            throw new Error("Deployer is not KeepToken owner, cannot mint");
        }
    } else {
        console.log("✅ Sufficient KEEP balance:", ethers.formatEther(keepBalance));
    }

    // Approve KEEP
    console.log("\n--- Approving KEEP ---");
    await (await keepTokenERC20.approve(CELLAR_HOOK, neededKEEP)).wait();
    console.log("✅ Approved KEEP for CellarHook");

    // Add initial liquidity
    console.log("\n--- Adding Initial Liquidity ---");
    const initialMON = ethers.parseEther("1");
    const initialKEEP = ethers.parseEther("3");

    console.log("Adding:", ethers.formatEther(initialMON), "MON");
    console.log("Adding:", ethers.formatEther(initialKEEP), "KEEP");

    const tx = await cellarHook.addLiquidity(
        poolKey,
        initialMON,
        initialKEEP,
        0,
        0,
        { value: initialMON }
    );

    console.log("Transaction sent:", tx.hash);
    await tx.wait();
    console.log("✅ Pool initialized with initial liquidity!");
    console.log("   - 1 MON");
    console.log("   - 3 KEEP");
    console.log("   - Price: 3 KEEP per MON");

    // Verify pool state
    try {
        const StateView = await ethers.getContractFactory("StateView");
        const stateView = await StateView.deploy(POOL_MANAGER);
        await stateView.waitForDeployment();

        const poolId = ethers.solidityPackedKeccak256(
            ["address", "address", "uint24", "int24", "address"],
            [poolKey.currency0, poolKey.currency1, poolKey.fee, poolKey.tickSpacing, poolKey.hooks]
        );

        const slot0 = await stateView.getSlot0(poolId);
        console.log("\n✅ Pool state verified:");
        console.log("   sqrtPriceX96:", slot0.sqrtPriceX96.toString());
        console.log("   tick:", slot0.tick.toString());
    } catch (e) {
        console.log("\n⚠️  Could not verify pool state:", e);
    }

    console.log("\n=== POOL INITIALIZATION COMPLETE ===");
}

main().catch((error) => {
    console.error(error);
    process.exitCode = 1;
});
