# Dungeon Builders and Provenance System - Summary

## Overview

The dungeon generation system now includes a comprehensive builder and provenance system that determines who built dungeons, why they were built, and how they've evolved over time. This information influences room descriptions, difficulty scaling, and dungeon history.

## Builder Categories

Dungeons start in two forms:

### 1. Practical Constructions (Repurposed Over Time)
These were originally built for practical purposes and have been repurposed as dungeons over time.

### 2. Dungeon-Like Constructions (Built as Dungeons)
These were designed as dungeons from the beginning.

## All Available Builders

### Practical Constructions

#### 1. **Ancient Dwarven Kingdom**
- **Category**: Practical
- **Description**: A once-great dwarven civilization that carved deep into the earth
- **Purposes**:
  - mining operation
  - underground city
  - treasure vault
  - forge complex
  - stone quarry
- **Room Flavor**: carved from solid rock, dwarven stonework, ancient mining tunnels, dwarven craftsmanship, stone-hewn chambers

#### 2. **Gnomish Workshop**
- **Category**: Practical
- **Description**: An underground gnomish tinkering and invention facility
- **Purposes**:
  - mechanical workshop
  - invention laboratory
  - clockwork factory
  - alchemical research
  - artifact storage
- **Room Flavor**: gnomish machinery, intricate clockwork, mechanical contraptions, gnomish engineering, whirring gears and pipes

#### 3. **Elven Underground Sanctuary**
- **Category**: Practical
- **Description**: An elven refuge built beneath ancient forests
- **Purposes**:
  - nature temple
  - crystal grove
  - ancient library
  - healing sanctuary
  - star observatory
- **Room Flavor**: elven architecture, living roots and vines, natural stone formations, elven craftsmanship, magical crystal formations

#### 4. **Forgotten Human Kingdom**
- **Category**: Practical
- **Description**: A lost human civilization that built extensive underground structures
- **Purposes**:
  - underground city
  - treasure vault
  - wine cellar
  - grain storage
  - catacombs
- **Room Flavor**: ancient human masonry, weathered stone, forgotten architecture, human construction, time-worn passages

#### 5. **Ancient Dragon Lair**
- **Category**: Practical
- **Description**: A dragon's treasure hoard expanded into a vast underground complex
- **Purposes**:
  - treasure hoard
  - dragon nest
  - treasure vault
  - ancient lair
  - hoard chamber
- **Room Flavor**: dragon-carved tunnels, scales embedded in walls, dragon fire marks, ancient dragon lair, treasure-filled chambers

#### 6. **Merchant Guild Vault**
- **Category**: Practical
- **Description**: A merchant guild's secure underground storage and trading post
- **Purposes**:
  - treasure vault
  - trading post
  - warehouse
  - secure storage
  - merchant hall
- **Room Flavor**: merchant architecture, storage chambers, trading halls, secure vaults, commercial construction

### Dungeon-Like Constructions

#### 7. **Dark Necromancer Cult**
- **Category**: Dungeon-Like
- **Description**: A dark cult dedicated to necromancy and undeath
- **Purposes**:
  - necromantic research
  - undead laboratory
  - soul harvesting
  - dark ritual chamber
  - crypt network
- **Room Flavor**: dark necromantic energy, soul-bound walls, death magic infused, necromantic architecture, cursed stonework

#### 8. **Demon Cult**
- **Category**: Dungeon-Like
- **Description**: A cult that worships demons and practices dark rituals
- **Purposes**:
  - demon summoning
  - dark ritual chamber
  - sacrificial altar
  - hellish prison
  - corruption pit
- **Room Flavor**: demonic corruption, hellfire-scarred walls, infernal architecture, demon taint, sulfur-stained stone

#### 9. **Orc War Fortress**
- **Category**: Dungeon-Like
- **Description**: An orc war fortress built for conquest and raiding
- **Purposes**:
  - war fortress
  - prison for captives
  - war camp
  - raiding base
  - trophy hall
- **Room Flavor**: crude orc construction, rough-hewn stone, war trophies, orc craftsmanship, battle-scarred walls

#### 10. **Undead Kingdom**
- **Category**: Dungeon-Like
- **Description**: A kingdom of the undead, ruled by liches and vampires
- **Purposes**:
  - undead city
  - necropolis
  - vampire court
  - lich laboratory
  - death temple
- **Room Flavor**: deathly cold, undead architecture, soul-bound construction, necromantic stonework, eternal darkness

#### 11. **Dark Empire**
- **Category**: Dungeon-Like
- **Description**: A fallen empire that embraced darkness and tyranny
- **Purposes**:
  - underground fortress
  - prison for enemies
  - dark temple
  - torture chamber
  - tyrant's vault
- **Room Flavor**: oppressive architecture, dark imperial design, tyrannical construction, fear-inducing halls, empire stonework

#### 12. **Ancient Beast Lair**
- **Category**: Dungeon-Like
- **Description**: A natural cave system expanded by monstrous creatures
- **Purposes**:
  - beast den
  - monster nest
  - hunting ground
  - creature lair
  - predator's domain
- **Room Flavor**: natural cave formations, beast-carved tunnels, claw marks on walls, monster dens, wild creature lairs

#### 13. **Cursed Temple**
- **Category**: Dungeon-Like
- **Description**: A temple dedicated to dark gods or cursed practices
- **Purposes**:
  - dark temple
  - cursed sanctuary
  - sacrificial chamber
  - blasphemous altar
  - corrupted shrine
- **Room Flavor**: cursed architecture, dark temple design, blasphemous stonework, corrupted halls, temple of darkness

#### 14. **Wizard's Prison**
- **Category**: Dungeon-Like
- **Description**: A magical prison built to contain dangerous creatures and artifacts
- **Purposes**:
  - magical prison
  - containment facility
  - arcane vault
  - sealed chamber
  - warded prison
- **Room Flavor**: magical wards, arcane architecture, warded stonework, prison design, containment chambers

## Dungeon Age and Expansion

### Age Categories
Dungeons can be:
- **50, 100, 200, 500, or 1000 years old**

### Original Depth Calculation
Dungeons expand over time. The original depth is calculated based on age:

- **Recent (< 200 years)**: Started at 20-40% of current depth
- **Ancient (200-500 years)**: Started at 10-30% of current depth
- **Legendary (500+ years)**: Started at 5-20% of current depth

Example: A 1000-year-old dungeon that's now 100 levels deep likely started as only 5-20 levels.

### History Generation

**Practical Constructions:**
```
"This dungeon began {age} years ago as a {purpose} built by the {builder}. 
What started as a practical construction has been repurposed, abandoned, 
and reclaimed over time. [Expansion text if applicable] The deepest levels 
hold secrets that have been lost to time, and dark creatures now call it home."
```

**Dungeon-Like Constructions:**
```
"This dungeon was built {age} years ago by the {builder} as a {purpose}. 
From the beginning, it was designed as a place of darkness and danger. 
[Expansion text if applicable] Over the centuries, it has been abandoned, 
conquered, and reclaimed by various forces. The deepest levels hold secrets 
that have been lost to time, and dark creatures now call it home."
```

## Age-Based Difficulty Scaling

Age affects the difficulty of bosses and encounters:

### Difficulty Multipliers
- **Recent (< 200 years)**: 1.0x (base difficulty)
- **Ancient (200-500 years)**: 1.3x (30% harder)
- **Legendary (500+ years)**: 1.6x (60% harder)

### Application
- **Bosses**: Base difficulty multiplied by age multiplier
- **Room Encounters**: Base difficulty multiplied by age multiplier
- **Room Difficulty Range**: Adjusted based on age

## Room Description Integration

Room descriptions now include builder-specific flavor text:

Example: "A shadow realm room on level 25. The walls show dwarven stonework. Darkness clings to everything like a physical presence. The air is tense with anticipation of battle."

The builder flavor is randomly selected from the builder's flavor list, ensuring variety while maintaining consistency with the dungeon's origin.

## Implementation Locations

### TypeScript (Primary)
- `code/builders/dungeon-builders.ts` - Builder definitions and utilities
- `code/generators/dungeon-generator.ts` - Provenance generation
- `code/generators/room-generator.ts` - Room description with builder flavor
- `code/generators/boss-generator.ts` - Age-based difficulty scaling
- `code/types/dungeon-generation.ts` - DungeonProvenance interface

### HTML Tool (Testing)
- `tools/dungeon-generator/dungeon-generator-tool.html` - Simplified JavaScript version

## Summary Statistics

- **Total Builders**: 14
  - **Practical**: 6 builders
  - **Dungeon-Like**: 8 builders
- **Total Purposes**: 70 unique purposes (5 per builder)
- **Age Options**: 5 (50, 100, 200, 500, 1000 years)
- **Difficulty Multipliers**: 3 tiers (1.0x, 1.3x, 1.6x)
- **Room Flavor Options**: 70 unique flavors (5 per builder)

All generation is deterministic based on the dungeon seed, ensuring reproducibility.