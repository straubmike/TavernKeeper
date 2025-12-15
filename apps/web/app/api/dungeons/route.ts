import { NextRequest, NextResponse } from 'next/server';
import { supabase } from '@/lib/supabase';

/**
 * GET /api/dungeons
 * List all available dungeons
 */
export async function GET(request: NextRequest) {
  try {
    const { data: dungeons, error } = await supabase
      .from('dungeons')
      .select('id, seed, map, created_at')
      .order('created_at', { ascending: false });

    if (error) {
      console.error('Error fetching dungeons:', error);
      return NextResponse.json(
        { error: 'Failed to fetch dungeons' },
        { status: 500 }
      );
    }

    // Extract dungeon info from map JSONB
    const dungeonList = (dungeons || []).map((d: any) => ({
      id: d.id,
      seed: d.seed,
      name: d.map?.name || `Dungeon ${d.seed}`,
      depth: d.map?.depth || 100,
      theme: d.map?.theme?.id || 'unknown',
      finalBoss: d.map?.finalBoss?.name || 'Unknown',
      createdAt: d.created_at,
    }));

    return NextResponse.json({ dungeons: dungeonList }, { status: 200 });
  } catch (error) {
    console.error('Error in dungeons endpoint:', error);
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    );
  }
}

