/**
 * Check the latest run's error details
 */

import dotenv from 'dotenv';
import path from 'path';

// Load environment variables
dotenv.config();
const rootEnvPath = path.resolve(process.cwd(), '../../.env');
dotenv.config({ path: rootEnvPath });

async function checkLatestRunError() {
  console.log('🔍 Checking Latest Run Error...\n');
  
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
    console.log('📊 Latest Run:');
    console.log(`   ID: ${latestRun.id}`);
    console.log(`   Status: ${latestRun.status || 'N/A'}`);
    console.log(`   Result: ${latestRun.result || 'N/A'}`);
    console.log(`   Start Time: ${latestRun.start_time}`);
    console.log(`   End Time: ${latestRun.end_time || 'N/A'}`);
    console.log(`   Dungeon ID: ${latestRun.dungeon_id}`);
    console.log(`   Party: ${JSON.stringify(latestRun.party)}\n`);
    
    // Get error logs for this run
    const { data: logs, error: logsError } = await supabase
      .from('run_logs')
      .select('*')
      .eq('run_id', latestRun.id)
      .order('timestamp', { ascending: false })
      .limit(10);
    
    if (logsError) {
      console.error('Error fetching logs:', logsError);
    } else if (logs && logs.length > 0) {
      console.log('📝 Recent Logs (most recent first):');
      logs.forEach((log, idx) => {
        console.log(`\n   ${idx + 1}. [${log.type || 'unknown'}] ${new Date(log.timestamp).toISOString()}`);
        if (log.text) {
          const text = typeof log.text === 'string' ? log.text : JSON.stringify(log.text);
          // Show first 500 chars
          const preview = text.length > 500 ? text.substring(0, 500) + '...' : text;
          console.log(`      ${preview.split('\n').join('\n      ')}`);
        }
      });
    } else {
      console.log('No logs found for this run');
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
      console.log(`\n📦 Events: ${events?.length || 0} total`);
      if (events && events.length > 0) {
        console.log('   First few events:');
        events.slice(0, 5).forEach((event, idx) => {
          console.log(`   ${idx + 1}. [${event.type}] ${new Date(event.timestamp).toISOString()}`);
        });
      }
    }
    
    // Check if adventurers table exists
    console.log('\n🔍 Checking database schema...');
    const { data: tableCheck, error: tableError } = await supabase
      .from('adventurers')
      .select('id')
      .limit(1);
    
    if (tableError) {
      if (tableError.message.includes('adventurers') || tableError.message.includes('table')) {
        console.error('❌ adventurers table does NOT exist!');
        console.error('   Error:', tableError.message);
        console.log('\n💡 Solution: Run the migration:');
        console.log('   apps/web/contributions/adventurer-tracking/code/database/migration.sql');
      } else {
        console.error('Error checking table:', tableError);
      }
    } else {
      console.log('✅ adventurers table exists');
    }
    
  } catch (error) {
    console.error('Error:', error);
  }
  
  process.exit(0);
}

checkLatestRunError();

