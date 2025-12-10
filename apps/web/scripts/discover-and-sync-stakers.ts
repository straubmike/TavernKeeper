/**
 * Discover and Sync All Stakers Script
 *
 * Discovers all stakers from on-chain Staked events and syncs them to Supabase.
 * This is useful for initial population of the stakers table.
 *
 * Usage:
 *   npx tsx apps/web/scripts/discover-and-sync-stakers.ts
 *
 * Options:
 *   --from-block <number>  Start from specific block (default: contract deployment)
 *   --to-block <number>    End at specific block (default: latest)
 *   --batch-size <number>   Number of blocks per batch (default: 10000)
 */

import { createPublicClient, http, formatEther } from 'viem';
import { monad } from '../lib/chains';
import { CONTRACT_ADDRESSES } from '../lib/contracts/addresses';
import { supabase } from '../lib/supabase';

const KEEP_STAKING_ABI = [
    {
        anonymous: false,
        inputs: [
            { indexed: true, internalType: 'address', name: 'user', type: 'address' },
            { indexed: false, internalType: 'uint256', name: 'amount', type: 'uint256' },
            { indexed: false, internalType: 'uint256', name: 'lockDays', type: 'uint256' },
            { indexed: false, internalType: 'uint256', name: 'lockExpiry', type: 'uint256' },
        ],
        name: 'Staked',
        type: 'event',
    },
    {
        inputs: [{ internalType: 'address', name: 'user', type: 'address' }],
        name: 'getUserStake',
        outputs: [
            {
                components: [
                    { internalType: 'uint256', name: 'amount', type: 'uint256' },
                    { internalType: 'uint256', name: 'lockExpiry', type: 'uint256' },
                    { internalType: 'uint256', name: 'lockMultiplier', type: 'uint256' },
                    { internalType: 'uint256', name: 'rewardDebt', type: 'uint256' },
                ],
                internalType: 'struct KEEPStaking.StakeInfo',
                name: '',
                type: 'tuple',
            },
        ],
        stateMutability: 'view',
        type: 'function',
    },
] as const;

const LOCK_MULTIPLIER_SCALE = 1e18;

interface StakeInfo {
    amount: bigint;
    lockExpiry: bigint;
    lockMultiplier: bigint;
    rewardDebt: bigint;
}

function calculateWeightedStake(amount: bigint, lockMultiplier: bigint): bigint {
    return (amount * lockMultiplier) / BigInt(LOCK_MULTIPLIER_SCALE);
}

async function syncStaker(
    publicClient: ReturnType<typeof createPublicClient>,
    stakingContract: `0x${string}`,
    address: string
): Promise<boolean> {
    try {
        const stakeInfo = await publicClient.readContract({
            address: stakingContract,
            abi: KEEP_STAKING_ABI,
            functionName: 'getUserStake',
            args: [address.toLowerCase() as `0x${string}`],
        }) as StakeInfo;

        if (stakeInfo.amount === 0n) {
            // Remove from Supabase if exists
            await supabase.from('stakers').delete().eq('address', address.toLowerCase());
            return false;
        }

        const weightedStake = calculateWeightedStake(stakeInfo.amount, stakeInfo.lockMultiplier);
        const lockExpiry = stakeInfo.lockExpiry > 0n ? new Date(Number(stakeInfo.lockExpiry) * 1000).toISOString() : null;

        const { error } = await supabase.from('stakers').upsert(
            {
                address: address.toLowerCase(),
                amount: stakeInfo.amount.toString(),
                weighted_stake: weightedStake.toString(),
                lock_expiry: lockExpiry,
                lock_multiplier: stakeInfo.lockMultiplier.toString(),
                last_verified_at: new Date().toISOString(),
                updated_at: new Date().toISOString(),
            },
            { onConflict: 'address' }
        );

        if (error) {
            console.error(`❌ Error syncing ${address}:`, error);
            return false;
        }

        return true;
    } catch (error: any) {
        console.error(`❌ Error syncing ${address}:`, error.message);
        return false;
    }
}

async function discoverAndSyncStakers(
    fromBlock?: bigint,
    toBlock?: bigint,
    batchSize: number = 100
): Promise<void> {
    const publicClient = createPublicClient({
        chain: monad,
        transport: http(monad.rpcUrls.default.http[0]),
    });

    const stakingContract = CONTRACT_ADDRESSES.KEEP_STAKING;
    if (!stakingContract || stakingContract === '0x0000000000000000000000000000000000000000') {
        console.error('❌ KEEP_STAKING contract not configured');
        process.exit(1);
    }

    console.log('\n🔍 Discovering and syncing all stakers...');
    console.log(`   Staking Contract: ${stakingContract}\n`);

    try {
        // Get contract deployment block (or use provided fromBlock)
        let startBlock = fromBlock;
        if (!startBlock) {
            // Try to get contract creation block
            const code = await publicClient.getBytecode({ address: stakingContract });
            if (!code || code === '0x') {
                console.error('❌ Contract not found at address');
                process.exit(1);
            }
            // For now, start from a reasonable block (you may need to adjust this)
            // Or scan from block 0 if you know the deployment block
            console.log('⚠️  No fromBlock specified, starting from block 0');
            console.log('   Consider using --from-block to start from contract deployment block');
            startBlock = 0n;
        }

        // Get current block if toBlock not specified
        let endBlock = toBlock;
        if (!endBlock) {
            endBlock = await publicClient.getBlockNumber();
        }

        console.log(`📡 Scanning blocks ${startBlock} to ${endBlock}...\n`);

        // Collect all unique addresses from Staked events
        const uniqueAddresses = new Set<string>();
        let currentBlock = startBlock;
        let totalEvents = 0;

        // Scan in batches to avoid overwhelming the RPC
        // Monad RPC limits to 100 blocks per request
        let currentBatchSize = Math.min(batchSize, 100);

        while (currentBlock < endBlock) {
            const batchEnd = currentBlock + BigInt(currentBatchSize);
            let actualEnd = batchEnd > endBlock ? endBlock : batchEnd;

            // Ensure we don't exceed 100 block limit
            const blockRange = Number(actualEnd - currentBlock);
            if (blockRange > 100) {
                actualEnd = currentBlock + 100n;
                currentBatchSize = 100;
            }

            let retries = 3;
            let success = false;

            while (retries > 0 && !success) {
                try {
                    const logs = await publicClient.getLogs({
                        address: stakingContract,
                        event: {
                            anonymous: false,
                            inputs: [
                                { indexed: true, internalType: 'address', name: 'user', type: 'address' },
                                { indexed: false, internalType: 'uint256', name: 'amount', type: 'uint256' },
                                { indexed: false, internalType: 'uint256', name: 'lockDays', type: 'uint256' },
                                { indexed: false, internalType: 'uint256', name: 'lockExpiry', type: 'uint256' },
                            ],
                            name: 'Staked',
                            type: 'event',
                        },
                        fromBlock: currentBlock,
                        toBlock: actualEnd,
                    });

                    for (const log of logs) {
                        if (log.args.user) {
                            uniqueAddresses.add(log.args.user.toLowerCase());
                            totalEvents++;
                        }
                    }

                    const scannedRange = Number(actualEnd - currentBlock);
                    console.log(`   Scanned blocks ${currentBlock} to ${actualEnd} (${scannedRange} blocks): Found ${logs.length} Staked events, ${uniqueAddresses.size} unique addresses`);
                    success = true;
                } catch (error: any) {
                    const errorMsg = error.message || error.details?.message || JSON.stringify(error.details || {}) || '';
                    const isLimitError = errorMsg.includes('limited to') ||
                                        errorMsg.includes('100 range') ||
                                        errorMsg.includes('block range too large') ||
                                        errorMsg.includes('query returned more than') ||
                                        error.code === -32614;

                    if (isLimitError) {
                        // Reduce batch size significantly
                        currentBatchSize = Math.max(50, Math.floor(currentBatchSize / 2));
                        actualEnd = currentBlock + BigInt(currentBatchSize);

                        console.log(`   ⚠️  RPC limit hit, reducing batch size to ${currentBatchSize} blocks`);

                        if (currentBatchSize < 50) {
                            console.error('❌ Batch size too small, cannot proceed');
                            process.exit(1);
                        }

                        retries--;
                        if (retries === 0) {
                            throw error;
                        }
                        // Wait a bit before retry to avoid rate limiting
                        await new Promise(resolve => setTimeout(resolve, 1000));
                    } else {
                        throw error;
                    }
                }
            }

            currentBlock = actualEnd + 1n;

            // Small delay to avoid rate limiting
            if (currentBlock < endBlock) {
                await new Promise(resolve => setTimeout(resolve, 100));
            }
        }

        console.log(`\n📊 Discovery complete:`);
        console.log(`   Total Staked events: ${totalEvents}`);
        console.log(`   Unique addresses: ${uniqueAddresses.size}\n`);

        if (uniqueAddresses.size === 0) {
            console.log('ℹ️  No stakers found in events');
            return;
        }

        // Now sync each address
        console.log('🔄 Syncing stakers to Supabase...\n');
        const addresses = Array.from(uniqueAddresses);
        let syncedCount = 0;
        let activeCount = 0;
        let removedCount = 0;
        let errorCount = 0;

        for (let i = 0; i < addresses.length; i++) {
            const address = addresses[i];
            const success = await syncStaker(publicClient, stakingContract, address);

            if (success) {
                syncedCount++;
                activeCount++;

                // Get stake info for display
                try {
                    const stakeInfo = await publicClient.readContract({
                        address: stakingContract,
                        abi: KEEP_STAKING_ABI,
                        functionName: 'getUserStake',
                        args: [address as `0x${string}`],
                    }) as StakeInfo;

                    if (i < 10) { // Show first 10
                        console.log(`   ${i + 1}. ${address}: ${formatEther(stakeInfo.amount)} KEEP`);
                    }
                } catch (e) {
                    // Ignore display errors
                }
            } else {
                removedCount++;
            }

            if ((i + 1) % 10 === 0) {
                console.log(`   Progress: ${i + 1}/${addresses.length} addresses processed...`);
            }
        }

        console.log('\n' + '='.repeat(60));
        console.log('SYNC SUMMARY');
        console.log('='.repeat(60));
        console.log(`✅ Active stakers synced: ${activeCount}`);
        console.log(`🗑️  Removed (no stake): ${removedCount}`);
        console.log(`❌ Errors: ${errorCount}`);
        console.log(`📊 Total addresses processed: ${addresses.length}`);
        console.log('='.repeat(60) + '\n');

        // Show top stakers
        const { data: topStakers } = await supabase
            .from('stakers')
            .select('address, amount, weighted_stake')
            .order('weighted_stake', { ascending: false })
            .limit(5);

        if (topStakers && topStakers.length > 0) {
            console.log('🏆 Top 5 Employees of the Month:');
            topStakers.forEach((staker, index) => {
                console.log(`   ${index + 1}. ${staker.address}: ${formatEther(BigInt(staker.weighted_stake))} weighted KEEP`);
            });
            console.log('');
        }
    } catch (error: any) {
        console.error('❌ Error discovering stakers:', error.message);
        if (error.details) {
            console.error('   Details:', error.details);
        }
        if (error.message?.includes('limited to') || error.message?.includes('100 range')) {
            console.error('   RPC limit: 100 blocks per request. The script should auto-adjust, but if it fails, try --batch-size 50');
        }
        process.exit(1);
    }
}

async function main() {
    const args = process.argv.slice(2);

    let fromBlock: bigint | undefined;
    let toBlock: bigint | undefined;
    let batchSize = 10000;

    for (let i = 0; i < args.length; i++) {
        if (args[i] === '--from-block' && args[i + 1]) {
            fromBlock = BigInt(args[i + 1]);
            i++;
        } else if (args[i] === '--to-block' && args[i + 1]) {
            toBlock = BigInt(args[i + 1]);
            i++;
        } else if (args[i] === '--batch-size' && args[i + 1]) {
            batchSize = parseInt(args[i + 1], 10);
            if (batchSize > 100) {
                console.warn('⚠️  Warning: RPC limit is 100 blocks. Reducing batch size to 100.');
                batchSize = 100;
            }
            i++;
        }
    }

    await discoverAndSyncStakers(fromBlock, toBlock, batchSize);
}

main()
    .then(() => process.exit(0))
    .catch((error) => {
        console.error('Fatal error:', error);
        process.exit(1);
    });

