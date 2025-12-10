import { NextRequest, NextResponse } from 'next/server';
import { supabase } from '@/lib/supabase';

/**
 * POST /api/world/cleanup
 * Remove old test dungeons (like "abandoned-cellar")
 * This is a one-time cleanup endpoint
 */
export async function POST(request: NextRequest) {
  try {
    // Find the abandoned-cellar test dungeon
    const { data: testDungeons, error: findError } = await supabase
      .from('dungeons')
      .select('id, seed')
      .eq('seed', 'abandoned-cellar');

    if (findError) {
      return NextResponse.json(
        { error: 'Failed to find test dungeons', details: findError.message },
        { status: 500 }
      );
    }

    if (!testDungeons || testDungeons.length === 0) {
      return NextResponse.json(
        { message: 'No test dungeons found to clean up', deleted: 0 },
        { status: 200 }
      );
    }

    const dungeonIds = testDungeons.map(d => d.id);
    const cleanupSteps: string[] = [];

    // Step 1: Find all runs for this dungeon
    const { data: runs, error: runsError } = await supabase
      .from('runs')
      .select('id')
      .in('dungeon_id', dungeonIds);

    if (runsError) {
      console.error('Error finding runs:', runsError);
    } else if (runs && runs.length > 0) {
      const runIds = runs.map(r => r.id);
      cleanupSteps.push(`Found ${runIds.length} run(s) to clean up`);

      // Step 2: Clear hero_states references to these runs
      const { error: heroStatesError } = await supabase
        .from('hero_states')
        .update({ current_run_id: null })
        .in('current_run_id', runIds);

      if (heroStatesError) {
        console.error('Error clearing hero_states:', heroStatesError);
      } else {
        cleanupSteps.push('Cleared hero_states references');
      }

      // Step 3: Delete run_logs (cascades from runs, but let's be explicit)
      try {
        const { error: runLogsError } = await supabase
          .from('run_logs')
          .delete()
          .in('run_id', runIds);

        if (runLogsError) {
          console.error('Error deleting run_logs:', runLogsError);
          cleanupSteps.push(`Warning: Could not delete run_logs: ${runLogsError.message}`);
        } else {
          cleanupSteps.push('Deleted run_logs');
        }
      } catch (runLogsErr) {
        console.error('Exception deleting run_logs:', runLogsErr);
        cleanupSteps.push(`Warning: Exception deleting run_logs (may not exist)`);
      }

      // Step 4: Delete runs (should cascade now that hero_states are cleared)
      try {
        const { error: runsDeleteError } = await supabase
          .from('runs')
          .delete()
          .in('id', runIds);

        if (runsDeleteError) {
          console.error('Error deleting runs:', runsDeleteError);
          cleanupSteps.push(`Error deleting runs: ${runsDeleteError.message}`);
        } else {
          cleanupSteps.push(`Deleted ${runIds.length} run(s)`);
        }
      } catch (runsErr) {
        console.error('Exception deleting runs:', runsErr);
        cleanupSteps.push(`Error deleting runs: ${runsErr instanceof Error ? runsErr.message : 'Unknown error'}`);
      }
    }

    // Step 5: Delete the test dungeons
    const { error: deleteError } = await supabase
      .from('dungeons')
      .delete()
      .eq('seed', 'abandoned-cellar');

    if (deleteError) {
      return NextResponse.json(
        { error: 'Failed to delete test dungeons', details: deleteError.message, cleanupSteps },
        { status: 500 }
      );
    }

    cleanupSteps.push(`Deleted ${testDungeons.length} test dungeon(s)`);

    return NextResponse.json(
      { 
        message: `Successfully cleaned up test dungeon(s)`,
        deleted: testDungeons.length,
        deletedSeeds: testDungeons.map(d => d.seed),
        cleanupSteps
      },
      { status: 200 }
    );
  } catch (error) {
    console.error('Error cleaning up test dungeons:', error);
    return NextResponse.json(
      { 
        error: 'Failed to cleanup test dungeons', 
        details: error instanceof Error ? error.message : 'Unknown error' 
      },
      { status: 500 }
    );
  }
}

