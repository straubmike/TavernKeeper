import { supabase } from '@/lib/supabase';
import { NextRequest, NextResponse } from 'next/server';
import { MapGenerator } from '../../../../contributions/map-generator-system/code/generators/map-generator';
import { MapStorage } from '../../../../contributions/map-generator-system/code/storage/map-storage';

/**
 * POST /api/map/generate
 * Generate initial map region with pre-generated features
 */
export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { seed, region, density = 'normal', includeDungeons = true } = body;

    if (!seed || !region) {
      return NextResponse.json(
        { error: 'seed and region are required' },
        { status: 400 }
      );
    }

    // Initialize map generator with Supabase storage
    const mapStorage = new MapStorage(supabase);
    const mapGenerator = new MapGenerator();
    // Note: MapGenerator needs to accept storage - this would require updating MapGenerator constructor
    // For now, we'll use the storage directly

    const cells = await mapGenerator.generateInitialMap({
      seed,
      region,
      density,
      includeDungeons,
    });

    return NextResponse.json({
      success: true,
      cells,
      count: cells.length,
    });
  } catch (error) {
    console.error('Error generating map:', error);
    return NextResponse.json(
      { error: 'Failed to generate map', details: error instanceof Error ? error.message : 'Unknown error' },
      { status: 500 }
    );
  }
}
