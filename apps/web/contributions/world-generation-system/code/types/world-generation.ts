/**
 * World Generation Types
 * 
 * Defines types for all levels of world generation, from primordial beings
 * down to individual mortals and their roles.
 */

// Note: These types should be imported from @innkeeper/lib after integration
// For now, we define minimal required types
export interface WorldContent {
  id: string;
  type: string;
  name: string;
  description: string;
  parentId: string | null;
  createdAt: Date;
  discoveredAt: Date;
  metadata: Record<string, unknown>;
}

/**
 * Generation level identifiers
 */
export type GenerationLevel = 1 | 2 | 2.5 | 3 | 4 | 5 | 6 | 6.5 | 7 | 7.5;

/**
 * Level 1: Primordial Beings
 * Fundamental forces of the universe
 */
export type PrimordialType = 'space' | 'time' | 'light' | 'dark' | 'order' | 'chaos';

export interface PrimordialBeing extends WorldContent {
  type: 'primordial';
  primordialType: PrimordialType;
  domain: string; // What they represent
  influence: string[]; // What they influence
}

/**
 * Level 2: Cosmic Creators
 * Elemental beings that created the world
 */
export type CosmicElement = 'rock' | 'wind' | 'water' | 'life' | 'fire' | 'earth' | 'ice' | 'magic';

export interface CosmicCreator extends WorldContent {
  type: 'cosmic_creator';
  element: CosmicElement;
  createdBy: string; // Primordial being ID
  creations: string[]; // What they created (geography, races, etc.)
}

/**
 * Level 2.5: Geography
 * Physical features of the world
 */
export type GeographyType = 
  | 'continent'
  | 'ocean'
  | 'mountain_range'
  | 'river'
  | 'underground_system'
  | 'forest'
  | 'desert'
  | 'plains'
  | 'island'
  | 'volcano'
  | 'swamp'
  | 'tundra'
  | 'canyon'
  | 'archipelago'
  | 'fjord'
  | 'steppe'
  | 'jungle'
  | 'badlands'
  | 'glacier'
  | 'marsh'
  | 'plateau'
  | 'coast'
  | 'bay'
  | 'peninsula';

export interface Geography extends WorldContent {
  type: 'geography';
  geographyType: GeographyType;
  createdBy: string; // Cosmic creator ID
  magnitude: 'vast' | 'large' | 'medium' | 'small'; // Size scale
  location?: { x: number; y: number }; // Optional coordinates
}

/**
 * Level 3: Conceptual Beings
 * Born from mortal worship and emotion
 */
export type ConceptualType = 
  | 'luck'
  | 'love'
  | 'fertility'
  | 'justice'
  | 'war'
  | 'death'
  | 'wisdom'
  | 'wealth'
  | 'art'
  | 'music'
  | 'craft'
  | 'hunting'
  | 'harvest'
  | 'blood'
  | 'party'
  | 'sacrifice'
  | 'vengeance'
  | 'mercy'
  | 'betrayal'
  | 'loyalty'
  | 'honor'
  | 'courage'
  | 'fear'
  | 'madness'
  | 'healing'
  | 'disease'
  | 'plague'
  | 'famine'
  | 'feast'
  | 'celebration'
  | 'mourning'
  | 'grief'
  | 'joy'
  | 'rage'
  | 'peace'
  | 'chaos'
  | 'order'
  | 'freedom'
  | 'tyranny'
  | 'hope'
  | 'despair'
  | 'truth'
  | 'lies'
  | 'secrets'
  | 'knowledge'
  | 'ignorance'
  | 'beauty'
  | 'ugliness'
  | 'strength'
  | 'weakness'
  | 'cunning'
  | 'stupidity'
  | 'trade'
  | 'forge'
  | 'stone'
  | 'metal'
  | 'mining'
  | 'smithing'
  | 'nature'
  | 'forest'
  | 'magic'
  | 'life'
  | 'growth'
  | 'battle'
  | 'fury'
  | 'beasts'
  | 'trickery'
  | 'stealth'
  | 'greed'
  | 'darkness'
  | 'mischief'
  | 'comfort'
  | 'home'
  | 'community'
  | 'stories'
  | 'invention'
  | 'curiosity'
  | 'tinkering'
  | 'wonder'
  | 'survival'
  | 'traps'
  | 'caves'
  | 'hoarding'
  | 'servitude'
  | 'power'
  | 'treasure'
  | 'dominance'
  | 'ancient'
  | 'sky'
  | 'wind'
  | 'travel'
  | 'heights'
  | 'sea'
  | 'water'
  | 'depths'
  | 'currents'
  | 'mysteries';

export interface ConceptualBeing extends WorldContent {
  type: 'conceptual';
  conceptualType: ConceptualType;
  worshipedBy: string[]; // Races/organizations that worship
  domain: string; // What concept they represent
}

/**
 * Level 4: Demi-Gods
 * Divine experiments and ancient beings
 */
export type DemiGodType = 
  | 'half_god'
  | 'ancient_creature'
  | 'divine_experiment'
  | 'fallen_divine'
  | 'ascended_mortal'
  | 'primordial_spawn';

// Subtypes for half_god - what their other half is
export type HalfGodRace = 
  | 'human'
  | 'orc'
  | 'goblin'
  | 'elf'
  | 'dwarf'
  | 'halfling'
  | 'dragon'
  | 'undead'
  | 'construct'
  | 'elemental'
  | 'fey'
  | 'giant'
  | 'gnome'
  | 'tiefling'
  | 'aasimar'
  | 'genasi'
  | 'kobold'
  | 'lizardfolk'
  | 'yuan_ti'
  | 'kenku';

// Subtypes for ancient_creature - mythical creatures
export type AncientCreatureType = 
  | 'hydra'
  | 'kraken'
  | 'phoenix'
  | 'colossus'
  | 'leviathan'
  | 'behemoth'
  | 'basilisk'
  | 'chimera'
  | 'griffin'
  | 'roc'
  | 'sphinx'
  | 'wyvern'
  | 'manticore'
  | 'cerberus'
  | 'pegasus'
  | 'unicorn'
  | 'dragon_turtle'
  | 'tarrasque';

// Subtypes for divine_experiment - animal feature combinations
export type AnimalFeature = 
  // Basic features
  | 'wings'
  | 'scales'
  | 'fur'
  | 'feathers'
  | 'claws'
  | 'fangs'
  | 'horns'
  | 'tentacles'
  | 'tail'
  | 'mane'
  | 'shell'
  | 'venom'
  | 'multiple_heads'
  | 'multiple_limbs'
  | 'gills'
  | 'trunk'
  | 'hooves'
  | 'paws'
  | 'beak'
  | 'antlers'
  // Bug-like features
  | 'scorpion_stinger'
  | 'web_spinner'
  | 'compound_eyes'
  | 'carapace'
  | 'antenna'
  | 'finger_like_mandibles'
  // Wing varieties
  | 'bat_wings'
  | 'bird_wings'
  | 'insect_wings'
  // Non-animal specific features
  | 'bony_protrusions'
  | 'patches_of_hair'
  | 'skin_boils'
  | 'crawling_with_maggots'
  // Attack methods
  | 'searing_hot_to_touch'
  | 'emits_noxious_fumes'
  | 'breathes_thick_smokescreen'
  | 'dims_light_around_it'
  | 'rusts_metal_with_spit';

// Subtypes for fallen_divine
export type FallenDivineType = 
  | 'fallen_angel'
  | 'risen_demon'
  | 'lost_celestial'
  | 'corrupted_seraph'
  | 'exiled_archon'
  | 'tainted_deva'
  | 'dark_angel'
  | 'infernal_being';

// Subtypes for primordial_spawn
export type PrimordialSpawnType = 
  | 'chaos_born'
  | 'order_manifest'
  | 'time_child'
  | 'space_fragment'
  | 'light_shard'
  | 'dark_essence';

export interface DemiGod extends WorldContent {
  type: 'demigod';
  demiGodType: DemiGodType;
  origin: string; // What created them (primordial, cosmic, or conceptual)
  age: number; // Age in years (often very old)
  powers: string[]; // Special abilities
  alignment?: 'good' | 'neutral' | 'evil';
  isBoss: boolean; // Is this a dungeon boss? (true for evil demi-gods)
  // Subtype information
  halfGodRace?: HalfGodRace; // For half_god type
  ancientCreatureType?: AncientCreatureType; // For ancient_creature type
  divineExperimentFeatures?: AnimalFeature[]; // For divine_experiment type
  fallenDivineType?: FallenDivineType; // For fallen_divine type
  primordialSpawnType?: PrimordialSpawnType; // For primordial_spawn type
}

/**
 * Level 5: Mortal Races
 * Variety of life
 */
export type MortalRaceType = 
  | 'human'
  | 'orc'
  | 'goblin'
  | 'elf'
  | 'dwarf'
  | 'halfling'
  | 'dragon'
  | 'undead'
  | 'construct'
  | 'elemental'
  | 'fey'
  | 'giant'
  | 'gnome'
  | 'tiefling'
  | 'aasimar'
  | 'genasi'
  | 'kobold'
  | 'lizardfolk'
  | 'yuan_ti'
  | 'kenku'
  | 'tabaxi'
  | 'triton'
  | 'goliath'
  | 'bugbear'
  | 'hobgoblin'
  | 'orc_variant'
  | 'drow'
  | 'wood_elf'
  | 'high_elf'
  | 'deep_gnome'
  | 'rock_gnome'
  | 'forest_gnome'
  | 'aarakocra'
  | 'merfolk';

export interface MortalRace extends WorldContent {
  type: 'mortal_race';
  raceType: MortalRaceType;
  createdBy: string; // Cosmic creator or demi-god ID
  homeland: string; // Geography ID where they originated
  characteristics: string[]; // Racial traits
  lifespan: { min: number; max: number }; // Age range
  population?: number; // Estimated population
}

/**
 * Level 6: Organizations
 * Named groups organized by magnitude
 */
export type OrganizationMagnitude = 
  | 'empire'      // Largest
  | 'kingdom'     // Large
  | 'horde'       // Large (for orcs, etc.)
  | 'realm'       // Large (for elves, etc.)
  | 'city'        // Medium-large
  | 'town'        // Medium
  | 'tribe'       // Medium
  | 'guild'       // Medium
  | 'band'        // Small
  | 'clan'        // Small
  | 'circle'      // Small
  | 'company'     // Small
  // Race-specific organization types
  | 'mountainhome'  // Dwarven
  | 'nest'          // Goblin/Kobold
  | 'canopy'        // Elven
  | 'warren'        // Halfling
  | 'stronghold'    // Orc
  | 'enclave'       // Gnome
  | 'colony'        // Various
  | 'sanctuary'     // Various
  | 'hold'          // Dwarven
  | 'grove'         // Elven/Druidic
  | 'den'           // Various
  | 'lair'          // Dragon/Monster
  | 'court'         // Fey
  | 'coven'         // Witches/Mages
  | 'coterie'       // Vampires
  | 'conclave'      // Religious
  | 'academy'       // Scholarly
  | 'colosseum'     // Gladiatorial
  | 'bazaar'        // Merchant
  | 'port'          // Maritime
  | 'fortress'      // Military
  | 'temple'        // Religious
  | 'library'       // Knowledge
  | 'forge'         // Dwarven
  | 'tower'         // Mages
  | 'crypt'         // Undead
  | 'hive'          // Insectoid
  | 'pack'          // Beast-like
  | 'pride'         // Feline
  | 'flock'         // Avian
  | 'school'        // Aquatic
  | 'pod'           // Aquatic
  | 'murder'        // Corvids
  | 'swarm'         // Small creatures;

export interface Organization extends WorldContent {
  type: 'organization';
  magnitude: OrganizationMagnitude;
  race: string; // Mortal race ID (primary race)
  location: string; // Geography ID
  leader?: string; // Standout mortal ID
  members: number; // Estimated membership
  purpose: string; // What the organization does
  founded?: Date; // When founded
}

/**
 * Level 6.5: Standout Mortals
 * Heroes, villains, and powerful individuals
 */
export type StandoutType = 
  // Royalty - founders of organizations, rulers
  | 'king'
  | 'queen'
  | 'prince'
  | 'princess'
  | 'emperor'
  | 'empress'
  | 'founder'
  // High ranking military
  | 'general'
  | 'commander'
  | 'war_chief'
  | 'marshal'
  | 'admiral'
  // Heroic participants in battle
  | 'knight'
  | 'champion'
  | 'hero'
  // Slayers of standout adversaries
  | 'dragon_slayer'
  | 'giant_slayer'
  | 'demon_slayer'
  | 'monster_slayer'
  // Saviors in dire circumstances
  | 'savior'
  | 'protector'
  | 'guardian'
  // Unique in their craft - magic practitioners
  | 'wizard'
  | 'archmage'
  | 'necromancer'
  | 'lich'
  | 'sorcerer'
  | 'warlock'
  | 'witch'
  | 'enchanter'
  | 'alchemist'
  // Other remarkable individuals
  | 'villain'
  | 'vampire'
  | 'high_priest'
  | 'oracle'
  | 'prophet';

export interface StandoutMortal extends WorldContent {
  type: 'standout_mortal';
  standoutType: StandoutType;
  race: string; // Mortal race ID
  organization?: string; // Organization ID (if part of one)
  location: string; // Geography ID
  powers: string[]; // Special abilities
  age: number; // Current age
  alignment?: 'good' | 'neutral' | 'evil';
  isBoss: boolean; // Is this a dungeon boss?
}

/**
 * Level 7: Family and Role
 * Individual mortals and their place in history
 */
export type RoleType = 
  | 'blacksmith'
  | 'playwright'
  | 'assassin'
  | 'merchant'
  | 'farmer'
  | 'soldier'
  | 'scholar'
  | 'priest'
  | 'noble'
  | 'commoner'
  | 'artisan'
  | 'bard'
  | 'ranger'
  | 'knight'
  | 'sailor'
  | 'fisherman'
  | 'guard'
  | 'shepherd'
  | 'carpenter'
  | 'mason'
  | 'weaver'
  | 'tailor'
  | 'cook'
  | 'baker'
  | 'brewer'
  | 'innkeeper'
  | 'stablemaster'
  | 'herbalist'
  | 'apothecary'
  | 'scribe'
  | 'librarian'
  | 'teacher'
  | 'student'
  | 'apprentice'
  | 'master'
  | 'journeyman'
  | 'miner'
  | 'jeweler'
  | 'leatherworker'
  | 'fletcher'
  | 'bowyer'
  | 'tanner'
  | 'cooper'
  | 'wheelwright'
  | 'miller'
  | 'butcher'
  | 'hunter'
  | 'trapper'
  | 'forester'
  | 'lumberjack'
  | 'quarryman'
  | 'stonemason'
  | 'roofer'
  | 'plumber'
  | 'tinker'
  | 'peddler'
  | 'vendor'
  | 'shopkeeper'
  | 'banker'
  | 'moneylender'
  | 'diplomat'
  | 'envoy'
  | 'messenger'
  | 'courier'
  | 'scout'
  | 'spy'
  | 'watchman'
  | 'sheriff'
  | 'judge'
  | 'lawyer'
  | 'bailiff'
  | 'executioner'
  | 'torturer'
  | 'jailer'
  | 'tax_collector'
  | 'bureaucrat'
  | 'clerk'
  | 'accountant'
  | 'steward'
  | 'chamberlain'
  | 'butler'
  | 'maid'
  | 'servant'
  | 'slave'
  | 'serf'
  | 'peasant'
  | 'laborer'
  | 'dockworker'
  | 'porter'
  | 'carter'
  | 'coachman'
  | 'groom'
  | 'stablehand'
  | 'squire'
  | 'page'
  | 'herald'
  | 'minstrel'
  | 'jester'
  | 'fool'
  | 'entertainer'
  | 'dancer'
  | 'acrobat'
  | 'performer'
  | 'actor'
  | 'poet'
  | 'author'
  | 'historian'
  | 'chronicler'
  | 'cartographer'
  | 'navigator'
  | 'shipwright'
  | 'sailmaker'
  | 'ropemaker'
  | 'netmaker'
  | 'fishmonger'
  | 'grocer'
  | 'greengrocer'
  | 'spice_merchant'
  | 'cloth_merchant'
  | 'grain_merchant'
  | 'livestock_merchant'
  | 'horse_trader'
  | 'slave_trader'
  | 'smuggler'
  | 'pirate'
  | 'bandit'
  | 'thief'
  | 'pickpocket'
  | 'burglar';

export interface FamilyMember extends WorldContent {
  type: 'family_member';
  role: RoleType;
  race: string; // Mortal race ID
  family?: string; // Family lineage ID
  parent?: string; // Parent family member ID
  organization?: string; // Organization ID
  location: string; // Geography ID
  birthDate?: Date;
  deathDate?: Date;
  notableActions: string[]; // Significant things they did
  connections: Array<{
    targetId: string;
    relationship: 'created' | 'influenced' | 'served' | 'betrayed' | 'loved' | 'hated';
    description: string;
  }>;
}

/**
 * Family lineage
 */
export interface FamilyLineage {
  id: string;
  name: string;
  race: string;
  origin: string; // Geography ID
  members: string[]; // Family member IDs
  notableMembers: string[]; // Standout mortals in the family
  history: string; // Family history
  founded?: Date;
  parentId?: string; // Standout mortal ID who founded this lineage
}

/**
 * World generation configuration
 */
export interface WorldGenerationConfig {
  seed: string;
  includeLevels?: GenerationLevel[]; // Which levels to generate
  depth?: 'full' | 'partial' | 'minimal'; // Generation depth
  customPrimordials?: PrimordialType[]; // Custom primordial types
  customRaces?: MortalRaceType[]; // Custom race types
  organizationDensity?: 'sparse' | 'normal' | 'dense'; // How many organizations
}

/**
 * World Event
 * 
 * Represents significant events in world history, such as
 * "necromancer built tower", "organization founded", etc.
 */
export interface WorldEvent {
  type: string; // Event type (e.g., 'built_tower', 'founded_organization')
  entityId: string; // ID of the entity involved (e.g., necromancer mortal ID)
  locationId: string; // Geography ID where event occurred
  description: string; // Human-readable description
  year: number; // Year when event occurred (negative for past events)
  metadata?: Record<string, unknown>; // Additional event metadata
}

/**
 * Level 7.5: Dungeons
 * 
 * Dungeons created by organizations or standout mortals.
 * Each dungeon has provenance linking it to its creator.
 * Bosses are initialized during world generation for permanent dungeons.
 */
export interface DungeonBoss {
  level: number; // Which level the boss appears on (final boss = dungeon.depth)
  bossId: string; // ID of the boss (demi-god, standout mortal, or proc-gen boss)
  bossType: 'demigod' | 'standout_mortal' | 'procgen'; // Type of boss
  bossName: string; // Name of the boss
  bossRace?: string; // Race of the boss (for encounter theming)
  bossAlignment?: 'good' | 'neutral' | 'evil'; // Alignment (for encounter theming)
}

export interface Dungeon extends WorldContent {
  type: 'dungeon';
  dungeonType: 'dungeon' | 'tower'; // Regular dungeon or tower
  location: string; // Geography ID where dungeon exists
  createdBy: 'organization' | 'standout_mortal'; // Type of creator
  creatorId: string; // Organization ID or Standout Mortal ID
  purpose: string; // Why the dungeon was built (mining, research, fortress, etc.)
  age: number; // Years ago when created (negative for past)
  depth: number; // Number of levels deep (typically ~100)
  seed: string; // Seed for deterministic generation
  // Boss information (initialized during world generation)
  finalBoss: DungeonBoss | null; // Final boss at the deepest level
  midBosses: DungeonBoss[]; // Mid-bosses at significant levels (e.g., every 25 levels)
}

/**
 * Generated world result
 */
export interface GeneratedWorld {
  seed: string;
  primordials: PrimordialBeing[];
  cosmicCreators: CosmicCreator[];
  geography: Geography[];
  conceptualBeings: ConceptualBeing[];
  demiGods: DemiGod[];
  mortalRaces: MortalRace[];
  organizations: Organization[];
  standoutMortals: StandoutMortal[];
  dungeons: Dungeon[]; // Dungeons created by organizations or standout mortals
  familyMembers: FamilyMember[];
  familyLineages: FamilyLineage[];
  worldEvents: WorldEvent[]; // World events (e.g., necromancer built tower)
  generatedAt: Date;
}

/**
 * Generation context (passed between generators)
 */
export interface GenerationContext {
  seed: string;
  rng: () => number; // Seeded random number generator
  primordials: PrimordialBeing[];
  cosmicCreators: CosmicCreator[];
  geography: Geography[];
  conceptualBeings: ConceptualBeing[];
  demiGods: DemiGod[];
  mortalRaces: MortalRace[];
  organizations: Organization[];
  standoutMortals: StandoutMortal[];
  dungeons: Dungeon[]; // Dungeons accumulated during generation
  worldEvents: WorldEvent[]; // World events accumulated during generation
}
