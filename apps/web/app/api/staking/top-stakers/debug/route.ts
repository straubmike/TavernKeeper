import { NextResponse } from 'next/server';
import { supabase } from '../../../../../lib/supabase';

export const dynamic = 'force-dynamic';

export async function GET() {
    const diagnostics: any = {
        timestamp: new Date().toISOString(),
        environment: process.env.NODE_ENV,
        isRender: !!process.env.RENDER,
        serviceName: process.env.RENDER_SERVICE_NAME || 'local',
    };

    // Check environment variables
    const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL ||
        process.env.SUPABASE_URL ||
        process.env.SUPABASE_PROJECT_URL ||
        process.env.NEXT_PUBLIC_SUPABASE_PROJECT_URL ||
        '';

    const supabaseKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY ||
        process.env.SUPABASE_ANON_KEY ||
        process.env.SUPABASE_API_KEY ||
        process.env.NEXT_PUBLIC_SUPABASE_KEY ||
        process.env.NEXT_PUBLIC_SUPABASE_API_KEY ||
        '';

    diagnostics.envVars = {
        hasSupabaseUrl: !!supabaseUrl,
        hasSupabaseKey: !!supabaseKey,
        urlPreview: supabaseUrl ? `${supabaseUrl.substring(0, 30)}...` : 'missing',
        keyPreview: supabaseKey ? `${supabaseKey.substring(0, 20)}...` : 'missing',
    };

    // Test Supabase connection
    try {
        const { data: stakers, error } = await supabase
            .from('stakers')
            .select('address, amount, weighted_stake')
            .order('weighted_stake', { ascending: false })
            .limit(5);

        diagnostics.supabase = {
            connected: !error,
            error: error ? {
                message: error.message,
                code: error.code,
            } : null,
            stakerCount: stakers?.length || 0,
            hasStakers: (stakers?.length || 0) > 0,
        };

        if (stakers && stakers.length > 0) {
            diagnostics.sampleStaker = {
                address: stakers[0].address,
                amount: stakers[0].amount,
                weightedStake: stakers[0].weighted_stake,
            };
        }
    } catch (err: any) {
        diagnostics.supabase = {
            connected: false,
            error: {
                message: err.message,
                stack: err.stack,
            },
        };
    }

    // Check if username column exists
    try {
        const { data: testQuery, error: usernameError } = await supabase
            .from('stakers')
            .select('address, username')
            .limit(1);

        diagnostics.usernameColumn = {
            exists: !usernameError,
            error: usernameError ? {
                message: usernameError.message,
                code: usernameError.code,
            } : null,
        };
    } catch (err: any) {
        diagnostics.usernameColumn = {
            exists: false,
            error: { message: err.message },
        };
    }

    return NextResponse.json(diagnostics, { status: 200 });
}

