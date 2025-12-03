import { supabase } from '@/lib/supabase';
import { NextRequest, NextResponse } from 'next/server';
import { MapStorage } from '../../../../contributions/map-generator-system/code/storage/map-storage';

/**
 * GET /api/map/cell?x=&y=
 * Get cell at specific coordinates
 */
export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const x = parseInt(searchParams.get('x') || '');
    const y = parseInt(searchParams.get('y') || '');

    if (isNaN(x) || isNaN(y)) {
      return NextResponse.json(
        { error: 'x and y coordinates are required' },
        { status: 400 }
      );
    }

    const mapStorage = new MapStorage(supabase);
    const cell = await mapStorage.getCell(x, y);

    if (!cell) {
      return NextResponse.json(
        { error: 'Cell not found' },
        { status: 404 }
      );
    }

    return NextResponse.json({
      success: true,
      cell,
    });
  } catch (error) {
    console.error('Error getting cell:', error);
    return NextResponse.json(
      { error: 'Failed to get cell', details: error instanceof Error ? error.message : 'Unknown error' },
      { status: 500 }
    );
  }
}
