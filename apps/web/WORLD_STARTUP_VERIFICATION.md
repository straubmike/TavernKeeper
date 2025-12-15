# World Initialization on Startup - Verification

## Overview

World initialization happens automatically when workers start. This document verifies the flow and provides testing steps.

## Startup Flow

### 1. Worker Startup (`apps/web/workers/index.ts`)

When workers start, they:
1. Load environment variables
2. **Check and initialize world** (if needed)
3. Start job workers (runWorker, replayWorker, etc.)

**Code:**
```typescript
async function start() {
  // Initialize world on startup if not already initialized
  console.log('🌍 Checking world initialization status...');
  try {
    const { initializeWorldOnStartup } = await import('../lib/services/worldInitializationService');
    await initializeWorldOnStartup();
    console.log('✅ World initialization check complete');
  } catch (error) {
    console.error('❌ World initialization error (non-fatal, workers will continue):', error);
    console.error('   You can manually initialize via: POST /api/world/initialize');
  }
  
  // ... start other workers
}
```

### 2. World Initialization Service (`apps/web/lib/services/worldInitializationService.ts`)

The `initializeWorldOnStartup()` function:
1. Checks if world is already initialized (via database)
2. If not initialized, calls `initializeWorld()`
3. If already initialized, skips (logs message)
4. **Non-fatal**: If it fails, workers still start (can initialize manually later)

**Code:**
```typescript
export async function initializeWorldOnStartup(): Promise<void> {
  console.log('[WORKER] Checking if world needs initialization...');
  try {
    // Check first to avoid unnecessary work
    const initialized = await isWorldInitialized();
    if (initialized) {
      console.log('[WORKER] ✅ World already initialized, skipping generation');
      return;
    }

    console.log('[WORKER] World not initialized, starting generation...');
    await initializeWorld();
    console.log('[WORKER] ✅ World initialization completed successfully');
  } catch (error) {
    console.error('[WORKER] ❌ Failed to initialize world on startup:', error);
    console.error('[WORKER]    This is non-fatal - workers will continue running');
    console.error('[WORKER]    You can manually initialize via: POST /api/world/initialize');
    // Don't throw - allow workers to start even if world init fails
  }
}
```

## Expected Logs

### ✅ **First Time (World Not Initialized)**

```
Worker Environment Loaded. REDIS_URL present: true
🌍 Checking world initialization status...
[WORKER] Checking if world needs initialization...
[WORKER] World not initialized, starting generation...
🌍 Starting world initialization...
📦 Generating world content...
   [1/8] Generating primordials...
✅ Generated world in 2.34s
   - 6 primordials
   - 8 cosmic creators
   - 12 geography entries
   - 10 mortal races
   - 45 conceptual beings
   - 15 demi-gods
   - 25 organizations
   - 50 standout mortals
   - 5 dungeons
💾 Storing world content in database...
✅ World content stored
🏰 Generating 5 themed dungeons...
   [1/5] Generating dungeon: ...
   ✅ Stored dungeon: ...
   [2/5] Generating dungeon: ...
   ✅ Stored dungeon: ...
   ...
✅ Generated and stored 5 themed dungeons
✅ World initialization complete!
[WORKER] ✅ World initialization completed successfully
✅ World initialization check complete
Workers started. Listening for jobs...
```

### ✅ **Subsequent Starts (World Already Initialized)**

```
Worker Environment Loaded. REDIS_URL present: true
🌍 Checking world initialization status...
[WORKER] Checking if world needs initialization...
[WORKER] ✅ World already initialized, skipping generation
✅ World initialization check complete
Workers started. Listening for jobs...
```

### ❌ **Error Case (Non-Fatal)**

```
Worker Environment Loaded. REDIS_URL present: true
🌍 Checking world initialization status...
[WORKER] Checking if world needs initialization...
[WORKER] World not initialized, starting generation...
🌍 Starting world initialization...
❌ Error initializing world: [error details]
[WORKER] ❌ Failed to initialize world on startup: [error details]
[WORKER]    This is non-fatal - workers will continue running
[WORKER]    You can manually initialize via: POST /api/world/initialize
✅ World initialization check complete
Workers started. Listening for jobs...
```

## Testing the Startup Flow

### Test 1: Fresh Start (No World)

1. **Clear world data** (optional, for testing):
   ```sql
   -- In Supabase SQL Editor
   DELETE FROM dungeons;
   DELETE FROM world_content WHERE type = 'world';
   ```

2. **Start workers:**
   ```bash
   cd apps/web
   pnpm start-worker
   ```

3. **Expected:** See full initialization logs (as shown above)

4. **Verify:**
   ```powershell
   Invoke-WebRequest -Uri "http://localhost:3000/api/world/status"
   ```
   Should show `"initialized": true`

### Test 2: Already Initialized

1. **Start workers again** (without clearing data):
   ```bash
   pnpm start-worker
   ```

2. **Expected:** See "World already initialized, skipping generation"

3. **Verify:** Status endpoint still shows `"initialized": true`

### Test 3: Error Handling

1. **Simulate error** (temporarily break Supabase config):
   - Remove `NEXT_PUBLIC_SUPABASE_URL` from `.env`
   - Restart workers

2. **Expected:** 
   - See error logs
   - Workers still start (non-fatal)
   - Can manually initialize via API

3. **Restore config** and verify workers still work

## Manual Initialization (Fallback)

If automatic initialization fails, you can manually initialize:

```powershell
# Check status
Invoke-WebRequest -Uri "http://localhost:3000/api/world/status"

# Initialize manually
Invoke-WebRequest -Uri "http://localhost:3000/api/world/initialize" -Method POST
```

## Key Points

✅ **Automatic**: World initializes automatically on worker startup  
✅ **Idempotent**: Safe to run multiple times (checks first)  
✅ **Non-Fatal**: Workers start even if world init fails  
✅ **Logged**: Clear logs show what's happening  
✅ **Manual Fallback**: Can initialize via API if needed  

## Troubleshooting

### Issue: "World initialization hangs"

- **Check:** Worker terminal for progress logs
- **Wait:** Generation can take 30-60 seconds
- **Verify:** CPU usage (should be high during generation)
- **See:** `WORLD_INIT_DEBUG.md` for more details

### Issue: "Workers don't start"

- **Check:** Error logs in worker terminal
- **Verify:** Supabase configuration in `.env`
- **Try:** Manual initialization via API

### Issue: "World not initializing"

- **Check:** Worker logs for error messages
- **Verify:** Database tables exist (run migrations)
- **Check:** Supabase credentials are correct
- **Try:** Manual initialization to see specific error

