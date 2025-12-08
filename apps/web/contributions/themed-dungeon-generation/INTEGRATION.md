# Integration Guide

## ΓÜá∩╕Å TypeScript is Primary

**The TypeScript code in `code/` is the PRIMARY implementation.**

The HTML tool in `tools/dungeon-generator/` is a simplified testing tool only. Always use the TypeScript code for integration.

## File Structure

```
code/
Γö£ΓöÇΓöÇ index.ts                          # Main export file - USE THIS
Γö£ΓöÇΓöÇ types/
Γöé   ΓööΓöÇΓöÇ dungeon-generation.ts         # Type definitions
Γö£ΓöÇΓöÇ themes/
Γöé   ΓööΓöÇΓöÇ theme-definitions.ts           # Theme definitions
ΓööΓöÇΓöÇ generators/
    Γö£ΓöÇΓöÇ dungeon-generator.ts           # Main generator class
    Γö£ΓöÇΓöÇ boss-generator.ts              # Boss generation
    Γö£ΓöÇΓöÇ theme-generator.ts             # Theme selection
    ΓööΓöÇΓöÇ room-generator.ts              # Room generation
```

## Integration Steps

### 1. Copy TypeScript Files

Copy the entire `code/` directory structure to:
- `packages/engine/src/dungeon-generation/`

Or integrate into existing structure as appropriate.

### 2. Import and Use

```typescript
import { ThemedDungeonGenerator } from '@innkeeper/engine/dungeon-generation';

const generator = new ThemedDungeonGenerator();
```

### 3. Generate Dungeon

```typescript
const dungeon = await generator.generate({
  seed: 'dungeon-seed-123',
  depth: 100, // or dynamic
});
```

### 4. Get Rooms On-Demand

```typescript
// When player reaches a level
const room = generator.getRoomForLevel(dungeon, levelNumber);
```

## Key Classes

### ThemedDungeonGenerator

Main class for dungeon generation.

**Methods:**
- `generate(options)` - Generate a complete dungeon
- `getRoomForLevel(dungeon, level, roomType?)` - Get room for a level (on-demand)
- `getAvailableDungeons()` - Get list of available dungeons (placeholder)
- `selectRandomDungeon(seed?)` - Select random dungeon (placeholder)

### BossGenerator

Generates final and mid-bosses.

**Methods:**
- `generateFinalBoss(level, seed, rng?)` - Generate final boss
- `generateMidBoss(level, seed, rng?)` - Generate mid-boss

### ThemeGenerator

Selects themes based on boss influence.

**Methods:**
- `selectTheme(seed, themeId?, bossInfluence?)` - Select theme
- `getAllThemes()` - Get all available themes
- `getTheme(themeId)` - Get theme by ID

### RoomGenerator

Generates rooms on-demand.

**Methods:**
- `generateRoom(options)` - Generate a room with encounter

## Type Definitions

All types are in `code/types/dungeon-generation.ts`:

- `ThemedDungeon` - Complete dungeon structure
- `Boss` - Boss entity
- `DungeonTheme` - Theme definition
- `DungeonRoom` - Room structure
- `RoomEncounter` - Encounter in a room
- `DungeonLevelLayout` - Level layout (list structure)
- `RoomTemplate` - Template for room generation
- `DungeonGenerationOptions` - Options for generation
- `RoomGenerationOptions` - Options for room generation

## Game Flow Integration

```typescript
// 1. Player clicks "Enter Dungeon"
// (Blockchain backend processes - not this system's concern)

// 2. Get list of dungeons
const dungeons = await generator.getAvailableDungeons();

// 3. Select random dungeon
const dungeon = await generator.selectRandomDungeon(playerSeed);

// If no dungeons, generate new one
if (!dungeon) {
  dungeon = await generator.generate({
    seed: `dungeon-${Date.now()}`,
    depth: 100,
  });
}

// 4. Dungeon structure is ready
// - Bosses are pre-generated
// - Theme is selected
// - Level layout is created

// 5. As player progresses, generate rooms on-demand
const room = generator.getRoomForLevel(dungeon, currentLevel);
```

## Testing

Use the HTML tool in `tools/dungeon-generator/` for quick testing, but remember:
- It's a simplified JavaScript version
- TypeScript is the source of truth
- Always verify behavior with TypeScript code

## Notes

- All generation is deterministic (seed-based)
- Bosses are pre-generated to influence theme
- Rooms are generated on-demand to save memory
- Level layout is a list for indexed access
- Theme selection considers boss influence