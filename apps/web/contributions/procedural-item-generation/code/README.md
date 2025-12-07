# Item Generation System - TypeScript Implementation

This directory contains the TypeScript implementation of the procedural item generation system, ready for integration into the main codebase.

## Structure

```
code/
├── types/
│   └── item-generation.ts          # Type definitions
├── generators/
│   ├── seeded-rng.ts               # Seeded random number generator
│   ├── item-generator.ts           # Main item generator
│   └── index.ts                    # Exports
└── README.md                       # This file
```

## Usage

```typescript
import { ItemGenerator } from './generators/item-generator';
import type { GenerationOptions } from './types/item-generation';

// Create a generator instance
const generator = new ItemGenerator();

// Generate an item
const item = generator.generateItem({
  context: 'dungeon_loot',
  level: 5,
  classPreference: 'warrior',
  rarityModifier: 100, // 0-200, default 100
  seed: 'dungeon-seed-chest-1', // Optional: for deterministic generation
});

console.log(item);
// {
//   id: 'item-1234567890-5678',
//   name: 'Longsword +1',
//   type: 'weapon (melee)',
//   category: 'weapon',
//   rarity: 'uncommon',
//   level: 5,
//   context: 'dungeon_loot',
//   seed: 1234567890,
//   itemType: 'Longsword',
//   requiredClass: 'warrior', // IMPORTANT: Check this during equipment validation
//   damage: '1d8 + 1',
//   attackBonus: '+1',
//   properties: 'Versatile',
//   enhancements: [],
//   description: 'An uncommon longsword.'
// }
```

## Key Features

- **Deterministic Generation**: Uses seeded RNG for reproducible results
- **Class Restrictions**: All items have `requiredClass` property for equipment validation
- **4 Rarity Tiers**: Common, Uncommon, Rare, Epic
- **Weapons & Armor Only**: Simplified scope (one weapon per class, two armor kits per class)
- **Optional Scarcity System**: Tracks item availability (can be removed if not needed)

## Integration Notes

### Equipment Validation

**CRITICAL**: Always check `requiredClass` before allowing equipment:

```typescript
function canEquipItem(agent: Agent, item: GeneratedItem): boolean {
  if (item.requiredClass && item.requiredClass !== agent.class) {
    return false; // Class mismatch - cannot equip
  }
  return true; // Class matches or no restriction
}
```

### Scarcity System

The scarcity system is **optional** and clearly marked in the code. To remove it:

1. Search for "SCARCITY" in `item-generator.ts`
2. Remove all marked methods and code blocks
3. Replace weighted selection with simple random choice

The system tracks item counts in memory by default. For production, you'll need to implement persistence (database, Redis, etc.) in the `getItemCounts()` and `saveItemCounts()` methods.

## Matching HTML Tool

This TypeScript implementation produces **identical results** to the HTML test tool (`../tools/item-generator/item-generator-tool.html`) when using the same seed. This ensures consistency between testing and production.






