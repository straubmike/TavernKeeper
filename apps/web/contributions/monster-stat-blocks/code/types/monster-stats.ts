/**
 * Monster Stat Block System - Type Definitions
 * 
 * Simplified monster stat blocks for combat encounters.
 */

/**
 * Challenge Rating (CR) - D&D 5e challenge rating system
 */
export type ChallengeRating = 0 | 0.125 | 0.25 | 0.5 | 1 | 2 | 3 | 4 | 5 | 6 | 7 | 8 | 9 | 10 | 11 | 12 | 13 | 14 | 15 | 16 | 17 | 18 | 19 | 20 | 21 | 22 | 23 | 24 | 25 | 26 | 27 | 28 | 29 | 30;

/**
 * Simplified monster stat block - only essential stats
 */
export interface MonsterStatBlock {
  name: string;
  hp: number;              // Hit points
  ac: number;              // Armor class
  cr: ChallengeRating;     // Challenge rating
  xp: number;             // XP reward
  strength: number;       // Strength stat
  dexterity: number;      // Dexterity stat
  wisdom: number;         // Wisdom stat
}

/**
 * Monster instance - a specific monster in combat
 */
export interface MonsterInstance {
  id: string;
  statBlock: MonsterStatBlock;
  currentHp: number;
  maxHp: number;
}

/**
 * Monster theme/category
 */
export type MonsterTheme = 
  | 'undead'
  | 'fire'
  | 'ice'
  | 'nature'
  | 'shadow'
  | 'mechanical'
  | 'abyssal'
  | 'crystal'
  | 'bandit'
  | 'goblin'
  | 'necromancer-tower'
  | 'generic';

/**
 * Monster registry entry
 */
export interface MonsterRegistryEntry {
  name: string;
  theme: MonsterTheme;
  statBlock: MonsterStatBlock;
  isBoss: boolean; // Whether this is typically a boss monster
}


/**
 * Calculate XP reward from CR (D&D 5e XP table)
 */
export function calculateXPFromCR(cr: ChallengeRating): number {
  const xpTable: Record<ChallengeRating, number> = {
    0: 0,
    0.125: 25,
    0.25: 50,
    0.5: 100,
    1: 200,
    2: 450,
    3: 700,
    4: 1100,
    5: 1800,
    6: 2300,
    7: 2900,
    8: 3900,
    9: 5000,
    10: 5900,
    11: 7200,
    12: 8400,
    13: 10000,
    14: 11500,
    15: 13000,
    16: 15000,
    17: 18000,
    18: 20000,
    19: 22000,
    20: 25000,
    21: 33000,
    22: 41000,
    23: 50000,
    24: 62000,
    25: 75000,
    26: 90000,
    27: 105000,
    28: 120000,
    29: 135000,
    30: 155000,
  };
  return xpTable[cr] || 0;
}
