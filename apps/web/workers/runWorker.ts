import { Job, Worker } from 'bullmq';
import Redis from 'ioredis';
import { supabase } from '../lib/supabase';
import { executeDungeonRun } from '../lib/services/dungeonRunService';
import { dungeonStateService } from '../lib/services/dungeonStateService';

/**
 * Wrap a promise with a timeout
 */
function withTimeout<T>(promise: Promise<T>, timeoutMs: number, operationName: string): Promise<T> {
  return Promise.race([
    promise,
    new Promise<T>((_, reject) => {
      setTimeout(() => {
        reject(new Error(`${operationName} timed out after ${timeoutMs}ms`));
      }, timeoutMs);
    }),
  ]);
}

const redisUrl = process.env.REDIS_URL || 'redis://localhost:6379';
console.log(`[Worker] Connecting to Redis: ${redisUrl.replace(/:[^:@]+@/, ':****@')}`);

const connection = new Redis(redisUrl, {
  maxRetriesPerRequest: null, // Required by BullMQ
  retryStrategy: (times) => {
    const delay = Math.min(times * 50, 2000);
    console.log(`[Worker] Redis retry attempt ${times}, waiting ${delay}ms`);
    return delay;
  },
  reconnectOnError: (err) => {
    console.error('[Worker] Redis connection error:', err.message);
    return true;
  },
});

// Test Redis connection
connection.on('connect', () => {
  console.log('[Worker] Redis connected successfully');
});

connection.on('ready', () => {
  console.log('[Worker] Redis ready');
});

connection.on('error', (err) => {
  console.error('[Worker] Redis error:', err);
});

connection.ping().then(() => {
  console.log('[Worker] Redis ping successful');
}).catch((err) => {
  console.error('[Worker] Redis ping failed:', err);
  console.error('[Worker] Make sure Redis is running and REDIS_URL is correct');
});

interface RunJobData {
  runId: string;
  dungeonId: string;
  party: string[];
  seed: string;
  startTime: number;
}

export const runWorker = new Worker<RunJobData>(
  'run-simulation',
  async (job: Job<RunJobData>) => {
    const { runId, dungeonId, party, seed, startTime } = job.data;
    const jobStartTime = Date.now();

    console.log(`[Worker] Processing job ${job.id} for run ${runId}`);
    console.log(`[Worker] Job data:`, { runId, dungeonId, party: party.length, seed });
    console.log(`[Worker] Job start time: ${new Date(startTime).toISOString()}`);

    try {
      // Get wallet address from run or party
      // For now, we'll need to get it from the run record or pass it in job data
      console.log(`[Worker] Fetching run data from database...`);
      const fetchStartTime = Date.now();
      const { data: runData } = await supabase
        .from('runs')
        .select('*')
        .eq('id', runId)
        .single();
      console.log(`[Worker] Run data fetched in ${Date.now() - fetchStartTime}ms`);

      // Extract wallet from party - in production, this should be stored in run record
      // For now, we'll need to get it from hero ownership
      const HERO_CONTRACT_ADDRESS = process.env.NEXT_PUBLIC_HERO_CONTRACT_ADDRESS || '0x0000000000000000000000000000000000000000';
      console.log(`[Worker] Loading adventurer service and fetching first hero...`);
      const heroFetchStartTime = Date.now();
      const { getAdventurer } = await import('../contributions/adventurer-tracking/code/services/adventurerService');
      
      let firstHero;
      try {
        firstHero = await getAdventurer({
          tokenId: party[0],
          contractAddress: HERO_CONTRACT_ADDRESS,
          chainId: parseInt(process.env.NEXT_PUBLIC_CHAIN_ID || '143', 10),
        });
        console.log(`[Worker] Hero data fetched in ${Date.now() - heroFetchStartTime}ms`);
      } catch (heroError) {
        const errorMsg = heroError instanceof Error ? heroError.message : String(heroError);
        if (errorMsg.includes('adventurers') || errorMsg.includes('table')) {
          throw new Error(`Database schema missing: The 'adventurers' table does not exist. Please run the migration: apps/web/contributions/adventurer-tracking/code/database/migration.sql`);
        }
        throw heroError;
      }

      if (!firstHero) {
        throw new Error(`Could not find adventurer for hero ${party[0]}. Make sure the hero exists in the adventurers table.`);
      }

      const walletAddress = firstHero.walletAddress;
      console.log(`[Worker] Wallet address: ${walletAddress}`);

      // Execute dungeon run using new service with timeout (5 minutes)
      console.log(`[Worker] Starting dungeon run execution (5 minute timeout)...`);
      const executionStartTime = Date.now();
      const DUNGEON_RUN_TIMEOUT = 5 * 60 * 1000; // 5 minutes
      const result = await withTimeout(
        executeDungeonRun(
          runId,
          dungeonId,
          party,
          seed,
          walletAddress
        ),
        DUNGEON_RUN_TIMEOUT,
        'executeDungeonRun'
      );
      const executionDuration = Date.now() - executionStartTime;
      console.log(`[Worker] Dungeon run completed in ${executionDuration}ms. Events generated: ${result.events.length}, Status: ${result.status}, Levels: ${result.levelsCompleted}, XP: ${result.totalXP}`);

      // Persist run logs in batch
      const runLogs = result.events.map((event) => ({
        run_id: runId,
        text: JSON.stringify(event),
        json: event,
        timestamp: new Date(event.timestamp).toISOString(),
      }));

      const worldEvents = result.events.map((event) => ({
        run_id: runId,
        type: event.type,
        payload: event,
        timestamp: new Date(event.timestamp).toISOString(),
      }));

      console.log(`[Worker] Inserting ${runLogs.length} run logs and ${worldEvents.length} world events...`);
      const insertStartTime = Date.now();
      const [logsResult, eventsResult] = await Promise.all([
        supabase.from('run_logs').insert(runLogs),
        supabase.from('world_events').insert(worldEvents),
      ]);
      const insertDuration = Date.now() - insertStartTime;
      console.log(`[Worker] Database insert completed in ${insertDuration}ms`);
      
      if (logsResult.error) {
        console.error(`[Worker] Error inserting run logs:`, logsResult.error);
      } else {
        console.log(`[Worker] Successfully inserted ${runLogs.length} run logs`);
      }
      if (eventsResult.error) {
        console.error(`[Worker] Error inserting world events:`, eventsResult.error);
        console.error(`[Worker] Error details:`, JSON.stringify(eventsResult.error, null, 2));
        console.error(`[Worker] Sample event structure:`, worldEvents.length > 0 ? JSON.stringify(worldEvents[0], null, 2) : 'No events to insert');
      } else {
        console.log(`[Worker] Successfully inserted ${worldEvents.length} world events for run ${runId}`);
        if (worldEvents.length > 0) {
          console.log(`[Worker] Sample event:`, JSON.stringify(worldEvents[0], null, 2));
        }
      }

      // Unlock heroes
      console.log(`[Worker] Unlocking heroes...`);
      const unlockStartTime = Date.now();
      const checkingHeroes = party.map((id: string) => ({ 
        contractAddress: HERO_CONTRACT_ADDRESS, 
        tokenId: id 
      }));
      await dungeonStateService.unlockHeroes(checkingHeroes);
      console.log(`[Worker] Heroes unlocked in ${Date.now() - unlockStartTime}ms`);

      // Update run status
      console.log(`[Worker] Updating run status in database...`);
      const updateStartTime = Date.now();
      await supabase
        .from('runs')
        .update({
          end_time: new Date().toISOString(),
          result: result.status,
        })
        .eq('id', runId);
      console.log(`[Worker] Run status updated in ${Date.now() - updateStartTime}ms`);

      const totalDuration = Date.now() - jobStartTime;
      console.log(`[Worker] Job ${job.id} completed successfully in ${totalDuration}ms`);

      return {
        success: true,
        runId,
        eventsCount: result.events.length,
        result: result.status,
        levelsCompleted: result.levelsCompleted,
        totalXP: result.totalXP,
      };
    } catch (error) {
      const errorDuration = Date.now() - jobStartTime;
      console.error(`[Worker] Error processing run ${runId} after ${errorDuration}ms:`, error);
      if (error instanceof Error) {
        console.error(`[Worker] Error message: ${error.message}`);
        console.error(`[Worker] Error stack: ${error.stack}`);
      }

      // Unlock heroes on error
      try {
        const HERO_CONTRACT_ADDRESS = process.env.NEXT_PUBLIC_HERO_CONTRACT_ADDRESS || '0x0000000000000000000000000000000000000000';
        const checkingHeroes = party.map((id: string) => ({ 
          contractAddress: HERO_CONTRACT_ADDRESS, 
          tokenId: id 
        }));
        await dungeonStateService.unlockHeroes(checkingHeroes);
      } catch (unlockError) {
        console.error('Error unlocking heroes:', unlockError);
      }

      // Log error to database for debugging
      const errorMessage = error instanceof Error ? error.message : String(error);
      const errorStack = error instanceof Error ? error.stack : '';
      console.error(`[Worker] Full error details:`, {
        message: errorMessage,
        stack: errorStack,
        runId,
        dungeonId,
        party,
      });
      
      await supabase.from('run_logs').insert({
        run_id: runId,
        text: `Simulation Failed: ${errorMessage}\nStack: ${errorStack}`,
        type: 'system',
        timestamp: new Date().toISOString()
      });

      // Insert at least one error event so the UI can show something
      try {
        const errorEventResult = await supabase.from('world_events').insert({
          run_id: runId,
          type: 'error',
          payload: {
            type: 'error',
            level: 0,
            roomType: 'unknown',
            description: `Run failed: ${errorMessage}`,
            timestamp: Date.now(),
          },
          timestamp: new Date().toISOString(),
        });
        if (errorEventResult.error) {
          console.error(`[Worker] Error inserting error event:`, errorEventResult.error);
        } else {
          console.log(`[Worker] Successfully inserted error event for failed run ${runId}`);
        }
      } catch (eventError) {
        console.error(`[Worker] Exception inserting error event:`, eventError);
      }

      // Update run with error status
      await supabase
        .from('runs')
        .update({
          end_time: new Date().toISOString(),
          result: 'error',
        })
        .eq('id', runId);

      throw error;
    }
  },
  {
    connection,
    concurrency: 5, // Process up to 5 runs concurrently
  }
);

runWorker.on('active', (job) => {
  console.log(`[Worker] Job ${job.id} is now active`);
});

runWorker.on('completed', (job) => {
  console.log(`[Worker] Run simulation completed: ${job.id}`);
});

runWorker.on('failed', async (job, err) => {
  console.error(`[Worker] Run simulation failed: ${job?.id}`, err);
  if (err instanceof Error) {
    console.error(`[Worker] Error message: ${err.message}`);
    console.error(`[Worker] Error stack:`, err.stack);
  }

  // Update run status when job fails
  if (job?.data?.runId) {
    try {
      const errorMessage = err instanceof Error ? err.message : String(err);
      
      // Log error to database
      await supabase.from('run_logs').insert({
        run_id: job.data.runId,
        text: `Job Failed: ${errorMessage}\nStack: ${err instanceof Error ? err.stack : ''}`,
        type: 'system',
        timestamp: new Date().toISOString()
      });

      // Update run with error status
      await supabase
        .from('runs')
        .update({
          end_time: new Date().toISOString(),
          result: 'error',
          status: 'failed',
        })
        .eq('id', job.data.runId);

      console.log(`[Worker] Updated run ${job.data.runId} status to 'error'`);
    } catch (updateError) {
      console.error(`[Worker] Failed to update run status:`, updateError);
    }
  }
});

runWorker.on('error', (err) => {
  console.error(`[Worker] Worker error:`, err);
});
