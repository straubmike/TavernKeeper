/**
 * Adventurer Tracking System - Usage Examples
 * 
 * Examples showing how to integrate and use the adventurer tracking system.
 */

import {
  getAdventurer,
  upsertAdventurer,
  updateAdventurerStats,
  restoreAdventurer,
  applyDamage,
  calculateTrapInteraction,
  calculateMeleeAttack,
  calculateRangedAttack,
  calculateSpellAttack,
  consumeMana,
  getAdventurersByWallet,
} from '../code/services/adventurerService';
import type {
  AdventurerRecord,
  HeroIdentifier,
  RestorationOptions,
  TrapType,
} from '../code/types/adventurer-stats';
import { getHeroByTokenId } from '../../../../lib/services/heroOwnership';

/**
 * Example 1: Initialize adventurer from hero NFT
 */
export async function initializeAdventurerFromHero(
  tokenId: string,
  contractAddress: string,
  chainId: number,
  walletAddress: string
): Promise<AdventurerRecord> {
  // Get hero metadata from blockchain
  const hero = await getHeroByTokenId(tokenId);

  // Determine hero class from metadata
  const heroClass = hero.metadata?.hero?.class || 
                    hero.metadata?.attributes?.find((a: any) => a.trait_type === 'Class')?.value ||
                    'warrior';

  // Base stats by class (these would typically come from metadata or be calculated)
  const baseStats = {
    warrior: {
      health: 100,
      maxHealth: 100,
      mana: 0,
      maxMana: 0,
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
    mage: {
      health: 60,
      maxHealth: 60,
      mana: 50,
      maxMana: 50,
      strength: 8,
      dexterity: 12,
      wisdom: 16,
      intelligence: 14,
      constitution: 10,
      charisma: 10,
      perception: 12,
      armorClass: 10,
      attackBonus: 1,
      spellAttackBonus: 3,
    },
    rogue: {
      health: 80,
      maxHealth: 80,
      mana: 0,
      maxMana: 0,
      strength: 10,
      dexterity: 16,
      wisdom: 10,
      intelligence: 14,
      constitution: 12,
      charisma: 8,
      perception: 14,
      armorClass: 12,
      attackBonus: 3,
      spellAttackBonus: 0,
    },
    cleric: {
      health: 90,
      maxHealth: 90,
      mana: 40,
      maxMana: 40,
      strength: 12,
      dexterity: 10,
      wisdom: 16,
      intelligence: 10,
      constitution: 14,
      charisma: 12,
      perception: 12,
      armorClass: 11,
      attackBonus: 2,
      spellAttackBonus: 3,
    },
  };

  const stats = baseStats[heroClass as keyof typeof baseStats] || baseStats.warrior;

  const heroId: HeroIdentifier = {
    tokenId,
    contractAddress,
    chainId,
  };

  const adventurer: AdventurerRecord = {
    heroId,
    walletAddress: walletAddress.toLowerCase(),
    name: hero.name,
    class: heroClass as any,
    stats,
    createdAt: new Date(),
    updatedAt: new Date(),
  };

  return await upsertAdventurer(adventurer);
}

/**
 * Example 2: Apply combat damage
 */
export async function handleCombatDamage(
  heroId: HeroIdentifier,
  damage: number
): Promise<AdventurerRecord> {
  const adventurer = await getAdventurer(heroId);
  if (!adventurer) {
    throw new Error('Adventurer not found');
  }

  const newHealth = Math.max(0, adventurer.stats.health - damage);

  return await updateAdventurerStats({
    heroId,
    updates: {
      health: newHealth,
    },
    reason: 'combat_damage',
  });
}

/**
 * Example 3: Restore health/mana in safe room
 */
export async function handleSafeRoomRest(
  heroId: HeroIdentifier
): Promise<AdventurerRecord> {
  return await restoreAdventurer(heroId, {
    restoreHealth: true,
    restoreMana: true,
  });
}

/**
 * Example 4: Calculate and handle trap interaction
 */
export async function handleTrapInteraction(
  heroId: HeroIdentifier,
  trapType: TrapType,
  difficultyClass: number
): Promise<{ success: boolean; result: any }> {
  const adventurer = await getAdventurer(heroId);
  if (!adventurer) {
    throw new Error('Adventurer not found');
  }

  const result = calculateTrapInteraction(adventurer, trapType, difficultyClass);

  if (!result.detected) {
    return {
      success: false,
      result: {
        message: 'Trap not detected!',
        damage: 10, // Trap triggers and deals damage
      },
    };
  }

  if (!result.disarmed) {
    return {
      success: false,
      result: {
        message: 'Trap detected but failed to disarm!',
        damage: 5, // Partial damage
      },
    };
  }

  return {
    success: true,
    result: {
      message: 'Trap successfully disarmed!',
      statUsed: result.statUsed,
      roll: result.roll,
    },
  };
}

/**
 * Example 5: Calculate melee attack
 */
export function handleMeleeAttack(
  adventurer: AdventurerRecord,
  targetAC: number,
  weaponBonus: number = 0
): { hit: boolean; damage?: number } {
  const attack = calculateMeleeAttack(adventurer, targetAC, weaponBonus);

  if (!attack.hit) {
    return { hit: false };
  }

  // Calculate damage (would use weapon damage dice)
  // This is simplified - actual damage would come from weapon stats
  const damage = Math.floor(Math.random() * 8) + 1 + Math.floor((adventurer.stats.strength - 10) / 2);

  return { hit: true, damage };
}

/**
 * Example 6: Calculate spell attack (mage)
 */
export function handleSpellAttack(
  adventurer: AdventurerRecord,
  targetAC: number,
  spellBonus: number = 0
): { hit: boolean; damage?: number } {
  const attack = calculateSpellAttack(adventurer, targetAC, spellBonus);

  if (!attack.hit) {
    return { hit: false };
  }

  // Calculate spell damage (would use spell damage dice)
  const damage = Math.floor(Math.random() * 6) + 1 + Math.floor((adventurer.stats.wisdom - 10) / 2);

  return { hit: true, damage };
}

/**
 * Example 7: Cast healing spell (cleric - auto-hit)
 */
export async function handleHealingSpell(
  heroId: HeroIdentifier,
  targetHeroId: HeroIdentifier,
  healingAmount: number
): Promise<{ success: boolean; healed: number }> {
  const caster = await getAdventurer(heroId);
  if (!caster) {
    throw new Error('Caster not found');
  }

  if (caster.class !== 'cleric') {
    throw new Error('Only clerics can cast healing spells');
  }

  // Consume mana
  const manaCost = 5;
  if (caster.stats.mana < manaCost) {
    return { success: false, healed: 0 };
  }

  await consumeMana(heroId, manaCost);

  // Heal target (auto-hit on allies)
  const target = await getAdventurer(targetHeroId);
  if (!target) {
    throw new Error('Target not found');
  }

  const newHealth = Math.min(
    target.stats.maxHealth,
    target.stats.health + healingAmount
  );

  await updateAdventurerStats({
    heroId: targetHeroId,
    updates: {
      health: newHealth,
    },
    reason: 'healing_spell',
  });

  return {
    success: true,
    healed: newHealth - target.stats.health,
  };
}

/**
 * Example 8: Get all adventurers for a wallet
 */
export async function getWalletAdventurers(walletAddress: string) {
  return await getAdventurersByWallet(walletAddress.toLowerCase());
}

/**
 * Example 9: Level up adventurer using D&D 5e leveling and Constitution-based HP
 */
export async function levelUpAdventurer(
  heroId: HeroIdentifier
): Promise<AdventurerRecord> {
  const adventurer = await getAdventurer(heroId);
  if (!adventurer) {
    throw new Error('Adventurer not found');
  }

  const newLevel = (adventurer.level || 1) + 1;

  // Hit dice by class (D&D 5e)
  const hitDice: Record<HeroClass, number> = {
    warrior: 10, // d10
    mage: 6,     // d6
    rogue: 8,    // d8
    cleric: 8,   // d8
  };

  const hitDie = hitDice[adventurer.class];
  
  // Calculate HP gain from Constitution (D&D 5e)
  // HP = (Hit Die + CON modifier) + (Hit Die Average + CON modifier) ├ù (level - 1)
  const conModifier = Math.floor((adventurer.stats.constitution - 10) / 2);
  const hitDieAverage = Math.floor(hitDie / 2) + 1; // Average of hit die
  
  let newMaxHP: number;
  if (newLevel === 1) {
    newMaxHP = hitDie + conModifier;
  } else {
    newMaxHP = hitDie + conModifier + (newLevel - 1) * (hitDieAverage + conModifier);
  }
  
  const hpGain = newMaxHP - adventurer.stats.maxHealth;

  // Increase stats on level up (simplified - actual system would be more complex)
  // In D&D 5e, ability score improvements happen at levels 4, 8, 12, 16, 19
  const abilityScoreImprovement = (newLevel % 4 === 0 && newLevel <= 19);
  
  const statIncreases: Partial<AdventurerStats> = {
    maxHealth: newMaxHP,
    health: newMaxHP, // Full heal on level up
  };

  // Mana increases for spellcasters (simplified)
  if (adventurer.class === 'mage' || adventurer.class === 'cleric') {
    statIncreases.maxMana = adventurer.stats.maxMana + 5;
    statIncreases.mana = adventurer.stats.maxMana + 5; // Full mana restore
  }

  // Ability score improvements (D&D 5e)
  if (abilityScoreImprovement) {
    // Player chooses which stats to increase, but for automation we'll increase primary stat
    if (adventurer.class === 'warrior') {
      statIncreases.strength = (statIncreases.strength || adventurer.stats.strength) + 1;
    } else if (adventurer.class === 'rogue') {
      statIncreases.dexterity = (statIncreases.dexterity || adventurer.stats.dexterity) + 1;
    } else if (adventurer.class === 'mage' || adventurer.class === 'cleric') {
      statIncreases.wisdom = (statIncreases.wisdom || adventurer.stats.wisdom) + 1;
    }
  }

  return await updateAdventurerStats({
    heroId,
    updates: statIncreases,
    reason: 'level_up',
  });
}