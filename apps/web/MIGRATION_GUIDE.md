# Database Migration Guide

## Problem
The `adventurers` table is missing, causing dungeon runs to fail immediately with "error" status.

## Solution
Run the adventurer tracking migration to create the required tables.

## Quick Fix (Supabase Dashboard - Recommended)

1. **Open Supabase Dashboard**
   - Go to https://supabase.com/dashboard
   - Select your project

2. **Open SQL Editor**
   - Click "SQL Editor" in the left sidebar
   - Click "New query"

3. **Run the Migration**
   - Open the file: `supabase/migrations/20250110000000_adventurer_tracking.sql`
   - Copy ALL contents
   - Paste into the SQL Editor
   - Click "Run" (or press Ctrl+Enter)

4. **Verify**
   - Check the output - you should see "Success. No rows returned"
   - Run this script to verify: `pnpm tsx scripts/check-latest-run-error.ts`
   - It should now show: `✅ adventurers table exists`

## Alternative: Supabase CLI

If you have Supabase CLI installed:

```bash
# Link to your project (if not already linked)
supabase link --project-ref YOUR_PROJECT_REF

# Push migrations
supabase db push
```

## After Migration

Once the migration is complete:
1. The worker should be able to process dungeon runs
2. Runs should no longer fail immediately
3. Events should start appearing in the battle screen

## Debugging Worker Errors

To see worker debug messages:

1. **Find the Worker Terminal**
   - Look for a terminal running: `pnpm start-worker` or `pnpm tsx workers/index.ts`
   - This terminal will show all `[Worker]` and `[DungeonRun]` log messages

2. **Check for Errors**
   - Look for lines starting with `[Worker]` or `[DungeonRun]`
   - Errors will show stack traces
   - Database errors will show table/column names

3. **Check Queue Status**
   - Run: `pnpm tsx scripts/check-worker-status.ts`
   - This shows failed jobs and their errors

4. **Check Latest Run**
   - Run: `pnpm tsx scripts/check-latest-run-error.ts`
   - This shows the most recent run's status and error message

## Common Issues

### "adventurers table does NOT exist"
- **Solution**: Run the migration (see above)

### "Dungeon not found"
- **Solution**: Ensure you have created a dungeon in the database first

### "Party member not found"
- **Solution**: Ensure adventurers are created in the `adventurers` table for the party members

### "Redis connection failed"
- **Solution**: Check `REDIS_URL` in `.env` file and ensure Redis is running

