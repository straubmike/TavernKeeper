/**
 * Adventurer Tracking System - Type Definitions
 * 
 * These types define the structure for tracking hero/adventurer stats and attributes.
 * Heroes are identified by their NFT token ID, contract address, and chain ID.
 * All heroes are ultimately owned by a wallet address.
 */

/**
 * Core stat attributes for heroes
 */
export interface AdventurerStats {
  // Combat stats
  health: number;           // Current HP (diminishes in combat, refills in safe rooms/between adventures)
  maxHealth: number;        // Maximum HP
  mana: number;             // Current mana (for mages/clerics, refills in safe rooms/between adventures)
  maxMana: number;          // Maximum mana
  
  // Primary attributes
  strength: number;          // STR - melee attacks (1d20 + STR + mods > target AC)
  dexterity: number;        // DEX - ranged/finesse weapons (1d20 + DEX + mods > AC)
  wisdom: number;           // WIS - mage spell attacks (1d20 + WIS + mods > AC), detect/dispel magic traps
  intelligence: number;     // INT - solve puzzle traps
  constitution: number;     // CON - affects max HP and damage resistance
  charisma: number;         // CHA - social interactions, party coordination
  
  // Secondary attributes
  perception: number;       // Ability to spot traps
  armorClass: number;       // AC - base armor class (modified by equipment)
  
  // Calculated combat bonuses
  attackBonus: number;      // Base attack bonus (modified by equipment)
  spellAttackBonus: number; // Spell attack bonus (for mages/clerics)
}

/**
 * Hero class types
 */
export type HeroClass = 'warrior' | 'mage' | 'rogue' | 'cleric';

/**
 * D&D 5e leveling curve - XP required per level
 */
export const XP_PER_LEVEL: Record<number, number> = {
  1: 0,
  2: 300,
  3: 900,
  4: 2700,
  5: 6500,
  6: 14000,
  7: 23000,
  8: 34000,
  9: 48000,
  10: 64000,
  11: 85000,
  12: 100000,
  13: 120000,
  14: 140000,
  15: 165000,
  16: 195000,
  17: 225000,
  18: 265000,
  19: 305000,
  20: 355000,
};

/**
 * Calculate level from total XP
 */
export function calculateLevelFromXP(totalXP: number): number {
  for (let level = 20; level >= 1; level--) {
    if (totalXP >= XP_PER_LEVEL[level]) {
      return level;
    }
  }
  return 1;
}

/**
 * Calculate HP from Constitution and level (D&D 5e)
 * HP = (Hit Die + CON modifier) + (Hit Die + CON modifier) ├ù (level - 1)
 * Or simplified: HP = level ├ù (Hit Die Average + CON modifier)
 */
export function calculateMaxHP(
  constitution: number,
  level: number,
  hitDie: number = 8 // Default hit die (varies by class)
): number {
  const conModifier = Math.floor((constitution - 10) / 2);
  const hitDieAverage = Math.floor(hitDie / 2) + 1; // Average of hit die (e.g., d8 = 4.5, rounded to 5)
  
  // Level 1: full hit die + CON modifier
  // Level 2+: average hit die + CON modifier per level
  if (level === 1) {
    return hitDie + conModifier;
  }
  
  return hitDie + conModifier + (level - 1) * (hitDieAverage + conModifier);
}

/**
 * Calculate HP gained on level up
 */
export function calculateHPGainOnLevelUp(
  constitution: number,
  newLevel: number,
  hitDie: number = 8
): number {
  const conModifier = Math.floor((constitution - 10) / 2);
  const hitDieAverage = Math.floor(hitDie / 2) + 1;
  
  if (newLevel === 1) {
    return hitDie + conModifier;
  }
  
  return hitDieAverage + conModifier;
}

/**
 * Hero identifier - links to on-chain NFT
 */
export interface HeroIdentifier {
  tokenId: string;          // NFT token ID
  contractAddress: string;   // Adventurer contract address
  chainId: number;          // Chain ID (e.g., 143 for Monad Mainnet)
}

/**
 * Complete adventurer record
 */
export interface AdventurerRecord {
  // On-chain identifier
  heroId: HeroIdentifier;
  
  // Wallet owner (ultimate owner - resolves through NFT ownership chain)
  walletAddress: string;   // Lowercase wallet address
  
  // Character info
  name?: string;            // Hero name (from metadata)
  class: HeroClass;         // Hero class
  
  // Stats
  stats: AdventurerStats;
  
  // Metadata
  level?: number;           // Character level (if leveling system exists)
  experience?: number;      // Experience points (if leveling system exists)
  
  // Timestamps
  createdAt: Date;
  updatedAt: Date;
  lastCombatAt?: Date;      // Last time hero was in combat
  lastRestAt?: Date;        // Last time hero rested (HP/mana refilled)
}

/**
 * Stat update payload
 */
export interface StatUpdate {
  heroId: HeroIdentifier;
  updates: Partial<AdventurerStats>;
  reason?: string;          // Reason for update (e.g., "combat_damage", "rest", "level_up")
}

/**
 * Health/mana restoration options
 */
export interface RestorationOptions {
  restoreHealth?: boolean;  // Restore health to max
  restoreMana?: boolean;    // Restore mana to max
  partialHealth?: number;   // Restore specific amount of health
  partialMana?: number;      // Restore specific amount of mana
}

/**
 * Trap interaction types
 */
export type TrapType = 'physical' | 'magical' | 'puzzle';

/**
 * Trap interaction result
 */
export interface TrapInteractionResult {
  detected: boolean;        // Whether trap was detected (perception check)
  disarmed: boolean;        // Whether trap was successfully disarmed/bypassed
  statUsed: 'strength' | 'dexterity' | 'wisdom' | 'intelligence';
  roll: number;             // Dice roll result
  dc: number;               // Difficulty class
  success: boolean;
}

/**
 * Query filters for adventurer records
 */
export interface AdventurerQueryFilters {
  walletAddress?: string;
  heroId?: HeroIdentifier;
  class?: HeroClass;
  minLevel?: number;
  maxLevel?: number;
}