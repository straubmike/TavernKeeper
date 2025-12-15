/**
 * Game Logging Service Wrapper
 * 
 * Wrapper for the game-logging-system contribution.
 * Provides simplified interface for logging dungeon run events.
 */

import { supabase } from '../supabase';
import {
  logEvent,
  classifyEventImportance,
  createKeyEventEntry,
  getDetailedLogBuffer,
} from '../../contributions/game-logging-system/code/engine/logging';
import type { GameEvent } from '@innkeeper/lib';
import type {
  EventImportance,
  DetailedLogEntry,
  KeyEventEntry,
} from '../../contributions/game-logging-system/code/types/logging';

/**
 * Log a game event to detailed logs
 */
export function logGameEvent(
  event: GameEvent,
  context?: {
    turn?: number;
    roomId?: string;
    level?: number;
    partyMembers?: string[];
  },
  metadata?: {
    runId?: string;
    agentId?: string;
  }
): void {
  logEvent(event, {
    turn: context?.turn,
    roomId: context?.roomId,
    dungeonState: context?.level
      ? {
          currentRoom: context.roomId,
          objectivesComplete: context.level,
        }
      : undefined,
    partyMembers: context?.partyMembers,
  }, metadata);
}

/**
 * Persist a key event to the database
 */
export async function persistKeyEvent(
  event: GameEvent,
  runId: string,
  importance?: EventImportance
): Promise<void> {
  const eventImportance = importance || classifyEventImportance(event);
  
  // Only persist critical and important events
  if (eventImportance !== 'critical' && eventImportance !== 'important') {
    return;
  }

  const keyEvent = createKeyEventEntry(event, eventImportance, runId);

  // Insert into key_events table
  const { error } = await supabase
    .from('key_events')
    .insert({
      event_id: keyEvent.eventId,
      type: keyEvent.type,
      importance: keyEvent.importance,
      actor_id: keyEvent.actorId || null,
      target_id: keyEvent.targetId || null,
      summary: keyEvent.summary,
      payload: keyEvent.payload,
      timestamp: new Date(keyEvent.timestamp).toISOString(),
      run_id: runId,
      metadata: keyEvent.metadata || {},
    });

  if (error) {
    console.error('[GameLogging] Error persisting key event:', error);
    // Don't throw - logging errors shouldn't break the game
  }
}

/**
 * Get detailed logs for a run
 */
export function getDetailedLogsForRun(runId: string): DetailedLogEntry[] {
  const buffer = getDetailedLogBuffer();
  return buffer.getAllEntries().filter(
    (entry) => entry.metadata?.runId === runId
  );
}

/**
 * Persist all key events for a run
 */
export async function persistAllKeyEventsForRun(runId: string): Promise<void> {
  const buffer = getDetailedLogBuffer();
  const entries = buffer.getAllEntries().filter(
    (entry) => entry.metadata?.runId === runId
  );

  // Filter to only critical and important events
  const keyEntries = entries.filter(
    (entry) => entry.importance === 'critical' || entry.importance === 'important'
  );

  // Persist each key event
  for (const entry of keyEntries) {
    await persistKeyEvent(entry.event, runId, entry.importance);
  }
}

