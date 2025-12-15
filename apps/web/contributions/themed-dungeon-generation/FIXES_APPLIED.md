# Fixes Applied for Necromancer Integration

## Issues Fixed

### 1. Necromancers Generated as Mid-Bosses
**Problem**: Necromancers were being generated as mid-bosses (e.g., "Vex the Death-Caller took control of level 75"), appearing as standalone entities without history.

**Fix**:
- Removed 'Necromancer' from `MID_BOSS_TYPES` in `boss-generator.ts`
- Updated `generateBosses()` to exclude necromancers when checking for mid-boss candidates
- Updated `generate()` to exclude necromancers when checking for mid-boss candidates
- Necromancers can now ONLY be final bosses of their own towers (from world generation)

### 2. `generateBosses()` Not Using World Context
**Problem**: The `generateBosses()` method wasn't accepting or using `worldContext`, so it couldn't use standout mortals from world generation.

**Fix**:
- Updated `generateBosses()` signature to accept `worldContext` and `provenance` parameters
- Added logic to check for builder mortal first (if dungeon was built by a standout mortal)
- Added logic to check for evil standout mortals at location (40% chance for final boss)
- Added logic to check for other standout mortals for mid-bosses (30% chance, excluding necromancers)
- Updated `ThemedDungeonGeneratorInterface` to reflect new signature

### 3. Mid-Bosses Not Using World Context
**Problem**: The `generate()` method was generating mid-bosses without checking for world context.

**Fix**:
- Updated `generate()` to check for standout mortals when generating mid-bosses
- Excludes necromancers from mid-boss selection
- Excludes the final boss from mid-boss selection
- Falls back to generated mid-boss if no suitable mortal found

## Intended Flow (Now Implemented)

1. **World Generation**:
   - Standout mortals are generated (including necromancers)
   - Necromancers have full history (born to race, possibly in organization)
   - World event created: `{ type: 'built_tower', entityId: necromancerId, locationId: locationId }`

2. **Map Generation**:
   - Detects "built_tower" events at locations
   - Creates dungeon at that location
   - Passes world context to dungeon generator

3. **Dungeon Generation**:
   - `generateProvenance()` detects necromancer tower event
   - Uses `NECROMANCER_BUILDER` and links to necromancer mortal
   - Forces `necromancer-tower` theme
   - `generateBosses()` uses necromancer as final boss (from world generation)
   - Mid-bosses are generated normally (no necromancers)

## What Still Needs to Be Done

### Map Visualization Tool
The map visualization tool (`map-visualization-tool.html`) is currently generating bosses independently and not using the themed dungeon generator. It needs to be updated to:

1. Use the themed dungeon generator when generating dungeon content
2. Pass world context (standout mortals and events) to the dungeon generator
3. Link necromancer towers to the necromancer standout mortal who built them
4. Display full history for standout mortals who become bosses

### Boss Naming
The boss generator uses a limited set of names (e.g., "Vex the Death-Caller" appears repeatedly). Consider:
- Using procedural name generation based on seed
- Expanding the name pool
- Using world generation names when available

## Testing Checklist

- [ ] Necromancer standout mortals from world generation become final bosses of their towers
- [ ] Necromancers are NOT generated as mid-bosses
- [ ] Necromancer towers use necromancer-tower theme
- [ ] Necromancer towers have correct provenance (built by necromancer)
- [ ] Standout mortals retain full history when becoming bosses
- [ ] Events are recorded when mortals become bosses
- [ ] Map visualization tool uses themed dungeon generator

