import { supabase } from '@/lib/supabase';
import { NextRequest, NextResponse } from 'next/server';
import { MapGenerator } from '../../../../contributions/map-generator-system/code/generators/map-generator';
import { MapStorage } from '../../../../contributions/map-generator-system/code/storage/map-storage';

/**
 * POST /api/map/explore
 * Explore a new cell (on-the-fly generation)
 */
export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { x, y, seed, generateDungeon = true } = body;

    if (typeof x !== 'number' || typeof y !== 'number') {
      return NextResponse.json(
        { error: 'x and y coordinates are required' },
        { status: 400 }
      );
    }

    // Initialize map generator with Supabase storage
    const mapStorage = new MapStorage(supabase);
    const mapGenerator = new MapGenerator();

    const cell = await mapGenerator.exploreCell(x, y, {
      seed,
      generateDungeon,
    });

    return NextResponse.json({
      success: true,
      cell,
    });
  } catch (error) {
    console.error('Error exploring cell:', error);
    return NextResponse.json(
      { error: 'Failed to explore cell', details: error instanceof Error ? error.message : 'Unknown error' },
      { status: 500 }
    );
  }
}
