/**
 * Quick check of latest run status
 */

import dotenv from 'dotenv';
import path from 'path';

dotenv.config();
const rootEnvPath = path.resolve(process.cwd(), '../../.env');
dotenv.config({ path: rootEnvPath });

async function check() {
  try {
    const { supabase } = await import('../lib/supabase');
    
    const { data: runs } = await supabase
      .from('runs')
      .select('id, status, result, error_message, start_time, end_time, dungeon_id, party')
      .order('start_time', { ascending: false })
      .limit(1);
    
    if (!runs || runs.length === 0) {
      console.log('No runs found');
      return;
    }
    
    const run = runs[0];
    console.log(`Latest Run: ${run.id}`);
    console.log(`Status: ${run.status || 'N/A'}`);
    console.log(`Result: ${run.result || 'N/A'}`);
    console.log(`Error: ${run.error_message || 'None'}`);
    
    if (run.start_time && run.end_time) {
      const duration = (new Date(run.end_time).getTime() - new Date(run.start_time).getTime()) / 1000;
      console.log(`Duration: ${duration.toFixed(2)}s`);
    }
    
    const { data: events } = await supabase
      .from('world_events')
      .select('id')
      .eq('run_id', run.id);
    
    console.log(`Events: ${events?.length || 0}`);
    
  } catch (error) {
    console.error('Error:', error);
  }
  process.exit(0);
}

check();

