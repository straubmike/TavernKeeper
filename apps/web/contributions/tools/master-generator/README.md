# Master Generation Tool

A comprehensive HTML tool that unifies all generation systems (World, Map, Dungeon, Item) into a single tabbed interface with full integration between systems.

## Overview

The master tool provides a unified interface for testing and exploring all generation systems as they would integrate in the main game. It's designed as a standalone HTML file with all code embedded inline.

## Features

### Systems Implemented

1. **World Generation** (100% complete - All 9 Levels)
   - **Level 1**: Primordials - Fundamental forces of the universe
   - **Level 2**: Cosmic Creators - Elemental beings that shaped the world
   - **Level 2.5**: Geography - Physical features (23 types with full templates)
   - **Level 3**: Conceptual Beings - Gods born from mortal worship
   - **Level 4**: Demi-Gods - Divine experiments and ancient beings (6 types with subtypes, powers, alignments)
   - **Level 5**: Mortal Races - Intelligent races with homelands
   - **Level 6**: Organizations - Race-based groups (kingdoms, guilds, hordes, etc.)
   - **Level 6.5**: Standout Mortals - Heroes, villains, and powerful individuals
   - **Level 7**: Family & Role - Family lineages with individual members and roles
   - Automatic dependency handling
   - World events generation (e.g., necromancer towers)

2. **Map Generation** (Functional)
   - Grid generation for specified regions
   - Coordinate-based cell system
   - World context integration (geography mapping, organization placement)
   - Feature placement (landmarks, ruins, trading posts)
   - Dungeon entrance generation
   - Interactive grid visualization with cell details

3. **Dungeon Generation** (Functional)
   - Themed dungeon generation (8 themes)
   - Final boss and mid-boss generation
   - Provenance/history system
   - On-demand room generation
   - World + Map context integration
   - Standout mortals as potential bosses

4. **Item Generation** (Complete)
   - Full port of ItemGenerator class
   - All weapon and armor types
   - Scarcity system with localStorage persistence
   - Rarity distribution with modifiers
   - Class-specific item requirements

### Integration

- **World → Map**: Geography mapping, organization placement, world event detection
- **Map → Dungeon**: Location selection from dungeon entrances, geography linkage
- **World → Dungeon**: Standout mortals as bosses, world events in provenance, location-based filtering
- **Shared Context**: Real-time statistics panel showing integration across all systems

## Usage

1. Open `master-generator-tool.html` in a web browser
2. Select a tab (World, Map, Dungeon, or Item)
3. Configure parameters in the left sidebar
4. Click "Generate" button
5. View results in the main area
6. Use shared context panel (right sidebar) to see cross-system data

## Integration Flow

```
World Generation (Tab 1)
  ├─ Generates: 9 levels (Primordials → Family)
  ├─ Produces: Geography entities with IDs
  ├─ Produces: Organizations with IDs
  ├─ Produces: Standout Mortals with location (geography ID)
  └─ Stores: GeneratedWorld in shared context
    ↓
Map Generation (Tab 2)
  ├─ Uses: World Geography entities (coordinate mapping)
  ├─ Uses: World Organizations (placed on map)
  ├─ Generates: MapCell[] with features at coordinates
  └─ Creates: Dungeon entrances with location IDs
    ↓
Dungeon Generation (Tab 3)
  ├─ Uses: buildDungeonWorldContext(world, locationId)
  ├─ Uses: Map location (coordinates, geography ID)
  ├─ Generates: Themed dungeon with bosses
  └─ Bosses can be standout mortals from world
    ↓
Item Generation (Tab 4)
  └─ Standalone (can use dungeon context for loot generation)
```

## Integration Features

### World → Map Integration

- **Geography Mapping**: Deterministic hash-based mapping of coordinates to geography entities
- **Organization Placement**: Organizations from world context placed on map based on location
- **World Events**: Necromancer tower construction events convert dungeons to towers

### Map → Dungeon Integration

- **Location Selection**: Dropdown populated from map dungeon entrances
- **Geography Linkage**: Dungeon entrances store locationId linking to world geography
- **Event Detection**: Tower names linked to necromancer builders from world events

### World → Dungeon Integration

- **World Context Builder**: Filters standout mortals and world events by location
- **Standout Mortals as Bosses**: 40% chance to use evil standout mortals as dungeon bosses
- **Theme Auto-Adjustment**: Theme adjusts based on boss type (necromancer/lich → undead theme)
- **Provenance System**: Uses world events for dungeon history (e.g., necromancer tower construction)

## File Structure

```
apps/web/contributions/tools/master-generator/
├── master-generator-tool.html    # Main tool file (all-in-one HTML, ~2600+ lines)
└── README.md                     # This file
```

## Relationship to TypeScript Source Code

**Important:** This tool is a JavaScript port of the TypeScript generator implementations. Changes to the TypeScript source code will NOT automatically appear in this tool.

### How It Works

- The tool contains JavaScript code embedded inline in the HTML file
- The logic is manually ported from the TypeScript contributions
- It's a standalone snapshot for testing purposes
- No automatic synchronization with TypeScript source

### Keeping in Sync

When you modify TypeScript generators, you'll need to:

1. **Identify affected systems** - Which generator(s) changed?
2. **Update the tool** - Port the TypeScript changes to JavaScript in this tool
3. **Test the changes** - Verify the tool works with the new logic

**Source files to check when updating:**
- World Generation: `apps/web/contributions/world-generation-system/code/`
- Dungeon Generation: `apps/web/contributions/themed-dungeon-generation/code/`
- Item Generation: `apps/web/contributions/procedural-item-generation/code/`

The tool includes comments indicating where code was ported from (e.g., "Ported from apps/web/contributions/...") to help track the source.

## Technical Notes

- Uses Mulberry32 seeded RNG for consistency across all systems
- All code embedded inline (no external dependencies)
- localStorage used for item scarcity system persistence
- Shared context stored in memory during session
- Deterministic generation based on seeds
