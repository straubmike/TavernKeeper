# Inventory Tracking System

## What This Does

This contribution implements a comprehensive inventory management system that tracks:

- **Equipped Items**: Items equipped to specific heroes (per character)
- **Non-Equipped Items**: Items in shared wallet inventory (accessible by all characters)
- **Item Acquisition**: Track items from various sources (dungeon loot, vendors, quests, etc.)
- **Item Transfers**: Transfer items between wallets
- **Equipment Management**: Equip/unequip items to/from heroes
- **Inventory Queries**: Filter and search inventory by various criteria
- **Inventory History**: Optional tracking of item transfers and equipment changes

Items are linked to wallet addresses as the root identifier, with equipped items also linked to specific hero NFT identifiers.

## Where It Should Be Integrated

### Type Definitions
- `packages/lib/src/types/inventory.ts` - New file with inventory types and interfaces
- `packages/lib/src/index.ts` - Export new types

### Database Schema
- `supabase/migrations/YYYYMMDDHHMMSS_inventory_tracking.sql` - New migration for inventory tables

### Services
- `apps/web/lib/services/inventoryService.ts` - New service for managing inventory
- `apps/web/lib/services/index.ts` - Export service functions

### Integration Points
- `apps/web/lib/services/lootClaim.ts` - Add items to inventory when claiming loot
- `apps/web/lib/services/rpgService.ts` - Integrate with hero equipment
- `apps/web/app/api/loot/claim/route.ts` - Add items to inventory after claiming
- `apps/web/app/api/inventory/route.ts` - API endpoints for inventory management

### API Endpoints
- `apps/web/app/api/inventory/wallet/[address]/route.ts` - Get wallet inventory
- `apps/web/app/api/inventory/hero/[tokenId]/equipped/route.ts` - Get equipped items for hero
- `apps/web/app/api/inventory/item/[itemId]/equip/route.ts` - Equip/unequip item
- `apps/web/app/api/inventory/item/[itemId]/transfer/route.ts` - Transfer item
- `apps/web/app/api/inventory/summary/[address]/route.ts` - Get inventory summary

## How to Test

### Unit Tests
1. Test adding items to inventory
2. Test equipping/unequipping items
3. Test item transfers between wallets
4. Test inventory queries and filters
5. Test inventory summary generation
6. Test item quantity management (stacking)

### Integration Tests
1. Claim loot and verify items added to inventory
2. Equip item to hero and verify equipment status
3. Transfer item between wallets
4. Query inventory with various filters
5. Verify equipped items are linked to correct heroes
6. Test inventory history recording

### Manual Testing
1. Connect wallet and view inventory
2. Claim loot from dungeon run
3. Equip item to hero
4. View equipped items for specific hero
5. Transfer item to another wallet
6. View inventory summary and statistics

## Dependencies

- Supabase database connection
- Procedural item generation system (for item definitions)
- Adventurer tracking system (for hero identifiers)
- Existing hero ownership system

## Breaking Changes

None - this is an additive feature. Existing item systems (on-chain ERC-1155) remain unchanged.

## Design Decisions

1. **Wallet Address as Root Identifier**: All inventory is owned by wallet addresses, making it accessible to all heroes owned by that wallet.

2. **Dual Inventory System**:
   - **Equipped Items**: Per-character, linked to hero NFT identifiers
   - **Non-Equipped Items**: Shared per wallet, accessible by all characters

3. **Equipment Slots**: 
   - `main_hand`: Primary weapon (swords, staffs, maces, etc.)
   - `off_hand`: Secondary weapon, shield, or spellbook
   - `head`: Helmets, hats, headgear
   - `body`: Armor, robes, chest pieces
   - `hands`: Gloves, gauntlets, handwear
   - `feet`: Boots, shoes, footwear

4. **Item Stacking**: Items can have quantities > 1 for stackable items. When equipping, only one item from a stack can be equipped.

5. **Item Transfers**: Supports full stack transfers (update ownership) and partial transfers (create new item instance with reduced quantity).

6. **Item History**: Optional tracking of:
   - Item transfers (trades, gifts, loot acquisition)
   - Equipment changes (equip/unequip events)

7. **Integration with On-Chain Items**: This system works alongside on-chain ERC-1155 items stored in hero Token Bound Accounts (TBAs). Items can exist in either:
   - On-chain (TBA): For trading, verifiable ownership
   - Off-chain (this system): For game mechanics, faster access

## Code Structure

```
contributions/inventory-tracking/
Γö£ΓöÇΓöÇ README.md (this file)
Γö£ΓöÇΓöÇ code/
Γöé   Γö£ΓöÇΓöÇ types/
Γöé   Γöé   ΓööΓöÇΓöÇ inventory.ts            # Inventory types and interfaces
Γöé   Γö£ΓöÇΓöÇ database/
Γöé   Γöé   ΓööΓöÇΓöÇ migration.sql           # Database schema
Γöé   ΓööΓöÇΓöÇ services/
Γöé       ΓööΓöÇΓöÇ inventoryService.ts    # Service for managing inventory
ΓööΓöÇΓöÇ examples/
    ΓööΓöÇΓöÇ usage-examples.ts           # Code examples showing integration
```

## Integration Example

```typescript
// Add item to inventory after claiming loot
import { addItemToInventory } from '@/lib/services/inventoryService';
import { generateItem } from '@/lib/services/itemGenerator';

const item = await generateItem({
  context: 'dungeon_loot',
  level: 5,
  classPreference: 'warrior',
});

await addItemToInventory(
  walletAddress,
  item,
  1,
  'dungeon_loot'
);

// Equip weapon to hero (CURRENT IMPLEMENTATION: main_hand only)
await equipItem({
  itemId: item.id,
  heroId: { tokenId, contractAddress, chainId },
  slot: 'main_hand', // or 'armor' for armor sets
  action: 'equip',
});

// Get equipped items for hero
const equipped = await getEquippedItems({
  tokenId,
  contractAddress,
  chainId,
});

// CURRENT IMPLEMENTATION: Only mainHand and armor
console.log(`Weapon: ${equipped.mainHand?.name}`);
console.log(`Armor: ${equipped.armor?.name}`);

// FUTURE EXPANSION: Would also have offHand, head, body, hands, feet

// Get unequipped items (shared inventory)
const unequipped = await getUnequippedItems(walletAddress);

// Transfer item
await transferItem({
  itemId: item.id,
  fromWallet: walletAddress,
  toWallet: otherWalletAddress,
  quantity: 1,
});

// Get inventory summary
const summary = await getInventorySummary(walletAddress);
console.log(`Total items: ${summary.totalItems}`);
console.log(`Equipped: ${summary.equippedItems}`);
console.log(`Unequipped: ${summary.unequippedItems}`);
```

## Notes

- **Simplified Equipment System**: Current implementation uses only `main_hand` (weapons) and `armor` (complete sets) slots. The full D&D-style structure (off_hand, head, body, hands, feet) is preserved in the code for future expansion.

- **Armor Sets**: Armor comes as complete sets (not individual pieces). Each class has 2 armor sets available. Armor equips to a single 'armor' slot.

- **Weapon System**: One weapon type per class (no off-hand weapons currently). Warriors use Longswords, Mages use Staffs, Rogues use Daggers, Clerics use Maces.

- Items are stored as JSONB in the database for flexibility with different item types
- Item instances have unique IDs even if they share the same base item definition
- Equipment validation (class requirements, slot restrictions) should be handled by the game engine
- Items can be linked to on-chain ERC-1155 tokens via `base_item_id` field
- Inventory history is optional and can be disabled for performance
- The system supports both stackable and non-stackable items

- **Future Expansion**: The code structure supports full D&D-style equipment. When ready to expand, simply:
  1. Enable additional slots (off_hand, head, body, hands, feet) in validation
  2. Update item generation to create individual armor pieces
  3. Update UI to show separate armor slots
  4. No major refactoring needed - the structure is already in place