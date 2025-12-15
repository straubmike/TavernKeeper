/**
 * Comprehensive diagnostic for latest run
 */

import dotenv from 'dotenv';
import path from 'path';

dotenv.config();
const rootEnvPath = path.resolve(process.cwd(), '../../.env');
dotenv.config({ path: rootEnvPath });

async function diagnose() {
  console.log('🔍 Comprehensive Run Diagnosis\n');
  
  try {
    const { supabase } = await import('../lib/supabase');
    const { Queue } = await import('bullmq');
    const Redis = (await import('ioredis')).default;
    
    // 1. Check latest run
    console.log('1️⃣  Latest Run Status:');
    const { data: runs } = await supabase
      .from('runs')
      .select('*')
      .order('start_time', { ascending: false })
      .limit(1);
    
    if (!runs || runs.length === 0) {
      console.log('   ❌ No runs found\n');
      return;
    }
    
    const run = runs[0];
    console.log(`   ID: ${run.id}`);
    console.log(`   Status: ${run.status || 'N/A'}`);
    console.log(`   Result: ${run.result || 'N/A'}`);
    console.log(`   Error: ${run.error_message || 'None'}`);
    
    if (run.start_time && run.end_time) {
      const duration = (new Date(run.end_time).getTime() - new Date(run.start_time).getTime()) / 1000;
      console.log(`   Duration: ${duration.toFixed(2)}s`);
      if (duration < 5) {
        console.log('   ⚠️  Run completed very quickly - likely failed immediately');
      }
    }
    console.log('');
    
    // 2. Check events
    console.log('2️⃣  Events Generated:');
    const { data: events } = await supabase
      .from('world_events')
      .select('id, type, timestamp')
      .eq('run_id', run.id)
      .order('timestamp', { ascending: true });
    
    console.log(`   Total: ${events?.length || 0}`);
    if (events && events.length > 0) {
      const types = events.reduce((acc: Record<string, number>, e) => {
        acc[e.type] = (acc[e.type] || 0) + 1;
        return acc;
      }, {});
      console.log('   Types:', types);
    } else {
      console.log('   ❌ No events - run failed before generating any events');
    }
    console.log('');
    
    // 3. Check queue status
    console.log('3️⃣  Queue Status:');
    const redisUrl = process.env.REDIS_URL || 'redis://localhost:6379';
    const connection = new Redis(redisUrl, { maxRetriesPerRequest: null });
    const queue = new Queue('run-simulation', { connection });
    
    const [waiting, active, completed, failed, delayed] = await Promise.all([
      queue.getWaitingCount(),
      queue.getActiveCount(),
      queue.getCompletedCount(),
      queue.getFailedCount(),
      queue.getDelayedCount(),
    ]);
    
    console.log(`   Waiting: ${waiting}`);
    console.log(`   Active: ${active}`);
    console.log(`   Completed: ${completed}`);
    console.log(`   Failed: ${failed}`);
    console.log(`   Delayed: ${delayed}`);
    
    if (active > 0) {
      console.log('   ✅ Worker is currently processing a job');
    } else if (waiting > 0) {
      console.log('   ⚠️  Jobs are waiting but not being processed - worker may not be running');
    } else {
      console.log('   ℹ️  No active or waiting jobs');
    }
    console.log('');
    
    // 4. Check if hero exists
    if (run.party && Array.isArray(run.party) && run.party.length > 0) {
      console.log('4️⃣  Party Member Check:');
      const tokenId = run.party[0];
      const HERO_CONTRACT = process.env.NEXT_PUBLIC_HERO_CONTRACT_ADDRESS || '0x0000000000000000000000000000000000000000';
      const CHAIN_ID = parseInt(process.env.NEXT_PUBLIC_CHAIN_ID || '143', 10);
      
      const { data: adventurer, error: advError } = await supabase
        .from('adventurers')
        .select('id, name, class, level, health, max_health')
        .eq('token_id', tokenId)
        .eq('contract_address', HERO_CONTRACT)
        .eq('chain_id', CHAIN_ID)
        .single();
      
      if (adventurer) {
        console.log(`   ✅ Hero ${tokenId} found: ${adventurer.name || 'Unnamed'} (${adventurer.class}, Lv.${adventurer.level})`);
        console.log(`      Health: ${adventurer.health}/${adventurer.max_health}`);
      } else {
        console.log(`   ❌ Hero ${tokenId} NOT FOUND in adventurers table`);
        console.log(`      Error: ${advError?.message || 'No record found'}`);
        console.log(`      This is why the run is failing!`);
      }
      console.log('');
    }
    
    // 5. Check dungeon
    if (run.dungeon_id) {
      console.log('5️⃣  Dungeon Check:');
      const { data: dungeon, error: dungeonError } = await supabase
        .from('dungeons')
        .select('id')
        .eq('id', run.dungeon_id)
        .single();
      
      if (dungeon) {
        console.log(`   ✅ Dungeon ${run.dungeon_id} exists`);
      } else {
        console.log(`   ❌ Dungeon ${run.dungeon_id} NOT FOUND`);
        console.log(`      Error: ${dungeonError?.message || 'No record found'}`);
      }
      console.log('');
    }
    
    await connection.quit();
    process.exit(0);
    
  } catch (error) {
    console.error('❌ Diagnostic error:', error);
    if (error instanceof Error) {
      console.error('   Stack:', error.stack);
    }
    process.exit(1);
  }
}

diagnose();

