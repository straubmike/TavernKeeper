/**
 * Room Generator
 * 
 * Generates rooms for dungeon levels (pre-generated during dungeon creation).
 * Rooms can be combat encounters, puzzles, events, or other types.
 * All generation is deterministic based on seed and level.
 */

import type {
  DungeonRoom,
  RoomEncounter,
  RoomType,
  RoomTemplate,
  RoomGenerationOptions,
  GeneratedRoom,
  ThemedDungeon,
  TrapSubtype,
} from '../types/dungeon-generation';
import { 
  createMonsterInstance,
  type MonsterStatBlock,
} from '../../monster-stat-blocks/code/services/monsterService';
import { 
  getMonstersByTheme as getMonsterEntriesByTheme,
  getRegularMonsters,
  type MonsterRegistryEntry,
} from '../../../monster-stat-blocks/code/data/monster-registry';
import type { ChallengeRating } from '../../monster-stat-blocks/code/types/monster-stats';

/**
 * Create a seeded RNG function
 */
function createRNG(seed: string): () => number {
  let hash = 0;
  for (let i = 0; i < seed.length; i++) {
    const char = seed.charCodeAt(i);
    hash = ((hash << 5) - hash) + char;
    hash = hash & hash;
  }
  let state = Math.abs(hash);
  
  return function rng() {
    state = (state * 9301 + 49297) % 233280;
    return state / 233280;
  };
}

/**
 * Trap subtypes
 */
const TRAP_SUBTYPES: Array<{
  type: TrapSubtype;
  name: string;
  description: string;
}> = [
  {
    type: 'ambush',
    name: 'Ambush Trap',
    description: 'This room appears safe, but enemies lie in wait',
  },
  {
    type: 'mechanical',
    name: 'Mechanical Trap',
    description: 'Mechanical traps and puzzle-like mechanisms attempt to impede progress',
  },
  {
    type: 'magical',
    name: 'Magical Trap',
    description: 'Magical traps and puzzle-like enchantments attempt to impede progress',
  },
  {
    type: 'fake_treasure',
    name: 'Fake Treasure',
    description: 'Treasure is disguised as a trap',
  },
];

export class RoomGenerator {
  /**
   * Generate a room (deterministic, called during dungeon creation)
   */
  generateRoom(options: RoomGenerationOptions): GeneratedRoom {
    const {
      level,
      dungeon,
      roomType,
      seed,
      builder,
      builderFlavor,
    } = options;

    const roomSeed = seed || `${dungeon.seed}-level-${level}`;
    const rng = createRNG(roomSeed);

    // Determine room type
    const finalRoomType = roomType || this.selectRoomType(dungeon.theme, level, rng);

    // Generate room (deterministic ID based on seed and level)
    const room: DungeonRoom = {
      id: `room-${dungeon.seed}-${level}`,
      level,
      type: finalRoomType,
      name: this.generateRoomName(finalRoomType, level, dungeon.theme, rng),
      description: this.generateRoomDescription(finalRoomType, level, dungeon.theme, builderFlavor),
      encounter: undefined,
      metadata: {
        theme: dungeon.theme.id,
        generatedAt: new Date().toISOString(),
      },
    };

    // Generate encounter if applicable
    let encounter: RoomEncounter | undefined;
    if (finalRoomType === 'combat' || finalRoomType === 'trap') {
      encounter = this.generateEncounter(finalRoomType, level, dungeon, rng);
      room.encounter = encounter;
    }

    return {
      room,
      encounter,
    };
  }

  /**
   * Select a room type based on theme and level
   * 
   * Distribution:
   * - Majority: combat rooms (~65%)
   * - Small but equal: trap, safe (~15% each = 30% total)
   * - Fewest: treasure (~5%)
   */
  private selectRoomType(
    theme: ThemedDungeon['theme'],
    level: number,
    rng: () => number
  ): RoomType {
    const roll = rng();

    // Boss and mid-boss rooms are handled separately
    // Here we only generate regular rooms

    // Distribution:
    // Combat: 65% (majority)
    // Trap: 15% (small but equal)
    // Safe: 15% (small but equal)
    // Treasure: 5% (fewest)
    
    const combatChance = 0.65; // 65% combat
    const trapChance = 0.15; // 15% traps
    const safeChance = 0.15; // 15% safe rooms
    const treasureChance = 0.05; // 5% treasure

    if (roll < combatChance) {
      return 'combat';
    } else if (roll < combatChance + trapChance) {
      return 'trap';
    } else if (roll < combatChance + trapChance + safeChance) {
      return 'safe';
    } else if (roll < combatChance + trapChance + safeChance + treasureChance) {
      return 'treasure';
    } else {
      // Fallback to safe
      return 'safe';
    }
  }

  /**
   * Generate an encounter for a room
   */
  private generateEncounter(
    roomType: RoomType,
    level: number,
    dungeon: ThemedDungeon,
    rng: () => number
  ): RoomEncounter {
    // Deterministic seed based on dungeon seed and level
    const encounterSeed = `${dungeon.seed}-encounter-${level}`;
    const encounterRNG = createRNG(encounterSeed);

    const difficulty = Math.min(10, Math.max(1, Math.floor(level / 10) + Math.floor(encounterRNG() * 3)));

    if (roomType === 'combat') {
      return this.generateCombatEncounter(level, dungeon, difficulty, encounterRNG);
    } else if (roomType === 'trap') {
      return this.generateTrapEncounter(level, dungeon, difficulty, encounterRNG);
    }

    // Fallback (should not happen)
    return {
      id: `encounter-${encounterSeed}`,
      type: 'combat',
      name: 'Mysterious Room',
      description: 'This room holds unknown secrets.',
      difficulty,
      metadata: {},
    };
  }

  /**
   * Calculate appropriate CR range for a dungeon level
   * Level 1 = CR 0-1 (appropriate for level 1 party)
   * Level 99 = CR 15-20 (difficult for level 15 party)
   */
  private calculateCRRangeForLevel(level: number): { minCR: number; maxCR: number } {
    // Formula: baseCR scales with level, with wider range at higher levels
    // Level 1: CR 0-1
    // Level 99: CR 15-20
    const baseCR = Math.floor(level / 6.6);
    const minCR = Math.max(0, baseCR);
    // Wider range at higher levels (1-2 CR spread early, 5 CR spread later)
    const rangeSize = level < 10 ? 1 : (level < 30 ? 2 : 5);
    const maxCR = Math.min(30, baseCR + rangeSize);
    
    return { minCR, maxCR };
  }

  /**
   * Determine monster count based on dungeon level (gradient progression)
   * Early levels: 1 monster (easiest)
   * Mid levels: 1-2 monsters
   * Late levels: 1-3 monsters (more variety)
   */
  private determineMonsterCount(level: number, rng: () => number): number {
    if (level <= 10) {
      // Early levels: always 1 monster (easiest encounters)
      return 1;
    } else if (level <= 30) {
      // Mid levels: 1-2 monsters
      return Math.floor(rng() * 2) + 1;
    } else {
      // Late levels: 1-3 monsters (more variety at higher levels)
      return Math.floor(rng() * 3) + 1;
    }
  }

  /**
   * Adjust CR range downward when multiple monsters are present
   * This accounts for D&D 5e encounter multipliers:
   * - 1 monster: 1x (no adjustment)
   * - 2 monsters: 1.5x (divide CR by 1.5)
   * - 3+ monsters: 2x (divide CR by 2)
   * 
   * This ensures effective encounter difficulty stays consistent
   * regardless of monster count.
   */
  private adjustCRForMonsterCount(
    minCR: number,
    maxCR: number,
    monsterCount: number
  ): { minCR: number; maxCR: number } {
    if (monsterCount === 1) {
      // No adjustment needed for single monster
      return { minCR, maxCR };
    } else if (monsterCount === 2) {
      // 2 monsters = 1.5x multiplier, so divide CR by 1.5
      return {
        minCR: Math.max(0, minCR / 1.5),
        maxCR: maxCR / 1.5,
      };
    } else {
      // 3+ monsters = 2x multiplier, so divide CR by 2
      return {
        minCR: Math.max(0, minCR / 2),
        maxCR: maxCR / 2,
      };
    }
  }

  /**
   * Generate a combat encounter with CR-scaled monsters
   * Difficulty is fixed to dungeon level (not party level/size)
   * Multiple monsters are accounted for to maintain consistent difficulty
   */
  private generateCombatEncounter(
    level: number,
    dungeon: ThemedDungeon,
    difficulty: number,
    rng: () => number
  ): RoomEncounter {
    // STEP 1: Determine monster count FIRST (gradient based on level)
    const monsterCount = this.determineMonsterCount(level, rng);
    
    // STEP 2: Calculate base CR range for this dungeon level
    const baseCRRange = this.calculateCRRangeForLevel(level);
    
    // STEP 3: Adjust CR range downward for multiple monsters
    // This ensures effective encounter difficulty stays consistent
    const { minCR, maxCR } = this.adjustCRForMonsterCount(
      baseCRRange.minCR,
      baseCRRange.maxCR,
      monsterCount
    );
    
    // STEP 4: Get theme ID (should match monster registry theme values)
    const monsterTheme = dungeon.theme.id as any;
    
    // STEP 5: Get all monster entries for this theme, filter by adjusted CR and exclude bosses
    const themeMonsterEntries = getMonsterEntriesByTheme(monsterTheme);
    const availableEntries = themeMonsterEntries.filter(entry => 
      !entry.isBoss && 
      entry.statBlock.cr >= minCR && 
      entry.statBlock.cr <= maxCR
    );
    
    // STEP 6: Fallback to generic non-boss monsters if theme has no matches
    let selectedMonster: MonsterStatBlock | null = null;
    if (availableEntries.length > 0) {
      const selectedEntry = availableEntries[Math.floor(rng() * availableEntries.length)];
      selectedMonster = selectedEntry.statBlock;
    } else {
      // Fallback: get any non-boss monster in adjusted CR range from generic theme
      const genericEntries = getMonsterEntriesByTheme('generic').filter(entry =>
        !entry.isBoss &&
        entry.statBlock.cr >= minCR &&
        entry.statBlock.cr <= maxCR
      );
      if (genericEntries.length > 0) {
        const selectedEntry = genericEntries[Math.floor(rng() * genericEntries.length)];
        selectedMonster = selectedEntry.statBlock;
      } else {
        // Last resort: get any regular monster in adjusted CR range
        const regularMonsters = getRegularMonsters().filter(entry =>
          entry.statBlock.cr >= minCR &&
          entry.statBlock.cr <= maxCR
        );
        if (regularMonsters.length > 0) {
          const selectedEntry = regularMonsters[Math.floor(rng() * regularMonsters.length)];
          selectedMonster = selectedEntry.statBlock;
        }
      }
    }
    
    // STEP 7: If still no monster found, use a default low-CR monster
    if (!selectedMonster) {
      selectedMonster = {
        name: 'Goblin',
        hp: 7,
        ac: 15,
        cr: 0.25,
        xp: 25,
        strength: 8,
        dexterity: 14,
        wisdom: 8,
      };
    }

    return {
      id: `combat-${dungeon.seed}-${level}`,
      type: 'combat',
      name: `${monsterCount > 1 ? `${monsterCount} ` : ''}${selectedMonster.name}${monsterCount > 1 ? 's' : ''}`,
      description: `You encounter ${monsterCount > 1 ? `${monsterCount} ` : 'a '}${selectedMonster.name.toLowerCase()}${monsterCount > 1 ? 's' : ''} in this room. ${dungeon.theme.atmosphere}`,
      difficulty,
      rewards: [
        {
          type: 'gold',
          amount: difficulty * 10 + Math.floor(rng() * 20),
          description: `${difficulty * 10 + Math.floor(rng() * 20)} gold pieces`,
        },
        {
          type: 'experience',
          amount: selectedMonster.xp * monsterCount,
          description: `${selectedMonster.xp * monsterCount} experience points`,
        },
      ],
      metadata: {
        monsterType: selectedMonster.name,
        monsterCount,
        theme: dungeon.theme.id,
        cr: selectedMonster.cr,
        minCR: baseCRRange.minCR, // Store base CR range in metadata
        maxCR: baseCRRange.maxCR,
        adjustedMinCR: minCR, // Store adjusted CR range for debugging
        adjustedMaxCR: maxCR,
      },
    };
  }

  /**
   * Generate a trap encounter with subtypes
   */
  private generateTrapEncounter(
    level: number,
    dungeon: ThemedDungeon,
    difficulty: number,
    rng: () => number
  ): RoomEncounter {
    // Select trap subtype
    const trapSubtype = TRAP_SUBTYPES[Math.floor(rng() * TRAP_SUBTYPES.length)];

    let name: string;
    let description: string;
    let rewards: RoomEncounter['rewards'] = [];

    if (trapSubtype.type === 'ambush') {
      // Ambush trap - appears safe but is actually combat
      name = 'Ambush Trap';
      description = `This room appears safe and peaceful, but enemies lie in wait. ${dungeon.theme.atmosphere}`;
      // Ambush is actually combat, so it will be handled as combat
      // But we mark it as trap with ambush subtype
      rewards = [
        {
          type: 'experience',
          amount: difficulty * 50,
          description: `${difficulty * 50} experience points`,
        },
      ];
    } else if (trapSubtype.type === 'mechanical') {
      // Mechanical traps (includes puzzle-like mechanisms)
      const mechanicalTraps = [
        'Pressure Plates',
        'Spike Trap',
        'Pitfall',
        'Crushing Walls',
        'Rotating Blades',
        'Lever Puzzle',
        'Gear Mechanism',
        'Clockwork Trap',
      ];
      const trapName = mechanicalTraps[Math.floor(rng() * mechanicalTraps.length)];
      name = `${trapName}`;
      description = `Mechanical traps and puzzle-like mechanisms attempt to impede your progress. ${dungeon.theme.atmosphere}`;
      rewards = [
        {
          type: 'experience',
          amount: difficulty * 30,
          description: `${difficulty * 30} experience points for surviving`,
        },
        {
          type: 'lore',
          description: 'Knowledge gained from understanding the mechanism',
        },
      ];
    } else if (trapSubtype.type === 'magical') {
      // Magical traps (includes puzzle-like magical challenges)
      const magicalTraps = [
        'Rune Trap',
        'Elemental Barrier',
        'Symbol Sequence',
        'Magic Ward',
        'Arcane Lock',
        'Spell Puzzle',
        'Mana Drain',
        'Enchanted Trap',
      ];
      const trapName = magicalTraps[Math.floor(rng() * magicalTraps.length)];
      name = `${trapName}`;
      description = `Magical traps and puzzle-like enchantments attempt to impede your progress. ${dungeon.theme.atmosphere}`;
      rewards = [
        {
          type: 'experience',
          amount: difficulty * 30,
          description: `${difficulty * 30} experience points for surviving`,
        },
        {
          type: 'lore',
          description: 'Knowledge gained from understanding the magic',
        },
      ];
    } else if (trapSubtype.type === 'fake_treasure') {
      // Fake treasure - treasure disguised as trap
      name = 'Fake Treasure';
      description = `Treasure glitters in this room, but it's a trap designed to lure the unwary. ${dungeon.theme.atmosphere}`;
      rewards = [
        {
          type: 'experience',
          amount: difficulty * 40,
          description: `${difficulty * 40} experience points for surviving`,
        },
        {
          type: 'gold',
          amount: difficulty * 15, // Some gold if you survive the trap
          description: `${difficulty * 15} gold pieces recovered`,
        },
      ];
    } else {
      // Fallback
      name = trapSubtype.name;
      description = trapSubtype.description;
    }

    return {
      id: `trap-${dungeon.seed}-${level}`,
      type: 'trap',
      name,
      description,
      difficulty,
      trapSubtype: trapSubtype.type,
      rewards,
      metadata: {
        trapSubtype: trapSubtype.type,
        theme: dungeon.theme.id,
      },
    };
  }

  /**
   * Generate room name
   */
  private generateRoomName(
    roomType: RoomType,
    level: number,
    theme: ThemedDungeon['theme'],
    rng: () => number
  ): string {
    const prefixes: Record<RoomType, string[]> = {
      combat: ['Combat Chamber', 'Battle Room', 'Fighting Grounds', 'Arena'],
      trap: ['Trap Room', 'Dangerous Chamber', 'Hazardous Hall', 'Deadly Room'],
      treasure: ['Treasure Vault', 'Loot Chamber', 'Wealth Room', 'Reward Hall'],
      safe: ['Safe Chamber', 'Quiet Room', 'Resting Hall', 'Sanctuary'],
      boss: ['Boss Chamber', 'Final Arena', 'Throne Room', 'Boss Hall'],
      mid_boss: ['Mid-Boss Chamber', 'Guardian Room', 'Champion Hall', 'Boss Arena'],
    };

    const names = prefixes[roomType] || ['Chamber'];
    return `${names[Math.floor(rng() * names.length)]} (Level ${level})`;
  }

  /**
   * Generate room description with builder flavor
   */
  private generateRoomDescription(
    roomType: RoomType,
    level: number,
    theme: ThemedDungeon['theme'],
    builderFlavor?: string
  ): string {
    const builderText = builderFlavor ? ` The walls show ${builderFlavor}.` : '';
    const base = `A ${theme.name.toLowerCase()} room on level ${level}.${builderText} ${theme.atmosphere}`;
    
    const additions: Record<RoomType, string> = {
      combat: 'The air is tense with anticipation of battle.',
      trap: 'Danger lurks in every corner.',
      treasure: 'The glint of gold catches your eye.',
      safe: 'A moment of peace in the darkness. A safe place to rest and recover.',
      boss: 'The presence of great power fills this room.',
      mid_boss: 'A powerful guardian awaits.',
    };

    return `${base} ${additions[roomType] || ''}`;
  }
}

