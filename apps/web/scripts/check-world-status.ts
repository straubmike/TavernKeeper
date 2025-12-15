/**
 * Check World Initialization Status
 * 
 * Quick script to check if world is initialized and show details
 */

import dotenv from 'dotenv';
import path from 'path';

// Load environment variables - try multiple locations
const scriptDir = __dirname;
const webDir = path.resolve(scriptDir, '..');
const rootDir = path.resolve(webDir, '../..');

dotenv.config({ path: path.resolve(webDir, '.env') }); // apps/web/.env
dotenv.config({ path: path.resolve(webDir, '.env.local') }); // apps/web/.env.local
dotenv.config({ path: path.resolve(rootDir, '.env') }); // Root .env
dotenv.config({ path: path.resolve(rootDir, '.env.local') }); // Root .env.local

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL ||
    process.env.SUPABASE_URL ||
    process.env.SUPABASE_PROJECT_URL ||
    process.env.NEXT_PUBLIC_SUPABASE_PROJECT_URL;

const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY ||
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY ||
    process.env.SUPABASE_ANON_KEY ||
    process.env.SUPABASE_API_KEY;

if (!supabaseUrl || !supabaseKey) {
    console.error('❌ Missing Supabase credentials');
    console.error('   Please set NEXT_PUBLIC_SUPABASE_URL and NEXT_PUBLIC_SUPABASE_ANON_KEY');
    process.exit(1);
}

async function supabaseFetch(table: string, select: string = '*', filters?: string) {
    const url = `${supabaseUrl}/rest/v1/${table}?select=${select}${filters ? `&${filters}` : ''}`;
    const headers: Record<string, string> = {
        'apikey': supabaseKey as string,
        'Authorization': `Bearer ${supabaseKey}`,
        'Content-Type': 'application/json',
    };

    const res = await fetch(url, { method: 'GET', headers });
    
    if (res.status === 404 || res.status === 406) {
        return null; // Table doesn't exist or no rows
    }
    
    if (!res.ok) {
        const text = await res.text();
        throw new Error(`Supabase Error ${res.status}: ${text}`);
    }

    return res.json();
}

async function checkWorldStatus() {
    console.log('🌍 Checking World Initialization Status...\n');

    try {
        // 1. Check world_content table
        console.log('1. Checking world_content table...');
        try {
            const worldContent = await supabaseFetch('world_content', 'id,type,name', 'type=eq.world');
            if (worldContent && worldContent.length > 0) {
                console.log(`   ✅ Found ${worldContent.length} world entry(ies)`);
                worldContent.forEach((w: any) => {
                    console.log(`      - ${w.name || w.id} (${w.type})`);
                });
            } else {
                console.log('   ⚠️  No world entries found');
            }
        } catch (e: any) {
            if (e.message.includes('relation "world_content" does not exist')) {
                console.log('   ❌ world_content table does not exist (migration not run?)');
            } else {
                console.log(`   ❌ Error: ${e.message}`);
            }
        }

        // 2. Check dungeons table
        console.log('\n2. Checking dungeons table...');
        try {
            const dungeons = await supabaseFetch('dungeons', 'id,seed,map,created_at');
            if (dungeons && dungeons.length > 0) {
                console.log(`   ✅ Found ${dungeons.length} dungeon(s)`);
                dungeons.slice(0, 5).forEach((d: any) => {
                    const mapData = typeof d.map === 'string' ? JSON.parse(d.map) : d.map;
                    const name = mapData?.name || 'Unknown';
                    const depth = mapData?.depth || '?';
                    const theme = mapData?.theme?.name || mapData?.theme?.id || '?';
                    console.log(`      - ${name} (seed: ${d.seed}, depth: ${depth}, theme: ${theme})`);
                });
                if (dungeons.length > 5) {
                    console.log(`      ... and ${dungeons.length - 5} more`);
                }
            } else {
                console.log('   ⚠️  No dungeons found');
            }
        } catch (e: any) {
            if (e.message.includes('relation "dungeons" does not exist')) {
                console.log('   ❌ dungeons table does not exist (migration not run?)');
            } else {
                console.log(`   ❌ Error: ${e.message}`);
            }
        }

        // 3. Check via API endpoint (if server is running)
        console.log('\n3. Checking via API endpoint...');
        try {
            const apiResponse = await fetch('http://localhost:3000/api/world/initialize');
            if (apiResponse.ok) {
                const data = await apiResponse.json();
                console.log(`   ✅ API says: ${data.initialized ? 'World is initialized' : 'World is NOT initialized'}`);
            } else {
                console.log('   ⚠️  API endpoint not accessible (is dev server running?)');
            }
        } catch (e: any) {
            console.log('   ⚠️  Could not reach API (dev server may not be running)');
        }

        // 4. Summary
        console.log('\n📊 Summary:');
        try {
            const worldContent = await supabaseFetch('world_content', 'count', 'type=eq.world');
            const dungeons = await supabaseFetch('dungeons', 'count');
            
            const hasWorld = worldContent && worldContent.length > 0;
            const hasDungeons = dungeons && dungeons.length > 0;
            
            if (hasWorld || hasDungeons) {
                console.log('   ✅ World appears to be initialized');
                console.log(`      - World entries: ${hasWorld ? 'Yes' : 'No'}`);
                console.log(`      - Dungeons: ${hasDungeons ? 'Yes' : 'No'}`);
            } else {
                console.log('   ❌ World is NOT initialized');
                console.log('\n   To initialize:');
                console.log('   1. Make sure workers are running: pnpm start-worker');
                console.log('   2. Or manually: POST http://localhost:3000/api/world/initialize');
            }
        } catch (e: any) {
            console.log('   ⚠️  Could not determine status (check errors above)');
        }

    } catch (error) {
        console.error('❌ Error checking world status:', error);
    }
}

checkWorldStatus();

