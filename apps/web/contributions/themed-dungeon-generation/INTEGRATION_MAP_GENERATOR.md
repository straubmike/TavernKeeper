# Integration with Map Generator System

**⚠️ DEPRECATED:** This file documents integration with the map-generator-system, which has been removed. This documentation is kept for historical reference only and should not be used for new development.

## Overview

The themed dungeon generator was previously integrated with the map generator system. The map generator acted as the "atrium" that coordinated all systems, and it called the themed dungeon generator for richer dungeon provenance and boss generation.

**Note:** The map-generator-system has been deleted. Dungeon generation now happens directly through the themed-dungeon-generation system and world-generation-system.

## Integration Flow

```
Map Generator (Atrium)
  └─> RichContentGenerator.generateDungeonContent(dungeon, themedGenerator)
       ├─> ThemedDungeonGenerator.generateProvenance()
       │   └─> Returns: builder, purpose, age, history, originalDepth
       │
       └─> ThemedDungeonGenerator.generateBosses(seed, depth, age)
           └─> Returns: finalBoss, midBosses (with age-based difficulty)
```

## What the Map Generator Uses

### 1. Provenance Generation

The map generator calls `ThemedDungeonGenerator.generateProvenance()` which provides:

- **14 Builders** (vs 5 in old system):
  - 6 Practical constructions (repurposed over time)
  - 8 Dungeon-like constructions (built as dungeons)
  
- **Builder-Matched Purposes**: Each builder has 5 specific purposes
  - Example: Gnomish Workshop → mechanical workshop, invention laboratory, etc.
  - Example: Dark Necromancer Cult → necromantic research, undead laboratory, etc.

- **Age**: 50, 100, 200, 500, or 1000 years ago

- **Original Depth**: Calculates how deep the dungeon was originally
  - Recent (< 200 years): Started at 20-40% of current depth
  - Ancient (200-500 years): Started at 10-30% of current depth
  - Legendary (500+ years): Started at 5-20% of current depth

- **History**: Rich history text that explains:
  - How the dungeon started (practical vs dungeon-like)
  - How it expanded over time
  - Its current state

### 2. Boss Generation

The map generator calls `ThemedDungeonGenerator.generateBosses()` which provides:

- **Final Boss**: At the deepest level
- **Mid-Bosses**: At strategic intervals (every 25 levels)
- **Age-Based Difficulty**: Bosses are harder in older dungeons
  - Recent: 1.0x multiplier
  - Ancient: 1.3x multiplier (30% harder)
  - Legendary: 1.6x multiplier (60% harder)

- **Boss Alignment**: Bosses are generated **after** provenance, so they:
  - Use age for difficulty scaling
  - Can be influenced by dungeon history (future enhancement)
  - Match the dungeon's context

## Format Conversion

The `RichContentGenerator` automatically converts formats:

- Themed generator's `Boss` → `RichDungeonContent['mainBoss']`
- Themed generator's `DungeonProvenance` → `RichDungeonContent['provenance']`

## Usage Example

```typescript
import { ThemedDungeonGenerator } from '@innkeeper/engine/dungeon-generation';
import { RichContentGenerator } from '@innkeeper/engine/map-generation';

// Create generators
const themedGenerator = new ThemedDungeonGenerator();
const richContentGenerator = new RichContentGenerator();

// Generate dungeon structure
const dungeon = await dungeonGenerator.generate({
  seed: 'dungeon-seed',
  entranceX: 10,
  entranceY: -5,
  type: 'dungeon',
  depth: 100,
});

// Generate rich content using themed dungeon generator
const richContent = richContentGenerator.generateDungeonContent(
  dungeon,
  themedGenerator  // Pass themed generator to use richer system
);

// richContent now has:
// - Richer provenance (14 builders, matched purposes)
// - Age-based difficulty bosses
// - Expansion history
// - Aligned boss generation
```

## Benefits

1. **Richer Content**: 14 builders with matched purposes vs 5 with random purposes
2. **Consistent Bosses**: Bosses align with dungeon history through age-based difficulty
3. **Expansion History**: Tracks how dungeons grew over time
4. **Age-Based Difficulty**: Older dungeons have harder bosses
5. **Builder Flavor**: Room descriptions can include builder-specific flavor (when rooms are generated)

## Backward Compatibility

If `themedDungeonGenerator` is not provided to `RichContentGenerator.generateDungeonContent()`, it falls back to the simple generation system (5 builders, random purposes, simple bosses).

## Implementation Details

### Public Methods Exposed

The `ThemedDungeonGenerator` exposes these methods for the map generator:

1. **`generateProvenance(seed, depth, rng?)`**
   - Returns: `DungeonProvenance` with builder, purpose, age, history, originalDepth
   - Used by map generator for richer provenance

2. **`generateBosses(seed, depth, age, rng?)`**
   - Returns: `{ finalBoss: Boss, midBosses: Boss[] }`
   - Used by map generator for age-aligned boss generation

### Interface

The map generator uses `ThemedDungeonGeneratorInterface` (defined in `map-generator-system/code/integration/themed-dungeon-integration.ts`) which defines the contract for integration.

## Notes

- The map generator remains the "atrium" - it coordinates all systems
- The themed dungeon generator provides richer content when called
- Bosses are aligned with provenance through age-based difficulty
- All generation remains deterministic (seed-based)
- The integration is optional - map generator can work without it (backward compatible)

