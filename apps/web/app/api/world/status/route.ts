import { NextRequest, NextResponse } from 'next/server';
import { supabase } from '@/lib/supabase';

// Add timeout to prevent hanging
const STATUS_TIMEOUT = 5000; // 5 seconds

/**
 * GET /api/world/status
 * Simple endpoint to check world initialization status
 * Doesn't require importing world generation code
 */
export async function GET(request: NextRequest) {
  try {
    // Check Supabase configuration first
    const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL || 
                       process.env.SUPABASE_URL || 
                       process.env.SUPABASE_PROJECT_URL || 
                       process.env.NEXT_PUBLIC_SUPABASE_PROJECT_URL;
    const supabaseKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY || 
                       process.env.SUPABASE_ANON_KEY || 
                       process.env.SUPABASE_API_KEY;

    if (!supabaseUrl || !supabaseKey) {
      return NextResponse.json({
        initialized: false,
        hasWorld: false,
        hasDungeons: false,
        worldEntries: 0,
        dungeonCount: 0,
        dungeons: [],
        errors: {
          worldError: 'Missing Supabase Configuration. Please check your environment variables.',
          dungeonError: 'Missing Supabase Configuration. Please check your environment variables.',
        },
        config: {
          hasUrl: !!supabaseUrl,
          hasKey: !!supabaseKey,
        },
      }, { status: 200 }); // Return 200 so it doesn't look like an error
    }

    // Check world_content and dungeons tables with timeout
    const timeoutPromise = new Promise((_, reject) => 
      setTimeout(() => reject(new Error('Database query timeout')), STATUS_TIMEOUT)
    );

    let worldContent: any = null;
    let worldError: any = null;
    let dungeons: any = null;
    let dungeonError: any = null;

    try {
      const results = await Promise.race([
        Promise.all([
          supabase.from('world_content').select('id').eq('type', 'world').limit(1),
          supabase.from('dungeons').select('id, seed, map, created_at').order('created_at', { ascending: false }), // Get all, ordered by newest first
        ]),
        timeoutPromise,
      ]) as any[];

      worldContent = results[0]?.data;
      worldError = results[0]?.error;
      dungeons = results[1]?.data;
      dungeonError = results[1]?.error;
    } catch (timeoutError: any) {
      // Timeout occurred
      worldError = { message: timeoutError.message || 'Database query timeout' };
      dungeonError = { message: timeoutError.message || 'Database query timeout' };
    }

    const hasWorld = !worldError && worldContent && worldContent.length > 0;
    const hasDungeons = !dungeonError && dungeons && dungeons.length > 0;
    const initialized = hasWorld || hasDungeons;

    // Get dungeon details
      const dungeonList = (dungeons || [])
        .map((d: any) => {
          const mapData = typeof d.map === 'string' ? JSON.parse(d.map) : d.map;
          return {
            id: d.id,
            seed: d.seed,
            name: mapData?.name || 'Unknown',
            depth: mapData?.depth || '?',
            theme: mapData?.theme?.name || mapData?.theme?.id || '?',
            createdAt: d.created_at,
          };
        })
        .sort((a, b) => {
          // Sort by createdAt descending (newest first), but put test dungeons at the end
          if (a.seed === 'abandoned-cellar') return 1;
          if (b.seed === 'abandoned-cellar') return -1;
          return new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime();
        });

    return NextResponse.json({
      initialized,
      hasWorld,
      hasDungeons,
      worldEntries: hasWorld ? worldContent?.length || 0 : 0,
      dungeonCount: hasDungeons ? dungeons?.length || 0 : 0,
      dungeons: dungeonList,
      errors: {
        worldError: worldError ? worldError.message : null,
        dungeonError: dungeonError ? dungeonError.message : null,
      },
    }, { status: 200 });
  } catch (error) {
    console.error('Error checking world status:', error);
    return NextResponse.json(
      {
        initialized: false,
        error: 'Failed to check world status',
        details: error instanceof Error ? error.message : 'Unknown error',
      },
      { status: 500 }
    );
  }
}

