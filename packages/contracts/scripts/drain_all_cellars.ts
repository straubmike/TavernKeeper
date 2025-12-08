import { ethers } from "hardhat";
import * as dotenv from "dotenv";

dotenv.config({ path: "../../.env" });

/**
 * Drain ALL cellar contracts (TheCellarV3 and old CellarHook contracts)
 *
 * Usage:
 *   npx hardhat run scripts/drain_all_cellars.ts --network monad
 */

const CELLAR_ADDRESSES = {
    THE_CELLAR_V3: "0x32A920be00dfCE1105De0415ba1d4f06942E9ed0",
    OLD_CELLAR_HOOK: "0xe71CAf7162dd81a4A9C0c6BD25ED02C26F492DC0",
    CELLAR_HOOK_MAINNET: "0x6c7612F44B71E5E6E2bA0FEa799A23786A537755",
};

const WMON = "0x3bd359C1119dA7Da1D913D1C4D2B7c461115433A";
const KEEP = "0x2D1094F5CED6ba279962f9676d32BE092AFbf82E";

async function drainCellarV3(address: string) {
    console.log(`\n--- Draining TheCellarV3 (${address}) ---`);
    try {
        const cellar = await ethers.getContractAt("TheCellarV3", address);

        const [potMON, potKEEP, owner] = await Promise.all([
            cellar.potBalanceMON(),
            cellar.potBalanceKEEP(),
            cellar.owner(),
        ]);

        console.log(`Pot MON: ${ethers.formatEther(potMON)} MON`);
        console.log(`Pot KEEP: ${ethers.formatEther(potKEEP)} KEEP`);
        console.log(`Owner: ${owner}`);

        if (potMON === 0n && potKEEP === 0n) {
            console.log("✅ Already empty");
            return { drained: false, amount: 0n };
        }

        const [deployer] = await ethers.getSigners();
        if (owner.toLowerCase() !== deployer.address.toLowerCase()) {
            console.log("❌ You are not the owner. Cannot drain.");
            return { drained: false, amount: 0n };
        }

        // Try emergency drain first
        try {
            console.log("Trying emergencyDrainPot()...");
            const tx = await cellar.emergencyDrainPot(deployer.address);
            await tx.wait();
            console.log("✅ Emergency drain successful!");
            return { drained: true, amount: potMON };
        } catch (e: any) {
            if (e.message.includes("emergencyDrainPot")) {
                console.log("⚠️  emergencyDrainPot() doesn't exist. Need CLP to raid.");
                // Check CLP balance
                const cellarToken = await cellar.cellarToken();
                const clp = await ethers.getContractAt("CellarToken", cellarToken);
                const clpBalance = await clp.balanceOf(deployer.address);
                console.log(`Your CLP Balance: ${ethers.formatEther(clpBalance)} CLP`);

                if (clpBalance > 0n) {
                    const raidAmount = clpBalance > ethers.parseEther("1.05") ? ethers.parseEther("1.05") : clpBalance;
                    const allowance = await clp.allowance(deployer.address, address);
                    if (allowance < raidAmount) {
                        await (await clp.approve(address, raidAmount)).wait();
                    }
                    const raidTx = await cellar.raid(raidAmount);
                    await raidTx.wait();
                    console.log("✅ Raid successful!");
                    return { drained: true, amount: potMON };
                } else {
                    console.log("❌ No CLP tokens to raid with");
                    return { drained: false, amount: potMON };
                }
            }
            throw e;
        }
    } catch (error: any) {
        console.error(`❌ Error: ${error.message}`);
        return { drained: false, amount: 0n };
    }
}

async function drainCellarHook(address: string) {
    console.log(`\n--- Draining CellarHook (${address}) ---`);
    try {
        // CellarHook uses different ABI - need to check what functions it has
        const hookABI = [
            "function potBalance() external view returns (uint256)",
            "function owner() external view returns (address)",
            "function balanceOf(address) external view returns (uint256)",
            "function raid(uint256 maxPaymentAmount) external returns (uint256)",
            "function MON() external view returns (address)",
        ];

        const hook = await ethers.getContractAt(hookABI, address);

        const [potBalance, owner, monCurrency] = await Promise.all([
            hook.potBalance().catch(() => 0n),
            hook.owner().catch(() => ethers.ZeroAddress),
            hook.MON().catch(() => ethers.ZeroAddress),
        ]);

        console.log(`Pot Balance: ${ethers.formatEther(potBalance)} MON`);
        console.log(`Owner: ${owner}`);
        console.log(`MON Currency: ${monCurrency}`);

        if (potBalance === 0n) {
            console.log("✅ Already empty");
            return { drained: false, amount: 0n };
        }

        const [deployer] = await ethers.getSigners();

        // Check if we have LP tokens to raid with
        const lpBalance = await hook.balanceOf(deployer.address);
        console.log(`Your LP Balance: ${ethers.formatEther(lpBalance)} LP`);

        if (lpBalance > 0n) {
            // Try to raid with LP tokens
            try {
                console.log("Attempting to raid with LP tokens...");
                // Need to calculate current price - for now try with a large amount
                const maxPayment = lpBalance;
                const tx = await hook.raid(maxPayment);
                await tx.wait();
                console.log("✅ Raid successful!");
                return { drained: true, amount: potBalance };
            } catch (e: any) {
                console.log(`⚠️  Raid failed: ${e.message}`);
                // Continue to try owner methods
            }
        }

        // If owner, try owner-only methods
        if (owner.toLowerCase() === deployer.address.toLowerCase()) {
            console.log("✅ You are the owner. Checking for owner-only withdraw functions...");

            // Check if contract has WMON balance that we can transfer
            const wmon = await ethers.getContractAt("IERC20", WMON);
            const wmonBalance = await wmon.balanceOf(address);
            console.log(`Contract WMON balance: ${ethers.formatEther(wmonBalance)} MON`);

            if (wmonBalance > 0n && wmonBalance >= potBalance) {
                console.log("⚠️  Contract has WMON but no standard withdraw function.");
                console.log("   You may need to upgrade the contract to add a withdraw function.");
                console.log("   Or the potBalance might be in native MON (if MON is address(0))");

                // If MON is native (address(0)), check native balance
                if (monCurrency === ethers.ZeroAddress) {
                    const nativeBalance = await ethers.provider.getBalance(address);
                    console.log(`Contract native balance: ${ethers.formatEther(nativeBalance)} MON`);
                    if (nativeBalance >= potBalance) {
                        console.log("⚠️  Funds are in native MON but no withdraw function exists.");
                        console.log("   Need to add emergency withdraw function via upgrade.");
                    }
                }
            }

            return { drained: false, amount: potBalance };
        } else {
            console.log("❌ You are not the owner and have no LP tokens. Cannot drain.");
            return { drained: false, amount: potBalance };
        }
    } catch (error: any) {
        console.error(`❌ Error: ${error.message}`);
        return { drained: false, amount: 0n };
    }
}

async function main() {
    const [deployer] = await ethers.getSigners();
    console.log("=== DRAINING ALL CELLAR CONTRACTS ===");
    console.log("Deployer:", deployer.address);
    console.log();

    const results: any[] = [];

    // Drain TheCellarV3
    const v3Result = await drainCellarV3(CELLAR_ADDRESSES.THE_CELLAR_V3);
    results.push({ address: CELLAR_ADDRESSES.THE_CELLAR_V3, ...v3Result });

    // Drain Old CellarHook
    const oldHookResult = await drainCellarHook(CELLAR_ADDRESSES.OLD_CELLAR_HOOK);
    results.push({ address: CELLAR_ADDRESSES.OLD_CELLAR_HOOK, ...oldHookResult });

    // Drain CellarHook Mainnet
    const hookResult = await drainCellarHook(CELLAR_ADDRESSES.CELLAR_HOOK_MAINNET);
    results.push({ address: CELLAR_ADDRESSES.CELLAR_HOOK_MAINNET, ...hookResult });

    // Summary
    console.log("\n=== DRAIN SUMMARY ===");
    const totalDrained = results.filter(r => r.drained).reduce((sum, r) => sum + r.amount, 0n);
    const stillHasFunds = results.filter(r => !r.drained && r.amount > 0n);

    console.log(`Total Drained: ${ethers.formatEther(totalDrained)} MON`);

    if (stillHasFunds.length > 0) {
        console.log(`\n⚠️  Contracts still with funds:`);
        stillHasFunds.forEach(r => {
            console.log(`  - ${r.address}: ${ethers.formatEther(r.amount)} MON`);
        });
    } else {
        console.log("\n✅ All cellars drained!");
    }
}

main().catch((error) => {
    console.error(error);
    process.exitCode = 1;
});

