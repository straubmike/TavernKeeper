import { NextRequest, NextResponse } from 'next/server';
import { getUserByAddress, postToFeed } from '../../../../lib/services/neynarService';
import { supabase } from '../../../../lib/supabase';

export async function POST(request: NextRequest) {
    try {
        const body = await request.json();
        const { raiderAddress, monProfit, keepProfit } = body;

        console.log('📨 Raid notification request received:', {
            raiderAddress,
            monProfit,
            keepProfit
        });

        if (!raiderAddress || monProfit === undefined || keepProfit === undefined) {
            console.error('❌ Missing required fields');
            return NextResponse.json(
                { error: 'Missing required fields: raiderAddress, monProfit, keepProfit' },
                { status: 400 }
            );
        }

        const normalizedRaiderAddress = raiderAddress.toLowerCase();

        // Get raider's username for @mention
        let raiderUsername: string = 'Someone';
        const { data: raiderData } = await supabase
            .from('office_managers')
            .select('username, display_name')
            .eq('wallet_address', normalizedRaiderAddress)
            .single();

        if (raiderData?.username) {
            raiderUsername = raiderData.username;
        } else {
            // Fallback: fetch from Neynar API
            const userData = await getUserByAddress(normalizedRaiderAddress);
            if (userData?.username) {
                raiderUsername = userData.username;
            }
        }

        // Format profit amounts
        const monFormatted = parseFloat(monProfit).toFixed(4);
        const keepFormatted = parseFloat(keepProfit).toFixed(4);

        // Post to feed (ALWAYS happens - public announcement, notifies all miniapp users)
        let feedPostSuccess = false;
        let feedPostBody: string;

        if (parseFloat(monProfit) > 0 && parseFloat(keepProfit) > 0) {
            feedPostBody = `@${raiderUsername} just raided The Cellar! 🔥 They claimed ${monFormatted} MON + ${keepFormatted} KEEP. Raid it yourself!`;
        } else if (parseFloat(monProfit) > 0) {
            feedPostBody = `@${raiderUsername} just raided The Cellar! 🔥 They claimed ${monFormatted} MON. Raid it yourself!`;
        } else if (parseFloat(keepProfit) > 0) {
            feedPostBody = `@${raiderUsername} just raided The Cellar! 🔥 They claimed ${keepFormatted} KEEP. Raid it yourself!`;
        } else {
            feedPostBody = `@${raiderUsername} just raided The Cellar! 🔥 Raid it yourself!`;
        }

        // Use the Farcaster miniapp URL for proper embed
        const miniappEmbedUrl = 'https://farcaster.xyz/miniapps/dDsKsz-XG5KU/tavernkeeper';
        feedPostSuccess = await postToFeed(feedPostBody, [miniappEmbedUrl]);

        if (feedPostSuccess) {
            console.log('✅ Raid feed post published successfully');
        } else {
            console.warn('⚠️ Failed to post raid to feed (this is non-critical)');
        }

        // Return success if feed post worked (feed post notifies all miniapp users)
        return NextResponse.json({
            success: feedPostSuccess, // Success if feed post worked
            message: feedPostSuccess ? 'Raid notification posted successfully' : 'Failed to post raid notification',
            feedPosted: feedPostSuccess,
        });
    } catch (error) {
        console.error('Error in notify-raid route:', error);
        const errorMessage = error instanceof Error ? error.message : 'Unknown error';
        return NextResponse.json(
            { success: false, error: errorMessage },
            { status: 500 }
        );
    }
}

