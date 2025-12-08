# Room Generation System Breakdown

## Overview
This document breaks down how rooms are generated for dungeons in the master generator tool.

## Room Type Distribution

### Main Types (Random Distribution)
- **60% Combat Rooms** - Always have encounters
- **20% Safe Rooms** - No encounters, allows rest/healing
- **20% Trap Rooms** - Various trap mechanics

## Theme System

Themes are determined by the **dungeon's purpose**, not by level depth:

| Dungeon Purpose Contains | Theme |
|-------------------------|-------|
| mining | Mineshaft |
| fortress, citadel, stronghold | Fortress |
| vault | Vault |
| temple | Temple |
| prison | Prison |
| laboratory | Laboratory |
| barracks | Barracks |
| warehouse | Warehouse |
| necromantic, research | Necromantic Lab |
| tower, undeath | Tower |
| phylactery, sanctum, citadel | Sanctum |
| library, arcane | Arcane Library |
| lair, base | Lair |
| crypt, blood | Crypt |
| (default) | Generic Dungeon |

## Room Types & Subtypes

### 1. COMBAT ROOMS (60%)
- **No subtypes**
- Always have encounters
- Encounters are themed by dungeon boss

**Possible Names:**
- Battle Chamber
- Combat Hall
- Fighting Grounds
- Arena
- War Room

**Description:** "A combat encounter room within the {theme}."

---

### 2. SAFE ROOMS (20%)

#### Subtypes:
- **50% Regular Safe Room**
  - Players can rest, heal, regain spells
  - Names: Safe Room, Rest Area, Sanctuary, Shelter
  
- **50% Treasure Room**
  - Contains treasure/loot
  - Players can rest, heal, and collect loot
  - Names: Treasure Vault, Loot Room, Hoard Chamber, Wealth Vault

**No encounters** for safe rooms

---

### 3. TRAP ROOMS (20%)

#### Subtypes (Equal 20% distribution each):

**a) Mechanical Trap Room (20%)**
- Perception check to find/identify mechanical traps
- Dex check to disarm
- Damage on failed checks
- Name: "Mechanical Trap Room"

**b) Magical Trap Room (20%)**
- Perception check to find/identify magical traps
- Arcana check to disarm
- Damage on failed checks
- Name: "Magical Trap Room"

**c) Ambush Room (20%)**
- Appears to be a safe room
- If perception check is failed ΓåÆ encounter starts
- Enemies go first with advantage
- Has encounters (themed by boss)
- Name: "Ambush Room"

**d) Trapped Treasure Room (20%)**
- Appears to be a treasure room
- Actually contains mechanical OR magical traps (50/50)
- Abides by mechanical/magical trap rules
- May result in treasure if checks pass
- Name: "Trapped Treasure Room"

**e) Puzzle Room (20%)**
- Puzzles block progression
- Mechanical or magical puzzles (no damage)
- Puzzles are eventually solvable
- Failed checks cost time
- Name: "Puzzle Room"

## Encounter System

### Which Rooms Have Encounters?
- **Combat Rooms:** Always
- **Ambush Rooms:** If perception check fails
- **Other Rooms:** No encounters

### Encounter Theming by Boss

Encounters are themed based on the dungeon's creator (boss):

**Orc War-Chief Theme:**
- Orc, Orc Warrior, Orc Shaman, Orc Berserker
- Goblin, Hobgoblin, Troll

**Undead Theme (Necromancer/Lich/Vampire):**
- Skeleton, Zombie, Ghoul, Wraith
- Shadow, Lich, Vampire Spawn

**Magic User Theme (Wizard/Archmage/Sorcerer):**
- Arcane Construct, Magical Guardian
- Spellcaster, Elemental, Golem

**Organization Race-Based:**
- Orc organization ΓåÆ Orcs, Goblins, Trolls
- Human organization ΓåÆ Bandits, Mercenaries, Guards, Knights
- Elf organization ΓåÆ Elf Warriors, Archers, Mages
- Dwarf organization ΓåÆ Dwarf Warriors, Defenders

**Default (No Boss Info):**
- Skeleton, Zombie, Goblin, Orc, Troll, Giant Spider

**Encounter Details:**
- Count: 1-2 encounters per room (50/50 chance)
- Monster Count: 1-4 monsters per encounter
- Monsters are selected from themed list

## Features (Optional)

Currently includes flavor features that may be removed later:
- Common features (60% chance): Ancient Carvings, Torch Sconces, Weathered Statues, etc.
- Theme-specific features (50% chance): Varies by theme

## What Was Removed

1. Γ¥î Level-based theme system (Sewers ΓåÆ Crypt ΓåÆ Catacombs)
2. Γ¥î Corridor, Entrance, Boss Chamber as separate room types
3. Γ¥î Special level rules (Level 1 = entrance, Level 100 = boss, etc.)
4. Γ¥î Loot generation system
5. Γ¥î Difficulty calculation
6. Γ¥î Generic trap list (replaced with trap room subtypes)

## Current System Summary

**Room Generation Flow:**
1. Determine theme from dungeon purpose
2. Roll for room type (60% combat, 20% safe, 20% trap)
3. If safe ΓåÆ roll subtype (50% regular, 50% treasure)
4. If trap ΓåÆ roll subtype (20% each: mechanical, magical, ambush, trapped_treasure, puzzle)
5. Get boss info to theme encounters
6. Generate encounters (if applicable)
7. Generate features (optional flavor)

## Testing

Use the "Simulate Room" button in the Dungeon Registry tab to test room generation for any level. Each simulation shows:
- Room name
- Room type and subtype
- Theme
- Description
- Encounters (if any)
- Features (optional)