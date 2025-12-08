/**
 * Dungeon Builders and Purposes
 * 
 * Defines who built dungeons and why, with proper categorization.
 * Builders determine appropriate purposes, and age affects difficulty.
 */

/**
 * Builder category - determines the type of dungeon origin
 */
export type BuilderCategory = 'practical' | 'dungeon_like';

/**
 * A dungeon builder definition
 */
export interface DungeonBuilder {
  id: string;
  name: string;
  category: BuilderCategory;
  description: string;
  purposes: string[]; // Valid purposes for this builder
  roomDescriptionFlavor: string[]; // Flavor text for room descriptions
}

/**
 * Special builder ID for necromancer towers (created by standout mortals)
 * This is not in the main list - it's used when a necromancer standout mortal creates a tower
 */
export const NECROMANCER_BUILDER: DungeonBuilder = {
  id: 'necromancer',
  name: 'Necromancer',
  category: 'dungeon_like',
  description: 'A powerful necromancer who built a tower for study and experimentation',
  purposes: [
    'necromantic research',
    'undead laboratory',
    'soul harvesting',
    'dark ritual chamber',
    'tower of study',
  ],
  roomDescriptionFlavor: [
    'dark necromantic energy',
    'soul-bound walls',
    'death magic infused',
    'necromantic architecture',
    'cursed stonework',
    'magical construction',
    'corruption-tainted stone',
  ],
};

/**
 * All available dungeon builders
 */
export const DUNGEON_BUILDERS: DungeonBuilder[] = [
  // PRACTICAL CONSTRUCTIONS (repurposed over time)
  {
    id: 'dwarven_kingdom',
    name: 'Ancient Dwarven Kingdom',
    category: 'practical',
    description: 'A once-great dwarven civilization that carved deep into the earth',
    purposes: [
      'mining operation',
      'underground city',
      'treasure vault',
      'forge complex',
      'stone quarry',
    ],
    roomDescriptionFlavor: [
      'carved from solid rock',
      'dwarven stonework',
      'ancient mining tunnels',
      'dwarven craftsmanship',
      'stone-hewn chambers',
    ],
  },
  {
    id: 'gnomish_workshop',
    name: 'Gnomish Workshop',
    category: 'practical',
    description: 'An underground gnomish tinkering and invention facility',
    purposes: [
      'mechanical workshop',
      'invention laboratory',
      'clockwork factory',
      'alchemical research',
      'artifact storage',
    ],
    roomDescriptionFlavor: [
      'gnomish machinery',
      'intricate clockwork',
      'mechanical contraptions',
      'gnomish engineering',
      'whirring gears and pipes',
    ],
  },
  {
    id: 'elven_sanctuary',
    name: 'Elven Underground Sanctuary',
    category: 'practical',
    description: 'An elven refuge built beneath ancient forests',
    purposes: [
      'nature temple',
      'crystal grove',
      'ancient library',
      'healing sanctuary',
      'star observatory',
    ],
    roomDescriptionFlavor: [
      'elven architecture',
      'living roots and vines',
      'natural stone formations',
      'elven craftsmanship',
      'magical crystal formations',
    ],
  },
  {
    id: 'human_kingdom',
    name: 'Forgotten Human Kingdom',
    category: 'practical',
    description: 'A lost human civilization that built extensive underground structures',
    purposes: [
      'underground city',
      'treasure vault',
      'wine cellar',
      'grain storage',
      'catacombs',
    ],
    roomDescriptionFlavor: [
      'ancient human masonry',
      'weathered stone',
      'forgotten architecture',
      'human construction',
      'time-worn passages',
    ],
  },
  {
    id: 'dragon_hoard',
    name: 'Ancient Dragon Lair',
    category: 'practical',
    description: 'A dragon\'s treasure hoard expanded into a vast underground complex',
    purposes: [
      'treasure hoard',
      'dragon nest',
      'treasure vault',
      'ancient lair',
      'hoard chamber',
    ],
    roomDescriptionFlavor: [
      'dragon-carved tunnels',
      'scales embedded in walls',
      'dragon fire marks',
      'ancient dragon lair',
      'treasure-filled chambers',
    ],
  },
  {
    id: 'merchant_guild',
    name: 'Merchant Guild Vault',
    category: 'practical',
    description: 'A merchant guild\'s secure underground storage and trading post',
    purposes: [
      'treasure vault',
      'trading post',
      'warehouse',
      'secure storage',
      'merchant hall',
    ],
    roomDescriptionFlavor: [
      'merchant architecture',
      'storage chambers',
      'trading halls',
      'secure vaults',
      'commercial construction',
    ],
  },

  // DUNGEON-LIKE CONSTRUCTIONS (built as dungeons from the start)
  {
    id: 'necromancer_cult',
    name: 'Dark Necromancer Cult',
    category: 'dungeon_like',
    description: 'A dark cult dedicated to necromancy and undeath',
    purposes: [
      'necromantic research',
      'undead laboratory',
      'soul harvesting',
      'dark ritual chamber',
      'crypt network',
    ],
    roomDescriptionFlavor: [
      'dark necromantic energy',
      'soul-bound walls',
      'death magic infused',
      'necromantic architecture',
      'cursed stonework',
    ],
  },
  {
    id: 'demon_cult',
    name: 'Demon Cult',
    category: 'dungeon_like',
    description: 'A cult that worships demons and practices dark rituals',
    purposes: [
      'demon summoning',
      'dark ritual chamber',
      'sacrificial altar',
      'hellish prison',
      'corruption pit',
    ],
    roomDescriptionFlavor: [
      'demonic corruption',
      'hellfire-scarred walls',
      'infernal architecture',
      'demon taint',
      'sulfur-stained stone',
    ],
  },
  {
    id: 'orc_horde',
    name: 'Orc War Fortress',
    category: 'dungeon_like',
    description: 'An orc war fortress built for conquest and raiding',
    purposes: [
      'war fortress',
      'prison for captives',
      'war camp',
      'raiding base',
      'trophy hall',
    ],
    roomDescriptionFlavor: [
      'crude orc construction',
      'rough-hewn stone',
      'war trophies',
      'orc craftsmanship',
      'battle-scarred walls',
    ],
  },
  {
    id: 'undead_kingdom',
    name: 'Undead Kingdom',
    category: 'dungeon_like',
    description: 'A kingdom of the undead, ruled by liches and vampires',
    purposes: [
      'undead city',
      'necropolis',
      'vampire court',
      'lich laboratory',
      'death temple',
    ],
    roomDescriptionFlavor: [
      'deathly cold',
      'undead architecture',
      'soul-bound construction',
      'necromantic stonework',
      'eternal darkness',
    ],
  },
  {
    id: 'dark_empire',
    name: 'Dark Empire',
    category: 'dungeon_like',
    description: 'A fallen empire that embraced darkness and tyranny',
    purposes: [
      'underground fortress',
      'prison for enemies',
      'dark temple',
      'torture chamber',
      'tyrant\'s vault',
    ],
    roomDescriptionFlavor: [
      'oppressive architecture',
      'dark imperial design',
      'tyrannical construction',
      'fear-inducing halls',
      'empire stonework',
    ],
  },
  {
    id: 'beast_lair',
    name: 'Ancient Beast Lair',
    category: 'dungeon_like',
    description: 'A natural cave system expanded by monstrous creatures',
    purposes: [
      'beast den',
      'monster nest',
      'hunting ground',
      'creature lair',
      'predator\'s domain',
    ],
    roomDescriptionFlavor: [
      'natural cave formations',
      'beast-carved tunnels',
      'claw marks on walls',
      'monster dens',
      'wild creature lairs',
    ],
  },
  {
    id: 'cursed_temple',
    name: 'Cursed Temple',
    category: 'dungeon_like',
    description: 'A temple dedicated to dark gods or cursed practices',
    purposes: [
      'dark temple',
      'cursed sanctuary',
      'sacrificial chamber',
      'blasphemous altar',
      'corrupted shrine',
    ],
    roomDescriptionFlavor: [
      'cursed architecture',
      'dark temple design',
      'blasphemous stonework',
      'corrupted halls',
      'temple of darkness',
    ],
  },
  {
    id: 'wizard_prison',
    name: 'Wizard\'s Prison',
    category: 'dungeon_like',
    description: 'A magical prison built to contain dangerous creatures and artifacts',
    purposes: [
      'magical prison',
      'containment facility',
      'arcane vault',
      'sealed chamber',
      'warded prison',
    ],
    roomDescriptionFlavor: [
      'magical wards',
      'arcane architecture',
      'warded stonework',
      'prison design',
      'containment chambers',
    ],
  },
];

/**
 * Get a builder by ID
 */
export function getBuilderById(builderId: string): DungeonBuilder | undefined {
  return DUNGEON_BUILDERS.find((builder) => builder.id === builderId);
}

/**
 * Get all builders in a category
 */
export function getBuildersByCategory(category: BuilderCategory): DungeonBuilder[] {
  return DUNGEON_BUILDERS.filter((builder) => builder.category === category);
}

/**
 * Get a random purpose for a builder
 */
export function getPurposeForBuilder(builder: DungeonBuilder, rng: () => number): string {
  const purposes = builder.purposes;
  return purposes[Math.floor(rng() * purposes.length)];
}

/**
 * Get room description flavor for a builder
 */
export function getRoomFlavorForBuilder(builder: DungeonBuilder, rng: () => number): string {
  const flavors = builder.roomDescriptionFlavor;
  return flavors[Math.floor(rng() * flavors.length)];
}

/**
 * Age categories for difficulty scaling
 */
export type AgeCategory = 'recent' | 'ancient' | 'legendary';

/**
 * Get age category from age in years
 */
export function getAgeCategory(age: number): AgeCategory {
  if (age < 200) {
    return 'recent';
  } else if (age < 500) {
    return 'ancient';
  } else {
    return 'legendary';
  }
}

/**
 * Get difficulty multiplier based on age
 */
export function getDifficultyMultiplier(age: number): number {
  const category = getAgeCategory(age);
  switch (category) {
    case 'recent':
      return 1.0; // Base difficulty
    case 'ancient':
      return 1.3; // 30% harder
    case 'legendary':
      return 1.6; // 60% harder
  }
}