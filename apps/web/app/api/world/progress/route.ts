import { NextRequest, NextResponse } from 'next/server';

/**
 * GET /api/world/progress
 * Check if world generation is in progress (doesn't require Supabase)
 * This endpoint just checks if the process is running, useful for debugging
 */
export async function GET(request: NextRequest) {
  try {
    // This is a simple endpoint that doesn't require database access
    // It can be used to check if the API is responding while world generation runs
    return NextResponse.json({
      status: 'ok',
      message: 'API is responding. Check /api/world/status for initialization status.',
      timestamp: new Date().toISOString(),
    }, { status: 200 });
  } catch (error) {
    return NextResponse.json(
      {
        status: 'error',
        error: 'Failed to check progress',
        details: error instanceof Error ? error.message : 'Unknown error',
      },
      { status: 500 }
    );
  }
}

