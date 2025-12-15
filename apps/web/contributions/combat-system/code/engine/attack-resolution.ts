/**
 * Attack Resolution System
 * 
 * Handles attack rolls, damage calculation, and hit determination.
 */

import type { CombatEntity, Weapon, AttackResult } from '../types/combat';
import { SeededRNG } from '../../../../lib/utils/seededRNG';

/**
 * Roll a d20 using seeded RNG
 */
export function rollD20(rng: SeededRNG): number {
  return rng.range(1, 20);
}

/**
 * Roll dice using seeded RNG (e.g., "2d6" or "2d4+2" returns sum of dice + modifier)
 */
export function rollDice(diceString: string, rng: SeededRNG): { total: number; rolls: number[] } {
  // Match patterns like "2d6", "2d4+2", "1d4+1"
  const match = diceString.match(/(\d+)d(\d+)(?:\+(\d+))?/);
  if (!match) {
    throw new Error(`Invalid dice string: ${diceString}`);
  }

  const count = parseInt(match[1], 10);
  const sides = parseInt(match[2], 10);
  const modifier = match[3] ? parseInt(match[3], 10) : 0;
  const rolls: number[] = [];

  for (let i = 0; i < count; i++) {
    rolls.push(rng.range(1, sides));
  }

  return {
    total: rolls.reduce((sum, roll) => sum + roll, 0) + modifier,
    rolls,
  };
}

/**
 * Calculate ability modifier from score
 */
export function calculateModifier(score: number): number {
  return Math.floor((score - 10) / 2);
}

/**
 * Resolve an attack
 */
export function resolveAttack(
  attacker: CombatEntity,
  target: CombatEntity,
  weapon: Weapon,
  rng: SeededRNG
): AttackResult {
  // Roll d20
  const attackRoll = rollD20(rng);
  const isCritical = attackRoll === 20;

  // Determine which stat to use for attack
  let attackStat: number;
  if (weapon.type === 'melee-strength') {
    attackStat = attacker.strength || 10;
  } else if (weapon.type === 'melee-dexterity' || weapon.type === 'ranged') {
    attackStat = attacker.dexterity;
  } else {
    // Magic attacks auto-hit (handled separately)
    attackStat = 10;
  }

  const attackModifier = calculateModifier(attackStat);
  const proficiencyBonus = attacker.proficiencyBonus || 0; // All heroes proficient with weapons
  const weaponModifier = weapon.attackModifier || 0;
  const attackTotal = attackRoll + attackModifier + proficiencyBonus + weaponModifier;

  // Check if hit (attack total > target AC, or critical hit)
  const hit = isCritical || attackTotal > target.ac;

  let damage: number | undefined;
  let damageRoll: number[] | undefined;

  if (hit) {
    // Roll damage
    const damageResult = rollDice(weapon.damageDice, rng);
    damageRoll = damageResult.rolls;
    
    // Add modifiers
    const damageMod = weapon.damageModifier || 0;
    let statMod = 0;
    
    // Add stat modifier to damage for melee/ranged
    if (weapon.type === 'melee-strength') {
      statMod = calculateModifier(attacker.strength || 10);
    } else if (weapon.type === 'melee-dexterity' || weapon.type === 'ranged') {
      statMod = calculateModifier(attacker.dexterity);
    }
    
    damage = damageResult.total + statMod + damageMod;
    
    // Critical hits: roll damage dice again and add
    if (isCritical) {
      const critResult = rollDice(weapon.damageDice, rng);
      damage += critResult.total;
      damageRoll = [...damageRoll, ...critResult.rolls];
    }
  }

  return {
    attackerId: attacker.id,
    targetId: target.id,
    hit,
    attackRoll,
    attackTotal,
    targetAC: target.ac,
    damage,
    damageRoll,
    criticalHit: isCritical,
    targetHpBefore: target.currentHp, // Target HP before damage (for display)
    targetHpAfter: hit && damage !== undefined ? Math.max(0, target.currentHp - damage) : target.currentHp, // Target HP after damage
    targetMaxHp: target.maxHp, // Target max HP (for display)
    attackModifier, // Stat modifier (for display)
    proficiencyBonus, // Proficiency bonus (for display)
    weaponModifier, // Weapon modifier (for display)
  };
}

/**
 * Apply damage to an entity
 */
export function applyDamage(entity: CombatEntity, damage: number): CombatEntity {
  const newHp = Math.max(0, entity.currentHp - damage);
  return {
    ...entity,
    currentHp: newHp,
  };
}

/**
 * Apply healing to an entity
 */
export function applyHealing(entity: CombatEntity, healing: number): CombatEntity {
  const newHp = Math.min(entity.maxHp, entity.currentHp + healing);
  return {
    ...entity,
    currentHp: newHp,
  };
}
