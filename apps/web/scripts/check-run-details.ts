/**
 * Check detailed information about the latest run
 */

import dotenv from 'dotenv';
import path from 'path';

// Load environment variables
dotenv.config();
const rootEnvPath = path.resolve(process.cwd(), '../../.env');
dotenv.config({ path: rootEnvPath });

async function checkRunDetails() {
  console.log('🔍 Checking Latest Run Details...\n');
  
  try {
    const { supabase } = await import('../lib/supabase');
    
    // Get the most recent run
    const { data: runs, error: runsError } = await supabase
      .from('runs')
      .select('*')
      .order('start_time', { ascending: false })
      .limit(1);
    
    if (runsError) {
      console.error('Error fetching runs:', runsError);
      return;
    }
    
    if (!runs || runs.length === 0) {
      console.log('No runs found in database');
      return;
    }
    
    const latestRun = runs[0];
    console.log('📊 Latest Run Details:');
    console.log(`   ID: ${latestRun.id}`);
    console.log(`   Status: ${latestRun.status || 'N/A'}`);
    console.log(`   Result: ${latestRun.result || 'N/A'}`);
    console.log(`   Error Message: ${latestRun.error_message || 'None'}`);
    console.log(`   Start Time: ${latestRun.start_time}`);
    console.log(`   End Time: ${latestRun.end_time || 'N/A'}`);
    console.log(`   Dungeon ID: ${latestRun.dungeon_id}`);
    console.log(`   Party: ${JSON.stringify(latestRun.party)}`);
    console.log(`   Seed: ${latestRun.seed || 'N/A'}\n`);
    
    // Calculate duration
    if (latestRun.start_time && latestRun.end_time) {
      const start = new Date(latestRun.start_time);
      const end = new Date(latestRun.end_time);
      const duration = (end.getTime() - start.getTime()) / 1000;
      console.log(`   Duration: ${duration.toFixed(2)} seconds\n`);
      
      if (duration < 5) {
        console.log('⚠️  Run completed very quickly (< 5 seconds) - likely failed immediately\n');
      }
    }
    
    // Check if dungeon exists
    if (latestRun.dungeon_id) {
      const { data: dungeon, error: dungeonError } = await supabase
        .from('dungeons')
        .select('id, name, slug')
        .eq('id', latestRun.dungeon_id)
        .single();
      
      if (dungeonError) {
        console.log(`❌ Dungeon not found: ${latestRun.dungeon_id}`);
        console.log(`   Error: ${dungeonError.message}\n`);
      } else {
        console.log(`✅ Dungeon found: ${dungeon.name} (${dungeon.slug || 'no slug'})\n`);
      }
    }
    
    // Check if party members exist in adventurers table
    if (latestRun.party && Array.isArray(latestRun.party)) {
      console.log(`🔍 Checking party members (${latestRun.party.length} members)...`);
      
      const HERO_CONTRACT_ADDRESS = process.env.NEXT_PUBLIC_HERO_CONTRACT_ADDRESS || '0x0000000000000000000000000000000000000000';
      
      for (const tokenId of latestRun.party) {
        const { data: adventurer, error: advError } = await supabase
          .from('adventurers')
          .select('id, name, class, level')
          .eq('token_id', tokenId)
          .eq('contract_address', HERO_CONTRACT_ADDRESS)
          .single();
        
        if (advError || !adventurer) {
          console.log(`   ❌ Hero ${tokenId}: NOT FOUND in adventurers table`);
          console.log(`      Error: ${advError?.message || 'No record found'}`);
        } else {
          console.log(`   ✅ Hero ${tokenId}: ${adventurer.name || 'Unnamed'} (${adventurer.class}, Lv.${adventurer.level})`);
        }
      }
      console.log('');
    }
    
    // Get events for this run
    const { data: events, error: eventsError } = await supabase
      .from('world_events')
      .select('*')
      .eq('run_id', latestRun.id)
      .order('timestamp', { ascending: true });
    
    if (eventsError) {
      console.error('Error fetching events:', eventsError);
    } else {
      console.log(`📦 Events: ${events?.length || 0} total`);
      if (events && events.length > 0) {
        console.log('   Event types:');
        const eventTypes = events.reduce((acc: Record<string, number>, event) => {
          const type = event.type || 'unknown';
          acc[type] = (acc[type] || 0) + 1;
          return acc;
        }, {});
        Object.entries(eventTypes).forEach(([type, count]) => {
          console.log(`      ${type}: ${count}`);
        });
      } else {
        console.log('   ⚠️  No events generated - run likely failed before processing any rooms\n');
      }
    }
    
  } catch (error) {
    console.error('Error:', error);
    if (error instanceof Error) {
      console.error('   Stack:', error.stack);
    }
  }
  
  process.exit(0);
}

checkRunDetails();

