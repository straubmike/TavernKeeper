/**
 * Monster Registry
 * 
 * This file contains all monster stat blocks organized by theme.
 * Simplified stat blocks with only essential stats.
 */

import type { MonsterStatBlock, MonsterRegistryEntry, ChallengeRating } from '../types/monster-stats';
import { calculateXPFromCR } from '../types/monster-stats';

/**
 * Helper to create a simplified stat block
 */
function createStatBlock(
  name: string,
  cr: ChallengeRating,
  hp: number,
  ac: number,
  strength: number,
  dexterity: number,
  wisdom: number
): MonsterStatBlock {
  return {
    name,
    hp,
    ac,
    cr,
    xp: calculateXPFromCR(cr),
    strength,
    dexterity,
    wisdom,
  };
}

/**
 * UNDEAD THEME MONSTERS
 */
const undeadMonsters: MonsterRegistryEntry[] = [
  {
    name: 'Skeleton',
    theme: 'undead',
    isBoss: false,
    statBlock: createStatBlock('Skeleton', 0.25, 13, 13, 10, 16, 8),
  },
  {
    name: 'Zombie',
    theme: 'undead',
    isBoss: false,
    statBlock: createStatBlock('Zombie', 0.25, 22, 8, 13, 6, 6),
  },
  {
    name: 'Wraith',
    theme: 'undead',
    isBoss: false,
    statBlock: createStatBlock('Wraith', 5, 67, 13, 6, 16, 14),
  },
  {
    name: 'Ghost',
    theme: 'undead',
    isBoss: false,
    statBlock: createStatBlock('Ghost', 4, 45, 11, 7, 13, 12),
  },
  {
    name: 'Lich',
    theme: 'undead',
    isBoss: true,
    statBlock: createStatBlock('Lich', 21, 315, 20, 11, 16, 14),
  },
  {
    name: 'Banshee',
    theme: 'undead',
    isBoss: false,
    statBlock: createStatBlock('Banshee', 4, 58, 12, 1, 14, 11),
  },
  {
    name: 'Death Knight',
    theme: 'undead',
    isBoss: true,
    statBlock: createStatBlock('Death Knight', 17, 180, 20, 20, 11, 16),
  },
  {
    name: 'Mummy',
    theme: 'undead',
    isBoss: false,
    statBlock: createStatBlock('Mummy', 3, 58, 11, 16, 8, 12),
  },
];

/**
 * FIRE THEME MONSTERS
 */
const fireMonsters: MonsterRegistryEntry[] = [
  {
    name: 'Fire Elemental',
    theme: 'fire',
    isBoss: false,
    statBlock: createStatBlock('Fire Elemental', 5, 102, 13, 10, 17, 10),
  },
  {
    name: 'Lava Golem',
    theme: 'fire',
    isBoss: false,
    statBlock: createStatBlock('Lava Golem', 10, 157, 17, 20, 8, 11),
  },
  {
    name: 'Salamander',
    theme: 'fire',
    isBoss: false,
    statBlock: createStatBlock('Salamander', 5, 90, 15, 18, 15, 10),
  },
  {
    name: 'Fire Imp',
    theme: 'fire',
    isBoss: false,
    statBlock: createStatBlock('Fire Imp', 0.5, 7, 13, 6, 17, 12),
  },
  {
    name: 'Magma Beast',
    theme: 'fire',
    isBoss: false,
    statBlock: createStatBlock('Magma Beast', 6, 126, 15, 19, 12, 10),
  },
  {
    name: 'Phoenix',
    theme: 'fire',
    isBoss: true,
    statBlock: createStatBlock('Phoenix', 16, 175, 18, 22, 12, 19),
  },
  {
    name: 'Hellhound',
    theme: 'fire',
    isBoss: false,
    statBlock: createStatBlock('Hellhound', 3, 45, 15, 17, 12, 13),
  },
];

/**
 * ICE THEME MONSTERS
 */
const iceMonsters: MonsterRegistryEntry[] = [
  {
    name: 'Ice Elemental',
    theme: 'ice',
    isBoss: false,
    statBlock: createStatBlock('Ice Elemental', 5, 114, 14, 14, 14, 10),
  },
  {
    name: 'Frost Giant',
    theme: 'ice',
    isBoss: false,
    statBlock: createStatBlock('Frost Giant', 8, 138, 15, 23, 9, 10),
  },
  {
    name: 'Ice Golem',
    theme: 'ice',
    isBoss: false,
    statBlock: createStatBlock('Ice Golem', 5, 133, 15, 18, 9, 8),
  },
  {
    name: 'Frozen Wraith',
    theme: 'ice',
    isBoss: false,
    statBlock: createStatBlock('Frozen Wraith', 5, 67, 13, 6, 16, 14),
  },
  {
    name: 'Yeti',
    theme: 'ice',
    isBoss: false,
    statBlock: createStatBlock('Yeti', 3, 51, 12, 18, 13, 12),
  },
  {
    name: 'Ice Wyrm',
    theme: 'ice',
    isBoss: true,
    statBlock: createStatBlock('Ice Wyrm', 20, 200, 20, 26, 10, 13),
  },
  {
    name: 'Frost Troll',
    theme: 'ice',
    isBoss: false,
    statBlock: createStatBlock('Frost Troll', 5, 84, 15, 18, 13, 9),
  },
];

/**
 * NATURE THEME MONSTERS
 */
const natureMonsters: MonsterRegistryEntry[] = [
  {
    name: 'Ent',
    theme: 'nature',
    isBoss: false,
    statBlock: createStatBlock('Ent', 2, 136, 16, 23, 8, 16),
  },
  {
    name: 'Treant',
    theme: 'nature',
    isBoss: false,
    statBlock: createStatBlock('Treant', 9, 138, 16, 23, 8, 16),
  },
  {
    name: 'Giant Spider',
    theme: 'nature',
    isBoss: false,
    statBlock: createStatBlock('Giant Spider', 1, 26, 14, 14, 16, 11),
  },
  {
    name: 'Venomous Plant',
    theme: 'nature',
    isBoss: false,
    statBlock: createStatBlock('Venomous Plant', 2, 51, 13, 15, 8, 10),
  },
  {
    name: 'Beast',
    theme: 'nature',
    isBoss: false,
    statBlock: createStatBlock('Beast', 1, 19, 12, 13, 12, 10),
  },
  {
    name: 'Druid',
    theme: 'nature',
    isBoss: false,
    statBlock: createStatBlock('Druid', 2, 27, 11, 10, 12, 15),
  },
  {
    name: 'Wild Boar',
    theme: 'nature',
    isBoss: false,
    statBlock: createStatBlock('Wild Boar', 0.25, 11, 11, 13, 11, 9),
  },
  {
    name: 'Dire Wolf',
    theme: 'nature',
    isBoss: false,
    statBlock: createStatBlock('Dire Wolf', 1, 37, 14, 17, 15, 12),
  },
];

/**
 * SHADOW THEME MONSTERS
 */
const shadowMonsters: MonsterRegistryEntry[] = [
  {
    name: 'Shadow',
    theme: 'shadow',
    isBoss: false,
    statBlock: createStatBlock('Shadow', 0.5, 16, 12, 6, 14, 10),
  },
  {
    name: 'Dark Stalker',
    theme: 'shadow',
    isBoss: false,
    statBlock: createStatBlock('Dark Stalker', 2, 27, 14, 11, 16, 10),
  },
  {
    name: 'Void Creature',
    theme: 'shadow',
    isBoss: false,
    statBlock: createStatBlock('Void Creature', 4, 45, 14, 12, 15, 11),
  },
  {
    name: 'Shadow Demon',
    theme: 'shadow',
    isBoss: false,
    statBlock: createStatBlock('Shadow Demon', 4, 66, 13, 1, 19, 13),
  },
  {
    name: 'Dark Mage',
    theme: 'shadow',
    isBoss: false,
    statBlock: createStatBlock('Dark Mage', 3, 40, 12, 9, 14, 12),
  },
  {
    name: 'Nightmare',
    theme: 'shadow',
    isBoss: false,
    statBlock: createStatBlock('Nightmare', 3, 68, 13, 18, 15, 13),
  },
  {
    name: 'Phantom',
    theme: 'shadow',
    isBoss: false,
    statBlock: createStatBlock('Phantom', 1, 22, 11, 6, 13, 12),
  },
];

/**
 * MECHANICAL THEME MONSTERS
 */
const mechanicalMonsters: MonsterRegistryEntry[] = [
  {
    name: 'Golem',
    theme: 'mechanical',
    isBoss: false,
    statBlock: createStatBlock('Golem', 5, 93, 15, 19, 9, 8),
  },
  {
    name: 'Construct',
    theme: 'mechanical',
    isBoss: false,
    statBlock: createStatBlock('Construct', 1, 30, 13, 15, 10, 8),
  },
  {
    name: 'Mechanical Spider',
    theme: 'mechanical',
    isBoss: false,
    statBlock: createStatBlock('Mechanical Spider', 1, 26, 15, 14, 16, 10),
  },
  {
    name: 'Automaton',
    theme: 'mechanical',
    isBoss: false,
    statBlock: createStatBlock('Automaton', 2, 39, 15, 16, 12, 10),
  },
  {
    name: 'Clockwork Beast',
    theme: 'mechanical',
    isBoss: false,
    statBlock: createStatBlock('Clockwork Beast', 3, 60, 16, 18, 13, 10),
  },
  {
    name: 'War Machine',
    theme: 'mechanical',
    isBoss: true,
    statBlock: createStatBlock('War Machine', 10, 157, 18, 22, 9, 11),
  },
  {
    name: 'Steel Guardian',
    theme: 'mechanical',
    isBoss: false,
    statBlock: createStatBlock('Steel Guardian', 5, 93, 16, 19, 9, 8),
  },
];

/**
 * ABYSSAL THEME MONSTERS
 */
const abyssalMonsters: MonsterRegistryEntry[] = [
  {
    name: 'Demon',
    theme: 'abyssal',
    isBoss: false,
    statBlock: createStatBlock('Demon', 4, 45, 15, 13, 16, 11),
  },
  {
    name: 'Imp',
    theme: 'abyssal',
    isBoss: false,
    statBlock: createStatBlock('Imp', 1, 10, 13, 6, 17, 12),
  },
  {
    name: 'Hellhound',
    theme: 'abyssal',
    isBoss: false,
    statBlock: createStatBlock('Hellhound', 3, 45, 15, 17, 12, 13),
  },
  {
    name: 'Succubus',
    theme: 'abyssal',
    isBoss: false,
    statBlock: createStatBlock('Succubus', 4, 66, 15, 8, 17, 12),
  },
  {
    name: 'Balrog',
    theme: 'abyssal',
    isBoss: true,
    statBlock: createStatBlock('Balrog', 19, 262, 18, 22, 15, 16),
  },
  {
    name: 'Fiend',
    theme: 'abyssal',
    isBoss: false,
    statBlock: createStatBlock('Fiend', 5, 65, 15, 15, 14, 13),
  },
  {
    name: 'Chaos Spawn',
    theme: 'abyssal',
    isBoss: false,
    statBlock: createStatBlock('Chaos Spawn', 2, 33, 13, 13, 14, 8),
  },
];

/**
 * CRYSTAL THEME MONSTERS
 */
const crystalMonsters: MonsterRegistryEntry[] = [
  {
    name: 'Crystal Golem',
    theme: 'crystal',
    isBoss: false,
    statBlock: createStatBlock('Crystal Golem', 10, 157, 17, 20, 9, 11),
  },
  {
    name: 'Arcane Construct',
    theme: 'crystal',
    isBoss: false,
    statBlock: createStatBlock('Arcane Construct', 5, 60, 15, 15, 12, 10),
  },
  {
    name: 'Crystal Spider',
    theme: 'crystal',
    isBoss: false,
    statBlock: createStatBlock('Crystal Spider', 2, 39, 15, 14, 16, 10),
  },
  {
    name: 'Mana Elemental',
    theme: 'crystal',
    isBoss: false,
    statBlock: createStatBlock('Mana Elemental', 5, 102, 13, 10, 17, 10),
  },
  {
    name: 'Crystal Beast',
    theme: 'crystal',
    isBoss: false,
    statBlock: createStatBlock('Crystal Beast', 3, 60, 16, 18, 13, 10),
  },
  {
    name: 'Arcane Guardian',
    theme: 'crystal',
    isBoss: true,
    statBlock: createStatBlock('Arcane Guardian', 12, 178, 18, 22, 9, 11),
  },
];

/**
 * BANDIT THEME MONSTERS
 */
const banditMonsters: MonsterRegistryEntry[] = [
  {
    name: 'Bandit',
    theme: 'bandit',
    isBoss: false,
    statBlock: createStatBlock('Bandit', 0.125, 11, 12, 11, 12, 10),
  },
  {
    name: 'Bandit Veteran',
    theme: 'bandit',
    isBoss: false,
    statBlock: createStatBlock('Bandit Veteran', 3, 58, 15, 16, 16, 10),
  },
  {
    name: 'Bandit Leader',
    theme: 'bandit',
    isBoss: true,
    statBlock: createStatBlock('Bandit Leader', 2, 65, 15, 15, 16, 11),
  },
  {
    name: 'Thug',
    theme: 'bandit',
    isBoss: false,
    statBlock: createStatBlock('Thug', 0.5, 32, 11, 15, 11, 10),
  },
  {
    name: 'Mercenary',
    theme: 'bandit',
    isBoss: false,
    statBlock: createStatBlock('Mercenary', 3, 58, 16, 16, 14, 10),
  },
  {
    name: 'Outlaw',
    theme: 'bandit',
    isBoss: false,
    statBlock: createStatBlock('Outlaw', 1, 27, 14, 13, 16, 10),
  },
  {
    name: 'Raider',
    theme: 'bandit',
    isBoss: false,
    statBlock: createStatBlock('Raider', 2, 39, 14, 15, 14, 10),
  },
  {
    name: 'Cutthroat',
    theme: 'bandit',
    isBoss: false,
    statBlock: createStatBlock('Cutthroat', 1, 22, 14, 11, 16, 10),
  },
];

/**
 * GOBLIN THEME MONSTERS
 */
const goblinMonsters: MonsterRegistryEntry[] = [
  {
    name: 'Goblin',
    theme: 'goblin',
    isBoss: false,
    statBlock: createStatBlock('Goblin', 0.25, 7, 15, 8, 14, 8),
  },
  {
    name: 'Goblin Warrior',
    theme: 'goblin',
    isBoss: false,
    statBlock: createStatBlock('Goblin Warrior', 0.5, 15, 15, 10, 14, 8),
  },
  {
    name: 'Goblin Shaman',
    theme: 'goblin',
    isBoss: false,
    statBlock: createStatBlock('Goblin Shaman', 1, 18, 13, 8, 14, 13),
  },
  {
    name: 'Hobgoblin',
    theme: 'goblin',
    isBoss: false,
    statBlock: createStatBlock('Hobgoblin', 0.5, 11, 18, 13, 12, 10),
  },
  {
    name: 'Bugbear',
    theme: 'goblin',
    isBoss: false,
    statBlock: createStatBlock('Bugbear', 1, 27, 16, 15, 14, 11),
  },
  {
    name: 'Cave Rat',
    theme: 'goblin',
    isBoss: false,
    statBlock: createStatBlock('Cave Rat', 0, 1, 10, 2, 11, 10),
  },
  {
    name: 'Giant Bat',
    theme: 'goblin',
    isBoss: false,
    statBlock: createStatBlock('Giant Bat', 0.25, 22, 13, 15, 16, 12),
  },
  {
    name: 'Dire Weasel',
    theme: 'goblin',
    isBoss: false,
    statBlock: createStatBlock('Dire Weasel', 0.125, 7, 14, 11, 16, 12),
  },
];

/**
 * NECROMANCER TOWER THEME MONSTERS
 */
const necromancerTowerMonsters: MonsterRegistryEntry[] = [
  {
    name: 'Skeleton',
    theme: 'necromancer-tower',
    isBoss: false,
    statBlock: createStatBlock('Skeleton', 0.25, 13, 13, 10, 14, 8),
  },
  {
    name: 'Zombie',
    theme: 'necromancer-tower',
    isBoss: false,
    statBlock: createStatBlock('Zombie', 0.25, 22, 8, 13, 6, 6),
  },
  {
    name: 'Animated Golem',
    theme: 'necromancer-tower',
    isBoss: false,
    statBlock: createStatBlock('Animated Golem', 5, 93, 15, 19, 9, 8),
  },
  {
    name: 'Mimic',
    theme: 'necromancer-tower',
    isBoss: false,
    statBlock: createStatBlock('Mimic', 2, 58, 12, 17, 12, 13),
  },
  {
    name: 'Black Dragon',
    theme: 'necromancer-tower',
    isBoss: true,
    statBlock: createStatBlock('Black Dragon', 7, 127, 19, 19, 14, 11),
  },
  {
    name: 'Cultist',
    theme: 'necromancer-tower',
    isBoss: false,
    statBlock: createStatBlock('Cultist', 0.125, 9, 12, 11, 12, 11),
  },
  {
    name: 'Dark Acolyte',
    theme: 'necromancer-tower',
    isBoss: false,
    statBlock: createStatBlock('Dark Acolyte', 2, 27, 13, 10, 14, 11),
  },
  {
    name: 'Wight',
    theme: 'necromancer-tower',
    isBoss: false,
    statBlock: createStatBlock('Wight', 3, 45, 14, 15, 14, 13),
  },
];

/**
 * GENERIC MONSTERS (from basic MonsterFactory)
 */
const genericMonsters: MonsterRegistryEntry[] = [
  {
    name: 'Goblin',
    theme: 'generic',
    isBoss: false,
    statBlock: createStatBlock('Goblin', 0.25, 7, 15, 8, 14, 8),
  },
  {
    name: 'Skeleton',
    theme: 'generic',
    isBoss: false,
    statBlock: createStatBlock('Skeleton', 0.25, 13, 13, 10, 14, 8),
  },
  {
    name: 'Orc',
    theme: 'generic',
    isBoss: false,
    statBlock: createStatBlock('Orc', 0.5, 15, 13, 16, 12, 11),
  },
  {
    name: 'Spider',
    theme: 'generic',
    isBoss: false,
    statBlock: createStatBlock('Spider', 0, 1, 12, 2, 14, 10),
  },
  {
    name: 'Bandit',
    theme: 'generic',
    isBoss: false,
    statBlock: createStatBlock('Bandit', 0.125, 11, 12, 11, 12, 10),
  },
  {
    name: 'Dragon',
    theme: 'generic',
    isBoss: true,
    statBlock: createStatBlock('Dragon', 10, 200, 18, 23, 10, 13),
  },
  {
    name: 'Lich',
    theme: 'generic',
    isBoss: true,
    statBlock: createStatBlock('Lich', 21, 135, 17, 11, 16, 14),
  },
  {
    name: 'Giant',
    theme: 'generic',
    isBoss: true,
    statBlock: createStatBlock('Giant', 9, 162, 15, 25, 9, 10),
  },
  {
    name: 'Demon',
    theme: 'generic',
    isBoss: true,
    statBlock: createStatBlock('Demon', 4, 45, 15, 13, 16, 11),
  },
];

/**
 * All monsters combined
 */
export const ALL_MONSTERS: MonsterRegistryEntry[] = [
  ...undeadMonsters,
  ...fireMonsters,
  ...iceMonsters,
  ...natureMonsters,
  ...shadowMonsters,
  ...mechanicalMonsters,
  ...abyssalMonsters,
  ...crystalMonsters,
  ...banditMonsters,
  ...goblinMonsters,
  ...necromancerTowerMonsters,
  ...genericMonsters,
];

/**
 * Get monster by name
 */
export function getMonsterByName(name: string): MonsterRegistryEntry | undefined {
  return ALL_MONSTERS.find(m => m.name.toLowerCase() === name.toLowerCase());
}

/**
 * Get monsters by theme
 */
export function getMonstersByTheme(theme: MonsterRegistryEntry['theme']): MonsterRegistryEntry[] {
  return ALL_MONSTERS.filter(m => m.theme === theme);
}

/**
 * Get boss monsters
 */
export function getBossMonsters(): MonsterRegistryEntry[] {
  return ALL_MONSTERS.filter(m => m.isBoss);
}

/**
 * Get regular monsters (non-boss)
 */
export function getRegularMonsters(): MonsterRegistryEntry[] {
  return ALL_MONSTERS.filter(m => !m.isBoss);
}
