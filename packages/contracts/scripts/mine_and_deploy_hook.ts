import { ethers, upgrades } from "hardhat";
import * as fs from "fs";
import * as path from "path";

async function main() {
    const [deployer] = await ethers.getSigners();
    console.log("Deployer:", deployer.address);

    // Desired flags:
    // BEFORE_INITIALIZE (Bit 13)
    // BEFORE_ADD_LIQUIDITY (Bit 11)
    // AFTER_ADD_LIQUIDITY (Bit 10)
    // BEFORE_SWAP (Bit 7)
    // AFTER_SWAP (Bit 6)

    // CRITICAL: Bits 0-3 (Delta flags) must be 0 to avoid validation errors!

    const REQUIRED_FLAGS = (1 << 13) | (1 << 11) | (1 << 10) | (1 << 7) | (1 << 6);
    const FORBIDDEN_FLAGS = 0xF; // Bits 0, 1, 2, 3

    console.log("Required Flags Mask:", REQUIRED_FLAGS.toString(16));
    console.log("Forbidden Flags Mask:", FORBIDDEN_FLAGS.toString(16));

    const CellarHook = await ethers.getContractFactory("CellarHook");

    // Read existing addresses to get dependencies
    const addressesPath = path.join(process.cwd(), "..", "..", "apps", "web", "lib", "contracts", "addresses.ts");
    const addressesContent = fs.readFileSync(addressesPath, "utf8");
    const pmMatch = addressesContent.match(/LOCALHOST_ADDRESSES[\s\S]*?POOL_MANAGER:\s*['"](0x[a-fA-F0-9]{40})['"]/);
    const keepMatch = addressesContent.match(/LOCALHOST_ADDRESSES[\s\S]*?KEEP_TOKEN:\s*['"](0x[a-fA-F0-9]{40})['"]/);

    if (!pmMatch || !keepMatch) {
        console.error("Could not find POOL_MANAGER or KEEP_TOKEN");
        return;
    }

    const poolManagerAddress = pmMatch[1];
    const keepTokenAddress = keepMatch[1];
    const MON = "0x0000000000000000000000000000000000000000";
    const initPrice = ethers.parseEther("100");
    const epochPeriod = 3600;
    const priceMultiplier = ethers.parseEther("1.1");
    const minInitPrice = ethers.parseEther("1");

    let hookProxy;
    let hookAddress = "";
    let attempts = 0;
    const MAX_ATTEMPTS = 2000; // Increased attempts for stricter criteria (approx 1/512 chance)

    console.log("Mining for valid hook address (Safe Flags)...");

    while (attempts < MAX_ATTEMPTS) {
        attempts++;
        if (attempts % 10 === 0) process.stdout.write(`Attempt ${attempts}... `);

        try {
            // Deploy a new proxy
            hookProxy = await upgrades.deployProxy(
                CellarHook,
                [
                    poolManagerAddress,
                    MON,
                    keepTokenAddress,
                    initPrice,
                    epochPeriod,
                    priceMultiplier,
                    minInitPrice,
                    deployer.address
                ],
                { kind: 'uups', initializer: 'initialize' }
            );
            await hookProxy.waitForDeployment();
            hookAddress = await hookProxy.getAddress();

            const addressBigInt = BigInt(hookAddress);
            const flags = Number(addressBigInt & 0x3FFFn);

            const hasRequired = (flags & REQUIRED_FLAGS) === REQUIRED_FLAGS;
            const hasForbidden = (flags & FORBIDDEN_FLAGS) !== 0;

            if (hasRequired && !hasForbidden) {
                console.log(`\n${hookAddress} (Flags: 0x${flags.toString(16)}) -> VALID ✅`);
                break;
            } else {
                // console.log(`${hookAddress} -> INVALID ❌`);
            }
        } catch (e) {
            console.log("Error:", e);
        }
    }

    if (attempts >= MAX_ATTEMPTS && !hookAddress) {
        console.error("Failed to find valid hook address");
        return;
    }

    console.log("\n✅ Found valid hook address:", hookAddress);

    const addressBigInt = BigInt(hookAddress);
    const flags = Number(addressBigInt & 0x3FFFn);

    console.log("\n=== UPDATE CellarHook.sol WITH THESE PERMISSIONS ===");
    console.log(`beforeInitialize: ${(flags & (1 << 13)) !== 0}`);
    console.log(`afterInitialize: ${(flags & (1 << 12)) !== 0}`);
    console.log(`beforeAddLiquidity: ${(flags & (1 << 11)) !== 0}`);
    console.log(`afterAddLiquidity: ${(flags & (1 << 10)) !== 0}`);
    console.log(`beforeRemoveLiquidity: ${(flags & (1 << 9)) !== 0}`);
    console.log(`afterRemoveLiquidity: ${(flags & (1 << 8)) !== 0}`);
    console.log(`beforeSwap: ${(flags & (1 << 7)) !== 0}`);
    console.log(`afterSwap: ${(flags & (1 << 6)) !== 0}`);
    console.log(`beforeDonate: ${(flags & (1 << 5)) !== 0}`);
    console.log(`afterDonate: ${(flags & (1 << 4)) !== 0}`);
    console.log(`beforeSwapReturnDelta: ${(flags & (1 << 3)) !== 0}`);
    console.log(`afterSwapReturnDelta: ${(flags & (1 << 2)) !== 0}`);
    console.log(`afterAddLiquidityReturnDelta: ${(flags & (1 << 1)) !== 0}`);
    console.log(`afterRemoveLiquidityReturnDelta: ${(flags & (1 << 0)) !== 0}`);

    console.log("\n=== UPDATE addresses.ts ===");
    console.log(`THE_CELLAR: "${hookAddress}",`);

    // We should also update the file automatically if possible, but let's just output for now
    // and I will manually update CellarHook.sol and addresses.ts
}

main().catch((error) => {
    console.error(error);
    process.exitCode = 1;
});
