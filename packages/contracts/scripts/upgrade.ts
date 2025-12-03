import { ethers, upgrades } from "hardhat";

/**
 * Upgrade script for UUPS upgradeable contracts
 *
 * Usage:
 *   npx hardhat run scripts/upgrade.ts --network monad
 *
 * Set these environment variables:
 *   CONTRACT_NAME=KeepToken (or Inventory, Adventurer, TavernKeeper)
 *   PROXY_ADDRESS=0x... (proxy address to upgrade)
 */

async function main() {
    const contractName = process.env.CONTRACT_NAME;
    const proxyAddress = process.env.PROXY_ADDRESS;

    if (!contractName || !proxyAddress) {
        console.error("Error: CONTRACT_NAME and PROXY_ADDRESS must be set");
        console.error("Example: CONTRACT_NAME=KeepToken PROXY_ADDRESS=0x... npx hardhat run scripts/upgrade.ts --network monad");
        process.exit(1);
    }

    const [deployer] = await ethers.getSigners();
    console.log("Upgrading contract with account:", deployer.address);
    console.log("Contract:", contractName);
    console.log("Proxy address:", proxyAddress);

    // Get current implementation
    const currentImpl = await upgrades.erc1967.getImplementationAddress(proxyAddress);
    console.log("Current implementation:", currentImpl);

    // Deploy new implementation
    console.log("\nDeploying new implementation...");
    const ContractFactory = await ethers.getContractFactory(contractName);
    const upgraded = await upgrades.upgradeProxy(proxyAddress, ContractFactory);
    await upgraded.waitForDeployment();

    // Get new implementation
    const newImpl = await upgrades.erc1967.getImplementationAddress(proxyAddress);
    console.log("New implementation:", newImpl);
    console.log("Proxy address (unchanged):", proxyAddress);

    console.log("\n=== Upgrade Complete ===");
    console.log("Contract:", contractName);
    console.log("Proxy:", proxyAddress);
    console.log("Old Implementation:", currentImpl);
    console.log("New Implementation:", newImpl);

    console.log("\n=== DOCUMENTATION UPDATE REQUIRED ===");
    console.log("Run this command to update FIRSTDEPLOYMENT.md (PowerShell):");
    const reason = contractName === "CellarHook" 
        ? "Added 1:3 MON:KEEP ratio validation to addLiquidity"
        : "Added updateTokenURI function";
    console.log(`  $env:CONTRACT_NAME="${contractName}"; $env:OLD_IMPL="${currentImpl}"; $env:NEW_IMPL="${newImpl}"; $env:REASON="${reason}"; npx hardhat run scripts/update_deployment_docs.ts`);
    console.log("\nOr manually update FIRSTDEPLOYMENT.md Upgrade History section with:");
    console.log(`  - Contract: ${contractName}`);
    console.log(`  - Proxy: ${proxyAddress}`);
    console.log(`  - Old Impl: ${currentImpl}`);
    console.log(`  - New Impl: ${newImpl}`);
}

main().catch((error) => {
    console.error(error);
    process.exitCode = 1;
});

