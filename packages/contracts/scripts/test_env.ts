import { ethers, upgrades } from "hardhat";

async function main() {
    console.log("Environment works!");
    console.log("Upgrades present:", !!upgrades);
    const [deployer] = await ethers.getSigners();
    console.log("Deployer:", deployer.address);
}

main().catch((error) => {
    console.error(error);
    process.exit(1);
});
