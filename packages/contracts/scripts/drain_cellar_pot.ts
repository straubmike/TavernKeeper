import { ethers } from "hardhat";
import * as dotenv from "dotenv";

dotenv.config({ path: "../../.env" });

/**
 * Emergency script to drain the cellar pot before upgrading
 * This bypasses the raid function and directly transfers pot balances
 *
 * Usage:
 *   npx hardhat run scripts/drain_cellar_pot.ts --network monad
 */

// Mainnet TheCellarV3 address
const THE_CELLAR_V3 = "0x32A920be00dfCE1105De0415ba1d4f06942E9ed0";

async function main() {
    const [deployer] = await ethers.getSigners();
    console.log("=== DRAINING CELLAR POT ===");
    console.log("Deployer:", deployer.address);
    console.log("TheCellarV3:", THE_CELLAR_V3);
    console.log();

    // Get contract instance
    const cellar = await ethers.getContractAt("TheCellarV3", THE_CELLAR_V3);

    // Check pot balances
    const potBalanceMON = await cellar.potBalanceMON();
    const potBalanceKEEP = await cellar.potBalanceKEEP();
    const wmon = await cellar.wmon();
    const keepToken = await cellar.keepToken();

    console.log("--- Current Pot Balances ---");
    console.log("Pot MON:", ethers.formatEther(potBalanceMON), "MON");
    console.log("Pot KEEP:", ethers.formatEther(potBalanceKEEP), "KEEP");
    console.log("WMON Address:", wmon);
    console.log("KEEP Address:", keepToken);
    console.log();

    if (potBalanceMON === 0n && potBalanceKEEP === 0n) {
        console.log("⚠️  Pot is already empty!");
        return;
    }

    // Check if we can call raid (need CLP tokens)
    const cellarTokenAddress = await cellar.cellarToken();
    const cellarToken = await ethers.getContractAt("CellarToken", cellarTokenAddress);

    // Check deployer's CLP balance
    const clpBalance = await cellarToken.balanceOf(deployer.address);
    console.log("Your CLP Balance:", ethers.formatEther(clpBalance), "CLP");
    console.log();

    if (clpBalance === 0n) {
        console.log("❌ You don't have any CLP tokens to raid with!");
        console.log("   Options:");
        console.log("   1. Get CLP tokens by adding liquidity first");
        console.log("   2. Use a different account that has CLP tokens");
        console.log("   3. If you're the owner, we can try to add an emergency drain function");
        return;
    }

    // Try to raid with available CLP
    const raidAmount = clpBalance > ethers.parseEther("1.05") ? ethers.parseEther("1.05") : clpBalance;
    console.log("Attempting to raid with:", ethers.formatEther(raidAmount), "CLP");
    console.log();

    try {
        // Check allowance
        const allowance = await cellarToken.allowance(deployer.address, THE_CELLAR_V3);
        if (allowance < raidAmount) {
            console.log("Approving CLP tokens...");
            const approveTx = await cellarToken.approve(THE_CELLAR_V3, raidAmount);
            await approveTx.wait();
            console.log("✅ CLP Approved");
        }

        // Try to call raid
        console.log("Calling raid()...");
        const raidTx = await cellar.raid(raidAmount);
        console.log("Transaction hash:", raidTx.hash);
        await raidTx.wait();
        console.log("✅ Raid successful!");

        // Check balances after
        const newPotMON = await cellar.potBalanceMON();
        const newPotKEEP = await cellar.potBalanceKEEP();
        console.log();
        console.log("--- Pot Balances After Raid ---");
        console.log("Pot MON:", ethers.formatEther(newPotMON), "MON");
        console.log("Pot KEEP:", ethers.formatEther(newPotKEEP), "KEEP");

    } catch (error: any) {
        console.error("❌ Raid failed:", error.message);

        // Check if it's a harvest issue
        if (error.message.includes("Deployer address not set") || error.message.includes("harvest")) {
            console.log();
            console.log("⚠️  The issue is that harvest() requires deployerAddress to be set.");
            console.log("   The current contract will revert on harvest() if deployerAddress is 0x0.");
            console.log();
            console.log("   Solutions:");
            console.log("   1. Upgrade the contract first (with the fix that skips harvest if deployerAddress is 0)");
            console.log("   2. Set deployerAddress on the current contract (if you have owner access)");
            console.log("   3. Manually collect fees and transfer pot (requires owner access)");
        }

        // Check if deployerAddress is set
        try {
            const deployerAddress = await cellar.deployerAddress();
            console.log("Current deployerAddress:", deployerAddress);
            if (deployerAddress === ethers.ZeroAddress) {
                console.log("⚠️  deployerAddress is not set (0x0)");
                console.log("   This is why harvest() fails!");
            }
        } catch (e) {
            console.log("Could not read deployerAddress (might be old contract version)");
        }

        // Try emergency drain if owner
        console.log();
        console.log("--- Trying Emergency Drain (Owner Only) ---");
        try {
            const owner = await cellar.owner();
            console.log("Contract Owner:", owner);
            console.log("Your Address:", deployer.address);

            if (owner.toLowerCase() === deployer.address.toLowerCase()) {
                console.log("✅ You are the owner! Trying emergencyDrainPot()...");
                const drainTx = await cellar.emergencyDrainPot(deployer.address);
                console.log("Transaction hash:", drainTx.hash);
                await drainTx.wait();
                console.log("✅ Emergency drain successful!");

                const newPotMON = await cellar.potBalanceMON();
                const newPotKEEP = await cellar.potBalanceKEEP();
                console.log("Pot MON after drain:", ethers.formatEther(newPotMON));
                console.log("Pot KEEP after drain:", ethers.formatEther(newPotKEEP));
            } else {
                console.log("❌ You are not the owner. Cannot use emergency drain.");
                console.log("   Need owner to call emergencyDrainPot() or upgrade contract first.");
            }
        } catch (e: any) {
            if (e.message.includes("emergencyDrainPot")) {
                console.log("⚠️  emergencyDrainPot() function doesn't exist on current contract.");
                console.log("   You need to upgrade the contract first to add this function.");
            } else {
                console.error("Error trying emergency drain:", e.message);
            }
        }
    }
}

main().catch((error) => {
    console.error(error);
    process.exitCode = 1;
});

