/**
 * Combat System - Type Definitions
 * 
 * Types for turn-based combat encounters between party members and monsters.
 */

import type { AdventurerRecord } from '../../adventurer-tracking/code/types/adventurer-stats';
import type { MonsterInstance } from '../../monster-stat-blocks/code/types/monster-stats';

/**
 * Combat entity - represents either a party member or monster in combat
 */
export interface CombatEntity {
  id: string;
  type: 'party' | 'monster';
  name: string;
  dexterity: number;      // For turn order
  currentHp: number;
  maxHp: number;
  ac: number;             // Armor class
  strength?: number;      // For party members (melee attacks)
  mana?: number;          // For party members (clerics/mages)
  maxMana?: number;       // For party members
  class?: 'warrior' | 'mage' | 'rogue' | 'cleric'; // For party members
  proficiencyBonus?: number; // Proficiency bonus for party members (D&D 5e)
  adventurerRecord?: AdventurerRecord; // Reference to full adventurer data
  monsterInstance?: MonsterInstance;   // Reference to full monster data
}

/**
 * Weapon type determines which stat is used for attack rolls
 */
export type WeaponType = 'melee-strength' | 'melee-dexterity' | 'ranged' | 'magic' | 'heal';

/**
 * Weapon definition
 * 
 * This interface represents weapons used in combat. Weapons are retrieved from the
 * inventory-tracking service via getEquippedItems() and converted using inventoryItemToWeapon().
 * If no weapon is equipped, the combat system falls back to default class-based weapons.
 * 
 * See: apps/web/contributions/inventory-tracking for the inventory system.
 * See: apps/web/contributions/combat-system/code/services/combatService.ts for weapon retrieval.
 */
export interface Weapon {
  name: string;
  type: WeaponType;
  damageDice: string;     // e.g., "1d6", "2d8"
  damageModifier?: number; // Additional damage modifier (from weapon enchantments/quality)
  attackModifier?: number; // Additional attack roll modifier (from weapon enchantments/quality)
  manaCost?: number;       // For magic/heal abilities
}

/**
 * Combat action - what an entity does on their turn
 */
export interface CombatAction {
  entityId: string;
  actionType: 'attack' | 'heal' | 'magic-attack';
  targetId: string;       // Target entity ID
  weapon: Weapon;
}

/**
 * Attack result
 */
export interface AttackResult {
  attackerId: string;
  targetId: string;
  hit: boolean;
  attackRoll: number;     // d20 roll
  attackTotal: number;    // roll + modifiers
  targetAC: number;
  damage?: number;        // Damage dealt (if hit)
  damageRoll?: number[];  // Individual dice rolls
  criticalHit?: boolean;
  targetHpBefore?: number; // Target HP before damage (for display)
  targetHpAfter?: number;  // Target HP after damage (for display)
  targetMaxHp?: number;    // Target max HP (for display)
  attackModifier?: number; // Stat modifier used for attack (for display)
  proficiencyBonus?: number; // Proficiency bonus (for display)
  weaponModifier?: number;   // Weapon modifier (for display)
}

/**
 * Heal result
 */
export interface HealResult {
  casterId: string;
  targetId: string;
  amount: number;
  targetHpBefore: number;  // Target HP before healing (for accurate display)
  targetNewHp: number;    // Target HP after healing
  targetMaxHp: number;
  manaCost: number;
  casterNewMana: number;
}

/**
 * Turn in combat
 */
export interface CombatTurn {
  turnNumber: number;
  entityId: string;
  entityName: string;
  targetId?: string;      // Target entity ID (for display)
  targetName?: string;    // Target entity name (for display)
  action: CombatAction;
  result: AttackResult | HealResult;
}

/**
 * Combat state
 */
export interface CombatState {
  combatId: string;
  roomId: string;
  entities: CombatEntity[];
  turnOrder: string[];    // Entity IDs in initiative order
  currentTurn: number;     // Index in turnOrder
  turns: CombatTurn[];     // History of all turns
  isAmbush: boolean;       // If monsters got ambush round (party failed perception)
  isSurprise: boolean;     // If party got surprise round (party passed perception)
  ambushCompleted: boolean;
  surpriseCompleted: boolean;
  status: 'active' | 'victory' | 'defeat';
  startedAt: Date;
  endedAt?: Date;
  seed?: string;           // Seed for deterministic RNG (optional, for compatibility)
}

/**
 * Combat configuration - determines behavior for special classes
 */
export interface CombatConfig {
  // For clerics: ratio of heal actions vs mace attacks (0.0 to 1.0)
  // 0.0 = never heal, 1.0 = always heal when possible
  clericHealRatio: number;
  
  // For mages: ratio of magic attacks vs staff melee (0.0 to 1.0)
  // 0.0 = never use magic, 1.0 = always use magic when possible
  mageMagicRatio: number;
  
  // Agent-determined actions for this combat (optional)
  // If provided, these actions will be used instead of auto-determining
  predeterminedActions?: Array<{
    turnNumber: number;
    entityId: string;
    actionType: 'attack' | 'heal' | 'magic-attack';
    targetId: string;
  }>;
}

/**
 * Combat result summary
 * 
 * NOTE: The finalState contains the updated entities with current HP/mana after combat.
 * This should be used to update adventurer records between rooms in dungeon runs.
 * HP and mana carry over between combat rooms, and only safe rooms reset them to max.
 */
export interface CombatResult {
  combatId: string;
  status: 'victory' | 'defeat';
  turns: CombatTurn[];
  totalTurns: number;
  partyMembersAlive: number;
  partyMembersTotal: number;
  monstersAlive: number;
  monstersTotal: number;
  xpAwarded?: number;
  duration: number; // milliseconds
  finalState: CombatState; // Final state with updated HP/mana for party members
}
