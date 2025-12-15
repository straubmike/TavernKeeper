/**
 * Timer System - Type Definitions
 * 
 * Types for time-based event delivery system.
 * Events are calculated deterministically but delivered over time.
 */

/**
 * Scheduled event - event with scheduled delivery time
 */
export interface ScheduledEvent {
  id: string;
  runId: string;
  type: string;
  payload: Record<string, unknown>;
  scheduledDeliveryTime: Date;
  delivered: boolean;
  createdAt: Date;
}

/**
 * Timer configuration
 */
export interface TimerConfig {
  eventIntervalSeconds: number; // Default: 6 seconds
  batchSize?: number; // Number of events to process per batch
  checkIntervalMs?: number; // How often to check for events ready to deliver
}

/**
 * Event scheduling options
 */
export interface ScheduleEventOptions {
  runId: string;
  type: string;
  payload: Record<string, unknown>;
  delaySeconds?: number; // Delay from now (default: 0)
  scheduledTime?: Date; // Specific scheduled time (overrides delaySeconds)
}

