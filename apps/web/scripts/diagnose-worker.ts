import dotenv from 'dotenv';
import path from 'path';
import { supabase } from '../lib/supabase';
import { runQueue } from '../lib/queue';
import Redis from 'ioredis';

// Load env
dotenv.config();
const rootEnvPath = path.resolve(process.cwd(), '../../.env');
dotenv.config({ path: rootEnvPath });

async function diagnose() {
  console.log('=== Worker Diagnostic Tool ===\n');

  // 1. Check Redis connection
  console.log('1. Checking Redis connection...');
  const redisUrl = process.env.REDIS_URL || 'redis://localhost:6379';
  console.log(`   REDIS_URL: ${redisUrl.replace(/:[^:@]+@/, ':****@')}`);
  
  try {
    const redis = new Redis(redisUrl, {
      maxRetriesPerRequest: null,
      connectTimeout: 5000,
    });
    
    const pingResult = await redis.ping();
    console.log(`   ✅ Redis ping successful: ${pingResult}`);
    
    // Check queue stats
    const waiting = await runQueue.getWaitingCount();
    const active = await runQueue.getActiveCount();
    const completed = await runQueue.getCompletedCount();
    const failed = await runQueue.getFailedCount();
    
    console.log(`\n   Queue Stats:`);
    console.log(`   - Waiting: ${waiting}`);
    console.log(`   - Active: ${active}`);
    console.log(`   - Completed: ${completed}`);
    console.log(`   - Failed: ${failed}`);
    
    await redis.quit();
  } catch (error: any) {
    console.log(`   ❌ Redis connection failed: ${error.message}`);
  }

  // 2. Check recent runs
  console.log('\n2. Checking recent runs...');
  try {
    const { data: runs, error } = await supabase
      .from('runs')
      .select('*')
      .order('start_time', { ascending: false })
      .limit(5);

    if (error) {
      console.log(`   ❌ Error fetching runs: ${error.message}`);
    } else if (!runs || runs.length === 0) {
      console.log('   ⚠️  No runs found in database');
    } else {
      console.log(`   Found ${runs.length} recent runs:`);
      for (const run of runs) {
        console.log(`\n   Run ID: ${run.id}`);
        console.log(`   - Status: ${run.status || 'unknown'}`);
        console.log(`   - Result: ${run.result || 'none'}`);
        console.log(`   - Start: ${run.start_time}`);
        console.log(`   - End: ${run.end_time || 'not finished'}`);
        console.log(`   - Dungeon: ${run.dungeon_id}`);
        console.log(`   - Party: ${JSON.stringify(run.party)}`);
      }
    }
  } catch (error: any) {
    console.log(`   ❌ Error: ${error.message}`);
  }

  // 3. Check events for recent runs
  console.log('\n3. Checking world events...');
  try {
    const { data: events, error } = await supabase
      .from('world_events')
      .select('run_id, type, timestamp')
      .order('timestamp', { ascending: false })
      .limit(10);

    if (error) {
      console.log(`   ❌ Error fetching events: ${error.message}`);
    } else if (!events || events.length === 0) {
      console.log('   ⚠️  No world events found in database');
    } else {
      console.log(`   Found ${events.length} recent events:`);
      const byRun = new Map<string, number>();
      for (const event of events) {
        const count = byRun.get(event.run_id) || 0;
        byRun.set(event.run_id, count + 1);
      }
      for (const [runId, count] of Array.from(byRun.entries())) {
        console.log(`   - Run ${runId}: ${count} events`);
      }
    }
  } catch (error: any) {
    console.log(`   ❌ Error: ${error.message}`);
  }

  // 4. Check run logs for errors
  console.log('\n4. Checking run logs for errors...');
  try {
    const { data: logs, error } = await supabase
      .from('run_logs')
      .select('run_id, type, text, timestamp')
      .or('type.eq.system,type.eq.error')
      .order('timestamp', { ascending: false })
      .limit(10);

    if (error) {
      console.log(`   ❌ Error fetching logs: ${error.message}`);
    } else if (!logs || logs.length === 0) {
      console.log('   ✅ No error logs found');
    } else {
      console.log(`   Found ${logs.length} error/system logs:`);
      for (const log of logs) {
        console.log(`\n   Run ${log.run_id} (${log.timestamp}):`);
        console.log(`   ${log.text?.substring(0, 200)}...`);
      }
    }
  } catch (error: any) {
    console.log(`   ❌ Error: ${error.message}`);
  }

  console.log('\n=== Diagnostic Complete ===');
  process.exit(0);
}

diagnose().catch(console.error);


