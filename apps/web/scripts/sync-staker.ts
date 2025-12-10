/**
 * Manual Staker Sync Script
 *
 * Syncs a specific staker's data from on-chain to Supabase.
 * Useful when staking doesn't show up in Employee of the Month.
 *
 * Usage:
 *   npx tsx apps/web/scripts/sync-staker.ts <WALLET_ADDRESS>
 *
 * Or sync all stakers:
 *   npx tsx apps/web/scripts/sync-staker.ts --all
 */

// Load environment variables FIRST before importing anything that uses them
import dotenv from 'dotenv';
import path from 'path';

// Load from root .env file
const rootEnvPath = path.resolve(__dirname, '../../../.env');
const envResult = dotenv.config({ path: rootEnvPath });

if (envResult.error) {
    console.warn('⚠️  Warning: Could not load root .env file from:', rootEnvPath);
    // Try current directory as fallback
    dotenv.config();
} else {
    console.log('✅ Loaded .env from:', rootEnvPath);
}

// Verify Supabase config is loaded
const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL ||
    process.env.SUPABASE_URL ||
    process.env.SUPABASE_PROJECT_URL ||
    process.env.NEXT_PUBLIC_SUPABASE_PROJECT_URL;

const supabaseKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY ||
    process.env.SUPABASE_ANON_KEY ||
    process.env.SUPABASE_API_KEY ||
    process.env.NEXT_PUBLIC_SUPABASE_KEY ||
    process.env.NEXT_PUBLIC_SUPABASE_API_KEY;

if (!supabaseUrl || !supabaseKey) {
    console.error('❌ CRITICAL: Supabase environment variables not found!');
    console.error('   Looking for:');
    console.error('     - NEXT_PUBLIC_SUPABASE_URL or SUPABASE_URL or SUPABASE_PROJECT_URL or NEXT_PUBLIC_SUPABASE_PROJECT_URL');
    console.error('     - NEXT_PUBLIC_SUPABASE_ANON_KEY or SUPABASE_ANON_KEY or SUPABASE_API_KEY or NEXT_PUBLIC_SUPABASE_KEY or NEXT_PUBLIC_SUPABASE_API_KEY');
    console.error(`   Found URL: ${supabaseUrl ? '✅' : '❌'}`);
    console.error(`   Found Key: ${supabaseKey ? '✅' : '❌'}`);
    console.error(`   .env path checked: ${rootEnvPath}`);
    process.exit(1);
}

console.log('✅ Supabase configuration loaded\n');

import { createPublicClient, http, formatEther } from 'viem';
import { monad } from '../lib/chains';
import { CONTRACT_ADDRESSES } from '../lib/contracts/addresses';
import { supabase } from '../lib/supabase';
import { getUserByAddress } from '../lib/services/neynarService';

const KEEP_STAKING_ABI = [
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

async function syncStaker(address: string): Promise<void> {
    const publicClient = createPublicClient({
        chain: monad,
        transport: http(monad.rpcUrls.default.http[0]),
    });

    const stakingContract = CONTRACT_ADDRESSES.KEEP_STAKING;
    if (!stakingContract || stakingContract === '0x0000000000000000000000000000000000000000') {
        console.error('❌ KEEP_STAKING contract not configured');
        process.exit(1);
    }

    console.log(`\n🔍 Syncing staker: ${address}`);
    console.log(`   Staking Contract: ${stakingContract}\n`);

    try {
        // Get stake info from contract
        const stakeInfo = await publicClient.readContract({
            address: stakingContract as `0x${string}`,
            abi: KEEP_STAKING_ABI,
            functionName: 'getUserStake',
            args: [address.toLowerCase() as `0x${string}`],
        }) as StakeInfo;

        console.log('📊 On-chain stake info:');
        console.log(`   Amount: ${formatEther(stakeInfo.amount)} KEEP`);
        console.log(`   Lock Expiry: ${stakeInfo.lockExpiry > 0n ? new Date(Number(stakeInfo.lockExpiry) * 1000).toISOString() : 'No lock'}`);
        console.log(`   Lock Multiplier: ${Number(stakeInfo.lockMultiplier) / LOCK_MULTIPLIER_SCALE}x`);
        console.log(`   Reward Debt: ${formatEther(stakeInfo.rewardDebt)} KEEP`);

        if (stakeInfo.amount === 0n) {
            console.log('\n⚠️  No stake found for this address');
            // Remove from Supabase if exists
            await supabase.from('stakers').delete().eq('address', address.toLowerCase());
            console.log('✅ Removed from database (no stake)');
            return;
        }

        const weightedStake = calculateWeightedStake(stakeInfo.amount, stakeInfo.lockMultiplier);
        const lockExpiry = stakeInfo.lockExpiry > 0n ? new Date(Number(stakeInfo.lockExpiry) * 1000).toISOString() : null;

        console.log(`   Weighted Stake: ${formatEther(weightedStake)} KEEP\n`);

        // Check if we already have username for this address
        const { data: existing } = await supabase
            .from('stakers')
            .select('username, username_fetched_at')
            .eq('address', address.toLowerCase())
            .single();

        let username: string | undefined;
        let displayName: string | undefined;
        let farcasterFid: number | undefined;

        // Only fetch username if we don't have it yet
        if (!existing?.username || !existing?.username_fetched_at) {
            console.log('   Fetching Farcaster username from Neynar...');
            try {
                const userData = await getUserByAddress(address);
                if (userData) {
                    username = userData.username;
                    displayName = userData.displayName;
                    farcasterFid = userData.fid;
                    console.log(`   ✅ Found username: ${username || 'N/A'}`);
                } else {
                    console.log('   ℹ️  No Farcaster account found for this address');
                }
            } catch (error) {
                console.log('   ⚠️  Could not fetch username (will try again later)');
            }
        } else {
            console.log(`   ℹ️  Username already cached: ${existing.username}`);
        }

        // Update Supabase
        const { error } = await supabase.from('stakers').upsert(
            {
                address: address.toLowerCase(),
                amount: stakeInfo.amount.toString(),
                weighted_stake: weightedStake.toString(),
                lock_expiry: lockExpiry,
                lock_multiplier: stakeInfo.lockMultiplier.toString(),
                last_verified_at: new Date().toISOString(),
                updated_at: new Date().toISOString(),
                // Only update username fields if we fetched new data
                ...(username !== undefined && {
                    username,
                    display_name: displayName,
                    farcaster_fid: farcasterFid,
                    username_fetched_at: new Date().toISOString(),
                }),
            },
            { onConflict: 'address' }
        );

        if (error) {
            console.error('❌ Error updating Supabase:', error);
            process.exit(1);
        }

        console.log('✅ Successfully synced to Supabase!');
        console.log(`   Your stake should now appear in Employee of the Month\n`);
    } catch (error: any) {
        console.error('❌ Error syncing staker:', error.message);
        if (error.message?.includes('execution reverted')) {
            console.error('   This might mean the address has no stake or the contract call failed');
        }
        process.exit(1);
    }
}

async function syncAllStakers(): Promise<void> {
    const publicClient = createPublicClient({
        chain: monad,
        transport: http(monad.rpcUrls.default.http[0]),
    });

    const stakingContract = CONTRACT_ADDRESSES.KEEP_STAKING;
    if (!stakingContract || stakingContract === '0x0000000000000000000000000000000000000000') {
        console.error('❌ KEEP_STAKING contract not configured');
        process.exit(1);
    }

    console.log('\n🔍 Syncing all stakers from Supabase...\n');

    try {
        // Get all stakers from Supabase
        const { data: stakers, error: fetchError } = await supabase
            .from('stakers')
            .select('address');

        if (fetchError) {
            console.error('❌ Error fetching stakers:', fetchError);
            process.exit(1);
        }

        if (!stakers || stakers.length === 0) {
            console.log('ℹ️  No stakers in database to sync');
            return;
        }

        console.log(`📊 Found ${stakers.length} stakers to sync\n`);

        let successCount = 0;
        let errorCount = 0;

        for (const staker of stakers) {
            try {
                await syncStaker(staker.address);
                successCount++;
            } catch (error) {
                console.error(`❌ Failed to sync ${staker.address}:`, error);
                errorCount++;
            }
        }

        console.log('\n' + '='.repeat(60));
        console.log('SYNC SUMMARY');
        console.log('='.repeat(60));
        console.log(`✅ Successfully synced: ${successCount}`);
        console.log(`❌ Failed: ${errorCount}`);
        console.log(`📊 Total: ${stakers.length}\n`);
    } catch (error: any) {
        console.error('❌ Error in sync all:', error.message);
        process.exit(1);
    }
}

async function main() {
    const args = process.argv.slice(2);

    if (args.length === 0) {
        console.error('Usage: npx tsx apps/web/scripts/sync-staker.ts <WALLET_ADDRESS>');
        console.error('   Or: npx tsx apps/web/scripts/sync-staker.ts --all');
        process.exit(1);
    }

    if (args[0] === '--all') {
        await syncAllStakers();
    } else {
        const address = args[0];
        if (!address.match(/^0x[a-fA-F0-9]{40}$/)) {
            console.error('❌ Invalid address format');
            process.exit(1);
        }
        await syncStaker(address);
    }
}

main()
    .then(() => process.exit(0))
    .catch((error) => {
        console.error('Fatal error:', error);
        process.exit(1);
    });

