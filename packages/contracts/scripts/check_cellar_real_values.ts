import { ethers } from "hardhat";
import * as fs from "fs";
import * as path from "path";

/**
 * Check real LP and Cellar Pot values on-chain
 *
 * Usage:
 *   npx hardhat run scripts/check_cellar_real_values.ts --network monad
 */

async function main() {
    console.log("=== CHECKING REAL CELLAR VALUES ===\n");

    const [deployer] = await ethers.getSigners();
    console.log("Deployer:", deployer.address);

    const network = await ethers.provider.getNetwork();
    const networkName = network.name;
    console.log("Network:", networkName, `(Chain ID: ${network.chainId})`);
    console.log("");

    // Get addresses from addresses.ts or use hardcoded for mainnet/testnet
    let THE_CELLAR = "";
    let KEEP_TOKEN = "";
    let POOL_MANAGER = "";
    let testAddress = deployer.address;

    // Try to read from addresses.ts
    const addressesPath = path.join(__dirname, "../../apps/web/lib/contracts/addresses.ts");
    if (fs.existsSync(addressesPath)) {
        const addressesContent = fs.readFileSync(addressesPath, "utf8");

        // Determine which address set to use
        let addressSet = "MONAD_TESTNET_ADDRESSES";
        if (network.chainId === 143n) {
            addressSet = "MONAD_MAINNET_ADDRESSES";
        }

        const cellarMatch = addressesContent.match(new RegExp(`${addressSet}[\\s\\S]*?THE_CELLAR:\\s*['"](0x[a-fA-F0-9]{40})['"]`, "i"));
        const keepMatch = addressesContent.match(new RegExp(`${addressSet}[\\s\\S]*?KEEP_TOKEN:\\s*['"](0x[a-fA-F0-9]{40})['"]`, "i"));
        const pmMatch = addressesContent.match(new RegExp(`${addressSet}[\\s\\S]*?POOL_MANAGER:\\s*['"](0x[a-fA-F0-9]{40})['"]`, "i"));

        if (cellarMatch && cellarMatch[1]) THE_CELLAR = cellarMatch[1];
        if (keepMatch && keepMatch[1]) KEEP_TOKEN = keepMatch[1];
        if (pmMatch && pmMatch[1]) POOL_MANAGER = pmMatch[1];
    }

    // Fallback to hardcoded addresses if not found
    if (!THE_CELLAR) {
        if (network.chainId === 143n) {
            THE_CELLAR = "0xe71CAf7162dd81a4A9C0c6BD25ED02C26F492DC0"; // Mainnet
            KEEP_TOKEN = "0x2D1094F5CED6ba279962f9676d32BE092AFbf82E";
            POOL_MANAGER = "0x27e98f6A0D3315F9f3ECDaFE0187a7637F41c7c2";
        } else {
            THE_CELLAR = "0xA43034595E2d1c52Ab08a057B95dD38bCbFf87dC"; // Testnet
            KEEP_TOKEN = "0x96982EC3625145f098DCe06aB34E99E7207b0520";
            POOL_MANAGER = "0x8788E862023A49a77E8F27277a8b3F07B4E9A7d8";
        }
    }

    console.log("Contract Addresses:");
    console.log("  THE_CELLAR:", THE_CELLAR);
    console.log("  KEEP_TOKEN:", KEEP_TOKEN);
    console.log("  POOL_MANAGER:", POOL_MANAGER);
    console.log("  Test Address (Deployer):", testAddress);
    console.log("");

    // Get CellarHook contract
    const CellarHook = await ethers.getContractFactory("CellarHook");
    const cellarHook = CellarHook.attach(THE_CELLAR);

    console.log("--- CELLAR CONTRACT STATE ---");

    // 1. Pot Balance
    try {
        const potBalance = await cellarHook.potBalance();
        console.log("Pot Balance:", ethers.formatEther(potBalance), "MON");
        console.log("Pot Balance (wei):", potBalance.toString());
    } catch (error: any) {
        console.error("❌ Error reading potBalance:", error.message);
    }

    // 2. Slot0
    try {
        const slot0 = await cellarHook.slot0();
        console.log("\nSlot0:");
        console.log("  Epoch ID:", slot0.epochId.toString());
        console.log("  Init Price:", ethers.formatEther(slot0.initPrice), "LP");
        console.log("  Start Time:", new Date(Number(slot0.startTime) * 1000).toISOString());
        console.log("  Locked:", slot0.locked.toString());
    } catch (error: any) {
        console.error("❌ Error reading slot0:", error.message);
    }

    // 3. Auction Price
    try {
        const auctionPrice = await cellarHook.getAuctionPrice();
        console.log("\nAuction Price (getAuctionPrice):", ethers.formatEther(auctionPrice), "LP");
    } catch (error: any) {
        console.error("❌ Error reading getAuctionPrice:", error.message);
    }

    // 4. LP Balance for deployer
    try {
        const lpBalance = await cellarHook.balanceOf(testAddress);
        console.log("\nLP Balance (deployer):", ethers.formatEther(lpBalance), "LP");
        console.log("LP Balance (wei):", lpBalance.toString());
    } catch (error: any) {
        console.error("❌ Error reading LP balance:", error.message);
    }

    // 5. Total Supply
    try {
        const totalSupply = await cellarHook.totalSupply();
        console.log("\nTotal LP Supply:", ethers.formatEther(totalSupply), "LP");
    } catch (error: any) {
        console.error("❌ Error reading totalSupply:", error.message);
    }

    // 6. Pool Initialized
    try {
        const poolInitialized = await cellarHook.poolInitialized();
        console.log("\nPool Initialized:", poolInitialized ? "✅ YES" : "❌ NO");
    } catch (error: any) {
        console.error("❌ Error reading poolInitialized:", error.message);
    }

    // 7. MON and KEEP currencies
    try {
        const MON = await cellarHook.MON();
        const KEEP = await cellarHook.KEEP();
        console.log("\nCurrencies:");
        const monAddr = ethers.getAddress(ethers.hexlify(MON));
        const keepAddr = ethers.getAddress(ethers.hexlify(KEEP));
        console.log("  MON:", monAddr === ethers.ZeroAddress ? "Native (0x0)" : monAddr);
        console.log("  KEEP:", keepAddr);
    } catch (error: any) {
        console.error("❌ Error reading currencies:", error.message);
    }

    // 8. Pool Manager balance for MON (native)
    console.log("\n--- POOL MANAGER BALANCES ---");
    try {
        const pmMonBalance = await ethers.provider.getBalance(POOL_MANAGER);
        console.log("PoolManager MON Balance:", ethers.formatEther(pmMonBalance), "MON");

        const KeepToken = await ethers.getContractAt("IERC20", KEEP_TOKEN);
        const pmKeepBalance = await KeepToken.balanceOf(POOL_MANAGER);
        console.log("PoolManager KEEP Balance:", ethers.formatEther(pmKeepBalance), "KEEP");
    } catch (error: any) {
        console.error("❌ Error reading PoolManager balances:", error.message);
    }

    // 9. CellarHook contract balance
    console.log("\n--- CELLAR HOOK BALANCES ---");
    try {
        const hookMonBalance = await ethers.provider.getBalance(THE_CELLAR);
        console.log("CellarHook MON Balance:", ethers.formatEther(hookMonBalance), "MON");

        const KeepToken = await ethers.getContractAt("IERC20", KEEP_TOKEN);
        const hookKeepBalance = await KeepToken.balanceOf(THE_CELLAR);
        console.log("CellarHook KEEP Balance:", ethers.formatEther(hookKeepBalance), "KEEP");
    } catch (error: any) {
        console.error("❌ Error reading CellarHook balances:", error.message);
    }

    // 10. Check pool state if pool is initialized
    console.log("\n--- POOL STATE (Uniswap V4) ---");
    try {
        const MON = await cellarHook.MON();
        const KEEP = await cellarHook.KEEP();

        const currency0 = MON < KEEP ? MON : KEEP;
        const currency1 = MON < KEEP ? KEEP : MON;

        const poolKey = {
            currency0: currency0,
            currency1: currency1,
            fee: 10000,
            tickSpacing: 200,
            hooks: THE_CELLAR
        };

        const poolId = ethers.solidityPackedKeccak256(
            ["address", "address", "uint24", "int24", "address"],
            [
                ethers.getAddress(ethers.hexlify(poolKey.currency0)),
                ethers.getAddress(ethers.hexlify(poolKey.currency1)),
                poolKey.fee,
                poolKey.tickSpacing,
                poolKey.hooks
            ]
        );

        const PoolManager = await ethers.getContractAt("IPoolManager", POOL_MANAGER);

        try {
            const slot0 = await PoolManager.getSlot0(poolId);
            const sqrtPriceX96 = slot0[0] || slot0.sqrtPriceX96;
            const tick = slot0[1] || slot0.tick;

            if (sqrtPriceX96 > 0n) {
                console.log("✅ Pool is initialized!");
                console.log("  sqrtPriceX96:", sqrtPriceX96.toString());
                console.log("  tick:", tick.toString());

                // Calculate price
                const Q96 = 2n ** 96n;
                const sqrtPrice = Number(sqrtPriceX96) / Number(Q96);
                const price = sqrtPrice * sqrtPrice;
                console.log("  Price (KEEP per MON):", price.toFixed(6));
            } else {
                console.log("❌ Pool NOT initialized (sqrtPriceX96 = 0)");
            }

            // Get liquidity
            try {
                const liquidity = await PoolManager.getLiquidity(poolId);
                console.log("  Liquidity:", liquidity.toString());
            } catch (e) {
                console.log("  Liquidity: Could not read (may not be available)");
            }
        } catch (error: any) {
            console.log("❌ Could not read pool state:", error.message);
            console.log("   Pool may not be initialized or getSlot0 not available");
        }
    } catch (error: any) {
        console.error("❌ Error checking pool state:", error.message);
    }

    console.log("\n=== SUMMARY ===");
    console.log("Check the values above to see what's actually on-chain.");
    console.log("Compare these with what the frontend is showing.");
}

main()
    .then(() => process.exit(0))
    .catch((error) => {
        console.error("❌ Script failed:", error);
        process.exitCode = 1;
    });

