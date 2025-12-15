/**
 * Trap Resolution System - Type Definitions
 * 
 * Types for resolving trap room encounters in dungeons.
 */

import type { AdventurerRecord } from '../../adventurer-tracking/code/types/adventurer-stats';
import type { RoomEncounter } from '../../themed-dungeon-generation/code/types/dungeon-generation';

/**
 * Trap check type - determines which stat is used for disarming
 */
export type TrapCheckType = 'perception' | 'dexterity' | 'strength' | 'wisdom' | 'intelligence';

/**
 * Trap resolution state - tracks the resolution process
 */
export interface TrapResolutionState {
  trapId: string;
  roomId: string;
  roomLevel: number; // Dungeon level (1-100)
  trapSubtype: 'mechanical' | 'magical' | 'fake_treasure' | 'trapped_treasure' | 'ambush';
  difficultyClass: number; // DC for checks
  partyMembers: AdventurerRecord[];
  perceptionChecks: PerceptionCheck[];
  disarmChecks: DisarmCheck[];
  status: 'detecting' | 'disarming' | 'resolved';
  resolvedAt?: Date;
}

/**
 * Perception check result for a party member
 */
export interface PerceptionCheck {
  adventurerId: string;
  adventurerName: string;
  statUsed: 'perception';
  roll: number; // d20 roll
  modifier: number; // Wisdom modifier
  proficiencyBonus: number; // Proficiency bonus if proficient
  total: number; // roll + modifier + proficiency
  dc: number; // Difficulty class
  success: boolean; // Whether trap was detected
}

/**
 * Disarm check result for a party member
 */
export interface DisarmCheck {
  adventurerId: string;
  adventurerName: string;
  statUsed: 'dexterity' | 'strength' | 'wisdom' | 'intelligence';
  roll: number; // d20 roll
  modifier: number; // Stat modifier
  proficiencyBonus: number; // Proficiency bonus
  total: number; // roll + modifier + proficiency
  dc: number; // Difficulty class
  success: boolean; // Whether trap was disarmed
}

/**
 * Damage dealt to a party member from trap
 */
export interface TrapDamage {
  adventurerId: string;
  adventurerName: string;
  damage: number;
  hpBefore: number;
  hpAfter: number;
  maxHp: number;
  reason: 'perception_failed' | 'disarm_failed';
}

/**
 * Trap resolution result
 */
export interface TrapResolutionResult {
  trapId: string;
  roomId: string;
  roomLevel: number;
  trapSubtype: 'mechanical' | 'magical' | 'fake_treasure' | 'trapped_treasure' | 'ambush';
  difficultyClass: number;
  
  // Check results
  perceptionChecks: PerceptionCheck[];
  disarmChecks: DisarmCheck[];
  
  // Overall results
  detected: boolean; // At least one party member detected the trap
  disarmed: boolean; // At least one party member disarmed the trap
  
  // Damage dealt
  damageDealt: TrapDamage[];
  totalDamage: number;
  
  // Rewards (if trap was disarmed)
  rewards?: Array<{
    type: 'gold' | 'item' | 'experience' | 'lore';
    amount?: number;
    itemId?: string;
    description: string;
  }>;
  
  // XP awarded (for surviving)
  xpAwarded: number;
  
  // Status
  status: 'success' | 'partial_success' | 'failure';
  message: string;
  
  // Updated party members (with HP/mana changes)
  updatedPartyMembers: AdventurerRecord[];
  
  // Time cost (for puzzle traps that don't deal damage)
  timeCost?: number; // In minutes or turns (not yet implemented)
}

/**
 * Configuration for trap resolution
 */
export interface TrapResolutionConfig {
  // Whether to use best party member's roll (true) or require all to pass (false)
  useBestRoll: boolean; // Default: true (any party member passing = success)
  
  // Damage scaling factor (damage = baseDamage * (level / 10) * scalingFactor)
  damageScalingFactor: number; // Default: 1.0
  
  // Whether puzzle traps deal damage on failure (false = time cost only)
  puzzleTrapsDealDamage: boolean; // Default: false
}
