# Grid Entity Registration Implementation

## Overview

This document describes the implementation of entity registration for grid-based entities (bosses, mid-bosses, organizations, and leaders) that appear on the 2D surface grid around year 1000 before era. These entities are now properly registered with entity IDs and have associated history.

## Problem Statement

Around year 1000 before era, the game starts populating the 2D surface grid with generic features of the world. Some entities that should be linkable with pop-up details weren't working because:

1. **Bosses and mid-bosses** - Were only having events logged, not registered as entities
2. **Organizations on the grid** - Had entity IDs in metadata but weren't registered in the entity registry
3. **Leaders from organizations** - Had entity IDs but weren't registered as entities and had no history

## Solution

### TypeScript Implementation

Two helper files were created in `code/helpers/`:

#### 1. `boss-entity-helper.ts`

Contains the `registerBossEntity()` function that:
- Registers bosses and mid-bosses as `StandoutMortal` entities with type `dungeon_boss`
- Determines appropriate race based on boss type
- Calculates when boss took control of dungeon level (50-150 years after dungeon creation)
- Sets power level (80-100 for main bosses, 50-80 for mid-bosses)
- Logs boss history events

#### 2. `grid-entity-helpers.ts`

Contains two functions:

- **`registerGridOrganization()`** - Registers organizations that appear on the grid:
  - Creates `Organization` entities with proper magnitude and purpose
  - Determines membership size based on organization type
  - Links to race and location
  - Logs organization founding events

- **`registerGridLeader()`** - Registers leaders from grid organizations:
  - Creates `StandoutMortal` entities with appropriate standout type
  - Determines power level and alignment based on leader type
  - Generates powers based on leader type (magic, leadership, combat, etc.)
  - Logs leader birth and rise to power events

### HTML Tool Implementation

Updated `map-visualization-tool.html` to:

1. **Register Bosses** - Added `registerBossEntity()` method that:
   - Registers main bosses and mid-bosses as entities with proper IDs
   - Maps boss types to races
   - Creates history events for boss control of dungeon levels

2. **Register Organizations** - Added `registerGridOrganization()` method that:
   - Registers organizations with entity IDs
   - Links to races and locations
   - Logs founding events

3. **Register Leaders** - Added `registerGridLeader()` method that:
   - Registers leaders as standout mortal entities
   - Determines leader type from name/title
   - Logs birth and rise to power events

4. **Updated Generation Code** - Modified cell generation to:
   - Call `registerBossEntity()` for main bosses and mid-bosses
   - Call `registerGridOrganization()` for organizations on the grid
   - Call `registerGridLeader()` for leaders from those organizations

## Entity Types

### Bosses
- **Type**: `standout_mortal` with `standoutType: 'dungeon_boss'`
- **Entity ID Format**: `boss-{dungeonId}-{main|mid}-{level}`
- **Metadata**: Includes boss type, dungeon info, powers, level, age, alignment

### Organizations
- **Type**: `organization`
- **Entity ID Format**: `org-grid-{x}-{y}-{name}`
- **Metadata**: Includes magnitude, purpose, members, grid coordinates, age

### Leaders
- **Type**: `standout_mortal` with appropriate `standoutType` (king, queen, war_chief, necromancer, etc.)
- **Entity ID Format**: `leader-{organizationId}-{name}`
- **Metadata**: Includes level, age, powers, alignment, grid coordinates, organization info

## History Events

All entities have associated history events:

- **Bosses**: Event when they took control of dungeon level
- **Organizations**: Founding event with founder name (if leader exists)
- **Leaders**: Birth event and rise to power event

## Usage in TypeScript

```typescript
import { registerBossEntity, registerGridOrganization, registerGridLeader } from '../helpers';

// Register a boss
const bossEntity = registerBossEntity(context, {
  name: 'Malachar the Eternal',
  type: 'Lich',
  level: -5,
  dungeonId: 'dungeon-10-15',
  dungeonName: 'Ancient Caverns',
  powers: ['Dark Magic', 'Necromancy', 'Curses'],
  description: '...',
  history: '...',
  isMainBoss: true,
  dungeonAge: 500,
});

// Register an organization
const orgEntityId = registerGridOrganization(context, {
  name: 'The Iron Kingdom',
  type: 'kingdom',
  raceId: 'race-humans',
  raceName: 'Humans',
  locationId: 'geo-plains',
  locationName: 'The Great Plains',
  gridX: 10,
  gridY: 15,
  age: 200,
  leaderName: 'King Aethelred',
  leaderType: 'king',
});

// Register a leader
const leaderEntityId = registerGridLeader(context, {
  name: 'King Aethelred the Great',
  organizationId: orgEntityId,
  organizationName: 'The Iron Kingdom',
  raceId: 'race-humans',
  raceName: 'Humans',
  locationId: 'geo-plains',
  locationName: 'The Great Plains',
  leaderType: 'king',
  gridX: 10,
  gridY: 15,
  birthYear: -230,
  riseToPowerYear: -200,
});
```

## Usage in HTML Tool

The HTML tool automatically calls these registration functions when:
- Dungeons are generated (bosses and mid-bosses)
- Cell features are processed (organizations and leaders)

All entities are registered in the `EntityRegistry` and are linkable in the world history tool.

## Notes

- Bosses can share names across dungeons (they're unique by position)
- Organizations are unique by grid position
- Leaders are linked to their organizations
- All entities have proper entity IDs for linking in pop-ups
- History events are logged with proper years and metadata