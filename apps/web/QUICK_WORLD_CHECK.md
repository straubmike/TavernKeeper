# Quick World Status Check

## Method 1: API Endpoint (Easiest)

If your dev server is running on `http://localhost:3000`:

```bash
# Check status
curl http://localhost:3000/api/world/initialize

# Or in browser:
# http://localhost:3000/api/world/initialize
```

**Response if initialized:**
```json
{
  "initialized": true,
  "details": {
    "worldEntries": 1,
    "dungeons": 5,
    "hasWorld": true,
    "hasDungeons": true
  }
}
```

**Response if NOT initialized:**
```json
{
  "initialized": false,
  "details": {
    "worldEntries": 0,
    "dungeons": 0,
    "hasWorld": false,
    "hasDungeons": false
  }
}
```

## Method 2: Check Worker Logs

If workers are running, look for:
- `✅ World initialization complete!` = World is initialized
- `✅ World already initialized, skipping...` = Already done
- No message = World not initialized yet

## Method 3: Direct Database Check

If you have Supabase Dashboard access:

```sql
-- Check world content
SELECT COUNT(*) as world_count 
FROM world_content 
WHERE type = 'world';

-- Check dungeons
SELECT COUNT(*) as dungeon_count 
FROM dungeons;

-- List dungeons
SELECT 
  id, 
  seed, 
  map->>'name' as name,
  map->>'depth' as depth,
  created_at
FROM dungeons
LIMIT 10;
```

## Method 4: Initialize World

If world is NOT initialized, you can initialize it:

**Via API:**
```bash
curl -X POST http://localhost:3000/api/world/initialize
```

**Via Workers:**
- Workers automatically initialize on startup
- Just restart workers: `pnpm start-worker`

## Quick Status Indicators

✅ **World is initialized if:**
- API returns `initialized: true`
- `world_content` table has entries with `type = 'world'`
- `dungeons` table has entries
- Worker logs show "World initialization complete"

❌ **World is NOT initialized if:**
- API returns `initialized: false`
- `world_content` table is empty
- `dungeons` table is empty
- No initialization messages in worker logs

