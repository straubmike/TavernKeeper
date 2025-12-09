/**
 * Inventory Tracking System - Type Definitions
 * 
 * These types define the structure for tracking player inventory.
 * Inventory is organized into:
 * - Equipped items: per character (tied to hero token ID)
 * - Non-equipped items: shared per wallet (accessible by all characters)
 * 
 * CURRENT IMPLEMENTATION (Simplified):
 * - Equipment slots: Only 'main_hand' (weapons) and 'armor' (complete sets)
 * - Weapons: One weapon type per class (no off-hand)
 * - Armor: Complete sets (2 per class), not individual pieces
 * 
 * FUTURE EXPANSION:
 * - Full D&D-style equipment with off_hand, head, body, hands, feet slots
 * - Individual armor pieces instead of complete sets
 * - Structure is preserved in types for easy expansion
 */

import type { GeneratedItem } from '../../../procedural-item-generation/code/types/item-generation';

/**
 * Equipment slot types
 * 
 * CURRENT IMPLEMENTATION (Simplified):
 * - main_hand: Primary weapon (one weapon per class)
 * - armor: Complete armor set (2 sets per class, equips as single piece)
 * 
 * FUTURE EXPANSION (Not currently used, but structure preserved):
 * - off_hand: Secondary weapon, shield, or spellbook
 * - head: Helmets, hats, headgear (separate from armor set)
 * - body: Armor, robes, chest pieces (separate from armor set)
 * - hands: Gloves, gauntlets, handwear (separate from armor set)
 * - feet: Boots, shoes, footwear (separate from armor set)
 */
export type EquipmentSlot =
  | 'main_hand'   // Primary weapon (swords, staffs, maces, etc.) - CURRENTLY USED
  | 'armor'       // Complete armor set (2 sets per class) - CURRENTLY USED
  | 'off_hand'    // Secondary weapon, shield, or spellbook - FUTURE EXPANSION
  | 'head'        // Helmets, hats, headgear - FUTURE EXPANSION
  | 'body'        // Armor, robes, chest pieces - FUTURE EXPANSION
  | 'hands'       // Gloves, gauntlets, handwear - FUTURE EXPANSION
  | 'feet';       // Boots, shoes, footwear - FUTURE EXPANSION

/**
 * Inventory item - extends GeneratedItem with inventory-specific fields
 */
export interface InventoryItem extends GeneratedItem {
  // Inventory tracking
  quantity: number;              // Stack size (for stackable items)
  equipped: boolean;             // Whether item is currently equipped
  equippedBy?: HeroIdentifier;  // Which hero has this equipped (if equipped)
  equippedSlot?: EquipmentSlot;  // Which slot it's equipped in (if equipped)
  
  // Ownership
  walletAddress: string;         // Wallet that owns this item
  acquiredAt: Date;              // When item was acquired
  acquiredFrom?: string;         // Source (e.g., "dungeon_loot", "vendor", "quest")
}

/**
 * Hero identifier - links to on-chain NFT
 */
export interface HeroIdentifier {
  tokenId: string;          // NFT token ID
  contractAddress: string;  // Adventurer contract address
  chainId: number;          // Chain ID
}

/**
 * Equipped items for a hero
 * 
 * CURRENT IMPLEMENTATION (Simplified):
 * - mainHand: One weapon per class
 * - armor: Complete armor set (equips as single piece)
 * 
 * FUTURE EXPANSION (Not currently used, but structure preserved):
 * - offHand, head, body, hands, feet: Individual armor pieces
 */
export interface EquippedItems {
  heroId: HeroIdentifier;
  mainHand?: InventoryItem;  // CURRENTLY USED - Primary weapon
  armor?: InventoryItem;      // CURRENTLY USED - Complete armor set
  offHand?: InventoryItem;   // FUTURE EXPANSION
  head?: InventoryItem;       // FUTURE EXPANSION
  body?: InventoryItem;       // FUTURE EXPANSION
  hands?: InventoryItem;      // FUTURE EXPANSION
  feet?: InventoryItem;       // FUTURE EXPANSION
}

/**
 * Wallet inventory - non-equipped items shared across all characters
 */
export interface WalletInventory {
  walletAddress: string;
  items: InventoryItem[];
  totalItems: number;
  totalValue?: number;      // Optional: total estimated value
}

/**
 * Item transfer operation
 */
export interface ItemTransfer {
  itemId: string;
  fromWallet: string;
  toWallet: string;
  quantity?: number;       // For stackable items, transfer partial quantity
}

/**
 * Item equip/unequip operation
 */
export interface ItemEquipOperation {
  itemId: string;
  heroId: HeroIdentifier;
  slot: EquipmentSlot;
  action: 'equip' | 'unequip';
}

/**
 * Item query filters
 */
export interface InventoryQueryFilters {
  walletAddress?: string;
  heroId?: HeroIdentifier;
  equipped?: boolean;
  slot?: EquipmentSlot;
  category?: 'weapon' | 'armor';
  rarity?: 'common' | 'uncommon' | 'rare' | 'epic';
  requiredClass?: 'warrior' | 'mage' | 'rogue' | 'cleric' | 'any';
}

/**
 * Inventory summary statistics
 */
export interface InventorySummary {
  walletAddress: string;
  totalItems: number;
  equippedItems: number;
  unequippedItems: number;
  itemsByCategory: {
    weapons: number;
    armor: number;
  };
  itemsByRarity: {
    common: number;
    uncommon: number;
    rare: number;
    epic: number;
  };
  itemsByHero: Array<{
    heroId: HeroIdentifier;
    equippedCount: number;
  }>;
}
