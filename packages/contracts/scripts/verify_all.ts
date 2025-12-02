import { run } from "hardhat";

/**
 * Verification Script
 * 
 * This script will verify all deployed contracts on the Monad Explorer.
 * addresses will be populated after deployment.
 */

// Placeholder addresses - WILL BE UPDATED AFTER DEPLOYMENT
const ADDRESSES = {
    ERC6551_REGISTRY: "0xE74D0b9372e81037e11B4DEEe27D063C24060Ea9",
    POOL_MANAGER: "0x27e98f6A0D3315F9f3ECDaFE0187a7637F41c7c2",
    KEEP_TOKEN_IMPL: "0x848750141b51C6bF0db2549b7CD6637866A6c635",
    CELLAR_HOOK_IMPL: "0x7C1Dce56106DB26fB117966AEc66c86d5933B2D6",
    INVENTORY_IMPL: "0x54F3f6b654176914452380C9270DFB45F2985e8B",
    ADVENTURER_IMPL: "0x71fb2B063569dD5B91c6241A9d6A41536894835A",
    TAVERNKEEPER_IMPL: "0xA33dF761f3A72eDe5D38310a17fc8CF70798e0Be",
    DUNGEON_GATEKEEPER_IMPL: "0x4CAC1ea1aa8ba7b7C25930CCA224AC166073DF13",
    CELLAR_ZAP_IMPL: "0x0aE0878FB0CA0D9d64e08B861371f69C944ae418",
    // For Managers, we will use proxies and let Hardhat Verify handle it or find impl
    TAVERN_REGULARS_PROXY: "0x9f455Ad562e080CC745f9E97c469a86E1bBF8db8",
    TOWN_POSSE_PROXY: "0xE46592D8185975888b4A301DBD9b24A49933CC7D",
};

// Constructor Arguments (if any) for Implementations
// Most UUPS implementations have no constructor args (they use initializers)
// But some might have immutable variables in constructor (e.g. PoolManager?)
const ARGS = {
    POOL_MANAGER: [], // Update if needed
};

async function main() {
    console.log("=== VERIFYING CONTRACTS ===");

    const verify = async (name: string, address: string, args: any[] = []) => {
        if (!address || address === "") {
            console.log(`Skipping ${name} (no address)`);
            return;
        }
        console.log(`Verifying ${name} at ${address}...`);
        try {
            await run("verify:verify", {
                address: address,
                constructorArguments: args,
            });
            console.log(`✅ ${name} verified!`);
        } catch (error: any) {
            if (error.message.includes("Already Verified")) {
                console.log(`⚠️  ${name} already verified.`);
            } else {
                console.error(`❌ Failed to verify ${name}:`, error.message);
            }
        }
    };

    await verify("ERC6551 Registry", ADDRESSES.ERC6551_REGISTRY);
    await verify("PoolManager", ADDRESSES.POOL_MANAGER, ["0xd515674a7fe63dfdfd43fb5647e8b04eefcedcaa"]);
    await verify("KeepToken Impl", ADDRESSES.KEEP_TOKEN_IMPL);
    await verify("CellarHook Impl", ADDRESSES.CELLAR_HOOK_IMPL);
    await verify("Inventory Impl", ADDRESSES.INVENTORY_IMPL);
    await verify("Adventurer Impl", ADDRESSES.ADVENTURER_IMPL);
    await verify("TavernKeeper Impl", ADDRESSES.TAVERNKEEPER_IMPL);
    await verify("DungeonGatekeeper Impl", ADDRESSES.DUNGEON_GATEKEEPER_IMPL);
    await verify("CellarZapV4 Impl", ADDRESSES.CELLAR_ZAP_IMPL);

    // For Managers, we try to verify the proxy which often works if etherscan detects it
    // Or we can try to find the implementation.
    // Let's try verifying the proxy address directly, often Hardhat Verify is smart enough
    // or it will ask to verify the implementation.
    await verify("TavernRegularsManager Proxy", ADDRESSES.TAVERN_REGULARS_PROXY);
    await verify("TownPosseManager Proxy", ADDRESSES.TOWN_POSSE_PROXY);

    console.log("\n=== VERIFICATION COMPLETE ===");
}

main().catch((error) => {
    console.error(error);
    process.exitCode = 1;
});
