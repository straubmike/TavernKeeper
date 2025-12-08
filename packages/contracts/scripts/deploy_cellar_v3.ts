console.log("Script starting...");
import { ethers, upgrades } from "hardhat";
// import { updateDeploymentTracker } from "./updateDeploymentTracker";
// import { updateFrontendAddresses } from "./updateFrontend";

const MONAD_CHAIN_ID = 143;
const MONAD_TESTNET_CHAIN_ID = 10143;

async function main() {
    console.log("Environment works inside deployment script!");
    const [deployer] = await ethers.getSigners();
    const network = await ethers.provider.getNetwork();
    const chainId = Number(network.chainId);

    console.log("=== DEPLOYING THE CELLAR V3 ===");
    console.log("Network:", chainId);
    console.log("Deployer:", deployer.address);

    const deployerAddress = process.env.DEPLOYER_ADDRESS || deployer.address;
    console.log("\n--- Address Configuration ---");
    console.log("Deployer Wallet (receives all swap fees):", deployerAddress);

    if (!deployerAddress || deployerAddress === "0x0000000000000000000000000000000000000000") {
        console.error("❌ DEPLOYER_ADDRESS not set in .env file!");
        process.exit(1);
    }

    let wmonAddress = "";
    let keepAddress = "";
    let positionManagerAddress = "";

    if (chainId === MONAD_CHAIN_ID) {
        console.log("Using MAINNET addresses");
        wmonAddress = "0x3bd359C1119dA7Da1D913D1C4D2B7c461115433A";
        keepAddress = "0x2D1094F5CED6ba279962f9676d32BE092AFbf82E";
        positionManagerAddress = "0x7197e214c0b767cfb76fb734ab638e2c192f4e53";
    } else {
        console.log("Using TESTNET/Other addresses");
        wmonAddress = "0x3bd359C1119dA7Da1D913D1C4D2B7c461115433A"; // Testnet WMON?
        keepAddress = "0x1d00b6Dbb2f141cf6A8c1bCf70324ec1907E82B1";
        positionManagerAddress = "0x7197e214c0b767cfb76fb734ab638e2c192f4e53";
    }

    console.log("WMON:", wmonAddress);
    console.log("KEEP:", keepAddress);
    console.log("V3 Position Manager:", positionManagerAddress);

    // Check for existing deployment
    const existingCellar = process.env.THE_CELLAR_V3_PROXY;
    const isUpgrade = existingCellar && existingCellar !== "0x0000000000000000000000000000000000000000";

    // 1. Deploy CellarToken (if not exists or new deployment)
    console.log("\n--- Deploying CellarToken ---");
    const CellarToken = await ethers.getContractFactory("CellarToken");
    let cellarTokenAddress: string;

    const existingCellarToken = process.env.CELLAR_TOKEN;
    if (existingCellarToken && existingCellarToken !== "0x0000000000000000000000000000000000000000" && isUpgrade) {
        console.log("Using existing CellarToken:", existingCellarToken);
        cellarTokenAddress = existingCellarToken;
    } else {
        const cellarToken = await CellarToken.deploy();
        await cellarToken.waitForDeployment();
        cellarTokenAddress = await cellarToken.getAddress();
        console.log("✅ CellarToken deployed:", cellarTokenAddress);
    }

    // 2. Deploy or Upgrade TheCellarV3
    console.log("\n--- Deploying/Upgrading TheCellarV3 ---");
    const TheCellarV3 = await ethers.getContractFactory("TheCellarV3");
    let cellarProxyAddress: string;
    let cellarImplAddress: string;

    if (isUpgrade) {
        console.log("Upgrading existing proxy:", existingCellar);
        // Force re-import of upgrades to be safe
        const cellar = await upgrades.upgradeProxy(existingCellar, TheCellarV3);
        await cellar.waitForDeployment();
        cellarProxyAddress = await cellar.getAddress();
        cellarImplAddress = await upgrades.erc1967.getImplementationAddress(cellarProxyAddress);
        console.log("✅ TheCellarV3 upgraded!");
        console.log("Proxy:", cellarProxyAddress);
        console.log("Implementation:", cellarImplAddress);
    } else {
        console.log("Deploying new TheCellarV3 proxy...");
        const cellar = await upgrades.deployProxy(
            TheCellarV3,
            [
                positionManagerAddress,
                cellarTokenAddress,
                wmonAddress,
                keepAddress,
                deployerAddress
            ],
            { kind: 'uups', initializer: 'initialize' }
        );
        await cellar.waitForDeployment();
        cellarProxyAddress = await cellar.getAddress();
        cellarImplAddress = await upgrades.erc1967.getImplementationAddress(cellarProxyAddress);
        console.log("✅ TheCellarV3 deployed!");
        console.log("Proxy:", cellarProxyAddress);
        console.log("Implementation:", cellarImplAddress);

        // Transfer CellarToken ownership to TheCellarV3
        console.log("\n--- Transferring CellarToken Ownership ---");
        const cellarToken = CellarToken.attach(cellarTokenAddress);
        const currentOwner = await cellarToken.owner();
        if (currentOwner.toLowerCase() !== cellarProxyAddress.toLowerCase()) {
            console.log("Transferring ownership to TheCellarV3...");
            const tx = await cellarToken.transferOwnership(cellarProxyAddress);
            await tx.wait();
            console.log("✅ Ownership transferred!");
        } else {
            console.log("✅ CellarToken already owned by TheCellarV3");
        }
    }

    console.log("\n--- Verification ---");
    console.log("Deployer checked:", deployerAddress);
    console.log("Manual verification required on explorer.");
}

main().catch((error) => {
    console.error(error);
    process.exit(1);
});
