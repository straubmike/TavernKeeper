import { NextRequest, NextResponse } from 'next/server';
import { getUserByAddress, sendNotification } from '../../../../lib/services/neynarService';
import { supabase } from '../../../../lib/supabase';

export async function POST(request: NextRequest) {
    try {
        const body = await request.json();
        const { previousManagerAddress, newManagerAddress, pricePaid } = body;

        if (!previousManagerAddress || !newManagerAddress || !pricePaid) {
            return NextResponse.json(
                { error: 'Missing required fields: previousManagerAddress, newManagerAddress, pricePaid' },
                { status: 400 }
            );
        }

        // Skip if previous manager is the zero address
        if (previousManagerAddress === '0x0000000000000000000000000000000000000000') {
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
        } else {
            // Fallback: fetch from Neynar API
            const userData = await getUserByAddress(normalizedPreviousAddress);
            if (userData?.fid) {
                fid = userData.fid;
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
            }
        }

        if (!fid) {
            return NextResponse.json(
                { success: false, message: 'Could not find FID for previous manager address' },
                { status: 404 }
            );
        }

        // Get previous manager's username for @mention
        let previousManagerUsername: string | null = null;
        if (previousManagerData?.username) {
            previousManagerUsername = previousManagerData.username;
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

        // Format notification message with @mentions
        const notificationTitle = 'Office Taken';
        let notificationBody: string;

        if (previousManagerUsername) {
            // Personal message with @mentions
            notificationBody = `Hey @${previousManagerUsername}, @${newManagerUsername} stole your spot in the office! You received ${parseFloat(pricePaid).toFixed(4)} MON as the previous manager.`;
        } else {
            // Fallback without previous username
            notificationBody = `Hey there! @${newManagerUsername} just claimed the office from you! You received ${parseFloat(pricePaid).toFixed(4)} MON as the previous manager.`;
        }

        const targetUrl = 'https://tavernkeeper.xyz/';

        const success = await sendNotification(
            [fid],
            notificationTitle,
            notificationBody,
            targetUrl
        );

        if (success) {
            return NextResponse.json({
                success: true,
                message: 'Notification sent successfully',
                fid,
            });
        } else {
            return NextResponse.json(
                { success: false, message: 'Failed to send notification' },
                { status: 500 }
            );
        }
    } catch (error) {
        console.error('Error in notify-previous-manager route:', error);
        const errorMessage = error instanceof Error ? error.message : 'Unknown error';
        return NextResponse.json(
            { success: false, error: errorMessage },
            { status: 500 }
        );
    }
}
