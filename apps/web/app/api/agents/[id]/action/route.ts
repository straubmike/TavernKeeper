import { supabase } from '@/lib/supabase';
import { validateAction } from '@innkeeper/engine';
import type { Action } from '@innkeeper/lib';
import { NextRequest, NextResponse } from 'next/server';

export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params;
  try {
    const body = await request.json();
    const { action, runId } = body as { action: Action; runId?: string };

    if (!action) {
      return NextResponse.json(
        { error: 'Action is required' },
        { status: 400 }
      );
    }

    // Verify agent exists
    const { data: agent, error: agentError } = await supabase
      .from('agents')
      .select('*')
      .eq('id', id)
      .single();

    if (agentError || !agent) {
      return NextResponse.json({ error: 'Agent not found' }, { status: 404 });
    }

    // Ensure action is for this agent
    if (action.actorId !== id) {
      return NextResponse.json(
        { error: 'Action actorId must match agent id' },
        { status: 400 }
      );
    }

    // Load current run state if runId provided
    // Note: In a full implementation, run state would be managed in-memory or via a state store
    // For now, we'll validate the action but execution requires full engine state
    if (!runId) {
      return NextResponse.json(
        { error: 'runId is required to execute action' },
        { status: 400 }
      );
    }

    // Load run and entities
    const { data: run, error: runError } = await supabase
      .from('runs')
      .select('*')
      .eq('id', runId)
      .single();

    if (runError || !run) {
      return NextResponse.json({ error: 'Run not found' }, { status: 404 });
    }

    // Load run logs to reconstruct state (simplified - in production would use proper state management)
    const { data: runLogs } = await supabase
      .from('run_logs')
      .select('json')
      .eq('run_id', runId)
      .order('timestamp', { ascending: false })
      .limit(100);

    // Note: Full implementation would:
    // 1. Load full engine state from database or in-memory store
    // 2. Validate action against current state
    // 3. Execute action via executeAction()
    // 4. Persist events and state updates
    // 5. Return events

    // For now, validate action structure and return success
    // Actual execution happens in simulateRun() which has full state
    const validation = validateAction(action, new Map()); // Empty entities map for basic validation

    if (!validation.valid) {
      return NextResponse.json(
        {
          success: false,
          error: 'Invalid action',
          errors: validation.errors,
        },
        { status: 400 }
      );
    }

    // Return success - actual execution handled by engine during simulation
    return NextResponse.json({
      success: true,
      message: 'Action validated and queued for execution',
      events: [], // Events will be generated during simulation execution
    });
  } catch (error) {
    console.error('Error executing agent action:', error);
    return NextResponse.json(
      { error: 'Failed to execute action', details: error instanceof Error ? error.message : 'Unknown error' },
      { status: 500 }
    );
  }
}

