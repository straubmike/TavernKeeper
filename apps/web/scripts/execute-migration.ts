/**
 * Execute the adventurer tracking migration directly via Supabase Management API
 */

import dotenv from 'dotenv';
import path from 'path';
import fs from 'fs';

// Load environment variables
dotenv.config();
const rootEnvPath = path.resolve(process.cwd(), '../../.env');
dotenv.config({ path: rootEnvPath });

async function executeMigration() {
  console.log('🚀 Executing Adventurer Tracking Migration...\n');
  
  try {
    // Read the migration file
    const migrationPath = path.resolve(process.cwd(), '../../supabase/migrations/20250110000000_adventurer_tracking.sql');
    const migrationSQL = fs.readFileSync(migrationPath, 'utf-8');
    
    console.log('📄 Migration file loaded');
    console.log(`   Path: ${migrationPath}\n`);
    
    // Get Supabase credentials
    const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL ||
      process.env.SUPABASE_URL ||
      process.env.SUPABASE_PROJECT_URL ||
      process.env.NEXT_PUBLIC_SUPABASE_PROJECT_URL;
    
    const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
    
    if (!supabaseUrl) {
      console.error('❌ Missing SUPABASE_URL in environment variables');
      process.exit(1);
    }
    
    if (!serviceRoleKey) {
      console.error('❌ Missing SUPABASE_SERVICE_ROLE_KEY in environment variables');
      console.error('   The service role key is required to execute DDL statements.');
      console.error('   You can find it in: Supabase Dashboard → Settings → API → service_role key\n');
      process.exit(1);
    }
    
    console.log('✅ Supabase credentials found');
    console.log(`   URL: ${supabaseUrl.replace(/\/$/, '')}`);
    console.log(`   Service Role Key: ${serviceRoleKey.substring(0, 20)}...\n`);
    
    // Check if table already exists
    console.log('🔍 Checking if adventurers table already exists...');
    const checkUrl = `${supabaseUrl.replace(/\/$/, '')}/rest/v1/adventurers?select=id&limit=1`;
    const checkResponse = await fetch(checkUrl, {
      method: 'GET',
      headers: {
        'apikey': serviceRoleKey,
        'Authorization': `Bearer ${serviceRoleKey}`,
        'Content-Type': 'application/json',
      },
    });
    
    if (checkResponse.ok) {
      console.log('✅ adventurers table already exists!');
      console.log('   Migration may have already been run.\n');
      return;
    }
    
    if (checkResponse.status !== 404 && !checkResponse.statusText.includes('table')) {
      const errorText = await checkResponse.text();
      console.log(`   Table check returned status ${checkResponse.status}`);
      console.log(`   This is expected if the table doesn't exist yet.\n`);
    }
    
    // Execute SQL via Supabase Management API
    // Note: Supabase doesn't expose a direct SQL execution endpoint via REST API
    // We need to use the PostgREST RPC endpoint or Management API
    // For DDL statements, we'll try using the REST API with a custom approach
    
    console.log('⚠️  Supabase REST API does not support executing arbitrary SQL (DDL statements)');
    console.log('   for security reasons. However, we can try using the Management API.\n');
    
    // Try using Supabase's SQL execution via Management API
    // This requires the Management API which may not be available in all plans
    const managementUrl = `${supabaseUrl.replace(/\/$/, '')}/rest/v1/rpc/exec_sql`;
    
    console.log('📤 Attempting to execute migration via Management API...');
    console.log(`   Endpoint: ${managementUrl}\n`);
    
    // Split SQL into individual statements (basic splitting by semicolon)
    // This is a simplified approach - in production, you'd want a proper SQL parser
    const statements = migrationSQL
      .split(';')
      .map(s => s.trim())
      .filter(s => s.length > 0 && !s.startsWith('--'));
    
    console.log(`   Found ${statements.length} SQL statements to execute\n`);
    
    // Try executing via a custom RPC function (if it exists)
    // Or use direct PostgreSQL connection approach
    console.log('❌ Direct SQL execution via REST API is not supported by Supabase.');
    console.log('   Supabase REST API is designed for data operations, not schema changes.\n');
    console.log('📋 Please use one of these methods instead:\n');
    console.log('   Option 1: Supabase Dashboard (Recommended)');
    console.log('   1. Go to https://supabase.com/dashboard');
    console.log('   2. Select your project');
    console.log('   3. Navigate to SQL Editor');
    console.log('   4. Copy and paste the contents of:');
    console.log(`      ${migrationPath}`);
    console.log('   5. Click "Run"\n');
    console.log('   Option 2: Install Supabase CLI');
    console.log('   npm install -g supabase');
    console.log('   supabase link --project-ref YOUR_PROJECT_REF');
    console.log('   supabase db push\n');
    console.log('   Option 3: Use psql (if you have database connection string)');
    console.log(`   psql <connection_string> < ${migrationPath}\n`);
    
    // Show first few statements as preview
    console.log('📄 Migration Preview (first 3 statements):');
    console.log('─'.repeat(60));
    statements.slice(0, 3).forEach((stmt, idx) => {
      const preview = stmt.length > 100 ? stmt.substring(0, 100) + '...' : stmt;
      console.log(`${String(idx + 1).padStart(3, ' ')} | ${preview.split('\n').join('\n    | ')}`);
    });
    console.log('─'.repeat(60));
    
  } catch (error) {
    console.error('❌ Error:', error);
    if (error instanceof Error) {
      console.error('   Stack:', error.stack);
    }
  }
  
  process.exit(0);
}

executeMigration();

