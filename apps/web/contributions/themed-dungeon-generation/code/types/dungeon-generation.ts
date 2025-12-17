/**
 * Themed Dungeon Generation Types
 * 
 * Defines the structure for generating themed dungeons with pre-generated
 * bosses and on-demand room generation.
 */

/**
 * A dungeon theme that influences monster types, room types, and atmosphere
 */
export interface DungeonTheme {
  id: string;
  name: string;
  description: string;
  monsterTypes: string[]; // Types of monsters that appear in this theme
  roomTypes: RoomType[]; // Types of rooms that appear in this theme
  atmosphere: string; // Description of the dungeon's atmosphere
  bossInfluences: string[]; // Boss types that would influence this theme
  metadata: Record<string, unknown>;
}

/**
 * Types of rooms in a dungeon
 */
export type RoomType =
  | 'combat' // Combat encounter room
  | 'safe' // Safe room (rest point for healing/spells)
  | 'treasure' // Treasure room
  | 'trap' // Trap room (with subtypes)
  | 'boss' // Boss room (pre-generated)
  | 'mid_boss'; // Mid-boss room (pre-generated)

/**
 * Trap room subtypes
 * Puzzles are just traps that evoke a less dangerous image
 */
export type TrapSubtype =
  | 'ambush' // Appears safe but is actually combat
  | 'mechanical' // Mechanical traps (includes puzzle-like mechanisms)
  | 'magical' // Magical traps (includes puzzle-like magical challenges)
  | 'fake_treasure'; // Treasure disguised as trap

/**
 * A boss entity (mid-boss or final boss)
 */
export interface Boss {
  id: string;
  name: string;
  type: string; // e.g., 'Necromancer', 'Lich', 'Dragon'
  level: number; // Dungeon level where boss appears
  description: string;
  powers: string[];
  history: string;
  themeInfluence: string[]; // Themes this boss would influence
  metadata: Record<string, unknown>;
}

/**
 * A room in the dungeon
 */
export interface DungeonRoom {
  id: string;
  level: number; // 1-100 (or dynamic depth)
  type: RoomType;
  name: string;
  description: string;
  encounter?: RoomEncounter; // Generated on-demand
  metadata: Record<string, unknown>;
}

/**
 * An encounter within a room (generated on-demand)
 */
export interface RoomEncounter {
  id: string;
  type: 'combat' | 'trap';
  name: string;
  description: string;
  difficulty: number; // 1-10 scale
  trapSubtype?: TrapSubtype; // For trap encounters
  rewards?: EncounterReward[];
  metadata: Record<string, unknown>;
}

/**
 * Rewards from an encounter
 */
export interface EncounterReward {
  type: 'gold' | 'item' | 'experience' | 'lore';
  amount?: number;
  itemId?: string;
  description: string;
}

/**
 * World context for dungeon generation (optional)
 * Links dungeons to world history and standout mortals
 * 
 * This should contain the FULL standout mortal data from world generation,
 * not simplified versions. This ensures their full history (born to organization,
 * race, etc.) is preserved when they become dungeon bosses.
 */
export interface DungeonWorldContext {
  locationId?: string; // Geography ID where dungeon is located
  standoutMortals?: Array<{
    id: string;
    name: string;
    standoutType: string;
    location: string; // Geography ID
    race: string; // Mortal race ID (full history)
    organization?: string; // Organization ID if part of one (full history)
    powers: string[];
    level: number;
    age: number;
    alignment?: 'good' | 'neutral' | 'evil';
    isBoss: boolean;
    // Full world content data
    parentId?: string | null; // Parent entity (race, organization, etc.)
    createdAt?: Date; // When they were born/created
    description?: string; // Full description from world generation
    metadata?: Record<string, unknown>; // Additional metadata from world generation
  }>; // Standout mortals from world generation (FULL data, not simplified)
  demiGods?: Array<{
    id: string;
    name: string;
    demiGodType: string;
    origin: string; // What created them (primordial, cosmic, or conceptual)
    powers: string[];
    age: number;
    alignment?: 'good' | 'neutral' | 'evil';
    isBoss: boolean; // Evil demi-gods are dungeon boss candidates
    // Full world content data
    parentId?: string | null; // Parent entity
    createdAt?: Date;
    description?: string;
    metadata?: Record<string, unknown>;
    // Subtype information
    halfGodRace?: string;
    ancientCreatureType?: string;
    divineExperimentFeatures?: string[];
    fallenDivineType?: string;
    primordialSpawnType?: string;
  }>; // Demi-gods from world generation (evil demi-gods can be dungeon bosses)
  worldEvents?: Array<{
    type: string;
    entityId: string; // ID of the entity (e.g., necromancer mortal)
    locationId: string; // Geography ID where event occurred
    description: string;
    year: number;
    metadata?: Record<string, unknown>; // Additional event metadata
  }>; // World events like "necromancer built tower"
  // Optional: Callback to record events in entity history
  recordEntityEvent?: (entityId: string, event: {
    type: string;
    description: string;
    year: number;
    relatedEntityId?: string; // e.g., dungeon ID if becoming a boss
    metadata?: Record<string, unknown>;
  }) => void;
}

/**
 * Dungeon provenance information
 */
export interface DungeonProvenance {
  builder: string; // Builder ID (e.g., 'dwarven_kingdom')
  builderName: string; // Display name (e.g., 'Ancient Dwarven Kingdom')
  builderCategory: 'practical' | 'dungeon_like';
  purpose: string; // Why it was built (e.g., 'mining operation')
  age: number; // Years ago it was built
  originalDepth: number; // Original depth (dungeons expand over time)
  history: string; // Generated history text
  builderMortalId?: string; // If built by a standout mortal, their ID
}

/**
 * A complete themed dungeon
 */
export interface ThemedDungeon {
  id: string;
  name: string;
  seed: string;
  depth: number; // Number of levels (default 100, can be dynamic)
  theme: DungeonTheme;
  finalBoss: Boss; // Pre-generated final boss at bottom
  midBosses: Boss[]; // Pre-generated mid-bosses
  levelLayout: DungeonLevelLayout[]; // List structure for deterministic access
  provenance: DungeonProvenance; // Builder, purpose, age, history
  metadata: Record<string, unknown>;
}

/**
 * Layout for a single dungeon level
 * This is the data structure that gets stored and accessed deterministically
 * Boss rooms are pre-generated when the dungeon is created.
 * Non-boss rooms are generated on-demand with random seeds.
 */
export interface DungeonLevelLayout {
  level: number; // 1-based level number
  boss?: Boss; // If this level has a boss (pre-generated)
  room?: DungeonRoom; // Pre-generated room (only for boss rooms)
  roomTemplate: RoomTemplate; // Template for generating non-boss rooms on-demand
  metadata: Record<string, unknown>;
}

/**
 * Template for generating rooms on-demand
 */
export interface RoomTemplate {
  roomTypes: RoomType[];
  monsterTypes?: string[]; // For combat rooms
  difficultyRange: [number, number]; // Min and max difficulty
  theme: DungeonTheme;
}

/**
 * Options for generating a themed dungeon
 */
export interface DungeonGenerationOptions {
  seed: string;
  depth?: number; // Default 100
  themeId?: string; // Optional: force a specific theme
  bossInfluence?: string; // Optional: boss type to influence theme selection
  worldContentId?: string; // Link to world-content-hierarchy
}

/**
 * Options for generating a room on-demand
 */
export interface RoomGenerationOptions {
  level: number;
  dungeon: ThemedDungeon;
  roomType?: RoomType; // Optional: specific room type
  seed?: string; // Optional: override seed for this room
  builder?: string; // Builder name for flavor text
  builderFlavor?: string; // Builder-specific flavor text (e.g., 'dwarven stonework')
}

/**
 * Result of room generation
 */
export interface GeneratedRoom {
  room: DungeonRoom;
  encounter?: RoomEncounter;
}

