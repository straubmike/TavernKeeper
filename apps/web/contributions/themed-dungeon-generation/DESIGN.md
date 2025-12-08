# Themed Dungeon Generation System - Design Document

## ΓÜá∩╕Å Implementation Note

**The PRIMARY implementation is TypeScript in `code/` directory.**

This design document describes the TypeScript implementation. The HTML tool in `tools/dungeon-generator/` is a simplified testing tool only.

## Overview

The Themed Dungeon Generation System creates dungeons with pre-generated bosses and on-demand room generation. The system emphasizes theme consistency, boss influence on dungeon atmosphere, and deterministic generation.

**All implementation details refer to the TypeScript code in `code/`.**

## Core Concepts

### 1. Themed Dungeons

Each dungeon has a theme that influences:
- **Monster Types**: What types of monsters appear in combat rooms
- **Room Types**: What types of rooms can appear (combat, safe, trap, treasure)
  - **Trap Subtypes**: ambush (appears safe but is combat), mechanical (includes puzzle-like mechanisms), magical (includes puzzle-like enchantments), fake_treasure (treasure disguised as trap)
- **Atmosphere**: Descriptive text that sets the mood
- **Boss Influences**: Which boss types would naturally fit this theme

### 2. Pre-Generated Bosses

Bosses are generated upfront (not on-demand) because:
- They need to influence theme selection
- They provide structure and goals for the dungeon
- They ensure consistency across dungeon runs

**Boss Types:**
- **Final Boss**: At the bottom level (level 100, or dynamic depth)
- **Mid-Bosses**: At strategic intervals (e.g., every 25 levels)

### 3. Boss Theme Influence

Bosses influence theme selection:
- **Necromancer/Lich** ΓåÆ Prefers Undead theme
- **Fire Dragon/Fire Lord** ΓåÆ Prefers Fire theme
- **Ice Dragon/Frost Giant** ΓåÆ Prefers Ice theme
- **Demon Lord** ΓåÆ Prefers Abyssal theme
- And so on...

This creates cohesive dungeon experiences where the boss and theme match.

### 4. On-Demand Room Generation

Regular rooms (non-boss) are generated on-demand:
- Saves memory (don't generate 100 rooms upfront)
- Allows flexibility (can generate different room types as needed)
- Still deterministic (same seed + level = same room)

### 5. Level Layout Structure

The dungeon is stored as a list of level layouts:

```typescript
DungeonLevelLayout[] = [
  { level: 1, boss: null, roomTemplate: {...} },
  { level: 2, boss: null, roomTemplate: {...} },
  ...
  { level: 25, boss: MidBoss, roomTemplate: {...} },
  ...
  { level: 100, boss: FinalBoss, roomTemplate: {...} },
]
```

This allows:
- Deterministic access by level index
- Easy iteration through levels
- Efficient storage (templates, not full rooms)

## Generation Flow

### Step 1: Generate Final Boss

```typescript
finalBoss = generateFinalBoss(depth, seed)
```

The final boss is generated at the bottom level. Its type will influence theme selection.

### Step 2: Generate Mid-Bosses

```typescript
midBossCount = floor(depth / 25)  // e.g., 4 mid-bosses for 100 levels
for each mid-boss:
  level = floor((depth / (midBossCount + 1)) * i)
  midBoss = generateMidBoss(level, seed)
```

Mid-bosses are placed at strategic intervals to provide milestones.

### Step 3: Consider Boss Influence

```typescript
bossInfluence = finalBoss.type  // e.g., "Necromancer"
```

The final boss's type influences theme selection.

### Step 4: Select Theme

```typescript
if (bossInfluence === "Necromancer" || bossInfluence === "Lich"):
  preferTheme = "undead"
  if (random() < 0.7):
    theme = "undead"
  else:
    theme = randomTheme()
else:
  theme = randomTheme()
```

Theme selection considers boss influence but isn't deterministic (allows variety).

### Step 5: Create Level Layout

```typescript
for level = 1 to depth:
  boss = null
  if (level === depth):
    boss = finalBoss
  else if (level in midBossLevels):
    boss = midBosses[level]
  
  roomTemplate = {
    roomTypes: theme.roomTypes,
    monsterTypes: theme.monsterTypes,
    difficultyRange: [floor(level/10), floor(level/10) + 2],
    theme: theme
  }
  
  levelLayout.push({ level, boss, roomTemplate })
```

Each level gets a layout entry with boss (if any) and room template.

## Room Generation (On-Demand)

When a player reaches a level:

```typescript
function getRoomForLevel(dungeon, level, roomType?):
  levelLayout = dungeon.levelLayout[level - 1]
  
  if (levelLayout.boss):
    return bossRoom(levelLayout.boss)
  
  // Generate regular room
  template = levelLayout.roomTemplate
  selectedRoomType = roomType || randomFrom(template.roomTypes)
  
  room = generateRoom(selectedRoomType, template, level)
  encounter = generateEncounter(selectedRoomType, template, level)
  
  return { room, encounter }
```

## Theme System

### Available Themes

1. **Undead Crypt**: Skeletons, zombies, wraiths, necromantic atmosphere
2. **Volcanic Depths**: Fire elementals, lava, intense heat
3. **Frozen Caverns**: Ice elementals, frost, bitter cold
4. **Overgrown Ruins**: Nature creatures, plants, earth and decay
5. **Shadow Realm**: Shadows, darkness, void creatures
6. **Ancient Workshop**: Golems, constructs, mechanical traps
7. **Abyssal Depths**: Demons, hellish atmosphere, chaos
8. **Crystal Caverns**: Crystal creatures, arcane energy, magical

### Theme Properties

Each theme defines:
- **Monster Types**: Array of monster names/types
- **Room Types**: Array of available room types
- **Atmosphere**: Descriptive text
- **Boss Influences**: Which boss types match this theme

## Boss System

### Boss Generation

Bosses are generated with:
- **Name**: From a pool of themed names
- **Type**: Boss type (Lich, Dragon, etc.)
- **Powers**: Array of special abilities
- **History**: Backstory text
- **Theme Influence**: Which themes this boss would influence

### Boss Placement

- **Final Boss**: Always at the bottom level
- **Mid-Bosses**: At strategic intervals (e.g., every 25 levels)
- **Boss Levels**: Pre-determined, not random

## Room Types

### Combat Rooms
- Encounter with monsters from theme's monster types
- Difficulty scales with level
- Rewards: Gold, Experience

### Puzzle Rooms
- Various puzzle types (riddles, pressure plates, etc.)
- Difficulty scales with level
- Rewards: Experience, Lore

### Event Rooms
- Special encounters (merchant, rest point, lore discovery, etc.)
- Variable rewards
- Can be beneficial or dangerous

### Trap Rooms
- Dangerous traps
- Difficulty scales with level
- Rewards: Experience (for surviving)

### Treasure Rooms
- Loot and rewards
- Less common
- Higher rewards

### Safe Rooms (Rest Points)
- Rest points
- Safe areas
- Less common in deeper levels

## Deterministic Generation

All generation is deterministic based on seeds:

```typescript
seed = "dungeon-123"
rng = createRNG(seed)

// Same seed = same dungeon
dungeon1 = generate(seed: "dungeon-123")
dungeon2 = generate(seed: "dungeon-123")
// dungeon1 === dungeon2 (structure-wise)
```

Room generation is also deterministic:

```typescript
room1 = getRoomForLevel(dungeon, 25)
room2 = getRoomForLevel(dungeon, 25)
// room1 === room2 (same room generated)
```

## Integration with Game

### Player Flow

1. Player clicks "Enter Dungeon"
2. Backend processes blockchain stuff (not this system)
3. System gets list of available dungeons
4. Random dungeon selected
5. Dungeon structure loaded (bosses pre-generated)
6. Player enters level 1
7. Room generated on-demand for level 1
8. Player progresses, rooms generated as needed
9. Player reaches boss level ΓåÆ Boss room (pre-generated)
10. Player reaches final boss ΓåÆ Final boss room

### Storage Considerations

- **Dungeon Structure**: Store in database (seed, depth, theme, boss IDs)
- **Level Layout**: Store as JSON (list of level layouts)
- **Bosses**: Store separately, referenced by ID
- **Rooms**: Generated on-demand, not stored (deterministic)

## Future Enhancements

1. **Dynamic Depth**: Make depth configurable per dungeon
2. **More Themes**: Add additional themes
3. **Boss Variants**: More boss types and variants
4. **Room Variety**: More room types and encounters
5. **Procedural Layouts**: More complex room connections
6. **Difficulty Scaling**: More sophisticated difficulty curves
7. **Loot Integration**: Integrate with item generation system
8. **World Content Integration**: Link to world-content-hierarchy