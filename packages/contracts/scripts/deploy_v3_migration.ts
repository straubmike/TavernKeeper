
import { ethers, upgrades } from "hardhat";

/**
 * MIGRATION SCRIPT: V3
 *
 * 1. Deploys CellarToken (ERC20).
 * 2. Checks/Deploys Uniswap V3 Infrastructure (Factory, Router, PositionManager) if missing.
 * 3. Deploys TheCellarV3 (UUPS Proxy).
 * 4. Configures ownership.
 */

const MONAD_CHAIN_ID = 143;
const MONAD_TESTNET_CHAIN_ID = 10143;

// Addresses
const ADDRESSES: Record<number, { WMON: string; KEEP: string; V3_POSITION_MANAGER: string }> = {
    [MONAD_CHAIN_ID]: { // MAINNET
        WMON: "0x760AfE86e5de5fa0Ee542fc7B7B713e1c5425701",
        KEEP: "0x2D1094F5CED6ba279962f9676d32BE092AFbf82E",
        V3_POSITION_MANAGER: "0x7197e214c0b767cfb76fb734ab638e2c192f4e53"
    },
    [MONAD_TESTNET_CHAIN_ID]: { // TESTNET
        WMON: "0x760AfE86e5de5fa0Ee542fc7B7B713e1c5425701",
        KEEP: "0x1d00b6Dbb2f141cf6A8c1bCf70324ec1907E82B1",
        V3_POSITION_MANAGER: "0x7197e214c0b767cfb76fb734ab638e2c192f4e53"
    }
};

async function main() {
    const [deployer] = await ethers.getSigners();
    const network = await ethers.provider.getNetwork();
    const chainId = Number(network.chainId);

    // Get deployer address from .env
    const deployerAddress = process.env.DEPLOYER_ADDRESS || deployer.address;

    console.log(`=== MIGRATION TO V3 ===`);
    console.log(`Network: ${chainId}`);
    console.log(`Deployer: ${deployer.address}`);
    console.log(`Deployer Address (fees): ${deployerAddress}`);

    let wmonAddress = "";
    let keepAddress = "";
    let positionManagerAddress = "";

    // 1. Setup Infrastructure
    if (ADDRESSES[chainId]) {
        console.log(`Targeting Monad Network (${chainId})`);
        wmonAddress = ADDRESSES[chainId].WMON;
        keepAddress = ADDRESSES[chainId].KEEP;
        positionManagerAddress = ADDRESSES[chainId].V3_POSITION_MANAGER;
    } else {
        console.log("⚠️  Running on Unknown Network (Local/Fork). Using Testnet defaults or Mocks.");
        // Defaults for local testing (Forking Testnet)
        wmonAddress = ADDRESSES[MONAD_TESTNET_CHAIN_ID].WMON;
        keepAddress = ADDRESSES[MONAD_TESTNET_CHAIN_ID].KEEP;
        positionManagerAddress = ADDRESSES[MONAD_TESTNET_CHAIN_ID].V3_POSITION_MANAGER;
    }

    console.log(`WMON: ${wmonAddress}`);
    console.log(`KEEP: ${keepAddress}`);
    console.log(`PositionManager: ${positionManagerAddress}`);

    // 2. Deploy CellarToken
    console.log("Deploying CellarToken...");
    const CellarToken = await ethers.getContractFactory("CellarToken");
    const cellarToken = await CellarToken.deploy();
    await cellarToken.waitForDeployment();
    console.log(`CellarToken: ${await cellarToken.getAddress()}`);

    // 3. Deploy TheCellarV3
    console.log("Deploying TheCellarV3...");
    const TheCellarV3 = await ethers.getContractFactory("TheCellarV3");

    // Args: PositionManager, CellarToken, WMON, KEEP
    // For now using placeholders if addresses not found
    if (!positionManagerAddress) {
        console.warn("⚠️  PositionManager not defined! Deployment will fail or use invalid address.");
        positionManagerAddress = ethers.ZeroAddress;
    }

    const cellar = await upgrades.deployProxy(TheCellarV3, [
        positionManagerAddress,
        await cellarToken.getAddress(),
        wmonAddress,
        keepAddress,
        deployerAddress // Deployer address that receives all swap fees
    ], { kind: 'uups' });

    await cellar.waitForDeployment();
    console.log(`TheCellarV3 Proxy: ${await cellar.getAddress()}`);

    // 4. Transfer Ownership of CellarToken to TheCellarV3
    console.log("Transferring Token Ownership...");
    await cellarToken.transferOwnership(await cellar.getAddress());
    console.log("✅ Ownership Transferred.");

}

main().catch((error) => {
    console.error(error);
    process.exitCode = 1;
});
