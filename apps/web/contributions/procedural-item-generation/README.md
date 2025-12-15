# Procedural Item Generation System

## What This Does

This contribution implements a comprehensive procedural item generation system that creates unique, balanced, and thematically appropriate items for various game contexts. The system generates items deterministically from seeds, scales appropriately with game progression, and integrates seamlessly with the existing world generation and loot systems.

When new items are needed (dungeon loot, monster drops, vendor stock, quest rewards), the system:
- Generates items appropriate to the context (dungeon level, monster type, player level)
- Creates items with coherent stats and properties
- Integrates with world lore and provenance
- Supports weapons and armor only (simplified scope for graphical implementation)
- Maintains balance across rarity tiers
- Provides deterministic generation for reproducibility
- Includes optional scarcity system that tracks item availability

## Key Features

### Item Categories
- **Weapons**: One weapon per class (Longsword for Warrior, Staff for Mage, Dagger for Rogue, Mace for Cleric)
- **Armor**: Two complete armor kits per class (full sets, not individual pieces)
  - Warrior: Full Plate, Chain Mail
  - Mage: Mage Robes, Enchanted Cloak
  - Rogue: Leather Armor, Studded Leather
  - Cleric: Scale Mail, Breastplate
- **Class-Specific**: All items are restricted to specific classes via `requiredClass` property

### Rarity System (4 Tiers)
- **Common**: Basic items with standard stats (60% at default)
- **Uncommon**: Slightly improved stats (+1) (28% at default)
- **Rare**: Significant improvements (+2) with one special property (10% at default)
- **Epic**: Major improvements (+3) with multiple properties (2% at default)

### Generation Contexts
- **Dungeon Loot**: Chests, secret rooms, boss drops
- **Monster Drops**: Regular enemies, elites, bosses
- **Vendor Stock**: General stores and specialty shops
- **Quest Rewards**: Side quests, main quests, legendary quests
- **World Generation**: Items linked to world lore and provenance

## Where It Should Be Integrated

### Type Definitions
- `packages/lib/src/types/item-generation.ts` - Item generation types and interfaces
- `packages/lib/src/types/entity.ts` - Extend Item interface with generation properties
- `packages/lib/src/index.ts` - Export new types

### Item Generation System
- `packages/engine/src/item-generation/` - New directory for item generation
  - `item-generator.ts` - Main item generator (includes weapon and armor generation)
  - `property-generator.ts` - Generates item properties and enhancements
  - `name-generator.ts` - Generates item names
  - `description-generator.ts` - Generates item descriptions
  - `scarcity-tracker.ts` - Optional scarcity system (tracks item availability)

### Templates and Configuration
- `packages/engine/src/item-generation/templates/` - Item templates
  - `weapon-templates.ts` - Weapon type templates
  - `armor-templates.ts` - Armor type templates
  - `enhancement-templates.ts` - Enhancement/modifier templates
  - `name-templates.ts` - Name generation templates
- `packages/engine/src/item-generation/config/` - Configuration files
  - `rarity-config.ts` - Rarity distributions and power budgets
  - `scaling-config.ts` - Level-based scaling configurations
  - `balance-config.ts` - Balance and tuning parameters

### Integration Points
- `packages/engine/src/engine.ts` - Generate items during dungeon runs
- `packages/engine/src/combat.ts` - Use generated weapon/armor stats
- `apps/web/workers/runWorker.ts` - Generate items for loot claims
- `apps/web/lib/services/lootClaim.ts` - Create LootItems from generated items
- `packages/engine/src/world-generation/` - Link items to world generation
- `packages/engine/src/world-content/` - Create world content for items
- `apps/web/lib/services/marketplace.ts` - Generate vendor stock

### Database Schema
- Extends `items` table (if exists) or creates new `generated_items` table
- Stores item properties, generation metadata, and seed information
- Links to `world_content` for provenance and lore

## How to Test

### Unit Tests
1. Test item generation for weapons and armor
2. Test rarity distribution matches expected percentages (4 tiers)
3. Test stat scaling based on level
4. Test deterministic generation from seeds
5. Test property generation and enhancement application
6. Test name and description generation
7. Test class restrictions (requiredClass property)
8. Test scarcity system (if enabled)

### Integration Tests
1. Generate items for dungeon loot context
2. Generate items for monster drops
3. Verify items integrate with combat system
4. Verify items create world content entries
5. Test item generation with world generation system
6. Verify items can be claimed as loot

### Balance Tests
1. Test power progression across rarity tiers (4 tiers)
2. Test stat distributions are balanced
3. Test class-specific items are appropriate
4. Test level scaling maintains balance
5. Test scarcity weighting (if enabled)

### Manual Testing
1. Generate items in different contexts (dungeon, monster, vendor)
2. Verify items have appropriate stats for their level
3. Verify rare items have special properties
4. Verify item names and descriptions are coherent
5. Verify items integrate with inventory and equipment systems
6. Test items with different seeds produce different results

## Dependencies

- Integrates with `world-generation-system` contribution for world-linked items
- Integrates with `world-content-hierarchy` contribution for lore and provenance
- Uses existing combat system for stat integration
- Uses existing loot claim system for item minting
- Uses seeded RNG from `packages/engine/src/rng.ts`

## Breaking Changes

None - this is an additive feature. Existing items in the game can coexist with procedurally generated items.

## Design Decisions

1. **Deterministic Generation**: All items generated from seeds for reproducibility
2. **Context-Aware**: Items generated based on context (level, source, theme)
3. **Template-Based**: Uses templates for consistent item generation
4. **Scalable**: Power scales appropriately with game progression
5. **Balanced**: Rarity tiers ensure meaningful progression
6. **Integrated**: Works seamlessly with world generation and lore systems

## Item Generation Process

```
1. Context Analysis
   ↓
2. Rarity Determination
   ↓
3. Category Selection
   ↓
4. Base Item Generation
   ↓
5. Stat Generation
   ↓
6. Enhancement Generation
   ↓
7. Name Generation
   ↓
8. Description Generation
   ↓
9. Property Generation
   ↓
10. World Integration
```

## Code Structure

```
contributions/procedural-item-generation/
├── README.md (this file)
├── DESIGN.md (design overview)
├── INTEGRATION_NOTES.md (class restrictions guide)
├── examples/
│   └── usage-examples.ts                # Generation examples
└── code/
    ├── types/
    │   └── item-generation.ts          # Generation types and interfaces
    ├── generators/
    │   ├── seeded-rng.ts               # Seeded random number generator
    │   ├── item-generator.ts            # Main generator (weapons + armor)
    │   └── index.ts                     # Exports
    └── README.md                        # Implementation documentation

Note: The standalone HTML test tool has been moved to contributions/tools/item-generator/
```

## Integration Example

```typescript
import { ItemGenerator } from './code/generators/item-generator';
import type { GenerationOptions } from './code/types/item-generation';

const generator = new ItemGenerator();

// Generate item for dungeon loot
const item = generator.generateItem({
  context: 'dungeon_loot',
  level: 5,
  classPreference: 'warrior', // Optional: class preference
  rarityModifier: 100, // Optional: 0-200, default 100
  seed: 'dungeon-seed-chest-1', // Optional: for deterministic generation
});

// IMPORTANT: Check requiredClass before allowing equipment
if (item.requiredClass === 'warrior' && agent.class !== 'warrior') {
  throw new Error('Only warriors can equip this item');
}
```

// Generate item for monster drop
const monsterItem = await generator.generateItem({
  context: 'monster_drop',
  level: 3,
  monsterType: 'goblin',
  monsterId: 'goblin-456',
  seed: 'monster-seed-goblin-456',
});

// Generate items for vendor stock
const vendorItems = await generator.generateVendorStock({
  vendorId: 'vendor-789',
  vendorType: 'general_store',
  seed: 'vendor-seed-789',
  itemCount: 10,
  level: 5,
});

// Generate item with world integration
const worldItem = await generator.generateItemWithWorld({
  context: 'world_generated',
  level: 8,
  creatorId: 'blacksmith-thorgrim',
  worldSeed: 'world-seed',
  itemSeed: 'item-seed-001',
  category: 'weapon',
});
```

## Notes

- Item generation is deterministic - same seed produces same item
- Items scale with level and context
- Rarity distribution ensures balanced progression (4 tiers: Common, Uncommon, Rare, Epic)
- All items are class-restricted (see INTEGRATION_NOTES.md)
- Generated items integrate with world content hierarchy for lore
- Items can be generated on-demand or pre-generated and cached
- Optional scarcity system tracks item availability (see DESIGN.md)
- System is simplified to weapons and armor only for graphical implementation scope

