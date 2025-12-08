# Adventurer Tracking System

## What This Does

This contribution implements a comprehensive system for tracking hero/adventurer stats and attributes. It manages:

- **Core Stats**: Health, mana, and all primary attributes (STR, DEX, WIS, INT, CON, CHA)
- **Combat Stats**: Armor class, attack bonuses, spell attack bonuses
- **Secondary Stats**: Perception for trap detection
- **Stat Updates**: Track stat changes with history (optional)
- **Combat Calculations**: Attack rolls, damage application, mana consumption
- **Trap Interactions**: Detection and disarming using appropriate stats
- **Restoration**: Health/mana restoration in safe rooms or between adventures

Heroes are identified by their on-chain NFT identifiers (token ID, contract address, chain ID) and are ultimately owned by wallet addresses.

## Where It Should Be Integrated

### Type Definitions
- `packages/lib/src/types/adventurer-stats.ts` - New file with stat types and interfaces
- `packages/lib/src/index.ts` - Export new types

### Database Schema
- `supabase/migrations/YYYYMMDDHHMMSS_adventurer_tracking.sql` - New migration for adventurers and stat history tables

### Services
- `apps/web/lib/services/adventurerService.ts` - New service for managing adventurer stats
- `apps/web/lib/services/index.ts` - Export service functions

### Integration Points
- `packages/engine/src/combat.ts` - Use stat calculations for combat
- `packages/engine/src/traps.ts` - Use trap interaction calculations
- `apps/web/workers/runWorker.ts` - Update stats during dungeon runs
- `apps/web/app/api/heroes/[tokenId]/stats/route.ts` - API endpoint for stat queries/updates

### API Endpoints
- `apps/web/app/api/adventurers/[tokenId]/stats/route.ts` - Get/update adventurer stats
- `apps/web/app/api/adventurers/[tokenId]/restore/route.ts` - Restore health/mana
- `apps/web/app/api/adventurers/wallet/[address]/route.ts` - Get all adventurers for wallet

## How to Test

### Unit Tests
1. Test stat initialization for different hero classes
2. Test stat updates (health, mana, attributes)
3. Test combat calculations (melee, ranged, spell attacks)
4. Test trap interactions (detection, disarming)
5. Test health/mana restoration
6. Test stat history recording

### Integration Tests
1. Create adventurer record from hero NFT
2. Apply combat damage and verify health decreases
3. Restore health/mana and verify restoration
4. Test trap detection and disarming
5. Test stat updates during dungeon runs
6. Verify stat history is recorded

### Manual Testing
1. Connect wallet and sync heroes
2. View hero stats in UI
3. Start dungeon run and verify stats update
4. Apply damage in combat and verify health decreases
5. Enter safe room and verify health/mana restoration
6. Interact with traps and verify stat-based checks

## Dependencies

- Supabase database connection
- Existing hero ownership system (`heroOwnership.ts`)
- Procedural item generation system (for weapon/armor stats)

## Breaking Changes

None - this is an additive feature. Existing hero metadata and ownership systems remain unchanged.

## Design Decisions

1. **Wallet Address as Root Identifier**: All heroes are ultimately owned by wallet addresses, even if they're held in Token Bound Accounts (TBAs). The system resolves ownership through the NFT ownership chain.

2. **Stat Structure**: Stats are organized into:
   - **Combat Stats**: Health, mana (current and max)
   - **Primary Attributes**: STR, DEX, WIS, INT, CON, CHA
   - **Secondary Attributes**: Perception, Armor Class
   - **Combat Bonuses**: Attack bonus, spell attack bonus

3. **Health Calculation (D&D 5e)**: 
   - Health is calculated from Constitution and level
   - Formula: HP = (Hit Die + CON modifier) + (Hit Die Average + CON modifier) ├ù (level - 1)
   - Hit dice by class: Warrior (d10), Mage (d6), Rogue (d8), Cleric (d8)
   - HP increases on level up based on Constitution modifier

4. **Leveling System (D&D 5e)**:
   - Uses D&D 5e XP curve (0, 300, 900, 2700, 6500, 14000, etc.)
   - XP awarded based on monster Challenge Rating (CR)
   - Ability score improvements at levels 4, 8, 12, 16, 19

5. **Combat Calculations**: 
   - Melee: 1d20 + STR + attackBonus + mods > target AC
   - Ranged/Finesse: 1d20 + DEX + attackBonus + mods > target AC
   - Spell (Mage): 1d20 + WIS + spellAttackBonus + mods > target AC
   - Cleric Healing: Auto-hit on allies

6. **Trap Interactions**:
   - **Perception**: Detects all trap types
   - **Physical Traps**: DEX for disarming (tripwires), STR for forcing (doors/levers)
   - **Magical Traps**: WIS for detecting and dispelling
   - **Puzzle Traps**: INT for solving

7. **Restoration**: Health and mana are restored in safe rooms or between dungeon adventures. The system supports full restoration or partial restoration.

8. **Stat History**: Optional stat history tracking for analytics and debugging. Records significant changes (combat damage, level ups, rest, spell casting).

9. **Charisma**: Currently not used for gameplay mechanics, but stored for future social interaction features.

## Code Structure

```
contributions/adventurer-tracking/
Γö£ΓöÇΓöÇ README.md (this file)
Γö£ΓöÇΓöÇ code/
Γöé   Γö£ΓöÇΓöÇ types/
Γöé   Γöé   ΓööΓöÇΓöÇ adventurer-stats.ts      # Stat types and interfaces
Γöé   Γö£ΓöÇΓöÇ database/
Γöé   Γöé   ΓööΓöÇΓöÇ migration.sql             # Database schema
Γöé   ΓööΓöÇΓöÇ services/
Γöé       ΓööΓöÇΓöÇ adventurerService.ts     # Service for managing stats
ΓööΓöÇΓöÇ examples/
    ΓööΓöÇΓöÇ usage-examples.ts             # Code examples showing integration
```

## Integration Example

```typescript
// Initialize adventurer from hero NFT
import { getAdventurer, upsertAdventurer } from '@/lib/services/adventurerService';
import { getHeroByTokenId } from '@/lib/services/heroOwnership';

const hero = await getHeroByTokenId(tokenId);
const adventurer = await upsertAdventurer({
  heroId: { tokenId, contractAddress, chainId },
  walletAddress: walletAddress.toLowerCase(),
  class: hero.metadata.hero?.class || 'warrior',
  stats: {
    health: 100,
    maxHealth: 100,
    mana: 50,
    maxMana: 50,
    strength: 16,
    dexterity: 12,
    wisdom: 10,
    intelligence: 10,
    constitution: 14,
    charisma: 8,
    perception: 12,
    armorClass: 10,
    attackBonus: 3,
    spellAttackBonus: 0,
  },
  createdAt: new Date(),
  updatedAt: new Date(),
});

// Apply combat damage
await updateAdventurerStats({
  heroId: { tokenId, contractAddress, chainId },
  updates: { health: adventurer.stats.health - 25 },
  reason: 'combat_damage',
});

// Restore health/mana in safe room
await restoreAdventurer(
  { tokenId, contractAddress, chainId },
  { restoreHealth: true, restoreMana: true }
);

// Calculate trap interaction
const result = calculateTrapInteraction(adventurer, 'magical', 15);
if (result.detected && result.disarmed) {
  console.log('Trap disarmed successfully!');
}
```

## Notes

- Stats should be initialized when a hero is first synced from the blockchain
- Health and mana are automatically capped at max values
- Stat history is optional and can be disabled for performance
- The system assumes heroes are owned by wallets (resolves through NFT ownership chain)
- Combat bonuses are calculated from base stats and can be modified by equipment (handled by inventory system)