/**
 * Adventurer Tracking Service
 * 
 * Service for managing hero/adventurer stats and attributes.
 * Handles stat updates, health/mana restoration, and trap interactions.
 */

import { supabase } from '../../../../lib/supabase';
import type {
  AdventurerRecord,
  AdventurerStats,
  HeroIdentifier,
  StatUpdate,
  RestorationOptions,
  TrapType,
  TrapInteractionResult,
  AdventurerQueryFilters,
  HeroClass,
} from '../types/adventurer-stats';
import { XP_PER_LEVEL, calculateLevelFromXP } from '../types/adventurer-stats';

/**
 * Get adventurer record by hero identifier
 */
export async function getAdventurer(heroId: HeroIdentifier): Promise<AdventurerRecord | null> {
  const { data, error } = await supabase
    .from('adventurers')
    .select('*')
    .eq('token_id', heroId.tokenId)
    .eq('contract_address', heroId.contractAddress)
    .eq('chain_id', heroId.chainId)
    .single();

  if (error) {
    if (error.code === 'PGRST116') {
      // No rows returned
      return null;
    }
    console.error('Error fetching adventurer:', error);
    throw error;
  }

  return mapDbToAdventurer(data);
}

/**
 * Get all adventurers for a wallet address
 */
export async function getAdventurersByWallet(
  walletAddress: string,
  filters?: AdventurerQueryFilters
): Promise<AdventurerRecord[]> {
  let query = supabase
    .from('adventurers')
    .select('*')
    .eq('wallet_address', walletAddress.toLowerCase());

  if (filters?.class) {
    query = query.eq('class', filters.class);
  }
  if (filters?.minLevel !== undefined) {
    query = query.gte('level', filters.minLevel);
  }
  if (filters?.maxLevel !== undefined) {
    query = query.lte('level', filters.maxLevel);
  }

  const { data, error } = await query.order('created_at', { ascending: false });

  if (error) {
    console.error('Error fetching adventurers:', error);
    throw error;
  }

  return (data || []).map(mapDbToAdventurer);
}

/**
 * Create or update adventurer record
 */
export async function upsertAdventurer(adventurer: AdventurerRecord): Promise<AdventurerRecord> {
  const dbRecord = mapAdventurerToDb(adventurer);

  const { data, error } = await supabase
    .from('adventurers')
    .upsert(dbRecord, {
      onConflict: 'token_id,contract_address,chain_id',
      ignoreDuplicates: false,
    })
    .select()
    .single();

  if (error) {
    console.error('Error upserting adventurer:', error);
    throw error;
  }

  return mapDbToAdventurer(data);
}

/**
 * Update adventurer stats
 */
export async function updateAdventurerStats(update: StatUpdate): Promise<AdventurerRecord> {
  const adventurer = await getAdventurer(update.heroId);
  if (!adventurer) {
    throw new Error(`Adventurer not found: ${update.heroId.tokenId}`);
  }

  // Apply updates
  const updatedStats: AdventurerStats = {
    ...adventurer.stats,
    ...update.updates,
  };

  // Ensure health/mana don't exceed max
  if (updatedStats.health > updatedStats.maxHealth) {
    updatedStats.health = updatedStats.maxHealth;
  }
  if (updatedStats.mana > updatedStats.maxMana) {
    updatedStats.mana = updatedStats.maxMana;
  }

  // Ensure health/mana don't go below 0
  if (updatedStats.health < 0) {
    updatedStats.health = 0;
  }
  if (updatedStats.mana < 0) {
    updatedStats.mana = 0;
  }

  const updatedAdventurer: AdventurerRecord = {
    ...adventurer,
    stats: updatedStats,
    updatedAt: new Date(),
  };

  // Record stat history if significant change
  if (update.reason && shouldRecordHistory(update)) {
    await recordStatHistory(adventurer, updatedStats, update);
  }

  return await upsertAdventurer(updatedAdventurer);
}

/**
 * Restore health and/or mana (e.g., in safe rooms or between adventures)
 */
export async function restoreAdventurer(
  heroId: HeroIdentifier,
  options: RestorationOptions
): Promise<AdventurerRecord> {
  const adventurer = await getAdventurer(heroId);
  if (!adventurer) {
    throw new Error(`Adventurer not found: ${heroId.tokenId}`);
  }

  const updates: Partial<AdventurerStats> = {};

  if (options.restoreHealth) {
    updates.health = adventurer.stats.maxHealth;
  } else if (options.partialHealth !== undefined) {
    updates.health = Math.min(
      adventurer.stats.health + options.partialHealth,
      adventurer.stats.maxHealth
    );
  }

  if (options.restoreMana) {
    updates.mana = adventurer.stats.maxMana;
  } else if (options.partialMana !== undefined) {
    updates.mana = Math.min(
      adventurer.stats.mana + options.partialMana,
      adventurer.stats.maxMana
    );
  }

  const updatedAdventurer: AdventurerRecord = {
    ...adventurer,
    stats: {
      ...adventurer.stats,
      ...updates,
    },
    lastRestAt: new Date(),
    updatedAt: new Date(),
  };

  return await upsertAdventurer(updatedAdventurer);
}

/**
 * Apply combat damage to adventurer
 */
export async function applyDamage(
  heroId: HeroIdentifier,
  damage: number
): Promise<AdventurerRecord> {
  return await updateAdventurerStats({
    heroId,
    updates: {
      health: undefined, // Will be calculated in updateAdventurerStats
    },
    reason: 'combat_damage',
  });
}

/**
 * Calculate trap interaction (detection and disarming)
 */
export function calculateTrapInteraction(
  adventurer: AdventurerRecord,
  trapType: TrapType,
  difficultyClass: number
): TrapInteractionResult {
  // Perception check to detect trap
  const perceptionRoll = rollD20() + adventurer.stats.perception;
  const detected = perceptionRoll >= difficultyClass;

  if (!detected) {
    return {
      detected: false,
      disarmed: false,
      statUsed: 'perception',
      roll: perceptionRoll,
      dc: difficultyClass,
      success: false,
    };
  }

  // Trap detected - now attempt to disarm/bypass
  let statUsed: 'strength' | 'dexterity' | 'wisdom' | 'intelligence';
  let statValue: number;
  let roll: number;

  switch (trapType) {
    case 'physical':
      // Physical traps: strength for forcing doors/levers, dexterity for tripwires
      // Default to dexterity for most physical traps
      statUsed = 'dexterity';
      statValue = adventurer.stats.dexterity;
      roll = rollD20() + statValue;
      break;

    case 'magical':
      // Magical traps: wisdom to detect and dispel
      statUsed = 'wisdom';
      statValue = adventurer.stats.wisdom;
      roll = rollD20() + statValue;
      break;

    case 'puzzle':
      // Puzzle traps: intelligence to solve
      statUsed = 'intelligence';
      statValue = adventurer.stats.intelligence;
      roll = rollD20() + statValue;
      break;

    default:
      statUsed = 'dexterity';
      statValue = adventurer.stats.dexterity;
      roll = rollD20() + statValue;
  }

  const success = roll >= difficultyClass;

  return {
    detected: true,
    disarmed: success,
    statUsed,
    roll,
    dc: difficultyClass,
    success,
  };
}

/**
 * Calculate melee attack roll
 */
export function calculateMeleeAttack(
  adventurer: AdventurerRecord,
  targetAC: number,
  modifiers: number = 0
): { hit: boolean; roll: number; total: number } {
  const roll = rollD20();
  const total = roll + adventurer.stats.strength + adventurer.stats.attackBonus + modifiers;
  const hit = total > targetAC;

  return { hit, roll, total };
}

/**
 * Calculate ranged/finesse attack roll
 */
export function calculateRangedAttack(
  adventurer: AdventurerRecord,
  targetAC: number,
  modifiers: number = 0
): { hit: boolean; roll: number; total: number } {
  const roll = rollD20();
  const total = roll + adventurer.stats.dexterity + adventurer.stats.attackBonus + modifiers;
  const hit = total > targetAC;

  return { hit, roll, total };
}

/**
 * Calculate spell attack roll (for mages)
 */
export function calculateSpellAttack(
  adventurer: AdventurerRecord,
  targetAC: number,
  modifiers: number = 0
): { hit: boolean; roll: number; total: number } {
  const roll = rollD20();
  const total = roll + adventurer.stats.wisdom + adventurer.stats.spellAttackBonus + modifiers;
  const hit = total > targetAC;

  return { hit, roll, total };
}

/**
 * Consume mana for spell casting
 */
export async function consumeMana(
  heroId: HeroIdentifier,
  amount: number
): Promise<AdventurerRecord> {
  const adventurer = await getAdventurer(heroId);
  if (!adventurer) {
    throw new Error(`Adventurer not found: ${heroId.tokenId}`);
  }

  if (adventurer.stats.mana < amount) {
    throw new Error(`Insufficient mana: ${adventurer.stats.mana} < ${amount}`);
  }

  return await updateAdventurerStats({
    heroId,
    updates: {
      mana: adventurer.stats.mana - amount,
    },
    reason: 'spell_cast',
  });
}

// Helper functions

function mapDbToAdventurer(dbRecord: any): AdventurerRecord {
  return {
    heroId: {
      tokenId: dbRecord.token_id,
      contractAddress: dbRecord.contract_address,
      chainId: dbRecord.chain_id,
    },
    walletAddress: dbRecord.wallet_address,
    name: dbRecord.name,
    class: dbRecord.class as HeroClass,
    level: dbRecord.level,
    experience: dbRecord.experience,
    stats: {
      health: dbRecord.health,
      maxHealth: dbRecord.max_health,
      mana: dbRecord.mana,
      maxMana: dbRecord.max_mana,
      strength: dbRecord.strength,
      dexterity: dbRecord.dexterity,
      wisdom: dbRecord.wisdom,
      intelligence: dbRecord.intelligence,
      constitution: dbRecord.constitution,
      charisma: dbRecord.charisma,
      perception: dbRecord.perception,
      armorClass: dbRecord.armor_class,
      attackBonus: dbRecord.attack_bonus,
      spellAttackBonus: dbRecord.spell_attack_bonus,
    },
    createdAt: new Date(dbRecord.created_at),
    updatedAt: new Date(dbRecord.updated_at),
    lastCombatAt: dbRecord.last_combat_at ? new Date(dbRecord.last_combat_at) : undefined,
    lastRestAt: dbRecord.last_rest_at ? new Date(dbRecord.last_rest_at) : undefined,
  };
}

function mapAdventurerToDb(adventurer: AdventurerRecord): any {
  return {
    token_id: adventurer.heroId.tokenId,
    contract_address: adventurer.heroId.contractAddress,
    chain_id: adventurer.heroId.chainId,
    wallet_address: adventurer.walletAddress.toLowerCase(),
    name: adventurer.name,
    class: adventurer.class,
    level: adventurer.level ?? 1,
    experience: adventurer.experience ?? 0,
    health: adventurer.stats.health,
    max_health: adventurer.stats.maxHealth,
    mana: adventurer.stats.mana,
    max_mana: adventurer.stats.maxMana,
    strength: adventurer.stats.strength,
    dexterity: adventurer.stats.dexterity,
    wisdom: adventurer.stats.wisdom,
    intelligence: adventurer.stats.intelligence,
    constitution: adventurer.stats.constitution,
    charisma: adventurer.stats.charisma,
    perception: adventurer.stats.perception,
    armor_class: adventurer.stats.armorClass,
    attack_bonus: adventurer.stats.attackBonus,
    spell_attack_bonus: adventurer.stats.spellAttackBonus,
    last_combat_at: adventurer.lastCombatAt?.toISOString(),
    last_rest_at: adventurer.lastRestAt?.toISOString(),
  };
}

async function recordStatHistory(
  adventurer: AdventurerRecord,
  newStats: AdventurerStats,
  update: StatUpdate
): Promise<void> {
  // Get adventurer database record to get UUID
  const { data: dbRecord } = await supabase
    .from('adventurers')
    .select('id')
    .eq('token_id', adventurer.heroId.tokenId)
    .eq('contract_address', adventurer.heroId.contractAddress)
    .eq('chain_id', adventurer.heroId.chainId)
    .single();

  if (!dbRecord) return;

  // Record stat history
  const { error } = await supabase.from('adventurer_stat_history').insert({
    adventurer_id: dbRecord.id,
    health: newStats.health,
    max_health: newStats.maxHealth,
    mana: newStats.mana,
    max_mana: newStats.maxMana,
    strength: newStats.strength,
    dexterity: newStats.dexterity,
    wisdom: newStats.wisdom,
    intelligence: newStats.intelligence,
    constitution: newStats.constitution,
    charisma: newStats.charisma,
    perception: newStats.perception,
    armor_class: newStats.armorClass,
    attack_bonus: newStats.attackBonus,
    spell_attack_bonus: newStats.spellAttackBonus,
    reason: update.reason,
    stat_name: Object.keys(update.updates)[0], // First changed stat
  });

  if (error) {
    console.error('Error recording stat history:', error);
    // Don't throw - history is optional
  }
}

function shouldRecordHistory(update: StatUpdate): boolean {
  // Record history for significant changes
  const significantReasons = ['combat_damage', 'level_up', 'rest', 'spell_cast'];
  return update.reason ? significantReasons.includes(update.reason) : false;
}

/**
 * Calculate max HP from Constitution and level (D&D 5e)
 * HP = (Hit Die + CON modifier) + (Hit Die Average + CON modifier) ├ù (level - 1)
 */
export function calculateMaxHPFromConstitution(
  constitution: number,
  level: number,
  hitDie: number = 8
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
 * Calculate HP gained on level up (D&D 5e)
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
 * Get hit die by class (D&D 5e)
 */
export function getHitDieByClass(heroClass: HeroClass): number {
  const hitDice: Record<HeroClass, number> = {
    warrior: 10, // d10
    mage: 6,     // d6
    rogue: 8,    // d8
    cleric: 8,   // d8
  };
  return hitDice[heroClass];
}

/**
 * Add XP to adventurer and check for level up
 */
export async function addXP(
  heroId: HeroIdentifier,
  xpAmount: number
): Promise<{ adventurer: AdventurerRecord; leveledUp: boolean; newLevel?: number }> {
  const adventurer = await getAdventurer(heroId);
  if (!adventurer) {
    throw new Error(`Adventurer not found: ${heroId.tokenId}`);
  }

  const currentXP = adventurer.experience || 0;
  const currentLevel = adventurer.level || 1;
  const newXP = currentXP + xpAmount;
  const newLevel = calculateLevelFromXP(newXP);
  const leveledUp = newLevel > currentLevel;

  // Update XP
  const updatedAdventurer: AdventurerRecord = {
    ...adventurer,
    experience: newXP,
    level: newLevel,
  };

  // If leveled up, recalculate max HP from Constitution
  if (leveledUp) {
    const hitDie = getHitDieByClass(adventurer.class);
    const newMaxHP = calculateMaxHPFromConstitution(
      adventurer.stats.constitution,
      newLevel,
      hitDie
    );
    
    updatedAdventurer.stats = {
      ...adventurer.stats,
      maxHealth: newMaxHP,
      health: newMaxHP, // Full heal on level up
    };

    // Restore mana on level up for spellcasters
    if (adventurer.class === 'mage' || adventurer.class === 'cleric') {
      updatedAdventurer.stats.mana = updatedAdventurer.stats.maxMana;
    }
  }

  const result = await upsertAdventurer(updatedAdventurer);

  return {
    adventurer: result,
    leveledUp,
    newLevel: leveledUp ? newLevel : undefined,
  };
}

function rollD20(): number {
  return Math.floor(Math.random() * 20) + 1;
}