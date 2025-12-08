/**
 * Theme Definitions
 * 
 * Defines the available dungeon themes and their properties.
 */

import type { DungeonTheme } from '../types/dungeon-generation';

/**
 * All available dungeon themes
 */
export const DUNGEON_THEMES: DungeonTheme[] = [
  {
    id: 'undead',
    name: 'Undead Crypt',
    description: 'A dark crypt filled with the restless dead, where necromantic energy flows through every stone.',
    monsterTypes: [
      'Skeleton',
      'Zombie',
      'Wraith',
      'Ghost',
      'Lich',
      'Banshee',
      'Death Knight',
      'Mummy',
    ],
    roomTypes: ['combat', 'safe', 'trap', 'treasure'],
    atmosphere: 'The air is cold and heavy with the stench of decay. Ancient tombs line the walls, and the sound of rattling bones echoes in the distance.',
    bossInfluences: ['Necromancer', 'Lich', 'Vampire Lord', 'Death Knight'],
    metadata: {
      color: '#2d1b3d',
      music: 'dark_ambient',
    },
  },
  {
    id: 'fire',
    name: 'Volcanic Depths',
    description: 'A scorching dungeon deep within volcanic rock, where lava flows and fire elementals reign. Volcanic extrusions have penetrated and expanded this dungeon from it\'s original purpose.',
    monsterTypes: [
      'Fire Elemental',
      'Lava Golem',
      'Salamander',
      'Fire Imp',
      'Magma Beast',
      'Phoenix',
      'Hellhound',
    ],
    roomTypes: ['combat', 'safe', 'trap', 'treasure'],
    atmosphere: 'Intense heat radiates from the walls. Lava pools bubble and steam rises from cracks in the floor. The very air seems to shimmer with heat.',
    bossInfluences: ['Ancient Dragon', 'Fire Lord', 'Demon Lord', 'Phoenix'],
    metadata: {
      color: '#8b0000',
      music: 'intense_combat',
    },
  },
  {
    id: 'ice',
    name: 'Frozen Caverns',
    description: 'An icy dungeon where frost and cold magic have frozen everything in time.',
    monsterTypes: [
      'Ice Elemental',
      'Frost Giant',
      'Ice Golem',
      'Frozen Wraith',
      'Yeti',
      'Ice Wyrm',
      'Frost Troll',
    ],
    roomTypes: ['combat', 'safe', 'trap', 'treasure'],
    atmosphere: 'Bitter cold permeates the air. Icicles hang from the ceiling like daggers, and the walls are coated in a thick layer of ice. Your breath freezes instantly.',
    bossInfluences: ['Ice Dragon', 'Frost Lord', 'Ancient Dragon', 'Ice Archmage'],
    metadata: {
      color: '#4a90e2',
      music: 'cold_ambient',
    },
  },
  {
    id: 'nature',
    name: 'Overgrown Ruins',
    description: 'A dungeon reclaimed by nature, where plants and beasts have taken over ancient structures. Illumination magic has threaded through this dungeon providing a source of light for subterranean growth.',
    monsterTypes: [
      'Ent',
      'Treant',
      'Giant Spider',
      'Venomous Plant',
      'Beast',
      'Druid',
      'Wild Boar',
      'Dire Wolf',
    ],
    roomTypes: ['combat', 'safe', 'trap', 'treasure'],
    atmosphere: 'Vines and roots have broken through the stone. The air is thick with the smell of earth and decay. Strange sounds of wildlife echo from the darkness.',
    bossInfluences: ['Druid Lord', 'Ancient Ent', 'Spider Queen', 'Nature Guardian'],
    metadata: {
      color: '#2d5016',
      music: 'nature_ambient',
    },
  },
  {
    id: 'shadow',
    name: 'Shadow Realm',
    description: 'A dungeon where darkness and shadow magic have corrupted reality itself.',
    monsterTypes: [
      'Shadow',
      'Dark Stalker',
      'Void Creature',
      'Shadow Demon',
      'Dark Mage',
      'Nightmare',
      'Phantom',
    ],
    roomTypes: ['combat', 'safe', 'trap', 'treasure'],
    atmosphere: 'Darkness clings to everything like a physical presence. Shadows move on their own, and the boundaries between reality and nightmare blur.',
    bossInfluences: ['Dark Archmage', 'Shadow Lord', 'Demon Lord', 'Void Master'],
    metadata: {
      color: '#1a1a1a',
      music: 'dark_ambient',
    },
  },
  {
    id: 'mechanical',
    name: 'Ancient Workshop',
    description: 'A dungeon filled with ancient machinery, constructs, and mechanical traps.',
    monsterTypes: [
      'Golem',
      'Construct',
      'Mechanical Spider',
      'Automaton',
      'Clockwork Beast',
      'War Machine',
      'Steel Guardian',
    ],
    roomTypes: ['combat', 'safe', 'trap', 'treasure'],
    atmosphere: 'The sound of grinding gears and whirring machinery fills the air. Ancient contraptions line the walls, some still active after centuries.',
    bossInfluences: ['Architect', 'Master Artificer', 'Golem Lord', 'Mechanical Master'],
    metadata: {
      color: '#4a4a4a',
      music: 'mechanical_ambient',
    },
  },
  {
    id: 'abyssal',
    name: 'Abyssal Depths',
    description: 'A dungeon corrupted by demonic energy, where the boundaries to other planes are thin.',
    monsterTypes: [
      'Demon',
      'Imp',
      'Hellhound',
      'Succubus',
      'Balrog',
      'Fiend',
      'Chaos Spawn',
    ],
    roomTypes: ['combat', 'safe', 'trap', 'treasure'],
    atmosphere: 'The air reeks of sulfur and brimstone. Strange symbols glow on the walls, and the very fabric of reality seems unstable here.',
    bossInfluences: ['Demon Lord', 'Balrog', 'Archfiend', 'Chaos Lord'],
    metadata: {
      color: '#8b0000',
      music: 'hellish_ambient',
    },
  },
  {
    id: 'crystal',
    name: 'Crystal Caverns',
    description: 'A dungeon filled with magical crystals that pulse with arcane energy.',
    monsterTypes: [
      'Crystal Golem',
      'Arcane Construct',
      'Crystal Spider',
      'Mana Elemental',
      'Crystal Beast',
      'Arcane Guardian',
    ],
    roomTypes: ['combat', 'safe', 'trap', 'treasure'],
    atmosphere: 'Brilliant crystals of every color line the walls, pulsing with magical energy. The air shimmers with arcane power.',
    bossInfluences: ['Crystal Archmage', 'Arcane Master', 'Mana Lord', 'Crystal Guardian'],
    metadata: {
      color: '#9370db',
      music: 'magical_ambient',
    },
  },
  {
    id: 'bandit',
    name: 'Bandit Refuge',
    description: 'Currently a headquarters for human bandits that has evolved into a lawless organization over the years.',
    monsterTypes: [
      'Bandit',
      'Bandit Veteran',
      'Bandit Leader',
      'Thug',
      'Mercenary',
      'Outlaw',
      'Raider',
      'Cutthroat',
    ],
    roomTypes: ['combat', 'safe', 'trap', 'treasure'],
    atmosphere: 'Crude barricades and stolen goods clutter the halls. The air smells of unwashed bodies and stale ale. Voices echo from nearby rooms, planning their next raid.',
    bossInfluences: ['Bandit King', 'Villain', 'Criminal Mastermind', 'Outlaw Leader'],
    metadata: {
      color: '#8b4513',
      music: 'tense_ambient',
    },
  },
  {
    id: 'goblin',
    name: 'Goblin Nest',
    description: 'An impossibly intricate tunnel system for goblins and their ilk to sneak, conspire, and cause mayhem.',
    monsterTypes: [
      'Goblin',
      'Goblin Warrior',
      'Goblin Shaman',
      'Hobgoblin',
      'Bugbear',
      'Cave Rat',
      'Giant Bat',
      'Dire Weasel',
    ],
    roomTypes: ['combat', 'safe', 'trap', 'treasure'],
    atmosphere: 'Narrow, winding tunnels branch in every direction. The walls are covered in crude markings and the floor is littered with bones and refuse. High-pitched cackling echoes from the darkness.',
    bossInfluences: ['Goblin King', 'Goblin Warlord', 'Hobgoblin Chief', 'Goblin Shaman Lord'],
    metadata: {
      color: '#556b2f',
      music: 'chaotic_ambient',
    },
  },
  {
    id: 'necromancer-tower',
    name: 'Necromancer\'s Tower',
    description: 'A place of study and experimentation for a necromancer, it\'s construction is magical in nature and radiates a feeling of corruption and dread in great distances around it.',
    monsterTypes: [
      'Skeleton',
      'Zombie',
      'Animated Golem',
      'Mimic',
      'Black Dragon',
      'Cultist',
      'Dark Acolyte',
      'Wight',
    ],
    roomTypes: ['combat', 'safe', 'trap', 'treasure'],
    atmosphere: 'Dark magic permeates every stone. Runic circles glow with necromantic energy on the floors. The stench of death and arcane corruption fills the air. Shadows seem to move with purpose.',
    bossInfluences: ['Necromancer', 'Lich', 'Dark Archmage', 'Death Lord'],
    metadata: {
      color: '#1a0033',
      music: 'dark_ambient',
    },
  },
];

/**
 * Get a theme by ID
 */
export function getThemeById(themeId: string): DungeonTheme | undefined {
  return DUNGEON_THEMES.find((theme) => theme.id === themeId);
}

/**
 * Get themes influenced by a boss type
 */
export function getThemesByBossInfluence(bossType: string): DungeonTheme[] {
  return DUNGEON_THEMES.filter((theme) =>
    theme.bossInfluences.some((influence) =>
      influence.toLowerCase().includes(bossType.toLowerCase()) ||
      bossType.toLowerCase().includes(influence.toLowerCase())
    )
  );
}

/**
 * Get all available theme IDs
 */
export function getAllThemeIds(): string[] {
  return DUNGEON_THEMES.map((theme) => theme.id);
}