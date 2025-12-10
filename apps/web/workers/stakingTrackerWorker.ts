/**
 * Staking Tracker Worker
 *
 * Tracks Staked/Unstaked events from KEEP staking contract and updates Supabase.
 * Runs a daily verification to sync with on-chain data.
 */

import { createPublicClient, http, formatEther } from 'viem';
import { monad } from '../lib/chains';
import { CONTRACT_REGISTRY } from '../lib/contracts/registry';
import { CONTRACT_ADDRESSES } from '../lib/contracts/addresses';
import { supabase } from '../lib/supabase';
import { getUserByAddress } from '../lib/services/neynarService';

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
        anonymous: false,
        inputs: [
            { indexed: true, internalType: 'address', name: 'user', type: 'address' },
            { indexed: false, internalType: 'uint256', name: 'amount', type: 'uint256' },
        ],
        name: 'Unstaked',
        type: 'event',
    },
    {
        inputs: [{ internalType: 'address', name: 'user', type: 'address' }],
        name: 'getUserStake',
        outputs: [
            {
                components: [
                    { internalType: 'uint256', name: 'amount', type: 'uint256' },
                    { indexed: false, internalType: 'uint256', name: 'lockExpiry', type: 'uint256' },
                    { indexed: false, internalType: 'uint256', name: 'lockMultiplier', type: 'uint256' },
                    { indexed: false, internalType: 'uint256', name: 'rewardDebt', type: 'uint256' },
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

/**
 * Calculate weighted stake: amount * lockMultiplier / LOCK_MULTIPLIER_SCALE
 */
function calculateWeightedStake(amount: bigint, lockMultiplier: bigint): bigint {
    return (amount * lockMultiplier) / BigInt(LOCK_MULTIPLIER_SCALE);
}

/**
 * Update staker in Supabase
 * Fetches username from Neynar if not already stored
 */
async function updateStakerInSupabase(
    address: string,
    stakeInfo: StakeInfo | null
): Promise<void> {
    if (!stakeInfo || stakeInfo.amount === 0n) {
        // Remove staker if they have no stake
        await supabase.from('stakers').delete().eq('address', address.toLowerCase());
        return;
    }

    const weightedStake = calculateWeightedStake(stakeInfo.amount, stakeInfo.lockMultiplier);
    const lockExpiry = stakeInfo.lockExpiry > 0n ? new Date(Number(stakeInfo.lockExpiry) * 1000).toISOString() : null;

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
        try {
            const userData = await getUserByAddress(address);
            if (userData) {
                username = userData.username;
                displayName = userData.displayName;
                farcasterFid = userData.fid;
            }
        } catch (error) {
            console.error(`Error fetching username for ${address}:`, error);
            // Continue without username - we'll try again next time
        }
    }

    await supabase.from('stakers').upsert(
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
}

/**
 * Process Staked event
 */
async function processStakedEvent(
    publicClient: ReturnType<typeof createPublicClient>,
    stakingContract: `0x${string}`,
    user: `0x${string}`,
    amount: bigint
): Promise<void> {
    try {
        // Get current stake info from contract
        const stakeInfo = await publicClient.readContract({
            address: stakingContract,
            abi: KEEP_STAKING_ABI,
            functionName: 'getUserStake',
            args: [user],
        });

        await updateStakerInSupabase(user, stakeInfo);
        console.log(`✅ Updated staker ${user}: ${formatEther(amount)} KEEP staked`);
    } catch (error) {
        console.error(`❌ Error processing Staked event for ${user}:`, error);
    }
}

/**
 * Process Unstaked event
 */
async function processUnstakedEvent(
    publicClient: ReturnType<typeof createPublicClient>,
    stakingContract: `0x${string}`,
    user: `0x${string}`,
    amount: bigint
): Promise<void> {
    try {
        // Get current stake info from contract
        const stakeInfo = await publicClient.readContract({
            address: stakingContract,
            abi: KEEP_STAKING_ABI,
            functionName: 'getUserStake',
            args: [user],
        });

        await updateStakerInSupabase(user, stakeInfo);
        console.log(`✅ Updated staker ${user}: ${formatEther(amount)} KEEP unstaked`);
    } catch (error) {
        console.error(`❌ Error processing Unstaked event for ${user}:`, error);
    }
}

/**
 * Track recent staking events
 */
async function trackRecentEvents(): Promise<void> {
    const publicClient = createPublicClient({
        chain: monad,
        transport: http(monad.rpcUrls.default.http[0]),
    });

    const stakingContract = CONTRACT_ADDRESSES.KEEP_STAKING;
    if (!stakingContract || stakingContract === '0x0000000000000000000000000000000000000000') {
        console.log('⏭️  KEEP_STAKING contract not deployed, skipping event tracking');
        return;
    }

    try {
        // Get block number from 24 hours ago (or last 1000 blocks if chain is new)
        const currentBlock = await publicClient.getBlockNumber();
        const fromBlock = currentBlock - 1000n > 0n ? currentBlock - 1000n : 0n;

        console.log(`📡 Tracking staking events from block ${fromBlock} to ${currentBlock}...`);

        // Get Staked events
        const stakedEvents = await publicClient.getLogs({
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
            fromBlock,
            toBlock: currentBlock,
        });

        // Get Unstaked events
        const unstakedEvents = await publicClient.getLogs({
            address: stakingContract,
            event: {
                anonymous: false,
                inputs: [
                    { indexed: true, internalType: 'address', name: 'user', type: 'address' },
                    { indexed: false, internalType: 'uint256', name: 'amount', type: 'uint256' },
                ],
                name: 'Unstaked',
                type: 'event',
            },
            fromBlock,
            toBlock: currentBlock,
        });

        console.log(`📊 Found ${stakedEvents.length} Staked events and ${unstakedEvents.length} Unstaked events`);

        // Process Staked events
        for (const event of stakedEvents) {
            if (event.args.user && event.args.amount) {
                await processStakedEvent(publicClient, stakingContract, event.args.user, event.args.amount);
            }
        }

        // Process Unstaked events
        for (const event of unstakedEvents) {
            if (event.args.user && event.args.amount) {
                await processUnstakedEvent(publicClient, stakingContract, event.args.user, event.args.amount);
            }
        }
    } catch (error) {
        console.error('❌ Error tracking staking events:', error);
    }
}

/**
 * Daily verification: Check all stakers in Supabase against on-chain data
 */
async function verifyStakersOnChain(): Promise<void> {
    const publicClient = createPublicClient({
        chain: monad,
        transport: http(monad.rpcUrls.default.http[0]),
    });

    const stakingContract = CONTRACT_ADDRESSES.KEEP_STAKING;
    if (!stakingContract || stakingContract === '0x0000000000000000000000000000000000000000') {
        console.log('⏭️  KEEP_STAKING contract not deployed, skipping verification');
        return;
    }

    try {
        console.log('🔍 Starting daily verification of stakers...');

        // Get all stakers from Supabase
        const { data: stakers, error } = await supabase
            .from('stakers')
            .select('address');

        if (error) {
            console.error('❌ Error fetching stakers from Supabase:', error);
            return;
        }

        if (!stakers || stakers.length === 0) {
            console.log('ℹ️  No stakers in database to verify');
            return;
        }

        console.log(`🔍 Verifying ${stakers.length} stakers on-chain...`);

        // Verify each staker
        for (const staker of stakers) {
            try {
                const stakeInfo = await publicClient.readContract({
                    address: stakingContract,
                    abi: KEEP_STAKING_ABI,
                    functionName: 'getUserStake',
                    args: [staker.address as `0x${string}`],
                });

                await updateStakerInSupabase(staker.address, stakeInfo);
            } catch (error) {
                console.error(`❌ Error verifying staker ${staker.address}:`, error);
            }
        }

        console.log('✅ Daily verification complete');
    } catch (error) {
        console.error('❌ Error in daily verification:', error);
    }
}

/**
 * Main worker function
 */
export async function startStakingTrackerWorker() {
    const ENABLE_STAKING_TRACKER = process.env.ENABLE_STAKING_TRACKER === 'true';
    if (!ENABLE_STAKING_TRACKER) {
        console.log('⏭️  Staking tracker worker disabled (ENABLE_STAKING_TRACKER not set)');
        return;
    }

    console.log('🚀 Starting Staking Tracker Worker...');

    // Track events every hour
    const EVENT_TRACK_INTERVAL = 60 * 60 * 1000; // 1 hour

    // Daily verification at 2 AM UTC
    const DAILY_VERIFICATION_HOUR = 2;
    const DAILY_VERIFICATION_MINUTE = 0;

    let lastVerificationDate = new Date().toDateString();

    // Initial tracking
    await trackRecentEvents();

    // Set up interval for event tracking
    setInterval(async () => {
        await trackRecentEvents();
    }, EVENT_TRACK_INTERVAL);

    // Set up daily verification
    setInterval(async () => {
        const now = new Date();
        const currentDate = now.toDateString();

        // Run verification once per day at the specified time
        if (
            currentDate !== lastVerificationDate &&
            now.getUTCHours() === DAILY_VERIFICATION_HOUR &&
            now.getUTCMinutes() === DAILY_VERIFICATION_MINUTE
        ) {
            lastVerificationDate = currentDate;
            await verifyStakersOnChain();
        }
    }, 60 * 1000); // Check every minute

    console.log('✅ Staking Tracker Worker started');
}

