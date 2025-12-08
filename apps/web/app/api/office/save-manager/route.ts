import { NextRequest, NextResponse } from 'next/server';
import { supabase } from '../../../../lib/supabase';
import { getUserByAddress } from '../../../../lib/services/neynarService';

export async function POST(request: NextRequest) {
    try {
        const body = await request.json();
        const { address, fid, username, displayName } = body;

        if (!address) {
            return NextResponse.json(
                { error: 'Missing required field: address' },
                { status: 400 }
            );
        }

        const normalizedAddress = address.toLowerCase();

        // If we have userContext data, use it
        let finalFid = fid;
        let finalUsername = username;
        let finalDisplayName = displayName;

        // If we don't have FID or username, try to fetch from Neynar
        if (!finalFid || !finalUsername) {
            const userData = await getUserByAddress(normalizedAddress);
            if (userData) {
                finalFid = finalFid || userData.fid;
                finalUsername = finalUsername || userData.username;
                finalDisplayName = finalDisplayName || userData.displayName;
            }
        }

        // Save to database
        const { data, error } = await supabase
            .from('office_managers')
            .upsert({
                wallet_address: normalizedAddress,
                farcaster_fid: finalFid || null,
                username: finalUsername || null,
                display_name: finalDisplayName || null,
                last_updated_at: new Date().toISOString(),
            }, {
                onConflict: 'wallet_address'
            })
            .select()
            .single();

        if (error) {
            console.error('Error saving office manager to database:', error);
            return NextResponse.json(
                { success: false, error: error.message },
                { status: 500 }
            );
        }

        return NextResponse.json({
            success: true,
            data: {
                address: normalizedAddress,
                fid: finalFid,
                username: finalUsername,
                displayName: finalDisplayName,
            },
        });
    } catch (error) {
        console.error('Error in save-manager route:', error);
        const errorMessage = error instanceof Error ? error.message : 'Unknown error';
        return NextResponse.json(
            { success: false, error: errorMessage },
            { status: 500 }
        );
    }
}

