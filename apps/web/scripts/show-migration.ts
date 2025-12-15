/**
 * Show the migration SQL in a copy-friendly format
 */

import fs from 'fs';
import path from 'path';

const migrationPath = path.resolve(__dirname, '../../../supabase/migrations/20250110000000_adventurer_tracking.sql');
const migrationSQL = fs.readFileSync(migrationPath, 'utf-8');

console.log('\n');
console.log('═'.repeat(70));
console.log('  COPY THE SQL BELOW AND PASTE IT INTO SUPABASE SQL EDITOR');
console.log('═'.repeat(70));
console.log('\n');
console.log(migrationSQL);
console.log('\n');
console.log('═'.repeat(70));
console.log('  INSTRUCTIONS:');
console.log('  1. Select ALL the SQL above (Ctrl+A)');
console.log('  2. Copy it (Ctrl+C)');
console.log('  3. Go to: https://supabase.com/dashboard → Your Project → SQL Editor');
console.log('  4. Click "New query"');
console.log('  5. Paste (Ctrl+V)');
console.log('  6. Click "Run"');
console.log('═'.repeat(70));
console.log('\n');

