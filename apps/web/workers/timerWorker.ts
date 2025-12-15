/**
 * Timer Worker
 * 
 * Background process that checks for events ready to deliver and processes them.
 * Runs independently of user presence - events continue to deliver even if user isn't watching.
 */

import dotenv from 'dotenv';
import path from 'path';

// Load environment variables
dotenv.config();
const possibleEnvPaths = [
  path.resolve(process.cwd(), '../../.env'),
  path.resolve(process.cwd(), '../.env'),
  path.resolve(process.cwd(), '.env'),
];

for (const envPath of possibleEnvPaths) {
  const result = dotenv.config({ path: envPath, override: false });
  if (!result.error) {
    console.log(`✅ Loaded .env file from: ${envPath}`);
    break;
  }
}

import {
  getEventsReadyToDeliver,
  markEventsAsDelivered,
} from '../contributions/timer-system/code/services/timerService';

const CHECK_INTERVAL_MS = 1000; // Check every second
const BATCH_SIZE = 100; // Process up to 100 events per check

/**
 * Process events ready to deliver
 */
async function processReadyEvents(): Promise<void> {
  try {
    const readyEvents = await getEventsReadyToDeliver(undefined, BATCH_SIZE);

    if (readyEvents.length === 0) {
      return; // No events ready
    }

    // Only log if there are multiple events (batches) to reduce noise
    // Single events are processed silently since they're expected every 6 seconds
    if (readyEvents.length > 1) {
      console.log(`[TimerWorker] Found ${readyEvents.length} events ready to deliver`);
    }

    // Mark events as delivered
    // Note: In a production system, you might want to send these to a message queue
    // or WebSocket connection instead of just marking as delivered
    const eventIds = readyEvents.map(e => e.id);
    await markEventsAsDelivered(eventIds);

    // Only log batches, not individual events
    if (readyEvents.length > 1) {
      console.log(`[TimerWorker] Marked ${eventIds.length} events as delivered`);
    }
  } catch (error) {
    console.error('[TimerWorker] Error processing ready events:', error);
  }
}

/**
 * Start the timer worker
 */
async function startTimerWorker(): Promise<void> {
  console.log('[TimerWorker] Starting timer worker...');
  console.log(`[TimerWorker] Check interval: ${CHECK_INTERVAL_MS}ms`);
  console.log(`[TimerWorker] Batch size: ${BATCH_SIZE}`);

  // Process immediately on start
  await processReadyEvents();

  // Then process on interval
  setInterval(async () => {
    await processReadyEvents();
  }, CHECK_INTERVAL_MS);

  console.log('[TimerWorker] Timer worker started');
}

// Export for use in main worker index
export { startTimerWorker };

