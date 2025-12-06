
import { createPublicClient, http, parseAbi, formatEther } from 'viem';
import { monad } from '../lib/chains';
import { CONTRACT_ADDRESSES } from '../lib/contracts/addresses';
import * as dotenv from 'dotenv';
import path from 'path';

// Load environment variables
dotenv.config({ path: path.resolve(__dirname, '../.env') });

const rpcUrl = process.env.NEXT_PUBLIC_MONAD_RPC_URL || 'https://testnet-rpc.monad.xyz';
const POOL_MANAGER = CONTRACT_ADDRESSES.POOL_MANAGER;
const KEEP_TOKEN = CONTRACT_ADDRESSES.KEEP_TOKEN;
// Hook address is key!
const HOOK_ADDRESS = CONTRACT_ADDRESSES.THE_CELLAR;

console.log('Checking Pool State on Monad Testnet...');
console.log('RPC:', rpcUrl);
console.log('PoolManager:', POOL_MANAGER);
console.log('KeepToken:', KEEP_TOKEN);
console.log('Hook (The Cellar):', HOOK_ADDRESS);

async function main() {
    const publicClient = createPublicClient({
        chain: monad,
        transport: http(rpcUrl),
    });

    // 1. Check Token Balances of PoolManager (Liquidity Check)
    const keepBalance = await publicClient.readContract({
        address: KEEP_TOKEN,
        abi: parseAbi(['function balanceOf(address) view returns (uint256)']),
        functionName: 'balanceOf',
        args: [POOL_MANAGER],
    });

    const monBalance = await publicClient.getBalance({ address: POOL_MANAGER });

    console.log('\n--- Liquidity (Held by PoolManager) ---');
    console.log(`MON Balance: ${formatEther(monBalance)} MON`);
    console.log(`KEEP Balance: ${formatEther(keepBalance)} KEEP`);

    // 2. Check Pool Initialization (Slot0)
    // We need to calculate the PoolId first.
    // PoolKey = { currency0: address(0), currency1: KEEP, fee: 10000, tickSpacing: 200, hooks: HOOK }
    // Since currency0 < currency1 is usually required for canonical ordering, but here MON=address(0) is strictly less than any token address.

    const poolKey = {
        currency0: '0x0000000000000000000000000000000000000000',
        currency1: KEEP_TOKEN,
        fee: 10000, // 1%
        tickSpacing: 200,
        hooks: HOOK_ADDRESS
    };

    // Calculate Pool ID manually or use a helper if available. 
    // Simplified: we will rely on observing the liquidity above. If balances are 0, pool might be empty or dead.

    if (monBalance === 0n && keepBalance === 0n) {
        console.log('\n⚠️ WARNING: PoolManager has ZERO assets. The pool is likely empty or not initialized with liquidity.');
    } else {
        console.log('\n✅ PoolManager has assets. Pool likely exists.');

        // Calculate implied price if simple V2-style (not accurate for V4 CL but gives idea)
        if (monBalance > 0n) {
            const impliedPrice = Number(formatEther(keepBalance)) / Number(formatEther(monBalance));
            console.log(`Implied Ratio V2-style (KEEP/MON): ${impliedPrice.toFixed(4)}`);
        }
    }

    // 3. Check Account Balance (optional, if passed arg)
    const testAddress = process.argv[2];
    if (testAddress) {
        console.log(`\n--- Checking Address: ${testAddress} ---`);
        const mon = await publicClient.getBalance({ address: testAddress as `0x${string}` });
        const keep = await publicClient.readContract({
            address: KEEP_TOKEN,
            abi: parseAbi(['function balanceOf(address) view returns (uint256)']),
            functionName: 'balanceOf',
            args: [testAddress as `0x${string}`],
        });
        console.log(`MON: ${formatEther(mon)}`);
        console.log(`KEEP: ${formatEther(keep)}`);
    }
}

main().catch(console.error);
