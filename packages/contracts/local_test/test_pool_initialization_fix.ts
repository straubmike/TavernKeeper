import * as fs from "fs";
import { ethers } from "hardhat";
import * as path from "path";

async function main() {
    const outputFile = path.join(process.cwd(), "local_test", "pool_init_fix_test.txt");
    // Clear previous output
    if (fs.existsSync(outputFile)) {
        fs.unlinkSync(outputFile);
    }
    const log = (msg: string) => {
        const output = msg + "\n";
        console.log(msg);
        try {
            fs.appendFileSync(outputFile, output);
        } catch (e) {
            // Ignore file write errors
        }
    };

    log("=== TESTING POOL INITIALIZATION FIX ===");
    const [deployer] = await ethers.getSigners();
    log("Deployer: " + deployer.address);

    // Read addresses from addresses.ts - use EXACT same approach as test_upgraded_proxy.ts
    let CELLAR_HOOK_PROXY = "";
    let POOL_MANAGER = "";
    let KEEP_TOKEN = "";

    // Use absolute path to avoid path resolution issues
    // Try multiple potential paths
    const potentialPaths = [
        "C:\\Users\\epj33\\Desktop\\InnKeeper\\apps\\web\\lib\\contracts\\addresses.ts",
        path.join(process.cwd(), "..", "..", "apps", "web", "lib", "contracts", "addresses.ts"),
        path.join(__dirname, "..", "..", "..", "apps", "web", "lib", "contracts", "addresses.ts")
    ];

    let addressesPath = "";
    for (const p of potentialPaths) {
        if (fs.existsSync(p)) {
            addressesPath = p;
            break;
        }
    }

    log("Reading addresses from: " + addressesPath);

    try {
        if (!addressesPath) {
            log("❌ addresses.ts not found in any expected location");
            throw new Error("addresses.ts not found");
        }

        const addressesContent = fs.readFileSync(addressesPath, "utf8");

        // Find the line number where LOCALHOST_ADDRESSES starts
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

        if (localhostStart >= 0 && localhostEnd >= 0) {
            const localhostSection = lines.slice(localhostStart, localhostEnd + 1).join('\n');
            log("Found LOCALHOST_ADDRESSES section (lines " + localhostStart + "-" + localhostEnd + ")");

            // Look for THE_CELLAR (CellarHook), POOL_MANAGER, KEEP_TOKEN
            // Regex handles optional whitespace and 'as Address'
            const cellarMatch = localhostSection.match(/THE_CELLAR:\s*['"](0x[a-fA-F0-9]{40})['"]/);
            const pmMatch = localhostSection.match(/POOL_MANAGER:\s*['"](0x[a-fA-F0-9]{40})['"]/);
            const keepMatch = localhostSection.match(/KEEP_TOKEN:\s*['"](0x[a-fA-F0-9]{40})['"]/);

            if (cellarMatch && cellarMatch[1]) {
                CELLAR_HOOK_PROXY = cellarMatch[1];
                log("✅ Found THE_CELLAR: " + CELLAR_HOOK_PROXY);
            } else {
                log("⚠️  Could not find THE_CELLAR in LOCALHOST_ADDRESSES section");
            }
            if (pmMatch && pmMatch[1]) {
                POOL_MANAGER = pmMatch[1];
                log("✅ Found POOL_MANAGER: " + POOL_MANAGER);
            } else {
                log("⚠️  Could not find POOL_MANAGER in LOCALHOST_ADDRESSES section");
            }
            if (keepMatch && keepMatch[1]) {
                KEEP_TOKEN = keepMatch[1];
                log("✅ Found KEEP_TOKEN: " + KEEP_TOKEN);
            } else {
                log("⚠️  Could not find KEEP_TOKEN in LOCALHOST_ADDRESSES section");
            }
        } else {
            log("⚠️  Could not find LOCALHOST_ADDRESSES section boundaries");
            // Fallback: try regex on whole file
            const cellarMatch = addressesContent.match(/LOCALHOST_ADDRESSES[\s\S]*?THE_CELLAR:\s*['"](0x[a-fA-F0-9]{40})['"]/);
            const pmMatch = addressesContent.match(/LOCALHOST_ADDRESSES[\s\S]*?POOL_MANAGER:\s*['"](0x[a-fA-F0-9]{40})['"]/);
            const keepMatch = addressesContent.match(/LOCALHOST_ADDRESSES[\s\S]*?KEEP_TOKEN:\s*['"](0x[a-fA-F0-9]{40})['"]/);

            if (cellarMatch && cellarMatch[1]) {
                CELLAR_HOOK_PROXY = cellarMatch[1];
                log("⚠️  Read THE_CELLAR using fallback regex: " + CELLAR_HOOK_PROXY);
            }
            if (pmMatch && pmMatch[1]) {
                POOL_MANAGER = pmMatch[1];
                log("⚠️  Read POOL_MANAGER using fallback regex: " + POOL_MANAGER);
            }
            if (keepMatch && keepMatch[1]) {
                KEEP_TOKEN = keepMatch[1];
                log("⚠️  Read KEEP_TOKEN using fallback regex: " + KEEP_TOKEN);
            }
        }
    } catch (e: any) {
        log("❌ Error reading addresses.ts: " + e.message);
        if (e.stack) {
            log("Stack: " + e.stack);
        }
    }

    if (!CELLAR_HOOK_PROXY || !POOL_MANAGER || !KEEP_TOKEN) {
        log("❌ ERROR: Could not read addresses from addresses.ts");
        log("   Found:");
        log("   - THE_CELLAR: " + (CELLAR_HOOK_PROXY || "NOT FOUND"));
        log("   - POOL_MANAGER: " + (POOL_MANAGER || "NOT FOUND"));
        log("   - KEEP_TOKEN: " + (KEEP_TOKEN || "NOT FOUND"));
        log("   Please ensure LOCALHOST_ADDRESSES section exists with THE_CELLAR, POOL_MANAGER, and KEEP_TOKEN");
        process.exit(1);
    }

    log("CellarHook Proxy: " + CELLAR_HOOK_PROXY);
    log("PoolManager: " + POOL_MANAGER);
    log("KeepToken: " + KEEP_TOKEN);

    // Get contracts
    const cellarHook = await ethers.getContractAt("CellarHook", CELLAR_HOOK_PROXY);
    // Use PoolManager artifact instead of interface to ensure ABI availability
    const poolManager = await ethers.getContractAt("PoolManager", POOL_MANAGER);
    const keepToken = await ethers.getContractAt("KeepToken", KEEP_TOKEN);

    // Get MON and KEEP currencies
    const MON = await cellarHook.MON();
    const KEEP = await cellarHook.KEEP();
    const MON_ADDRESS = ethers.getAddress(ethers.hexlify(MON));
    const KEEP_ADDRESS = ethers.getAddress(ethers.hexlify(KEEP));

    log("\n--- Token Addresses ---");
    log("MON: " + (MON_ADDRESS === ethers.ZeroAddress ? "Native" : MON_ADDRESS));
    log("KEEP: " + KEEP_ADDRESS);

    // Construct PoolKey (Existing Broken Pool)
    const poolKey = {
        currency0: MON,
        currency1: KEEP,
        fee: 10000,
        tickSpacing: 200,
        hooks: CELLAR_HOOK_PROXY
    };

    // Check current pool state
    log("\n--- Checking Pool State (Fee 10000) ---");
    const poolId = ethers.keccak256(
        ethers.AbiCoder.defaultAbiCoder().encode(
            ["address", "address", "uint24", "int24", "address"],
            [
                MON_ADDRESS === ethers.ZeroAddress ? ethers.ZeroAddress : MON_ADDRESS,
                KEEP_ADDRESS,
                10000,
                200,
                CELLAR_HOOK_PROXY
            ]
        )
    );

    try {
        const slot0 = await poolManager.getSlot0(poolId);
        const sqrtPriceX96 = slot0[0] || slot0.sqrtPriceX96;
        const tick = Number(slot0[1] || slot0.tick);

        log("sqrtPriceX96: " + sqrtPriceX96.toString());
        log("Tick: " + tick.toString());

        if (sqrtPriceX96 === 0n || tick === 0) {
            log("❌ Pool is NOT initialized (price=0, tick=0)");
            log("   This is a broken pool state");
        } else {
            log("✅ Pool is initialized");
            log("   Price: " + (Number(sqrtPriceX96) / (2 ** 96)) ** 2);
        }
    } catch (error: any) {
        log("❌ Error reading pool state: " + error.message);
        log("   Pool may not exist");
    }

    // Try to initialize pool (Existing)
    log("\n--- Attempting to Initialize Pool (Fee 10000) ---");
    try {
        const initTx = await cellarHook.initializePool(poolKey);
        log("Transaction sent: " + initTx.hash);
        const receipt = await initTx.wait();
        log("✅ Pool initialized successfully!");
    } catch (error: any) {
        log("❌ ERROR initializing pool: " + error.message);
        if (error.message.includes("already initialized")) {
            log("   Pool is already initialized - this is OK");
        } else if (error.message.includes("broken")) {
            log("   ✅ CORRECT BEHAVIOR: Pool is broken and correctly identified as unfixable");
        } else {
            log("   Unexpected error: " + error.message);
        }
    }

    // TEST NEW POOL (Fee 3000)
    log("\n--- Testing New Pool Creation (Fee 3000) ---");
    const poolKeyNew = {
        currency0: MON,
        currency1: KEEP,
        fee: 3000,
        tickSpacing: 60,
        hooks: CELLAR_HOOK_PROXY
    };

    try {
        log("Initializing new pool (Fee 3000)...");
        const initTx = await cellarHook.initializePool(poolKeyNew);
        await initTx.wait();
        log("✅ New Pool (Fee 3000) initialized successfully!");

        // Add liquidity to new pool
        log("Adding liquidity to new pool...");
        const amountMON = ethers.parseEther("0.1");
        const amountKEEP = ethers.parseEther("0.3");

        // Approve KEEP
        await keepToken.approve(CELLAR_HOOK_PROXY, amountKEEP);

        const addTx = await cellarHook.addLiquidity(
            poolKeyNew,
            amountMON,
            amountKEEP,
            0,
            0,
            { value: amountMON }
        );
        await addTx.wait();
        log("✅ Liquidity added to new pool successfully!");

    } catch (error: any) {
        log("❌ Error with new pool: " + error.message);
        if (error.message.includes("already initialized")) {
            log("   Pool already initialized (maybe from previous run)");
        }
    }

    log("\n=== TEST COMPLETE ===");
}

main().catch((error) => {
    console.error("❌ Script failed:", error);
    process.exitCode = 1;
});
