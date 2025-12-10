import { NextRequest, NextResponse } from 'next/server';
import { initializeWorld } from '@/lib/services/worldInitializationService';

/**
 * POST /api/world/force-init
 * Force world initialization even if it thinks it's already initialized
 * Useful for debugging or re-initializing
 */
export async function POST(request: NextRequest) {
  try {
    // Force initialization by calling initializeWorld directly
    // (it will still check internally, but we can bypass the startup check)
    await initializeWorld();

    return NextResponse.json(
      { message: 'World initialization completed', initialized: true },
      { status: 200 }
    );
  } catch (error) {
    console.error('Error force-initializing world:', error);
    return NextResponse.json(
      { 
        error: 'Failed to initialize world', 
        details: error instanceof Error ? error.message : 'Unknown error' 
      },
      { status: 500 }
    );
  }
}

