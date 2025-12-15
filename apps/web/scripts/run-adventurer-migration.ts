/**
 * Run the adventurer tracking migration
 * This script applies the migration SQL to Supabase
 */

import dotenv from 'dotenv';
import path from 'path';
import fs from 'fs';

// Load environment variables
dotenv.config();
const rootEnvPath = path.resolve(process.cwd(), '../../.env');
dotenv.config({ path: rootEnvPath });

async function runMigration() {
  console.log('🚀 Running Adventurer Tracking Migration...\n');
  
  try {
    // Read the migration file
    const migrationPath = path.resolve(process.cwd(), '../../supabase/migrations/20250110000000_adventurer_tracking.sql');
    const migrationSQL = fs.readFileSync(migrationPath, 'utf-8');
    
    console.log('📄 Migration file loaded');
    console.log(`   Path: ${migrationPath}\n`);
    
    // Import Supabase client
    const { supabase } = await import('../lib/supabase');
    
    // Check if table already exists
    const { data: existingTable, error: checkError } = await supabase
      .from('adventurers')
      .select('id')
      .limit(1);
    
    if (!checkError && existingTable !== null) {
      console.log('✅ adventurers table already exists!');
      console.log('   Migration may have already been run.\n');
      return;
    }
    
    if (checkError && !checkError.message.includes('table') && !checkError.message.includes('adventurers')) {
      console.error('❌ Error checking table:', checkError);
      return;
    }
    
    console.log('⚠️  Note: This script cannot directly execute DDL (CREATE TABLE) statements.');
    console.log('   Supabase client library does not support schema changes via REST API.\n');
    console.log('📋 Please run this migration using one of these methods:\n');
    console.log('   Option 1: Supabase Dashboard (Recommended)');
    console.log('   1. Go to https://supabase.com/dashboard');
    console.log('   2. Select your project');
    console.log('   3. Navigate to SQL Editor');
    console.log('   4. Copy and paste the contents of:');
    console.log(`      ${migrationPath}`);
    console.log('   5. Click "Run"\n');
    console.log('   Option 2: Supabase CLI');
    console.log('   If you have Supabase CLI installed:');
    console.log('   supabase db push\n');
    console.log('   Option 3: psql (if you have direct database access)');
    console.log(`   psql <connection_string> < ${migrationPath}\n`);
    
    // Show a preview of the migration
    console.log('📄 Migration Preview (first 20 lines):');
    console.log('─'.repeat(60));
    const lines = migrationSQL.split('\n').slice(0, 20);
    lines.forEach((line, idx) => {
      console.log(`${String(idx + 1).padStart(3, ' ')} | ${line}`);
    });
    if (migrationSQL.split('\n').length > 20) {
      console.log(`    ... (${migrationSQL.split('\n').length - 20} more lines)`);
    }
    console.log('─'.repeat(60));
    
  } catch (error) {
    console.error('❌ Error:', error);
    if (error instanceof Error) {
      console.error('   Stack:', error.stack);
    }
  }
  
  process.exit(0);
}

runMigration();

