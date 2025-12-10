import { NextResponse } from 'next/server';
import { supabase } from '../../../../lib/supabase';
import { getUserByAddress } from '../../../../lib/services/neynarService';

export const dynamic = 'force-dynamic';
export const revalidate = 60; // Revalidate every 60 seconds

interface StakerRow {
    address: string;
    amount: string;
    weighted_stake: string;
    lock_expiry?: string;
    lock_multiplier?: string;
}

export async function GET() {
    try {
        // Fetch top 5 stakers by weighted stake
        // Try to include username, but handle gracefully if column doesn't exist yet
        const { data: stakers, error } = await supabase
            .from<StakerRow>('stakers')
            .select('address, amount, weighted_stake, username')
            .order('weighted_stake', { ascending: false })
            .limit(5);

        if (error) {
            console.error('Error fetching stakers from Supabase:', JSON.stringify(error, null, 2));
            // If error is about missing column, try without username
            if (error.message?.includes('username') || error.message?.includes('column') || error.code === '42703') {
                console.log('Retrying without username column...');
                const { data: stakersRetry, error: retryError } = await supabase
                    .from<StakerRow>('stakers')
                    .select('address, amount, weighted_stake')
                    .order('weighted_stake', { ascending: false })
                    .limit(5);

                if (retryError) {
                    console.error('Error fetching stakers (retry):', JSON.stringify(retryError, null, 2));
                    return NextResponse.json({ stakers: [], error: retryError.message }, { status: 200 });
                }

                if (!stakersRetry || stakersRetry.length === 0) {
                    console.log('No stakers found in database');
                    return NextResponse.json({ stakers: [] });
                }

                const stakersWithUsernames = stakersRetry.map((staker) => ({
                    address: staker.address,
                    amount: staker.amount,
                    weightedStake: staker.weighted_stake,
                    username: undefined,
                }));

                return NextResponse.json({ stakers: stakersWithUsernames });
            }
            return NextResponse.json({ stakers: [], error: error.message }, { status: 200 });
        }

        if (!stakers || stakers.length === 0) {
            console.log('No stakers found in database');
            return NextResponse.json({ stakers: [] });
        }

        console.log(`Found ${stakers.length} stakers in database`);

        // Usernames are already stored in Supabase, no need to fetch from Neynar
        const stakersWithUsernames = stakers
            .filter((staker) => staker.address && staker.amount && staker.weighted_stake) // Filter out invalid entries
            .map((staker) => ({
                address: staker.address,
                amount: staker.amount, // Keep as string for JSON serialization
                weightedStake: staker.weighted_stake, // Keep as string for JSON serialization
                username: (staker as any).username || undefined, // Username is stored in Supabase
            }));

        console.log(`Returning ${stakersWithUsernames.length} stakers to frontend`);
        return NextResponse.json({ stakers: stakersWithUsernames });
    } catch (error) {
        console.error('Error in top-stakers API:', error);
        const errorMessage = error instanceof Error ? error.message : 'Unknown error';
        return NextResponse.json({ stakers: [], error: errorMessage }, { status: 200 });
    }
}

