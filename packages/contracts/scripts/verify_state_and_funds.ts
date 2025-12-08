import { ethers } from "hardhat";

const MONAD_CHAIN_ID = 143;

async function main() {
    console.log("\n=== 🕵️‍♀️ VERIFYING ON-CHAIN STATE ===\n");

    const [deployer] = await ethers.getSigners();
    console.log("Investigator Account:", deployer.address);

    // 1. Load Contract Addresses
    // Addresses (Hardcoded from typical mainnet config or infer logic)
    // We'll use the ones that seem current
    const TAVERN_KEEPER_ADDRESS = "0x56B81A60Ae343342685911bd97D1331fF4fa2d29"; // Mainnet
    const THE_CELLAR_PROXY = process.env.THE_CELLAR_V3_PROXY || "0x32A920be00dfCE1105De0415ba1d4f06942E9ed0";
    const WMON_ADDRESS = "0x3bd359C1119dA7Da1D913D1C4D2B7c461115433A";

    console.log("Checking Contracts:");
    console.log("• TavernKeeper:", TAVERN_KEEPER_ADDRESS);
    console.log("• TheCellar (Proxy):", THE_CELLAR_PROXY);
    console.log("• WMON:", WMON_ADDRESS);

    // 2. Connect to TavernKeeper
    // We use a generic interface to query minimal data
    const tavernKeeperAbi = [
        "function treasury() view returns (address)",
        "function owner() view returns (address)",
        "function slot0() view returns (uint8,uint16,uint192,uint40,uint256,address,string)"
    ];
    const tavernKeeper = new ethers.Contract(TAVERN_KEEPER_ADDRESS, tavernKeeperAbi, deployer);

    // 3. Connect to TheCellar
    const theCellarAbi = [
        "function potBalanceMON() view returns (uint256)",
        "function potBalanceKEEP() view returns (uint256)",
        "function wmon() view returns (address)",
    ];
    // This might fail if the function doesn't exist on the deployed contract, but view calls are safe-ish
    const theCellar = new ethers.Contract(THE_CELLAR_PROXY, theCellarAbi, deployer);

    // 4. Connect to WMON
    const erc20Abi = [
        "function balanceOf(address) view returns (uint256)"
    ];
    const wmon = new ethers.Contract(WMON_ADDRESS, erc20Abi, deployer);

    // === EXECUTE CHECKS ===

    // A. Check TavernKeeper Configuration
    console.log("\n--- 🍺 TavernKeeper Config ---");
    try {
        const treasury = await tavernKeeper.treasury();
        console.log("Treasury Address:", treasury);

        const owner = await tavernKeeper.owner();
        console.log("Owner Address:", owner);

        if (treasury.toLowerCase() === THE_CELLAR_PROXY.toLowerCase()) {
            console.log("✅ Treasury IS set to The Cellar Proxy.");
        } else if (treasury === "0x0000000000000000000000000000000000000000") {
            console.log("⚠️ Treasury is NOT SET (0x0). Funds fall back to Owner.");
        } else {
            console.log("⚠️ Treasury is set to UNKNOWN address:", treasury);
        }
    } catch (e) {
        console.error("Failed to read TavernKeeper:", e.message);
    }

    // B. Check The Cellar Balances
    console.log("\n--- 🍷 The Cellar Funds ---");
    try {
        // Balances
        const nativeBalance = await ethers.provider.getBalance(THE_CELLAR_PROXY);
        console.log("Native MON Balance (Unwrapped):", ethers.formatEther(nativeBalance), "MON");

        const wmonBalance = await wmon.balanceOf(THE_CELLAR_PROXY);
        console.log("WMON Balance (Wrapped):        ", ethers.formatEther(wmonBalance), "WMON");

        // Internal Accounting
        try {
            const potMon = await theCellar.potBalanceMON();
            console.log("Internal potBalanceMON:        ", ethers.formatEther(potMon));
        } catch (e) {
            console.log("Could not read potBalanceMON (Contract might be old V1/V2 or missing getter)");
        }

        try {
            const potKeep = await theCellar.potBalanceKEEP();
            console.log("Internal potBalanceKEEP:       ", ethers.formatEther(potKeep));
        } catch (e) { }

    } catch (e) {
        console.error("Failed to read Cellar Balances:", e.message);
    }

    // C. Simulation / Logic Check
    console.log("\n--- 🔬 Diagnosis ---");
    const nativeBalance = await ethers.provider.getBalance(THE_CELLAR_PROXY);
    if (nativeBalance > 0n) {
        console.log("🚨 FOUND STUCK FUNDS: The Cellar has Native MON!");
        console.log("   Reason: Contract lacks 'receive' handler to wrap it, OR it accepted it but didn't update potBalanceMON.");
        console.log("   Fix: Upgrade contract to wrap this balance or sweep it.");
    } else {
        console.log("No stuck native MON found.");
    }
}

main().catch((error) => {
    console.error(error);
    process.exit(1);
});
