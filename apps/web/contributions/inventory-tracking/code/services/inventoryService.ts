/**
 * Inventory Tracking Service
 * 
 * Service for managing player inventory (equipped and non-equipped items).
 * Handles item acquisition, equipping/unequipping, and transfers.
 */

import { supabase } from '../../../../lib/supabase';
import type {
  InventoryItem,
  HeroIdentifier,
  EquippedItems,
  WalletInventory,
  ItemTransfer,
  ItemEquipOperation,
  InventoryQueryFilters,
  InventorySummary,
  EquipmentSlot,
} from '../types/inventory';
import type { GeneratedItem } from '../../../procedural-item-generation/code/types/item-generation';

/**
 * Add item to wallet inventory
 */
export async function addItemToInventory(
  walletAddress: string,
  item: GeneratedItem,
  quantity: number = 1,
  acquiredFrom?: string
): Promise<InventoryItem> {
  const itemId = generateItemInstanceId();

  const inventoryItem: InventoryItem = {
    ...item,
    id: itemId,
    quantity,
    equipped: false,
    walletAddress: walletAddress.toLowerCase(),
    acquiredAt: new Date(),
    acquiredFrom,
  };

  const { data, error } = await supabase
    .from('inventory_items')
    .insert({
      item_id: itemId,
      base_item_id: item.id,
      wallet_address: walletAddress.toLowerCase(),
      item_data: inventoryItem,
      quantity,
      equipped: false,
      acquired_from: acquiredFrom,
    })
    .select()
    .single();

  if (error) {
    console.error('Error adding item to inventory:', error);
    throw error;
  }

  return mapDbToInventoryItem(data);
}

/**
 * Get all items for a wallet (equipped and unequipped)
 */
export async function getWalletInventory(
  walletAddress: string,
  filters?: InventoryQueryFilters
): Promise<WalletInventory> {
  let query = supabase
    .from('inventory_items')
    .select('*')
    .eq('wallet_address', walletAddress.toLowerCase());

  if (filters?.equipped !== undefined) {
    query = query.eq('equipped', filters.equipped);
  }
  if (filters?.slot) {
    query = query.eq('equipped_slot', filters.slot);
  }
  if (filters?.category) {
    query = query.contains('item_data', { category: filters.category });
  }
  if (filters?.rarity) {
    query = query.contains('item_data', { rarity: filters.rarity });
  }
  if (filters?.requiredClass) {
    query = query.contains('item_data', { requiredClass: filters.requiredClass });
  }

  const { data, error } = await query.order('acquired_at', { ascending: false });

  if (error) {
    console.error('Error fetching wallet inventory:', error);
    throw error;
  }

  const items = (data || []).map(mapDbToInventoryItem);

  return {
    walletAddress: walletAddress.toLowerCase(),
    items,
    totalItems: items.reduce((sum, item) => sum + item.quantity, 0),
  };
}

/**
 * Get equipped items for a hero
 */
export async function getEquippedItems(heroId: HeroIdentifier): Promise<EquippedItems> {
  const { data, error } = await supabase
    .from('inventory_items')
    .select('*')
    .eq('equipped', true)
    .eq('equipped_by_token_id', heroId.tokenId)
    .eq('equipped_by_contract', heroId.contractAddress)
    .eq('equipped_by_chain_id', heroId.chainId);

  if (error) {
    console.error('Error fetching equipped items:', error);
    throw error;
  }

  const items = (data || []).map(mapDbToInventoryItem);
  const equipped: EquippedItems = {
    heroId,
  };

  for (const item of items) {
    if (item.equippedSlot) {
      // Map slot to equipped items structure
      // CURRENT IMPLEMENTATION: main_hand and armor only
      if (item.equippedSlot === 'main_hand') {
        equipped.mainHand = item;
      } else if (item.equippedSlot === 'armor') {
        equipped.armor = item;
      }
      // FUTURE EXPANSION: Support for offHand, head, body, hands, feet
      // else if (item.equippedSlot === 'off_hand') equipped.offHand = item;
      // else if (item.equippedSlot === 'head') equipped.head = item;
      // etc.
    }
  }

  return equipped;
}

/**
 * Get unequipped items for a wallet (shared inventory)
 */
export async function getUnequippedItems(walletAddress: string): Promise<InventoryItem[]> {
  const { data, error } = await supabase
    .from('inventory_items')
    .select('*')
    .eq('wallet_address', walletAddress.toLowerCase())
    .eq('equipped', false)
    .order('acquired_at', { ascending: false });

  if (error) {
    console.error('Error fetching unequipped items:', error);
    throw error;
  }

  return (data || []).map(mapDbToInventoryItem);
}

/**
 * Equip item to hero
 * 
 * CURRENT IMPLEMENTATION (Simplified):
 * - Only 'main_hand' (weapons) and 'armor' (complete sets) slots are used
 * - One weapon per class, armor comes as complete sets
 * 
 * FUTURE EXPANSION:
 * - Support for off_hand, head, body, hands, feet slots
 * - Individual armor pieces instead of complete sets
 */
export async function equipItem(operation: ItemEquipOperation): Promise<InventoryItem> {
  if (operation.action !== 'equip') {
    throw new Error('Invalid action for equipItem - use unequipItem for unequip');
  }

  // Validate slot for current implementation
  const currentSlots: EquipmentSlot[] = ['main_hand', 'armor'];
  if (!currentSlots.includes(operation.slot)) {
    throw new Error(`Slot '${operation.slot}' is not currently supported. Use 'main_hand' or 'armor'.`);
  }

  // Get the item
  const { data: itemData, error: fetchError } = await supabase
    .from('inventory_items')
    .select('*')
    .eq('item_id', operation.itemId)
    .single();

  if (fetchError || !itemData) {
    throw new Error(`Item not found: ${operation.itemId}`);
  }

  const item = mapDbToInventoryItem(itemData);

  // Validate item category matches slot
  if (operation.slot === 'main_hand' && item.category !== 'weapon') {
    throw new Error('Only weapons can be equipped to main_hand slot');
  }
  if (operation.slot === 'armor' && item.category !== 'armor') {
    throw new Error('Only armor can be equipped to armor slot');
  }

  // Check if item is owned by the wallet that owns the hero
  // (In production, you'd verify hero ownership via NFT contract)
  if (!item.equipped && item.walletAddress) {
    // Check if slot is already occupied
    const { data: existingEquipped } = await supabase
      .from('inventory_items')
      .select('*')
      .eq('equipped', true)
      .eq('equipped_by_token_id', operation.heroId.tokenId)
      .eq('equipped_by_contract', operation.heroId.contractAddress)
      .eq('equipped_by_chain_id', operation.heroId.chainId)
      .eq('equipped_slot', operation.slot)
      .single();

    // If slot is occupied, unequip the existing item first
    if (existingEquipped) {
      await unequipItem({
        itemId: existingEquipped.item_id,
        heroId: operation.heroId,
        slot: operation.slot,
        action: 'unequip',
      });
    }

    // Equip the new item
    const { data: updated, error: updateError } = await supabase
      .from('inventory_items')
      .update({
        equipped: true,
        equipped_by_token_id: operation.heroId.tokenId,
        equipped_by_contract: operation.heroId.contractAddress,
        equipped_by_chain_id: operation.heroId.chainId,
        equipped_slot: operation.slot,
        updated_at: new Date().toISOString(),
      })
      .eq('item_id', operation.itemId)
      .select()
      .single();

    if (updateError) {
      console.error('Error equipping item:', updateError);
      throw updateError;
    }

    // Record equip history
    await recordEquipHistory(updated.id, operation.heroId, operation.slot, 'equip');

    return mapDbToInventoryItem(updated);
  } else {
    throw new Error('Item is already equipped or not available');
  }
}

/**
 * Unequip item from hero
 */
export async function unequipItem(operation: ItemEquipOperation): Promise<InventoryItem> {
  if (operation.action !== 'unequip') {
    throw new Error('Invalid action for unequipItem - use equipItem for equip');
  }

  const { data: updated, error } = await supabase
    .from('inventory_items')
    .update({
      equipped: false,
      equipped_by_token_id: null,
      equipped_by_contract: null,
      equipped_by_chain_id: null,
      equipped_slot: null,
      updated_at: new Date().toISOString(),
    })
    .eq('item_id', operation.itemId)
    .select()
    .single();

  if (error) {
    console.error('Error unequipping item:', error);
    throw error;
  }

  // Record unequip history
  await recordEquipHistory(updated.id, operation.heroId, operation.slot, 'unequip');

  return mapDbToInventoryItem(updated);
}

/**
 * Transfer item between wallets
 */
export async function transferItem(transfer: ItemTransfer): Promise<InventoryItem> {
  const { data: itemData, error: fetchError } = await supabase
    .from('inventory_items')
    .select('*')
    .eq('item_id', transfer.itemId)
    .single();

  if (fetchError || !itemData) {
    throw new Error(`Item not found: ${transfer.itemId}`);
  }

  const item = mapDbToInventoryItem(itemData);

  if (item.walletAddress.toLowerCase() !== transfer.fromWallet.toLowerCase()) {
    throw new Error('Item does not belong to source wallet');
  }

  const quantityToTransfer = transfer.quantity || item.quantity;

  if (quantityToTransfer > item.quantity) {
    throw new Error('Insufficient quantity');
  }

  // If transferring full stack, update ownership
  if (quantityToTransfer === item.quantity) {
    const { data: updated, error: updateError } = await supabase
      .from('inventory_items')
      .update({
        wallet_address: transfer.toWallet.toLowerCase(),
        updated_at: new Date().toISOString(),
      })
      .eq('item_id', transfer.itemId)
      .select()
      .single();

    if (updateError) {
      console.error('Error transferring item:', updateError);
      throw updateError;
    }

    // Record transfer history
    await recordTransferHistory(updated.id, transfer.fromWallet, transfer.toWallet, quantityToTransfer, 'trade');

    return mapDbToInventoryItem(updated);
  } else {
    // Partial transfer - create new item instance
    const newItemId = generateItemInstanceId();
    const newItem: InventoryItem = {
      ...item,
      id: newItemId,
      quantity: quantityToTransfer,
      walletAddress: transfer.toWallet.toLowerCase(),
      equipped: false,
      equippedBy: undefined,
      equippedSlot: undefined,
    };

    const { data: newItemData, error: insertError } = await supabase
      .from('inventory_items')
      .insert({
        item_id: newItemId,
        base_item_id: item.base_item_id || item.id,
        wallet_address: transfer.toWallet.toLowerCase(),
        item_data: newItem,
        quantity: quantityToTransfer,
        equipped: false,
        acquired_from: 'transfer',
      })
      .select()
      .single();

    if (insertError) {
      console.error('Error creating transferred item:', insertError);
      throw insertError;
    }

    // Update original item quantity
    const { error: updateError } = await supabase
      .from('inventory_items')
      .update({
        quantity: item.quantity - quantityToTransfer,
        updated_at: new Date().toISOString(),
      })
      .eq('item_id', transfer.itemId);

    if (updateError) {
      console.error('Error updating original item quantity:', updateError);
      throw updateError;
    }

    // Record transfer history
    await recordTransferHistory(newItemData.id, transfer.fromWallet, transfer.toWallet, quantityToTransfer, 'trade');

    return mapDbToInventoryItem(newItemData);
  }
}

/**
 * Get inventory summary for a wallet
 */
export async function getInventorySummary(walletAddress: string): Promise<InventorySummary> {
  const inventory = await getWalletInventory(walletAddress);

  const equippedItems = inventory.items.filter(item => item.equipped);
  const unequippedItems = inventory.items.filter(item => !item.equipped);

  const itemsByCategory = {
    weapons: inventory.items.filter(item => item.category === 'weapon').length,
    armor: inventory.items.filter(item => item.category === 'armor').length,
  };

  const itemsByRarity = {
    common: inventory.items.filter(item => item.rarity === 'common').length,
    uncommon: inventory.items.filter(item => item.rarity === 'uncommon').length,
    rare: inventory.items.filter(item => item.rarity === 'rare').length,
    epic: inventory.items.filter(item => item.rarity === 'epic').length,
  };

  // Group equipped items by hero
  const heroMap = new Map<string, { heroId: HeroIdentifier; equippedCount: number }>();
  for (const item of equippedItems) {
    if (item.equippedBy) {
      const key = `${item.equippedBy.tokenId}-${item.equippedBy.contractAddress}-${item.equippedBy.chainId}`;
      const existing = heroMap.get(key);
      if (existing) {
        existing.equippedCount++;
      } else {
        heroMap.set(key, {
          heroId: item.equippedBy,
          equippedCount: 1,
        });
      }
    }
  }

  return {
    walletAddress: walletAddress.toLowerCase(),
    totalItems: inventory.totalItems,
    equippedItems: equippedItems.length,
    unequippedItems: unequippedItems.length,
    itemsByCategory,
    itemsByRarity,
    itemsByHero: Array.from(heroMap.values()),
  };
}

/**
 * Remove item from inventory (e.g., when consumed or destroyed)
 */
export async function removeItem(itemId: string, quantity: number = 1): Promise<void> {
  const { data: itemData, error: fetchError } = await supabase
    .from('inventory_items')
    .select('*')
    .eq('item_id', itemId)
    .single();

  if (fetchError || !itemData) {
    throw new Error(`Item not found: ${itemId}`);
  }

  const item = mapDbToInventoryItem(itemData);

  if (quantity >= item.quantity) {
    // Remove entire item
    const { error } = await supabase
      .from('inventory_items')
      .delete()
      .eq('item_id', itemId);

    if (error) {
      console.error('Error removing item:', error);
      throw error;
    }
  } else {
    // Reduce quantity
    const { error } = await supabase
      .from('inventory_items')
      .update({
        quantity: item.quantity - quantity,
        updated_at: new Date().toISOString(),
      })
      .eq('item_id', itemId);

    if (error) {
      console.error('Error reducing item quantity:', error);
      throw error;
    }
  }
}

// Helper functions

function mapDbToInventoryItem(dbRecord: any): InventoryItem {
  const itemData = dbRecord.item_data as InventoryItem;
  return {
    ...itemData,
    id: dbRecord.item_id,
    quantity: dbRecord.quantity,
    equipped: dbRecord.equipped,
    equippedBy: dbRecord.equipped_by_token_id
      ? {
          tokenId: dbRecord.equipped_by_token_id,
          contractAddress: dbRecord.equipped_by_contract,
          chainId: dbRecord.equipped_by_chain_id,
        }
      : undefined,
    equippedSlot: dbRecord.equipped_slot as EquipmentSlot | undefined,
    walletAddress: dbRecord.wallet_address,
    acquiredAt: new Date(dbRecord.acquired_at),
    acquiredFrom: dbRecord.acquired_from,
  };
}

async function recordEquipHistory(
  itemDbId: string,
  heroId: HeroIdentifier,
  slot: EquipmentSlot,
  action: 'equip' | 'unequip'
): Promise<void> {
  const { error } = await supabase.from('item_equip_history').insert({
    item_id: itemDbId,
    hero_token_id: heroId.tokenId,
    hero_contract: heroId.contractAddress,
    hero_chain_id: heroId.chainId,
    slot,
    action,
  });

  if (error) {
    console.error('Error recording equip history:', error);
    // Don't throw - history is optional
  }
}

async function recordTransferHistory(
  itemDbId: string,
  fromWallet: string,
  toWallet: string,
  quantity: number,
  transferType: string
): Promise<void> {
  const { error } = await supabase.from('item_transfers').insert({
    item_id: itemDbId,
    from_wallet: fromWallet.toLowerCase(),
    to_wallet: toWallet.toLowerCase(),
    quantity,
    transfer_type: transferType,
  });

  if (error) {
    console.error('Error recording transfer history:', error);
    // Don't throw - history is optional
  }
}

function generateItemInstanceId(): string {
  return `item_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
}
