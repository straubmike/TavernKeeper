/**
 * Timer Service
 * 
 * Manages time-based event delivery for dungeon runs.
 * Events are calculated deterministically but delivered over time (6-second intervals).
 */

import { randomUUID } from 'crypto';
import { supabase } from '../../../../lib/supabase';
import type {
  ScheduledEvent,
  TimerConfig,
  ScheduleEventOptions,
} from '../types/timer';

const DEFAULT_CONFIG: TimerConfig = {
  eventIntervalSeconds: 6,
  batchSize: 100,
  checkIntervalMs: 1000, // Check every second
};

/**
 * Schedule an event for delivery
 */
export async function scheduleEvent(
  options: ScheduleEventOptions,
  config: TimerConfig = DEFAULT_CONFIG
): Promise<ScheduledEvent> {
  const now = new Date();
  let scheduledTime: Date;

  if (options.scheduledTime) {
    scheduledTime = options.scheduledTime;
  } else {
    const delaySeconds = options.delaySeconds || 0;
    scheduledTime = new Date(now.getTime() + delaySeconds * 1000);
  }

  // Generate a proper UUID for the event ID
  const event: ScheduledEvent = {
    id: randomUUID(),
    runId: options.runId,
    type: options.type,
    payload: options.payload,
    scheduledDeliveryTime: scheduledTime,
    delivered: false,
    createdAt: now,
  };

  // Store in world_events table with scheduled_delivery_time
  const { data, error } = await supabase
    .from('world_events')
    .insert({
      id: event.id,
      run_id: event.runId,
      type: event.type,
      payload: event.payload,
      timestamp: event.createdAt.toISOString(),
      scheduled_delivery_time: event.scheduledDeliveryTime.toISOString(),
      delivered: false,
    })
    .select();

  if (error) {
    console.error('[TimerService] ❌ Error scheduling event:', error);
    throw error;
  }

  if (!data || data.length === 0) {
    console.warn(`[TimerService] ⚠️ Event ${event.id} insert returned no data (but no error)`);
  }

  return event;
}

/**
 * Schedule multiple events with sequential intervals
 */
export async function scheduleEventsSequentially(
  events: Array<Omit<ScheduleEventOptions, 'delaySeconds' | 'scheduledTime'>>,
  startTime: Date,
  config: TimerConfig = DEFAULT_CONFIG
): Promise<ScheduledEvent[]> {
  const scheduled: ScheduledEvent[] = [];
  const intervalMs = config.eventIntervalSeconds * 1000;

  for (let i = 0; i < events.length; i++) {
    const scheduledTime = new Date(startTime.getTime() + i * intervalMs);
    const event = await scheduleEvent({
      ...events[i],
      scheduledTime,
    }, config);
    scheduled.push(event);
  }

  return scheduled;
}

/**
 * Get events ready to deliver (scheduled time <= now and not delivered)
 */
export async function getEventsReadyToDeliver(
  runId?: string,
  limit: number = 100
): Promise<ScheduledEvent[]> {
  const now = new Date().toISOString();

  let query = supabase
    .from('world_events')
    .select('*')
    .lte('scheduled_delivery_time', now)
    .eq('delivered', false)
    .order('scheduled_delivery_time', { ascending: true })
    .limit(limit);

  if (runId) {
    query = query.eq('run_id', runId);
  }

  const { data, error } = await query;

  if (error) {
    console.error('[TimerService] Error fetching events ready to deliver:', error);
    throw error;
  }

  return (data || []).map(mapDbToScheduledEvent);
}

/**
 * Mark events as delivered
 */
export async function markEventsAsDelivered(
  eventIds: string[]
): Promise<void> {
  if (eventIds.length === 0) return;

  const { error } = await supabase
    .from('world_events')
    .update({ delivered: true })
    .in('id', eventIds);

  if (error) {
    console.error('[TimerService] Error marking events as delivered:', error);
    throw error;
  }
}

/**
 * Get all scheduled events for a run
 */
export async function getScheduledEventsForRun(
  runId: string
): Promise<ScheduledEvent[]> {
  const { data, error } = await supabase
    .from('world_events')
    .select('*')
    .eq('run_id', runId)
    .order('scheduled_delivery_time', { ascending: true });

  if (error) {
    console.error('[TimerService] Error fetching scheduled events:', error);
    throw error;
  }

  return (data || []).map(mapDbToScheduledEvent);
}

/**
 * Map database record to ScheduledEvent
 */
function mapDbToScheduledEvent(record: any): ScheduledEvent {
  return {
    id: record.id,
    runId: record.run_id,
    type: record.type,
    payload: record.payload,
    scheduledDeliveryTime: new Date(record.scheduled_delivery_time),
    delivered: record.delivered || false,
    createdAt: new Date(record.timestamp || record.created_at),
  };
}

