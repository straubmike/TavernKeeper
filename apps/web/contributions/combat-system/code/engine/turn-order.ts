/**
 * Turn Order System
 * 
 * Handles initiative and turn order determination based on DEX.
 */

import type { CombatEntity } from '../types/combat';
import { SeededRNG } from '../../../../lib/utils/seededRNG';

/**
 * Sort entities by dexterity for turn order (highest DEX goes first)
 * If DEX is tied, use seeded RNG to break ties deterministically
 */
export function determineTurnOrder(entities: CombatEntity[], rng: SeededRNG): string[] {
  // Create array with entity ID and DEX for sorting
  const entityDex = entities.map(entity => ({
    id: entity.id,
    dexterity: entity.dexterity,
    random: rng.random(), // For tie-breaking (deterministic)
  }));

  // Sort by DEX (descending), then by random for ties
  entityDex.sort((a, b) => {
    if (b.dexterity !== a.dexterity) {
      return b.dexterity - a.dexterity;
    }
    return b.random - a.random;
  });

  return entityDex.map(e => e.id);
}

/**
 * Get next entity in turn order
 */
export function getNextEntity(
  turnOrder: string[],
  currentTurn: number
): string | null {
  const nextIndex = (currentTurn + 1) % turnOrder.length;
  return turnOrder[nextIndex] || null;
}

/**
 * Get current entity in turn order
 */
export function getCurrentEntity(
  turnOrder: string[],
  currentTurn: number
): string | null {
  return turnOrder[currentTurn] || null;
}

/**
 * Filter out dead entities from turn order
 */
export function filterAliveEntities(
  turnOrder: string[],
  entities: CombatEntity[]
): string[] {
  const aliveIds = new Set(
    entities.filter(e => e.currentHp > 0).map(e => e.id)
  );
  return turnOrder.filter(id => aliveIds.has(id));
}
