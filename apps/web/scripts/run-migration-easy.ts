/**
 * Easy migration runner - opens the SQL file and provides copy-paste instructions
 */

import dotenv from 'dotenv';
import path from 'path';
import fs from 'fs';
import { exec } from 'child_process';
import { promisify } from 'util';

const execAsync = promisify(exec);

// Load environment variables
dotenv.config();
const rootEnvPath = path.resolve(process.cwd(), '../../.env');
dotenv.config({ path: rootEnvPath });

async function runMigrationEasy() {
  console.log('🚀 Adventurer Tracking Migration - Easy Runner\n');
  
  const migrationPath = path.resolve(process.cwd(), '../../supabase/migrations/20250110000000_adventurer_tracking.sql');
  const migrationSQL = fs.readFileSync(migrationPath, 'utf-8');
  
  console.log('📋 Step 1: Copy the migration SQL');
  console.log('─'.repeat(60));
  console.log(migrationSQL);
  console.log('─'.repeat(60));
  console.log('\n');
  
  // Get Supabase URL to construct dashboard link
  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL ||
    process.env.SUPABASE_URL ||
    process.env.SUPABASE_PROJECT_URL ||
    process.env.NEXT_PUBLIC_SUPABASE_PROJECT_URL;
  
  if (supabaseUrl) {
    // Extract project ref from URL if possible
    const urlMatch = supabaseUrl.match(/https?:\/\/([^.]+)\.supabase\.co/);
    if (urlMatch) {
      const projectRef = urlMatch[1];
      const dashboardUrl = `https://supabase.com/dashboard/project/${projectRef}/sql/new`;
      console.log('📋 Step 2: Open Supabase SQL Editor');
      console.log(`   URL: ${dashboardUrl}\n`);
      console.log('   Attempting to open in your browser...\n');
      
      // Try to open the URL
      try {
        const platform = process.platform;
        let command: string;
        
        if (platform === 'win32') {
          command = `start "" "${dashboardUrl}"`;
        } else if (platform === 'darwin') {
          command = `open "${dashboardUrl}"`;
        } else {
          command = `xdg-open "${dashboardUrl}"`;
        }
        
        await execAsync(command);
        console.log('✅ Browser opened!');
      } catch (error) {
        console.log('⚠️  Could not auto-open browser. Please manually visit:');
        console.log(`   ${dashboardUrl}\n`);
      }
    } else {
      console.log('📋 Step 2: Go to Supabase Dashboard');
      console.log('   1. Visit: https://supabase.com/dashboard');
      console.log('   2. Select your project');
      console.log('   3. Click "SQL Editor" → "New query"\n');
    }
  } else {
    console.log('📋 Step 2: Go to Supabase Dashboard');
    console.log('   1. Visit: https://supabase.com/dashboard');
    console.log('   2. Select your project');
    console.log('   3. Click "SQL Editor" → "New query"\n');
  }
  
  console.log('📋 Step 3: Paste and Run');
  console.log('   1. Paste the SQL from above into the SQL Editor');
  console.log('   2. Click "Run" (or press Ctrl+Enter)');
  console.log('   3. You should see "Success. No rows returned"\n');
  
  console.log('📋 Step 4: Verify');
  console.log('   Run this command to verify:');
  console.log('   pnpm tsx scripts/check-latest-run-error.ts\n');
  
  console.log('✅ After migration, restart your worker and try a new dungeon run!');
  
  // Also try to open the file in the default editor
  try {
    const platform = process.platform;
    let command: string;
    
    if (platform === 'win32') {
      command = `notepad "${migrationPath}"`;
    } else if (platform === 'darwin') {
      command = `open "${migrationPath}"`;
    } else {
      command = `xdg-open "${migrationPath}"`;
    }
    
    console.log('\n📄 Opening migration file in your default editor...\n');
    await execAsync(command);
  } catch (error) {
    // Ignore errors opening the file
  }
  
  process.exit(0);
}

runMigrationEasy();

