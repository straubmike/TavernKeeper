/**
 * Monster Stat Block Service
 * 
 * Service for retrieving and managing monster stat blocks for combat encounters.
 */

import type {
  MonsterStatBlock,
  MonsterInstance,
  MonsterRegistryEntry,
} from '../types/monster-stats';
import {
  ALL_MONSTERS,
  getMonsterByName,
  getMonstersByTheme,
  getBossMonsters,
  getRegularMonsters,
} from '../data/monster-registry';

/**
 * Get monster stat block by name
 */
export function getMonsterStatBlock(name: string): MonsterStatBlock | null {
  const entry = getMonsterByName(name);
  return entry ? entry.statBlock : null;
}

/**
 * Get all monsters for a theme
 */
export function getMonsterStatBlocksByTheme(theme: MonsterRegistryEntry['theme']): MonsterStatBlock[] {
  return getMonstersByTheme(theme).map(entry => entry.statBlock);
}

/**
 * Create a monster instance for combat
 */
export function createMonsterInstance(
  statBlock: MonsterStatBlock,
  id?: string
): MonsterInstance {
  return {
    id: id || `monster-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`,
    statBlock,
    currentHp: statBlock.hp,
    maxHp: statBlock.hp,
  };
}

/**
 * Create monster instance from name
 */
export function createMonsterInstanceByName(name: string, id?: string): MonsterInstance | null {
  const statBlock = getMonsterStatBlock(name);
  if (!statBlock) return null;
  return createMonsterInstance(statBlock, id);
}

/**
 * Get random monster from theme
 */
export function getRandomMonsterFromTheme(
  theme: MonsterRegistryEntry['theme'],
  isBoss: boolean = false
): MonsterStatBlock | null {
  const monsters = getMonstersByTheme(theme).filter(m => m.isBoss === isBoss);
  if (monsters.length === 0) return null;
  
  const randomIndex = Math.floor(Math.random() * monsters.length);
  return monsters[randomIndex].statBlock;
}

/**
 * Get monster by challenge rating range
 */
export function getMonstersByCR(
  minCR: number,
  maxCR: number,
  theme?: MonsterRegistryEntry['theme']
): MonsterStatBlock[] {
  let monsters = theme 
    ? getMonstersByTheme(theme).map(e => e.statBlock)
    : ALL_MONSTERS.map(e => e.statBlock);
  
  return monsters.filter(m => 
    m.cr >= minCR && m.cr <= maxCR
  );
}

/**
 * Get XP reward for monster
 */
export function getMonsterXPReward(statBlock: MonsterStatBlock): number {
  return statBlock.xp;
}

/**
 * Get all available monster names
 */
export function getAllMonsterNames(): string[] {
  return ALL_MONSTERS.map(m => m.name);
}

/**
 * Get all available themes
 */
export function getAllThemes(): MonsterRegistryEntry['theme'][] {
  return Array.from(new Set(ALL_MONSTERS.map(m => m.theme)));
}