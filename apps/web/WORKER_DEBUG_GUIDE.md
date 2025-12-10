# Worker Debug Guide

## Current Issues Found

### 1. Missing Database Tables
**Error**: `Could not find the table 'public.adventurers' in the schema cache`

**Solution**: Run the migration:
```sql
-- Run this in Supabase SQL Editor
-- File: apps/web/contributions/adventurer-tracking/code/database/migration.sql
```

### 2. Missing Dungeons
**Error**: `Dungeon abandoned-cellar not found`

**Solution**: Ensure dungeons are generated before creating runs. Check if world initialization has run.

### 3. Worker Status Check
Run this to check worker and queue status:
```bash
cd apps/web
pnpm tsx scripts/check-worker-status.ts
```

## What to Check in Worker Terminal

When the worker starts, you should see:
1. `✅ Loaded .env file from: [path]`
2. `Worker Environment Loaded. REDIS_URL present: true`
3. `[Worker] Connecting to Redis: redis://...`
4. `[Worker] Redis connected successfully`
5. `[Worker] Redis ping successful`
6. `✅ Run worker loaded`
7. `Workers started. Listening for jobs...`

When a job is processed, you should see:
1. `[Worker] Processing job [id] for run [runId]`
2. `[Worker] Fetching run data from database...`
3. `[Worker] Loading adventurer service...`
4. `[Worker] Starting dungeon run execution...`
5. `[DungeonRun] Starting dungeon run...`
6. `[DungeonRun] === Level 1/[max] ===`
7. `[RoomExecution] Level 1: Executing [roomType] room...`
8. `[Combat] Starting combat...`
9. `[Worker] Dungeon run completed...`

## Common Errors

### "Could not find the table 'public.adventurers'"
- **Cause**: Migration not run
- **Fix**: Run `apps/web/contributions/adventurer-tracking/code/database/migration.sql` in Supabase

### "Dungeon [id] not found"
- **Cause**: Dungeon not generated
- **Fix**: Initialize world or generate dungeon before creating run

### "Status: timeout" in UI
- **Cause**: Job failed but run status wasn't updated
- **Fix**: Check worker terminal for errors. The worker now updates run status on failure.

### No events showing
- **Cause**: Job failed before generating events
- **Fix**: Check worker terminal logs for the specific error

## Next Steps

1. **Run database migrations** - Ensure `adventurers` table exists
2. **Check worker terminal** - Look for error messages when a run is created
3. **Verify Redis connection** - Worker should show "Redis connected successfully"
4. **Check queue status** - Run `pnpm tsx scripts/check-worker-status.ts` to see job status

