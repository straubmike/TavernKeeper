# Themed Dungeon Generation System

## ⚠️ Primary Implementation: TypeScript

**The main implementation is TypeScript code in `code/` directory. This is what should be integrated into the game.**

The HTML tool in `tools/dungeon-generator/` is for testing only and is a simplified JavaScript version.

## What This Does

This contribution provides a themed dungeon generation system for TavernKeeper. The system generates dungeons with pre-generated bosses (mid-bosses and final boss) and on-demand room generation for regular levels.

### Key Features

- **Themed Dungeons**: Multiple dungeon themes (Undead, Fire, Ice, Nature, Shadow, Mechanical, Abyssal, Crystal) that influence monster types, room types, and atmosphere
- **Pre-Generated Bosses**: Final boss at the bottom and mid-bosses at strategic intervals (e.g., every 25 levels)
- **Boss Theme Influence**: Bosses influence theme selection (e.g., Necromancer → Undead theme)
- **On-Demand Room Generation**: Regular levels generate rooms on-demand as the player progresses
- **Deterministic**: Seed-based generation for reproducibility
- **List Data Structure**: Level layout stored as a list for deterministic access

## Game Flow

1. **Player clicks "Enter Dungeon"** → Blockchain backend processes (not this system's concern)
2. **Get list of dungeons** → Query available dungeons
3. **Choose one randomly** → Select from available dungeons
4. **Begin building** → Check dungeon depth
5. **Assign bosses** → Final boss at bottom, mid-bosses at intervals
6. **Consider boss influence** → Boss type influences theme selection
7. **Select theme** → Choose appropriate theme based on boss
8. **Fill dungeon levels** → Create level layout structure
9. **Generate rooms on-demand** → As player progresses, generate rooms from templates

## Quick Start (Integration)

The TypeScript code is ready to integrate. Main entry point:

```typescript
import { ThemedDungeonGenerator } from '@innkeeper/engine/dungeon-generation';

const generator = new ThemedDungeonGenerator();

// Generate a dungeon
const dungeon = await generator.generate({
  seed: 'my-dungeon-seed',
  depth: 100,
});

// Get a room for a level (on-demand)
const room = generator.getRoomForLevel(dungeon, 25);
```

**All code is in `code/` directory - this is the primary implementation.**

## Where It Should Be Integrated

### Type Definitions
- `packages/lib/src/types/dungeon-generation.ts` - Copy from `code/types/dungeon-generation.ts`
- `packages/lib/src/index.ts` - Export new types

### Dungeon Generator System
- `packages/engine/src/dungeon-generation/` - Copy entire `code/` directory structure:
  - `dungeon-generator.ts` - Main dungeon generator (from `code/generators/dungeon-generator.ts`)
  - `theme-generator.ts` - Theme selection logic (from `code/generators/theme-generator.ts`)
  - `boss-generator.ts` - Boss generation (from `code/generators/boss-generator.ts`)
  - `room-generator.ts` - On-demand room generation (from `code/generators/room-generator.ts`)
  - `themes/theme-definitions.ts` - Theme definitions (from `code/themes/theme-definitions.ts`)
  - `index.ts` - Main export (from `code/index.ts`)

### Integration Points
- `apps/web/app/api/dungeon/route.ts` - API endpoint for dungeon queries
- `apps/web/app/api/dungeon/enter/route.ts` - API endpoint for entering a dungeon
- `apps/web/app/api/dungeon/room/route.ts` - API endpoint for generating rooms on-demand
- `apps/web/lib/services/dungeonService.ts` - Service for dungeon operations

### Database Schema
- `supabase/migrations/YYYYMMDDHHMMSS_dungeons.sql` - Tables for dungeon storage
- Extends world-content-hierarchy tables for dungeon-specific data

## How to Test

### Unit Tests
1. Test dungeon generation with various seeds
2. Test theme selection with boss influence
3. Test boss generation (final and mid-bosses)
4. Test room generation on-demand
5. Test level layout structure

### Integration Tests
1. Generate a dungeon and verify structure
2. Test boss placement at correct levels
3. Test theme selection based on boss influence
4. Test on-demand room generation for various levels
5. Verify deterministic generation with same seed

### Manual Testing
1. Use the HTML tool: `tools/dungeon-generator/dungeon-generator-tool.html`
2. Generate dungeons with different seeds
3. Test theme selection
4. Generate rooms for different levels
5. Verify boss placement and theme influence

## Dependencies

- Uses seeded RNG for deterministic generation
- May integrate with `world-content-hierarchy` for provenance tracking
- May integrate with `world-generation-system` for world context

## Breaking Changes

None - this is an additive feature.

## Design Decisions

1. **Pre-Generated Bosses**: Bosses are generated upfront to ensure consistency and allow theme influence
2. **On-Demand Rooms**: Regular rooms are generated on-demand to save memory and allow flexibility
3. **List Data Structure**: Level layout stored as a list for deterministic, indexed access
4. **Boss Theme Influence**: Bosses influence theme selection to create cohesive dungeon experiences
5. **Theme System**: Multiple themes provide variety while maintaining consistency within a dungeon
6. **Deterministic Generation**: Seed-based generation ensures reproducibility

## Dungeon Structure

```
Themed Dungeon
├── Metadata (seed, depth, theme, name)
├── Final Boss (pre-generated at bottom level)
├── Mid-Bosses (pre-generated at intervals)
└── Level Layout (list structure)
    ├── Level 1
    │   ├── Boss: null
    │   └── Room Template (for on-demand generation)
    ├── Level 25
    │   ├── Boss: Mid-Boss (pre-generated)
    │   └── Room Template
    ├── ...
    └── Level 100
        ├── Boss: Final Boss (pre-generated)
        └── Room Template
```

## Code Structure

```
contributions/themed-dungeon-generation/
├── README.md (this file)
├── DESIGN.md (design overview)
├── code/
│   ├── types/
│   │   └── dungeon-generation.ts      # Type definitions
│   ├── themes/
│   │   └── theme-definitions.ts       # Theme definitions
│   └── generators/
│       ├── dungeon-generator.ts        # Main generator
│       ├── theme-generator.ts          # Theme selection
│       ├── boss-generator.ts           # Boss generation
│       └── room-generator.ts           # Room generation
└── examples/
    └── usage-examples.ts               # Usage examples

tools/dungeon-generator/
├── dungeon-generator-tool.html         # HTML testing tool
└── README.md                           # Tool documentation
```

## Integration Example

```typescript
import { ThemedDungeonGenerator } from '@innkeeper/engine/dungeon-generation';

const generator = new ThemedDungeonGenerator();

// Generate a dungeon
const dungeon = await generator.generate({
  seed: 'my-dungeon-seed',
  depth: 100,
});

// Get a room for a specific level (on-demand)
const room = generator.getRoomForLevel(dungeon, 25);

console.log(`Room: ${room.room.name}`);
console.log(`Encounter: ${room.encounter?.name}`);
```

## Testing Tool

The HTML tool in `tools/dungeon-generator/dungeon-generator-tool.html` is for **testing only**. It's a simplified JavaScript version that mirrors the TypeScript implementation for quick visualization and testing. **Do not use it as the source of truth** - always refer to the TypeScript code in `code/`.

## Notes

- Dungeon generation is deterministic based on seeds
- Bosses are pre-generated to allow theme influence
- Rooms are generated on-demand to save memory
- Level layout is stored as a list for indexed access
- Theme selection considers boss influence for cohesion
- Default depth is 100 levels, but can be dynamic

