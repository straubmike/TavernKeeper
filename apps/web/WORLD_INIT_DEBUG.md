# World Initialization Debugging Guide

## Problem: World Generation Appears to Hang

If you see `[WEB] 📦 Generating world content...` but nothing happens, here's how to debug:

## 1. Check if Process is Running

**In your worker terminal**, you should see progress logs like:
```
[WEB] 📦 Generating world content...
[WEB] ✅ Generated world in 2.34s
[WEB]    - 6 primordials
[WEB]    - 8 cosmic creators
[WEB]    - 12 geography entries
[WEB]    - 10 mortal races
[WEB]    - 45 conceptual beings
[WEB]    - 15 demi-gods
[WEB]    - 25 organizations
[WEB]    - 50 standout mortals
[WEB]    - 5 dungeons
[WEB] 💾 Storing world content in database...
[WEB] ✅ World content stored
[WEB] 🏰 Generating 5 themed dungeons...
[WEB]    [1/5] Generating dungeon: ...
[WEB]    ✅ Stored dungeon: ...
[WEB] ✅ Generated and stored 5 themed dungeons
[WEB] ✅ World initialization complete!
```

**If you don't see these logs**, the process may be:
- Still running (world generation can take 30-60 seconds)
- Stuck on a specific step
- Encountered an error (check for red error messages)

## 2. Check API Status (Without Hanging)

The `/api/world/status` endpoint now has a 5-second timeout to prevent hanging:

```powershell
# Quick check (won't hang)
Invoke-WebRequest -Uri "http://localhost:3000/api/world/status" -TimeoutSec 10
```

**Expected responses:**

✅ **If Supabase is configured:**
```json
{
  "initialized": true/false,
  "hasWorld": true/false,
  "hasDungeons": true/false,
  "worldEntries": 1,
  "dungeonCount": 5,
  "dungeons": [...]
}
```

❌ **If Supabase is NOT configured:**
```json
{
  "initialized": false,
  "errors": {
    "worldError": "Missing Supabase Configuration...",
    "dungeonError": "Missing Supabase Configuration..."
  },
  "config": {
    "hasUrl": false,
    "hasKey": false
  }
}
```

## 3. Fix Supabase Configuration

If you see "Missing Supabase Configuration", add these to your `.env` file:

```env
NEXT_PUBLIC_SUPABASE_URL=https://your-project.supabase.co
NEXT_PUBLIC_SUPABASE_ANON_KEY=your-anon-key-here
```

**Where to find these:**
1. Go to your Supabase Dashboard
2. Project Settings → API
3. Copy "Project URL" → `NEXT_PUBLIC_SUPABASE_URL`
4. Copy "anon public" key → `NEXT_PUBLIC_SUPABASE_ANON_KEY`

**After adding env vars:**
- Restart your dev server: `pnpm dev`
- Restart workers: `pnpm start-worker`

## 4. Check if World Generation Completed

Even if the terminal shows it's done, verify in the database:

**Option A: Via Supabase Dashboard**
1. Go to Supabase Dashboard → Table Editor
2. Check `world_content` table - should have 1 row with `type = 'world'`
3. Check `dungeons` table - should have multiple rows

**Option B: Via API**
```powershell
# Check status
Invoke-WebRequest -Uri "http://localhost:3000/api/world/status" | Select-Object -ExpandProperty Content
```

## 5. Common Issues

### Issue: "World generation hangs at 'Generating world content...'"

**Possible causes:**
- World generation is CPU-intensive and can take 30-60 seconds
- Check CPU usage - if it's high, it's probably working
- Wait at least 60 seconds before assuming it's stuck

**Solution:**
- Wait longer (up to 2 minutes)
- Check worker terminal for any error messages
- If truly stuck, restart workers and try again

### Issue: "API endpoint hangs"

**Solution:**
- The status endpoint now has a 5-second timeout
- If it still hangs, check your Supabase connection
- Try the `/api/world/progress` endpoint (doesn't require DB)

### Issue: "Missing Supabase Configuration"

**Solution:**
- Add `NEXT_PUBLIC_SUPABASE_URL` and `NEXT_PUBLIC_SUPABASE_ANON_KEY` to `.env`
- Restart both dev server and workers
- Verify with `/api/world/status`

## 6. Manual Initialization

If automatic initialization isn't working:

```powershell
# Trigger manual initialization
Invoke-WebRequest -Uri "http://localhost:3000/api/world/initialize" -Method POST
```

This will:
- Check if already initialized (skips if yes)
- Generate world content
- Store in database
- Generate dungeons
- Return success/error message

## 7. Progress Tracking

**New progress logs show:**
- Generation time
- Counts for each entity type
- Per-dungeon progress
- Success/error for each step

**Watch your worker terminal** for these detailed logs!

