/**
 * Inventory Tracking System - Usage Examples
 * 
 * Examples showing how to integrate and use the inventory tracking system.
 */

import {
  addItemToInventory,
  getWalletInventory,
  getEquippedItems,
  getUnequippedItems,
  equipItem,
  unequipItem,
  transferItem,
  getInventorySummary,
  removeItem,
} from '../code/services/inventoryService';
import type {
  HeroIdentifier,
  ItemEquipOperation,
  InventoryQueryFilters,
} from '../code/types/inventory';
import type { GeneratedItem } from '../../procedural-item-generation/code/types/item-generation';

/**
 * Example 1: Add item to inventory after claiming loot
 */
export async function addLootToInventory(
  walletAddress: string,
  item: GeneratedItem
): Promise<void> {
  await addItemToInventory(
    walletAddress,
    item,
    1,
    'dungeon_loot'
  );
}

/**
 * Example 2: Equip item to hero
 * 
 * CURRENT IMPLEMENTATION (Simplified):
 * - Only 'main_hand' (weapons) and 'armor' (complete sets) slots
 * - One weapon per class, armor comes as complete sets
 */
export async function equipItemToHero(
  itemId: string,
  heroId: HeroIdentifier,
  slot: 'main_hand' | 'armor' // CURRENTLY SUPPORTED
  // Future expansion: 'off_hand' | 'head' | 'body' | 'hands' | 'feet'
): Promise<void> {
  const operation: ItemEquipOperation = {
    itemId,
    heroId,
    slot,
    action: 'equip',
  };

  await equipItem(operation);
}

/**
 * Example 3: Unequip item from hero
 * 
 * CURRENT IMPLEMENTATION (Simplified):
 * - Only 'main_hand' and 'armor' slots
 */
export async function unequipItemFromHero(
  itemId: string,
  heroId: HeroIdentifier,
  slot: 'main_hand' | 'armor' // CURRENTLY SUPPORTED
  // Future expansion: 'off_hand' | 'head' | 'body' | 'hands' | 'feet'
): Promise<void> {
  const operation: ItemEquipOperation = {
    itemId,
    heroId,
    slot,
    action: 'unequip',
  };

  await unequipItem(operation);
}

/**
 * Example 4: Get all equipped items for a hero
 */
export async function getHeroEquipment(heroId: HeroIdentifier) {
  return await getEquippedItems(heroId);
}

/**
 * Example 5: Get unequipped items (shared inventory)
 */
export async function getSharedInventory(walletAddress: string) {
  return await getUnequippedItems(walletAddress);
}

/**
 * Example 6: Get filtered inventory
 */
export async function getFilteredInventory(
  walletAddress: string,
  filters: InventoryQueryFilters
) {
  return await getWalletInventory(walletAddress, filters);
}

/**
 * Example 7: Transfer item between wallets
 */
export async function tradeItem(
  itemId: string,
  fromWallet: string,
  toWallet: string,
  quantity?: number
): Promise<void> {
  await transferItem({
    itemId,
    fromWallet,
    toWallet,
    quantity,
  });
}

/**
 * Example 8: Get inventory summary
 */
export async function getInventoryStats(walletAddress: string) {
  return await getInventorySummary(walletAddress);
}

/**
 * Example 9: Consume item (remove from inventory)
 */
export async function consumeItem(itemId: string, quantity: number = 1): Promise<void> {
  await removeItem(itemId, quantity);
}

/**
 * Example 10: Auto-equip best item for slot
 * 
 * CURRENT IMPLEMENTATION (Simplified):
 * - Only 'main_hand' (weapons) and 'armor' (complete sets) slots
 */
export async function autoEquipBestItem(
  walletAddress: string,
  heroId: HeroIdentifier,
  slot: 'main_hand' | 'armor', // CURRENTLY SUPPORTED
  // Future expansion: 'off_hand' | 'head' | 'body' | 'hands' | 'feet'
  requiredClass?: 'warrior' | 'mage' | 'rogue' | 'cleric'
): Promise<void> {
  // Get unequipped items
  const unequipped = await getUnequippedItems(walletAddress);

  // Filter by slot and class
  const candidates = unequipped.filter(item => {
    // CURRENT IMPLEMENTATION: Simplified slot matching
    if (slot === 'main_hand' && item.category !== 'weapon') {
      return false;
    }
    if (slot === 'armor' && item.category !== 'armor') {
      return false;
    }
    
    // FUTURE EXPANSION: More granular slot matching
    // if (item.category === 'weapon' && slot !== 'main_hand' && slot !== 'off_hand') {
    //   return false;
    // }
    // if (item.category === 'armor' && slot !== 'head' && slot !== 'body' && slot !== 'hands' && slot !== 'feet') {
    //   return false;
    // }
    
    if (requiredClass && item.requiredClass !== requiredClass && item.requiredClass !== 'any') {
      return false;
    }
    return true;
  });

  if (candidates.length === 0) {
    return; // No items to equip
  }

  // Sort by rarity (epic > rare > uncommon > common)
  const rarityOrder = { epic: 4, rare: 3, uncommon: 2, common: 1 };
  candidates.sort((a, b) => {
    const aRarity = rarityOrder[a.rarity] || 0;
    const bRarity = rarityOrder[b.rarity] || 0;
    return bRarity - aRarity;
  });

  // Equip the best item
  const bestItem = candidates[0];
  await equipItem({
    itemId: bestItem.id,
    heroId,
    slot,
    action: 'equip',
  });
}

/**
 * Example 11: Get all items for a specific hero class
 */
export async function getClassItems(
  walletAddress: string,
  heroClass: 'warrior' | 'mage' | 'rogue' | 'cleric'
) {
  return await getWalletInventory(walletAddress, {
    requiredClass: heroClass,
  });
}

/**
 * Example 12: Get items by rarity
 */
export async function getRareItems(
  walletAddress: string,
  rarity: 'common' | 'uncommon' | 'rare' | 'epic'
) {
  return await getWalletInventory(walletAddress, {
    rarity,
  });
}

/**
 * Example 13: Swap equipment between heroes
 * 
 * CURRENT IMPLEMENTATION (Simplified):
 * - Only 'main_hand' and 'armor' slots
 */
export async function swapEquipment(
  itemId: string,
  fromHeroId: HeroIdentifier,
  toHeroId: HeroIdentifier,
  slot: 'main_hand' | 'armor' // CURRENTLY SUPPORTED
  // Future expansion: 'off_hand' | 'head' | 'body' | 'hands' | 'feet'
): Promise<void> {
  // Unequip from first hero
  await unequipItem({
    itemId,
    heroId: fromHeroId,
    slot,
    action: 'unequip',
  });

  // Equip to second hero
  await equipItem({
    itemId,
    heroId: toHeroId,
    slot,
    action: 'equip',
  });
}

/**
 * Example 14: Get inventory for multiple heroes
 */
export async function getPartyInventory(
  walletAddress: string,
  heroIds: HeroIdentifier[]
) {
  const inventory = await getWalletInventory(walletAddress);
  const equippedItems = inventory.items.filter(item => item.equipped);

  const partyEquipment = heroIds.map(heroId => {
    const heroItems = equippedItems.filter(
      item =>
        item.equippedBy?.tokenId === heroId.tokenId &&
        item.equippedBy?.contractAddress === heroId.contractAddress &&
        item.equippedBy?.chainId === heroId.chainId
    );

    return {
      heroId,
      equipped: heroItems,
    };
  });

  return {
    shared: inventory.items.filter(item => !item.equipped),
    partyEquipment,
  };
}