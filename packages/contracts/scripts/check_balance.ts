import { ethers } from "hardhat";

const MAINNET_KEEP_TOKEN = "0x2D1094F5CED6ba279962f9676d32BE092AFbf82E";

async function main() {
    const [deployer] = await ethers.getSigners();
    console.log("=== CHECKING BALANCE ON MONAD MAINNET ===");
    console.log("Deployer:", deployer.address);

    const keepToken = await ethers.getContractAt("IERC20", MAINNET_KEEP_TOKEN);
    const balance = await keepToken.balanceOf(deployer.address);

    console.log("KEEP Balance:", ethers.formatEther(balance));

    if (balance < ethers.parseEther("0.3")) {
        console.log("❌ Insufficient Balance (Need 0.3)");
    } else {
        console.log("✅ Balance Sufficient");
    }
}

main().catch((error) => {
    console.error(error);
    process.exitCode = 1;
});
