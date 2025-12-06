/**
 * Quick diagnostic script to test contract reads
 * Run with: npx tsx scripts/test-contract-reads.ts
 */

import { createPublicClient, http, formatEther } from 'viem';
import { CONTRACT_ADDRESSES } from '../lib/contracts/addresses';
import { monad } from '../lib/chains';

async function main() {
    console.log('=== CONTRACT READ DIAGNOSTIC ===\n');

    console.log('Network Configuration:');
    console.log('  Chain ID:', monad.id);
    console.log('  Chain Name:', monad.name);
    console.log('  RPC URL:', monad.rpcUrls.default.http[0]);
    console.log('');

    const publicClient = createPublicClient({
        chain: monad,
        transport: http(),
    });

    console.log('Contract Addresses:');
    console.log('  THE_CELLAR:', CONTRACT_ADDRESSES.THE_CELLAR);
    console.log('  KEEP_TOKEN:', CONTRACT_ADDRESSES.KEEP_TOKEN);
    console.log('  POOL_MANAGER:', CONTRACT_ADDRESSES.POOL_MANAGER);
    console.log('');

    // Test 1: Read potBalance
    console.log('Test 1: Reading potBalance...');
    try {
        const potBalance = await publicClient.readContract({
            address: CONTRACT_ADDRESSES.THE_CELLAR,
            abi: [
                {
                    inputs: [],
                    name: 'potBalance',
                    outputs: [{ name: '', type: 'uint256' }],
                    stateMutability: 'view',
                    type: 'function',
                },
            ],
            functionName: 'potBalance',
            args: [],
        }) as bigint;
        console.log('  ✅ potBalance:', formatEther(potBalance), 'MON');
    } catch (error: any) {
        console.error('  ❌ Error:', error.message);
    }

    // Test 2: Read slot0
    console.log('\nTest 2: Reading slot0...');
    try {
        const slot0 = await publicClient.readContract({
            address: CONTRACT_ADDRESSES.THE_CELLAR,
            abi: [
                {
                    inputs: [],
                    name: 'slot0',
                    outputs: [
                        {
                            components: [
                                { name: 'locked', type: 'uint8' },
                                { name: 'epochId', type: 'uint16' },
                                { name: 'initPrice', type: 'uint192' },
                                { name: 'startTime', type: 'uint40' },
                            ],
                            internalType: 'struct CellarHook.Slot0',
                            name: '',
                            type: 'tuple',
                        },
                    ],
                    stateMutability: 'view',
                    type: 'function',
                },
            ],
            functionName: 'slot0',
            args: [],
        }) as any;
        console.log('  ✅ slot0:', {
            epochId: slot0.epochId.toString(),
            initPrice: formatEther(slot0.initPrice),
            startTime: slot0.startTime.toString(),
        });
    } catch (error: any) {
        console.error('  ❌ Error:', error.message);
    }

    // Test 3: Read balanceOf for a test address
    console.log('\nTest 3: Reading balanceOf (test with zero address)...');
    try {
        const balance = await publicClient.readContract({
            address: CONTRACT_ADDRESSES.THE_CELLAR,
            abi: [
                {
                    inputs: [{ name: 'account', type: 'address' }],
                    name: 'balanceOf',
                    outputs: [{ name: '', type: 'uint256' }],
                    stateMutability: 'view',
                    type: 'function',
                },
            ],
            functionName: 'balanceOf',
            args: ['0x0000000000000000000000000000000000000000' as `0x${string}`],
        }) as bigint;
        console.log('  ✅ balanceOf(0x0):', formatEther(balance), 'LP');
    } catch (error: any) {
        console.error('  ❌ Error:', error.message);
    }

    // Test 4: Read getAuctionPrice
    console.log('\nTest 4: Reading getAuctionPrice...');
    try {
        const price = await publicClient.readContract({
            address: CONTRACT_ADDRESSES.THE_CELLAR,
            abi: [
                {
                    inputs: [],
                    name: 'getAuctionPrice',
                    outputs: [{ name: '', type: 'uint256' }],
                    stateMutability: 'view',
                    type: 'function',
                },
            ],
            functionName: 'getAuctionPrice',
            args: [],
        }) as bigint;
        console.log('  ✅ getAuctionPrice:', formatEther(price), 'LP');
    } catch (error: any) {
        console.error('  ❌ Error:', error.message);
    }

    // Test 5: Check pool state via PoolManager
    console.log('\nTest 5: Checking pool state...');
    try {
        // Calculate pool ID
        const poolKey = {
            currency0: '0x0000000000000000000000000000000000000000' as `0x${string}`,
            currency1: CONTRACT_ADDRESSES.KEEP_TOKEN,
            fee: 10000,
            tickSpacing: 200,
            hooks: CONTRACT_ADDRESSES.THE_CELLAR,
        };

        const { keccak256, encodeAbiParameters } = await import('viem');
        const encoded = encodeAbiParameters(
            [
                { type: 'address', name: 'currency0' },
                { type: 'address', name: 'currency1' },
                { type: 'uint24', name: 'fee' },
                { type: 'int24', name: 'tickSpacing' },
                { type: 'address', name: 'hooks' },
            ],
            [
                poolKey.currency0,
                poolKey.currency1,
                poolKey.fee,
                poolKey.tickSpacing,
                poolKey.hooks,
            ]
        );
        const poolId = keccak256(encoded);

        const slot0Result = await publicClient.readContract({
            address: CONTRACT_ADDRESSES.POOL_MANAGER,
            abi: [
                {
                    inputs: [{ name: 'id', type: 'bytes32' }],
                    name: 'getSlot0',
                    outputs: [
                        { name: 'sqrtPriceX96', type: 'uint160' },
                        { name: 'tick', type: 'int24' },
                        { name: 'protocolFee', type: 'uint24' },
                        { name: 'lpFee', type: 'uint24' },
                    ],
                    stateMutability: 'view',
                    type: 'function',
                },
            ],
            functionName: 'getSlot0',
            args: [poolId],
        }) as any;

        if (slot0Result && slot0Result[0] && slot0Result[0] > 0n) {
            console.log('  ✅ Pool is initialized!');
            console.log('    sqrtPriceX96:', slot0Result[0].toString());
            console.log('    tick:', slot0Result[1].toString());
        } else {
            console.log('  ⚠️  Pool not initialized (sqrtPriceX96 = 0)');
        }
    } catch (error: any) {
        console.error('  ❌ Error:', error.message);
        if (error.message.includes('execution reverted')) {
            console.error('    This might mean the pool is not initialized or getSlot0 is not available on PoolManager');
        }
    }

    console.log('\n=== DIAGNOSTIC COMPLETE ===');
}

main().catch(console.error);

