import { NextRequest, NextResponse } from 'next/server';
import { getUserByAddress, sendNotification, postToFeed } from '../../../../lib/services/neynarService';
import { supabase } from '../../../../lib/supabase';

export async function POST(request: NextRequest) {
    try {
        const body = await request.json();
        const { previousManagerAddress, newManagerAddress, pricePaid } = body;

        console.log('📨 Notification request received:', {
            previousManagerAddress,
            newManagerAddress,
            pricePaid
        });

        if (!previousManagerAddress || !newManagerAddress || !pricePaid) {
            console.error('❌ Missing required fields');
            return NextResponse.json(
                { error: 'Missing required fields: previousManagerAddress, newManagerAddress, pricePaid' },
                { status: 400 }
            );
        }

        // Skip if previous manager is the zero address
        if (previousManagerAddress === '0x0000000000000000000000000000000000000000') {
            console.log('ℹ️ Previous manager is zero address, skipping notification');
            return NextResponse.json({ success: true, message: 'No previous manager to notify' });
        }

        const normalizedPreviousAddress = previousManagerAddress.toLowerCase();
        const normalizedNewAddress = newManagerAddress.toLowerCase();

        // Try to get FID from database first
        let fid: number | undefined;
        const { data: previousManagerData } = await supabase
            .from('office_managers')
            .select('farcaster_fid, username, display_name')
            .eq('wallet_address', normalizedPreviousAddress)
            .single();

        if (previousManagerData?.farcaster_fid) {
            fid = previousManagerData.farcaster_fid;
            console.log('✅ Found FID in database:', fid);
        } else {
            console.log('🔍 FID not in database, fetching from Neynar API...');
            // Fallback: fetch from Neynar API
            const userData = await getUserByAddress(normalizedPreviousAddress);
            if (userData?.fid) {
                fid = userData.fid;
                console.log('✅ Found FID from Neynar API:', fid);
                // Save to database for next time
                await supabase
                    .from('office_managers')
                    .upsert({
                        wallet_address: normalizedPreviousAddress,
                        farcaster_fid: fid,
                        username: userData.username || null,
                        display_name: userData.displayName || null,
                        last_updated_at: new Date().toISOString(),
                    }, {
                        onConflict: 'wallet_address'
                    });
            } else {
                console.warn('⚠️ Could not find user data from Neynar API');
            }
        }

        // Get previous manager's username for @mention
        let previousManagerUsername: string | null = null;
        if (previousManagerData?.username) {
            previousManagerUsername = previousManagerData.username;
        } else if (fid) {
            // Try to get username from Neynar if we have FID but no username in DB
            const userData = await getUserByAddress(normalizedPreviousAddress);
            if (userData?.username) {
                previousManagerUsername = userData.username;
            }
        }

        // Get new manager's username for @mention
        let newManagerUsername: string = 'Someone';
        const { data: newManagerData } = await supabase
            .from('office_managers')
            .select('username, display_name')
            .eq('wallet_address', normalizedNewAddress)
            .single();

        if (newManagerData?.username) {
            newManagerUsername = newManagerData.username;
        } else {
            // Fallback: fetch from Neynar API
            const userData = await getUserByAddress(normalizedNewAddress);
            if (userData?.username) {
                newManagerUsername = userData.username;
            }
        }

        // Post to feed (ALWAYS happens - public announcement, doesn't require FID)
        let feedPostSuccess = false;
        let feedPostBody: string;

        if (previousManagerUsername) {
            feedPostBody = `@${newManagerUsername} just took the Office from @${previousManagerUsername}! 👑 They paid ${parseFloat(pricePaid).toFixed(4)} MON. Take it from them!`;
        } else {
            feedPostBody = `@${newManagerUsername} just took the Office! 👑 They paid ${parseFloat(pricePaid).toFixed(4)} MON. Take it from them!`;
        }

        // Use the Farcaster miniapp URL for proper embed
        const miniappEmbedUrl = 'https://farcaster.xyz/miniapps/dDsKsz-XG5KU/tavernkeeper';
        feedPostSuccess = await postToFeed(feedPostBody, [miniappEmbedUrl]);

        // Send notification (ONLY if FID exists - optional)
        let notificationSuccess = false;
        if (fid) {
            const notificationTitle = 'Office Taken';
            let notificationBody: string;

            if (previousManagerUsername) {
                // Personal message with @mentions
                notificationBody = `Hey @${previousManagerUsername}, @${newManagerUsername} stole your spot in the office! You received ${parseFloat(pricePaid).toFixed(4)} MON as the previous manager.`;
            } else {
                // Fallback without previous username
                notificationBody = `Hey there! @${newManagerUsername} just claimed the office from you! You received ${parseFloat(pricePaid).toFixed(4)} MON as the previous manager.`;
            }

            const targetUrl = 'https://tavernkeeper.xyz/miniapp';

            console.log('📤 Sending notification:', {
                fid,
                title: notificationTitle,
                body: notificationBody,
                targetUrl
            });

            try {
                notificationSuccess = await sendNotification(
                    [fid],
                    notificationTitle,
                    notificationBody,
                    targetUrl
                );

                if (notificationSuccess) {
                    console.log('✅ Notification sent successfully to FID:', fid);
                } else {
                    console.error('❌ Failed to send notification to FID:', fid);
                    console.error('   Check logs above for detailed error information');
                }
            } catch (notificationError: any) {
                console.error('❌ Exception while sending notification:', notificationError);
                console.error('   Error message:', notificationError?.message);
                notificationSuccess = false;
            }
        } else {
            console.log('ℹ️ No FID found for previous manager - skipping direct notification (feed post will still happen)');
        }

        if (feedPostSuccess) {
            console.log('✅ Feed post published successfully');
        } else {
            console.warn('⚠️ Failed to post to feed (this is non-critical)');
        }

        // Return success if feed post worked (notification is optional if no FID)
        return NextResponse.json({
            success: feedPostSuccess, // Success if feed post worked
            message: fid
                ? (notificationSuccess ? 'Notification and feed post sent successfully' : 'Feed post sent, but notification failed')
                : 'Feed post sent successfully (no FID found for direct notification)',
            fid: fid || null,
            notificationSent: notificationSuccess,
            feedPosted: feedPostSuccess,
        });
    } catch (error) {
        console.error('Error in notify-previous-manager route:', error);
        const errorMessage = error instanceof Error ? error.message : 'Unknown error';
        return NextResponse.json(
            { success: false, error: errorMessage },
            { status: 500 }
        );
    }
}
