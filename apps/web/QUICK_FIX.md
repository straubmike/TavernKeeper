# Quick Fix: "Processing 0 raw events" Issue

## Root Cause
The `adventurers` table is missing from your database. This causes dungeon runs to fail immediately when the worker tries to load party members.

## Immediate Fix

### Step 1: Run the Migration

**Option A: Supabase Dashboard (Easiest)**
1. Go to https://supabase.com/dashboard
2. Select your project
3. Click "SQL Editor" → "New query"
4. Open: `supabase/migrations/20250110000000_adventurer_tracking.sql`
5. Copy ALL contents and paste into SQL Editor
6. Click "Run"

**Option B: Verify it worked**
```bash
cd apps/web
pnpm tsx scripts/check-latest-run-error.ts
```
You should see: `✅ adventurers table exists`

### Step 2: Restart the Worker

After running the migration, restart your worker:
1. Stop the current worker (Ctrl+C in the worker terminal)
2. Start it again: `cd apps/web && pnpm start-worker`

### Step 3: Try a New Run

1. Go to your map view
2. Select a party
3. Start a dungeon run
4. The battle screen should now show events instead of "Processing 0 raw events"

## Where to Find Worker Debug Messages

The worker terminal will show messages like:
- `[Worker] Processing run job: <job-id>`
- `[Worker] Run simulation completed in Xms`
- `[DungeonRun] Loading dungeon...`
- `[DungeonRun] Processing level 1...`
- `[Combat] Combat started...`

**Look for:**
- A terminal running `pnpm start-worker` or `pnpm tsx workers/index.ts`
- Messages prefixed with `[Worker]`, `[DungeonRun]`, or `[Combat]`
- Any red error messages

## What You Should See After Fix

✅ **Before Migration:**
- Status: "error"
- Events: 0
- Console: "Processing 0 raw events"

✅ **After Migration:**
- Status: "completed" or "active"
- Events: Multiple events (combat, traps, loot, etc.)
- Console: "Processing X raw events" where X > 0
- Battle screen shows detailed turn-by-turn combat

## Still Having Issues?

1. **Check worker terminal for errors**
   - Look for database errors
   - Look for Redis connection errors

2. **Check queue status**
   ```bash
   cd apps/web
   pnpm tsx scripts/check-worker-status.ts
   ```

3. **Check latest run error**
   ```bash
   cd apps/web
   pnpm tsx scripts/check-latest-run-error.ts
   ```

