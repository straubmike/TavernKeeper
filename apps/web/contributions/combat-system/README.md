# Combat System

## What This Does

This contribution implements a turn-based combat system and trap resolution system for dungeon encounters. It handles:

### Combat System
- **Turn Order**: Entities sorted by DEX for initiative
- **Attack Resolution**: d20 + stat modifiers vs AC
- **Damage Calculation**: Weapon dice + modifiers
- **Special Abilities**: Cleric healing and mage magic attacks
- **Ambush Rounds**: Monsters attack first if ambush trap failed
- **Combat Resolution**: Victory when all monsters defeated, defeat when all party members defeated

### Trap Resolution System
- **Perception Checks**: Wisdom-based checks to detect traps (with proficiency bonus if proficient)
- **Disarm Checks**: Stat-based checks to disarm traps (DEX/STR for mechanical, WIS for magical, INT for puzzle)
- **DC Scaling**: Trap DC scales with dungeon level (DC 10 at level 1, DC 25 at level 99)
- **Damage Scaling**: Trap damage scales with dungeon level and DC
- **Party-Wide Checks**: Any party member passing a check = success for the party
- **Trap Subtypes**: Mechanical (DEX/STR), Magical (WIS), Fake Treasure (mechanical or magical)
- **Rewards**: XP and loot awarded for successfully disarming traps

## Where It Should Be Integrated

### Type Definitions
- `packages/lib/src/types/combat.ts` - New file with combat types
- `packages/lib/src/index.ts` - Export new types

### Services
- `apps/web/lib/services/combatService.ts` - New service for combat management
- `apps/web/lib/services/index.ts` - Export service functions

### Integration Points
- `apps/web/workers/runWorker.ts` - Use combat system during dungeon runs
- `apps/web/app/api/dungeon/[id]/combat/route.ts` - API endpoint for combat encounters
- `apps/web/contributions/themed-dungeon-generation/` - Link combat to dungeon rooms
- `apps/web/contributions/adventurer-tracking/` - Update adventurer stats after combat
- `apps/web/contributions/monster-stat-blocks/` - Use monster stat blocks in combat

## How to Test

### Unit Tests
1. Test turn order determination (DEX sorting)
2. Test attack resolution (hit/miss, damage calculation)
3. Test special abilities (cleric heal, mage magic)
4. Test ambush round execution
5. Test combat status checking (victory/defeat)
6. Test predetermined actions

### Integration Tests
1. Create combat with party and monsters
2. Run combat to completion
3. Verify XP awarded on victory
4. Verify party member HP updates
5. Test ambush combat flow
6. Test step-by-step combat execution

### Manual Testing
1. Initialize combat with party members
2. Add monsters to combat
3. Run combat and verify turn order
4. Verify attacks hit/miss correctly
5. Test cleric healing functionality
6. Test mage magic attacks
7. Verify combat ends correctly

## Dependencies

- Adventurer tracking system (for party member stats)
- Monster stat blocks system (for monster stats)
- Themed dungeon generation (for room types and ambush detection)
- **Inventory system** (planned, not yet implemented - for equipped weapons)

## Breaking Changes

None - this is an additive feature.

## Design Decisions

1. **Turn Order**: Based on DEX, highest goes first. Ties broken randomly.

2. **Attack Resolution**:
   - d20 roll + ability modifier (STR for melee-strength, DEX for melee-dexterity/ranged) + weapon mods
   - Must exceed target AC to hit
   - Critical hit on natural 20 (roll damage dice twice)

3. **Damage Calculation**:
   - Weapon dice + stat modifier + weapon damage modifier
   - Critical hits: roll damage dice again and add

4. **Special Abilities**:
   - **Cleric Heal**: Auto-hits, costs mana, heals ally (cannot revive from 0 HP)
   - **Mage Magic Attack**: Auto-hits, costs mana, damages enemy
   - Behavior controlled by `clericHealRatio` and `mageMagicRatio` config values

5. **Ambush Rounds**: 
   - If room is ambush trap and party failed check, monsters attack first
   - Each monster attacks a random party member
   - Then normal turn order begins

6. **Combat End Conditions**:
   - Victory: All monsters HP = 0
   - Defeat: All party members HP = 0
   - Entities at 0 HP don't take turns

7. **Predetermined Actions**:
   - Agent can pre-determine all actions for combat
   - If provided, auto-determination is bypassed
   - Allows for deterministic combat when agent has planned ahead

## Code Structure

```
contributions/combat-system/
├── README.md (this file)
├── code/
│   ├── types/
│   │   ├── combat.ts              # Combat types and interfaces
│   │   └── trap.ts                # Trap resolution types and interfaces
│   ├── engine/
│   │   ├── turn-order.ts          # Initiative and turn order logic
│   │   └── attack-resolution.ts  # Attack rolls and damage calculation
│   ├── services/
│   │   ├── combatService.ts      # Main combat service
│   │   └── trapService.ts        # Trap resolution service
│   └── examples/
│       └── usage-examples.ts      # Code examples
```

## Integration Example

```typescript
import { initializeCombat, runCombat } from '@/lib/services/combatService';
import { getAdventurersByWallet } from '@/lib/services/adventurerService';
import { createMonsterInstanceByName } from '@/lib/services/monsterService';

// Get party members
const partyMembers = await getAdventurersByWallet(walletAddress);

// Create monsters for encounter
const monster1 = createMonsterInstanceByName('Skeleton');
const monster2 = createMonsterInstanceByName('Zombie');
const monsters = [monster1, monster2].filter(Boolean);

// Initialize combat
const combatState = initializeCombat(
  partyMembers,
  monsters,
  roomId,
  isAmbushRoom, // true if ambush trap failed
  {
    clericHealRatio: 0.3, // Clerics heal 30% of the time
    mageMagicRatio: 0.7, // Mages use magic 70% of the time
  }
);

// Run combat
const result = await runCombat(combatState, {
  clericHealRatio: 0.3,
  mageMagicRatio: 0.7,
});

if (result.status === 'victory') {
  // Award XP to party members
  for (const partyMember of partyMembers) {
    await addXP(partyMember.heroId, result.xpAwarded || 0);
  }
}
```

## Step-by-Step Combat (for Real-Time Rendering)

```typescript
import { executeTurn, checkCombatStatus, executeAmbushRound } from '@/lib/services/combatService';

let state = combatState;

// Handle ambush if needed
if (state.isAmbush && !state.ambushCompleted) {
  state = executeAmbushRound(state, config);
  // Render ambush attacks
}

// Execute turns one by one
while (state.status === 'active') {
  const { state: nextState, result } = await executeTurn(state, config);
  state = nextState;
  state.status = checkCombatStatus(state);
  
  // Render/display the turn result
  renderTurn(result);
  
  // Wait for display time or user interaction
  await waitForDisplay();
}
```

## Trap Resolution System

### How It Works

1. **Perception Phase**: All party members make Wisdom-based perception checks
   - Uses Wisdom modifier + proficiency bonus (if proficient in Perception)
   - If ANY party member succeeds, trap is detected
   - If ALL party members fail, trap triggers and deals damage

2. **Disarm Phase** (if detected): All party members make stat-based disarm checks
   - **Mechanical Traps**: 70% DEX, 30% STR (randomly determined)
   - **Magical Traps**: WIS
   - **Fake Treasure**: 50% mechanical (DEX/STR), 50% magical (WIS)
   - If ANY party member succeeds, trap is disarmed
   - If ALL party members fail, trap triggers and deals damage

3. **Damage Calculation**: 
   - Scales with dungeon level: `DC * 2 * (0.8 to 1.2 random factor)`
   - Level 1: ~20 damage (DC 10)
   - Level 99: ~50 damage (DC 25)
   - Applied to all party members if checks fail

4. **XP and Rewards**:
   - Full XP if disarmed: `difficulty * 30`
   - Partial XP if detected but not disarmed: `difficulty * 15`
   - Minimal XP if not detected: `difficulty * 5`
   - Rewards (gold, items, lore) only if trap is disarmed

### Trap Subtypes

- **Mechanical**: Physical traps (pressure plates, spikes, etc.) - DEX or STR check
- **Magical**: Magical traps (runes, wards, etc.) - WIS check
- **Fake Treasure**: Treasure disguised as trap - mechanical or magical (50/50)
- **Ambush**: Handled by combat system (not trap resolution)

### Usage Example

```typescript
import { resolveTrap } from '@/contributions/combat-system/code/services/trapService';
import type { RoomEncounter } from '@/contributions/themed-dungeon-generation/code/types/dungeon-generation';

const trapEncounter: RoomEncounter = {
  id: 'trap-123',
  type: 'trap',
  name: 'Mechanical Trap',
  description: 'A room filled with mechanical traps',
  difficulty: 5,
  trapSubtype: 'mechanical',
  rewards: [
    { type: 'experience', amount: 150, description: '150 XP' },
  ],
  metadata: {},
};

const result = resolveTrap(
  trapEncounter,
  'room-123',
  10, // Dungeon level (affects DC)
  partyMembers
);

if (result.status === 'success') {
  // Trap disarmed - award XP and rewards
  console.log(`XP: ${result.xpAwarded}`);
} else {
  // Trap triggered - apply damage
  result.updatedPartyMembers.forEach(member => {
    // Update adventurer records with new HP
  });
}
```

## Notes

### Combat System
- **Weapon Types**: Retrieved from equipped inventory items, with fallback to class-based defaults
- **Weapon Integration**: Fully integrated with inventory system
  - Uses `getEquippedItems()` to retrieve equipped weapons from inventory
  - Extracts weapon properties (damage dice, attack/damage modifiers) from `InventoryItem`
  - Falls back to default weapons if no weapon is equipped
  - Maps item types (Longsword/Staff/Mace = melee-strength, Dagger = melee-dexterity) to combat weapon types
- **Mana Costs**: Cleric heal costs 5 mana, mage magic attack costs 3 mana
- **Healing**: Cannot revive party members from 0 HP, only restore HP to wounded members
- **Magic Attacks**: Always hit (no attack roll needed)
- **Turn Skipping**: Entities at 0 HP are automatically skipped in turn order
- **Combat Limits**: Maximum 1000 turns to prevent infinite loops
- **XP Calculation**: Sum of all defeated monsters' XP values

### Trap Resolution System
- **DC Scaling**: Linear scaling from DC 10 (level 1) to DC 25 (level 99)
- **Damage Scaling**: Base damage = DC * 2, with 80-120% random factor
- **Proficiency**: Perception proficiency bonus applies if adventurer is proficient
- **Best Roll**: Uses best party member's roll (any success = party success)
- **Puzzle Traps**: Not yet implemented (will use time cost instead of damage)
- **Ambush Traps**: Handled by combat system, not trap resolution

## Inventory System Integration

The combat system is now integrated with the inventory system:

1. **Retrieve Equipped Weapons**: Uses `getEquippedItems()` from the inventory service to get equipped weapons
2. **Weapon Properties**: Extracts weapon properties (type, damage dice, modifiers) from `InventoryItem` objects
3. **Fallback to Defaults**: If no weapon is equipped, falls back to `DEFAULT_WEAPONS` based on class
4. **Weapon Type Mapping**: Maps item types (Longsword, Staff, Mace = melee-strength; Dagger = melee-dexterity) to combat weapon types

The `inventoryItemToWeapon()` helper function converts inventory items to combat weapons by:
- Parsing damage strings (e.g., "1d8 + 1") to extract dice and modifiers
- Parsing attack bonus strings (e.g., "+1") to extract attack modifiers
- Mapping item types to weapon types (melee-strength vs melee-dexterity)
