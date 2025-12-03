import { supabase } from '@/lib/supabase';
import { NextRequest, NextResponse } from 'next/server';
import { MapStorage } from '../../../../contributions/map-generator-system/code/storage/map-storage';

/**
 * GET /api/map/dungeon?id=&levelZ=
 * Get dungeon at specific level
 */
export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const dungeonId = searchParams.get('id');
    const levelZ = searchParams.get('levelZ') ? parseInt(searchParams.get('levelZ')!) : undefined;

    if (!dungeonId) {
      return NextResponse.json(
        { error: 'dungeon id is required' },
        { status: 400 }
      );
    }

    const mapStorage = new MapStorage(supabase);
    const dungeon = await mapStorage.getDungeon(dungeonId);

    if (!dungeon) {
      return NextResponse.json(
        { error: 'Dungeon not found' },
        { status: 404 }
      );
    }

    // If levelZ specified, return only that level
    if (levelZ !== undefined) {
      const level = dungeon.levels.find((l) => l.z === levelZ);
      if (!level) {
        return NextResponse.json(
          { error: `Level ${levelZ} not found in dungeon` },
          { status: 404 }
        );
      }
      return NextResponse.json({
        success: true,
        dungeon: {
          ...dungeon,
          levels: [level], // Return only requested level
        },
      });
    }

    return NextResponse.json({
      success: true,
      dungeon,
    });
  } catch (error) {
    console.error('Error getting dungeon:', error);
    return NextResponse.json(
      { error: 'Failed to get dungeon', details: error instanceof Error ? error.message : 'Unknown error' },
      { status: 500 }
    );
  }
}
