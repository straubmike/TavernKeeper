/**
 * Themed Dungeon Generator
 * 
 * PRIMARY IMPLEMENTATION - This is the main TypeScript code that should be
 * integrated into the game.
 * 
 * Main generator that creates themed dungeons with pre-generated bosses
 * and on-demand room generation.
 * 
 * Integration:
 *   import { ThemedDungeonGenerator } from '@innkeeper/engine/dungeon-generation';
 * 
 * The HTML tool in tools/dungeon-generator/ is for testing only.
 */

import { BossGenerator } from './boss-generator';
import { ThemeGenerator } from './theme-generator';
import { RoomGenerator } from './room-generator';
import {
  DUNGEON_BUILDERS,
  NECROMANCER_BUILDER,
  getPurposeForBuilder,
  getDifficultyMultiplier,
  type DungeonBuilder,
} from '../builders/dungeon-builders';
import type {
  ThemedDungeon,
  DungeonGenerationOptions,
  DungeonLevelLayout,
  RoomTemplate,
  Boss,
  DungeonProvenance,
  DungeonRoom,
  GeneratedRoom,
  DungeonWorldContext,
} from '../types/dungeon-generation';

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

export class ThemedDungeonGenerator {
  private bossGenerator: BossGenerator;
  private themeGenerator: ThemeGenerator;
  private roomGenerator: RoomGenerator;

  constructor() {
    this.bossGenerator = new BossGenerator();
    this.themeGenerator = new ThemeGenerator();
    this.roomGenerator = new RoomGenerator();
  }

  /**
   * Generate a complete themed dungeon
   * 
   * Flow:
   * 1. Generate final boss
   * 2. Generate mid-bosses
   * 3. Consider boss influences on theme
   * 4. Select appropriate theme
   * 5. Create level layout structure
   */
  async generate(options: DungeonGenerationOptions): Promise<ThemedDungeon> {
    const {
      seed,
      depth = 100,
      themeId,
      bossInfluence,
      worldContentId,
    } = options;

    const rng = createRNG(seed);

    // Step 0: Generate builder and provenance first (needed for age-based difficulty)
    const worldContext = (options as any).worldContext as DungeonWorldContext | undefined;
    const provenance = this.generateProvenance(seed, depth, rng, worldContext);

    // Step 1: Generate final boss at the bottom (with age-based difficulty)
    // Check if we should use a standout mortal as the boss
    let finalBoss: Boss;
    if (worldContext?.standoutMortals && provenance.builderMortalId) {
      // If this dungeon was built by a standout mortal (e.g., necromancer), use them as the boss
      const builderMortal = worldContext.standoutMortals?.find(
        (m) => m.id === provenance.builderMortalId
      );
      if (builderMortal) {
        finalBoss = this.convertStandoutMortalToBoss(
          builderMortal, 
          depth, 
          provenance.age,
          undefined, // dungeonId not available yet
          worldContext
        );
      } else {
        finalBoss = this.bossGenerator.generateFinalBoss(depth, seed, rng, provenance.age);
      }
    } else if (worldContext?.standoutMortals && worldContext.locationId) {
      // Check for evil standout mortals at this location that could be the boss
      const evilMortals = worldContext.standoutMortals?.filter(
        (m) => 
          m.location === worldContext.locationId &&
          m.isBoss === true // Use alignment-based isBoss flag
      ) || [];
      
      if (evilMortals.length > 0 && rng() < 0.4) { // 40% chance to use an evil mortal
        const selectedMortal = evilMortals[Math.floor(rng() * evilMortals.length)];
        finalBoss = this.convertStandoutMortalToBoss(
          selectedMortal, 
          depth, 
          provenance.age,
          undefined, // dungeonId not available yet
          worldContext
        );
      } else {
        // Check for evil demi-gods that could be the boss (divine beings aren't tied to locations)
        const evilDemiGods = worldContext.demiGods?.filter((d) => d.isBoss === true) || [];
        if (evilDemiGods.length > 0 && rng() < 0.3) { // 30% chance to use an evil demi-god
          const selectedDemiGod = evilDemiGods[Math.floor(rng() * evilDemiGods.length)];
          finalBoss = this.convertDemiGodToBoss(
            selectedDemiGod,
            depth,
            provenance.age,
            undefined, // dungeonId not available yet
            worldContext
          );
        } else {
          finalBoss = this.bossGenerator.generateFinalBoss(depth, seed, rng, provenance.age);
        }
      }
    } else {
      finalBoss = this.bossGenerator.generateFinalBoss(depth, seed, rng, provenance.age);
    }

    // Step 2: Generate mid-bosses (with age-based difficulty)
    // Place mid-bosses at strategic intervals (e.g., every 25 levels)
    // IMPORTANT: Do NOT use necromancers as mid-bosses - they should only be final bosses of their own towers
    const midBossCount = Math.max(1, Math.floor(depth / 25));
    const midBosses: Boss[] = [];
    const midBossLevels: number[] = [];

    for (let i = 1; i <= midBossCount; i++) {
      const midBossLevel = Math.floor((depth / (midBossCount + 1)) * i);
      
      // Check for other standout mortals that could be mid-bosses
      // But exclude necromancers - they should only be final bosses
      let midBoss: Boss | null = null;
      
      if (worldContext?.standoutMortals && worldContext.locationId) {
        const availableMortals = worldContext.standoutMortals.filter(
          (m) =>
            m.location === worldContext.locationId &&
            m.standoutType !== 'necromancer' && // Never use necromancers as mid-bosses
            m.id !== finalBoss.metadata?.mortalId && // Don't reuse final boss
            m.isBoss === true // Use alignment-based isBoss flag
        ) || [];
        
        if (availableMortals.length > 0 && rng() < 0.3) { // 30% chance to use a mortal as mid-boss
          const selectedMortal = availableMortals[Math.floor(rng() * availableMortals.length)];
          midBoss = this.convertStandoutMortalToBoss(
            selectedMortal,
            midBossLevel,
            provenance.age,
            undefined,
            worldContext
          );
        }
      }
      
      // If no mortal found, generate a mid-boss normally
      // The boss generator will not generate necromancers as mid-bosses
      if (!midBoss) {
        midBoss = this.bossGenerator.generateMidBoss(midBossLevel, seed, rng, provenance.age);
      }
      
      midBosses.push(midBoss);
      midBossLevels.push(midBossLevel);
    }

    // Step 3: Consider boss influences on theme
    // Final boss has the strongest influence
    const bossInfluenceForTheme = bossInfluence || finalBoss.type;

    // Step 4: Select theme (considering boss influence)
    const theme = this.themeGenerator.selectTheme(
      seed,
      themeId,
      bossInfluenceForTheme
    );

    // Step 5: Create level layout structure with pre-generated rooms
    // This is the list data structure for deterministic access
    // All rooms are generated upfront, not on-demand
    const levelLayout: DungeonLevelLayout[] = [];

    for (let level = 1; level <= depth; level++) {
      // Check if this level has a boss
      let boss: Boss | undefined;
      if (level === depth) {
        boss = finalBoss;
      } else if (midBossLevels.includes(level)) {
        boss = midBosses.find((mb) => mb.level === level);
      }

      // Create room template for this level
      // Apply age-based difficulty multiplier
      const baseDifficulty = Math.max(1, Math.floor(level / 10));
      const difficultyMultiplier = getDifficultyMultiplier(provenance.age);
      const adjustedDifficulty = Math.min(10, Math.floor(baseDifficulty * difficultyMultiplier));
      
      const roomTemplate: RoomTemplate = {
        roomTypes: theme.roomTypes,
        monsterTypes: theme.monsterTypes,
        difficultyRange: [
          adjustedDifficulty,
          Math.min(10, adjustedDifficulty + 2),
        ],
        theme,
      };

      // Pre-generate the room for this level (deterministic)
      // If it's a boss level, generate boss room, otherwise generate regular room
      let room: DungeonRoom;
      if (boss) {
        // Boss room
        room = {
          id: `room-boss-${seed}-${level}`,
          level,
          type: level === depth ? 'boss' : 'mid_boss',
          name: `${boss.name}'s Chamber`,
          description: boss.description,
          encounter: {
            id: `encounter-boss-${boss.id}`,
            type: 'combat' as const,
            name: boss.name,
            description: boss.description,
            difficulty: 10,
            rewards: [
              {
                type: 'experience' as const,
                amount: level * 1000,
                description: `${level * 1000} experience points`,
              },
              {
                type: 'lore' as const,
                description: boss.history,
              },
            ],
            metadata: {
              bossId: boss.id,
              powers: boss.powers,
            },
          },
          metadata: {
            bossId: boss.id,
            theme: theme.id,
            generatedAt: new Date().toISOString(),
          },
        };
      } else {
        // Regular room - generate deterministically based on seed and level
        // Create a temporary dungeon object for room generation
        // Note: We need provenance, but we're generating it earlier, so use a placeholder
        const tempProvenance: DungeonProvenance = {
          builder: 'unknown',
          builderName: 'Unknown',
          builderCategory: 'practical',
          purpose: 'unknown',
          age: 100,
          originalDepth: depth,
          history: 'Temporary dungeon for room generation',
        };
        const tempDungeon: ThemedDungeon = {
          id: `dungeon-${seed}-temp`,
          name: 'Temp',
          seed,
          depth,
          theme,
          finalBoss,
          midBosses,
          levelLayout: [],
          provenance: tempProvenance,
          metadata: {},
        };
        
        const generatedRoom = this.roomGenerator.generateRoom({
          level,
          dungeon: tempDungeon,
          builder: provenance.builderName,
          builderFlavor: this.getBuilderFlavor(provenance.builder, seed, level),
        });
        room = generatedRoom.room;
      }

      levelLayout.push({
        level,
        boss,
        room, // Pre-generated room
        roomTemplate, // Keep for reference
        metadata: {
          generatedAt: new Date().toISOString(),
        },
      });
    }

    // Create the dungeon
    const dungeon: ThemedDungeon = {
      id: `dungeon-${seed}-${Date.now()}`,
      name: this.generateDungeonName(theme, finalBoss, seed, rng),
      seed,
      depth,
      theme,
      finalBoss,
      midBosses,
      levelLayout,
      provenance,
      metadata: {
        worldContentId,
        generatedAt: new Date().toISOString(),
        bossInfluence: bossInfluenceForTheme,
      },
    };

    // Record dungeon creation event for the builder mortal (if applicable)
    if (provenance.builderMortalId && worldContext?.recordEntityEvent) {
      worldContext.recordEntityEvent(provenance.builderMortalId, {
        type: 'built_dungeon',
        description: `${provenance.builderName} built a dungeon known as ${dungeon.name} as a ${provenance.purpose}.`,
        year: Math.floor(Date.now() / (365 * 24 * 60 * 60 * 1000)) - provenance.age,
        relatedEntityId: dungeon.id,
        metadata: {
          dungeonName: dungeon.name,
          purpose: provenance.purpose,
          depth: depth,
          theme: theme.id,
        },
      });
    }

    // Record "became boss" event for the final boss (if it's a standout mortal)
    // This adds "became dungeon boss" to their entity history
    if (finalBoss.metadata?.mortalId && worldContext?.recordEntityEvent) {
      worldContext.recordEntityEvent(finalBoss.metadata.mortalId as string, {
        type: 'became_dungeon_boss',
        description: `${finalBoss.name} has taken control of ${dungeon.name}, becoming its final boss at level ${depth}.`,
        year: Math.floor(Date.now() / (365 * 24 * 60 * 60 * 1000)) - provenance.age,
        relatedEntityId: dungeon.id,
        metadata: {
          dungeonName: dungeon.name,
          dungeonLevel: depth,
          bossType: 'final',
        },
      });
    }

    return dungeon;
  }

  /**
   * Generate dungeon provenance (builder, purpose, age, history)
   * 
   * Public method for use by map generator system.
   * 
   * If worldContext is provided, checks for special cases:
   * - Necromancer towers: If a necromancer standout mortal built a tower at this location
   * - Other standout mortal constructions: Can be extended in the future
   */
  generateProvenance(
    seed: string,
    currentDepth: number,
    rng?: () => number,
    worldContext?: DungeonWorldContext
  ): DungeonProvenance {
    // Use provided RNG or create new one
    const provenanceRNG = rng || createRNG(`${seed}-provenance`);

    // Check for special cases based on world context
    let builder: DungeonBuilder;
    let builderMortalId: string | undefined;

    if (worldContext?.locationId && worldContext?.worldEvents && worldContext?.standoutMortals) {
      // Check if there's a necromancer tower event at this location
      const necromancerTowerEvent = worldContext.worldEvents?.find(
        (event) => 
          (event.type === 'built_tower' || event.type === 'constructed_tower') &&
          event.locationId === worldContext.locationId
      );

      if (necromancerTowerEvent) {
        // Find the necromancer mortal who built this tower
        const necromancerMortal = worldContext.standoutMortals?.find(
          (mortal) => 
            mortal.id === necromancerTowerEvent.entityId &&
            (mortal.standoutType === 'necromancer' || mortal.standoutType === 'lich')
        );

        if (necromancerMortal) {
          // Use special necromancer builder
          builder = NECROMANCER_BUILDER;
          builderMortalId = necromancerMortal.id;
        } else {
          // Fall back to random builder
          builder = DUNGEON_BUILDERS[Math.floor(provenanceRNG() * DUNGEON_BUILDERS.length)];
        }
      } else {
        // No special event, use random builder
        builder = DUNGEON_BUILDERS[Math.floor(provenanceRNG() * DUNGEON_BUILDERS.length)];
      }
    } else {
      // No world context, use random builder
      builder = DUNGEON_BUILDERS[Math.floor(provenanceRNG() * DUNGEON_BUILDERS.length)];
    }

    // Get appropriate purpose for this builder
    const purpose = getPurposeForBuilder(builder, provenanceRNG);

    // Generate age (50, 100, 200, 500, 1000 years ago)
    const ages = [50, 100, 200, 500, 1000];
    const age = ages[Math.floor(provenanceRNG() * ages.length)];

    // Calculate original depth (dungeons expand over time)
    // Older dungeons started smaller and expanded more
    // Recent: 20-40% of current depth
    // Ancient: 10-30% of current depth
    // Legendary: 5-20% of current depth
    let originalDepthRange: [number, number];
    if (age < 200) {
      originalDepthRange = [Math.floor(currentDepth * 0.2), Math.floor(currentDepth * 0.4)];
    } else if (age < 500) {
      originalDepthRange = [Math.floor(currentDepth * 0.1), Math.floor(currentDepth * 0.3)];
    } else {
      originalDepthRange = [Math.floor(currentDepth * 0.05), Math.floor(currentDepth * 0.2)];
    }
    const originalDepth = Math.max(1, Math.floor(
      originalDepthRange[0] + (provenanceRNG() * (originalDepthRange[1] - originalDepthRange[0]))
    ));

    // Generate history text
    const history = this.generateHistory(builder, purpose, age, originalDepth, currentDepth);

    return {
      builder: builder.id,
      builderName: builder.name,
      builderCategory: builder.category,
      purpose,
      age,
      originalDepth,
      history,
      builderMortalId, // Link to standout mortal if applicable
    };
  }

  /**
   * Generate history text for the dungeon
   */
  private generateHistory(
    builder: DungeonBuilder,
    purpose: string,
    age: number,
    originalDepth: number,
    currentDepth: number
  ): string {
    const expansion = currentDepth > originalDepth
      ? ` Over the centuries, it has been expanded from its original ${originalDepth} levels to ${currentDepth} levels deep.`
      : '';

    if (builder.category === 'practical') {
      return `This dungeon began ${age} years ago as a ${purpose} built by the ${builder.name}. What started as a practical construction has been repurposed, abandoned, and reclaimed over time.${expansion} The deepest levels hold secrets that have been lost to time, and dark creatures now call it home.`;
    } else {
      return `This dungeon was built ${age} years ago by the ${builder.name} as a ${purpose}. From the beginning, it was designed as a place of darkness and danger.${expansion} Over the centuries, it has been abandoned, conquered, and reclaimed by various forces. The deepest levels hold secrets that have been lost to time, and dark creatures now call it home.`;
    }
  }

  /**
   * Get builder flavor text for room descriptions
   */
  private getBuilderFlavor(builderId: string, seed: string, level: number): string {
    const builder = DUNGEON_BUILDERS.find((b) => b.id === builderId);
    if (!builder) {
      return 'ancient stonework';
    }

    const flavorSeed = `${seed}-flavor-${level}`;
    const flavorRNG = createRNG(flavorSeed);
    const flavors = builder.roomDescriptionFlavor;
    return flavors[Math.floor(flavorRNG() * flavors.length)];
  }

  /**
   * Generate bosses for a dungeon (for use by map generator)
   * 
   * This method generates final boss and mid-bosses that can be used
   * by the map generator's RichContentGenerator.
   * 
   * IMPORTANT: If worldContext is provided, it will use standout mortals
   * from world generation instead of generating new bosses. This ensures
   * that necromancers from world generation become dungeon bosses, not
   * standalone generated entities.
   * 
   * @param worldContext Optional world context to use standout mortals as bosses
   * @param provenance Optional provenance to check for builder mortal
   */
  generateBosses(
    seed: string,
    depth: number,
    age: number,
    rng?: () => number,
    worldContext?: DungeonWorldContext,
    provenance?: DungeonProvenance
  ): { finalBoss: Boss; midBosses: Boss[] } {
    const bossRNG = rng || createRNG(`${seed}-bosses`);

    // Generate final boss - check for standout mortals first
    let finalBoss: Boss;
    
    // Priority 1: If dungeon was built by a standout mortal, use them as final boss
    if (provenance?.builderMortalId && worldContext?.standoutMortals) {
      const builderMortal = worldContext.standoutMortals.find(
        (m) => m.id === provenance.builderMortalId
      );
      if (builderMortal) {
        finalBoss = this.convertStandoutMortalToBoss(
          builderMortal,
          depth,
          age,
          undefined, // dungeonId not available yet
          worldContext
        );
      } else {
        // Fallback to generated boss if builder mortal not found
        finalBoss = this.bossGenerator.generateFinalBoss(depth, seed, bossRNG, age);
      }
    }
    // Priority 2: Check for evil standout mortals at this location
    else if (worldContext?.standoutMortals && worldContext.locationId) {
      const evilMortals = worldContext.standoutMortals.filter(
        (m) =>
          m.location === worldContext.locationId &&
          m.isBoss === true // Use alignment-based isBoss flag
      ) || [];
      
      if (evilMortals.length > 0 && bossRNG() < 0.4) { // 40% chance to use an evil mortal
        const selectedMortal = evilMortals[Math.floor(bossRNG() * evilMortals.length)];
        finalBoss = this.convertStandoutMortalToBoss(
          selectedMortal,
          depth,
          age,
          undefined, // dungeonId not available yet
          worldContext
        );
      } else {
        // Check for evil demi-gods that could be the boss (divine beings aren't tied to locations)
        const evilDemiGods = worldContext.demiGods?.filter((d) => d.isBoss === true) || [];
        if (evilDemiGods.length > 0 && bossRNG() < 0.3) { // 30% chance to use an evil demi-god
          const selectedDemiGod = evilDemiGods[Math.floor(bossRNG() * evilDemiGods.length)];
          finalBoss = this.convertDemiGodToBoss(
            selectedDemiGod,
            depth,
            age,
            undefined, // dungeonId not available yet
            worldContext
          );
        } else {
          finalBoss = this.bossGenerator.generateFinalBoss(depth, seed, bossRNG, age);
        }
      }
    } else {
      // No world context - generate normally
      finalBoss = this.bossGenerator.generateFinalBoss(depth, seed, bossRNG, age);
    }

    // Generate mid-bosses
    // IMPORTANT: Do NOT use necromancers as mid-bosses - they should only be final bosses of their own towers
    const midBossCount = Math.max(1, Math.floor(depth / 25));
    const midBosses: Boss[] = [];

    for (let i = 1; i <= midBossCount; i++) {
      const midBossLevel = Math.floor((depth / (midBossCount + 1)) * i);
      
      // Check for other standout mortals that could be mid-bosses
      // But exclude necromancers - they should only be final bosses
      let midBoss: Boss | null = null;
      
      if (worldContext?.standoutMortals && worldContext.locationId) {
        const availableMortals = worldContext.standoutMortals.filter(
          (m) =>
            m.location === worldContext.locationId &&
            m.standoutType !== 'necromancer' && // Never use necromancers as mid-bosses
            m.id !== finalBoss.metadata?.mortalId && // Don't reuse final boss
            m.isBoss === true // Use alignment-based isBoss flag
        ) || [];
        
        if (availableMortals.length > 0 && bossRNG() < 0.3) { // 30% chance to use a mortal as mid-boss
          const selectedMortal = availableMortals[Math.floor(bossRNG() * availableMortals.length)];
          midBoss = this.convertStandoutMortalToBoss(
            selectedMortal,
            midBossLevel,
            age,
            undefined,
            worldContext
          );
        }
      }
      
      // If no mortal found, generate a mid-boss normally
      if (!midBoss) {
        midBoss = this.bossGenerator.generateMidBoss(midBossLevel, seed, bossRNG, age);
      }
      
      midBosses.push(midBoss);
    }

    return {
      finalBoss,
      midBosses,
    };
  }

  /**
   * Get a room for a specific level
   * 
   * Rooms are pre-generated when the dungeon is created, so this just retrieves
   * the pre-generated room from the level layout.
   */
  getRoomForLevel(
    dungeon: ThemedDungeon,
    level: number
  ): GeneratedRoom {
    const levelLayout = dungeon.levelLayout.find((layout) => layout.level === level);
    
    if (!levelLayout) {
      throw new Error(`Level ${level} not found in dungeon ${dungeon.id}`);
    }

    // Return the pre-generated room
    return {
      room: levelLayout.room,
      encounter: levelLayout.room.encounter,
    };
  }

  /**
   * Generate a dungeon name
   */
  private generateDungeonName(
    theme: ThemedDungeon['theme'],
    finalBoss: Boss,
    seed: string,
    rng: () => number
  ): string {
    const prefixes = [
      'The',
      'Ancient',
      'Forgotten',
      'Dark',
      'Cursed',
      'Lost',
    ];

    const suffixes = [
      'Dungeon',
      'Lair',
      'Depths',
      'Crypt',
      'Caverns',
      'Halls',
    ];

    const prefix = prefixes[Math.floor(rng() * prefixes.length)];
    const suffix = suffixes[Math.floor(rng() * suffixes.length)];

    // Sometimes include boss name or theme
    if (rng() < 0.3) {
      return `${prefix} ${finalBoss.name}'s ${suffix}`;
    } else if (rng() < 0.5) {
      return `${prefix} ${theme.name} ${suffix}`;
    } else {
      return `${prefix} ${suffix}`;
    }
  }

  /**
   * Get a list of available dungeons (for random selection)
   * 
   * In a real implementation, this would query from storage.
   * For now, this is a placeholder that shows the pattern.
   */
  async getAvailableDungeons(): Promise<ThemedDungeon[]> {
    // This would typically query from a database or storage
    // For now, return empty array - this is a placeholder
    return [];
  }

  /**
   * Select a random dungeon from available dungeons
   */
  async selectRandomDungeon(seed?: string): Promise<ThemedDungeon | null> {
    const dungeons = await this.getAvailableDungeons();
    
    if (dungeons.length === 0) {
      return null;
    }

    const rng = seed ? createRNG(seed) : Math.random;
    const index = Math.floor(rng() * dungeons.length);
    
    return dungeons[index] || null;
  }

  /**
   * Convert a standout mortal to a Boss format
   * 
   * Preserves the full history of the mortal and records this as an event
   * in their entity history (if recordEntityEvent callback is provided).
   */
  private convertStandoutMortalToBoss(
    mortal: NonNullable<NonNullable<DungeonWorldContext['standoutMortals']>[number]>,
    level: number,
    age: number,
    dungeonId?: string,
    worldContext?: DungeonWorldContext
  ): Boss {
    const difficultyMultiplier = getDifficultyMultiplier(age);
    const baseDifficulty = Math.min(10, Math.max(1, Math.floor(mortal.level / 10)));
    const adjustedDifficulty = Math.min(10, Math.floor(baseDifficulty * difficultyMultiplier));

    // Build richer description using full mortal data
    let description = mortal.description || `${mortal.name} is a powerful ${mortal.standoutType}`;
    if (mortal.powers.length > 0) {
      description += ` with mastery over ${mortal.powers.join(', ')}`;
    }
    if (mortal.organization) {
      description += `. Originally from an organization, they have risen to become a formidable threat.`;
    }

    // Build richer history using full mortal data
    let history = mortal.description || `${mortal.name} has been a force in this region for many years.`;
    if (mortal.organization) {
      history += ` Born into an organization, they have since become a powerful ${mortal.standoutType}.`;
    }
    if (mortal.createdAt) {
      const yearsActive = Math.floor((Date.now() - new Date(mortal.createdAt).getTime()) / (365 * 24 * 60 * 60 * 1000));
      history += ` They have been active for over ${yearsActive} years.`;
    }

    // Record this as an event in the mortal's entity history
    if (worldContext?.recordEntityEvent) {
      worldContext.recordEntityEvent(mortal.id, {
        type: 'became_dungeon_boss',
        description: `${mortal.name} has taken control of a dungeon at level ${level}, becoming its final boss.`,
        year: Math.floor(Date.now() / (365 * 24 * 60 * 60 * 1000)) - age, // Approximate year
        relatedEntityId: dungeonId,
        metadata: {
          dungeonLevel: level,
          bossType: 'final',
          difficulty: adjustedDifficulty,
        },
      });
    }

    return {
      id: `boss-${mortal.id}`,
      name: mortal.name,
      type: mortal.standoutType.charAt(0).toUpperCase() + mortal.standoutType.slice(1),
      level,
      description,
      powers: mortal.powers.length > 0 ? mortal.powers : ['Dark Magic', 'Combat Prowess'],
      history,
      themeInfluence: mortal.standoutType === 'necromancer' || mortal.standoutType === 'lich' 
        ? ['undead', 'necromancer-tower'] 
        : ['shadow'],
      metadata: {
        mortalId: mortal.id,
        mortalLevel: mortal.level,
        mortalRace: mortal.race,
        mortalOrganization: mortal.organization,
        difficultyMultiplier,
        difficulty: adjustedDifficulty,
        // Preserve full world content link
        worldContentId: mortal.id,
        parentId: mortal.parentId,
        createdAt: mortal.createdAt,
      },
    };
  }

  /**
   * Convert a demi-god to a Boss format
   * 
   * Preserves the full history of the demi-god and records this as an event
   * in their entity history (if recordEntityEvent callback is provided).
   */
  private convertDemiGodToBoss(
    demiGod: NonNullable<NonNullable<DungeonWorldContext['demiGods']>[number]>,
    level: number,
    age: number,
    dungeonId?: string,
    worldContext?: DungeonWorldContext
  ): Boss {
    const difficultyMultiplier = getDifficultyMultiplier(age);
    // Demi-gods are powerful - use age and powers to determine difficulty
    const baseDifficulty = Math.min(10, Math.max(7, Math.floor(demiGod.age / 100))); // Demi-gods start strong
    const adjustedDifficulty = Math.min(10, Math.floor(baseDifficulty * difficultyMultiplier));

    // Build description using demi-god data
    let description = demiGod.description || `${demiGod.name} is a powerful ${demiGod.demiGodType.replace(/_/g, ' ')}`;
    if (demiGod.powers.length > 0) {
      description += ` with mastery over ${demiGod.powers.join(', ')}`;
    }
    description += `. This divine being has taken control of this dungeon, becoming its final boss.`;

    // Build history using demi-god data
    let history = demiGod.description || `${demiGod.name} has existed for millennia as a ${demiGod.demiGodType.replace(/_/g, ' ')}.`;
    if (demiGod.createdAt) {
      const yearsActive = Math.floor((Date.now() - new Date(demiGod.createdAt).getTime()) / (365 * 24 * 60 * 60 * 1000));
      history += ` They have existed for over ${yearsActive} years.`;
    }
    history += ` They have now claimed this dungeon as their domain.`;

    // Record this as an event in the demi-god's entity history
    if (worldContext?.recordEntityEvent) {
      worldContext.recordEntityEvent(demiGod.id, {
        type: 'became_dungeon_boss',
        description: `${demiGod.name} has taken control of a dungeon at level ${level}, becoming its final boss.`,
        year: Math.floor(Date.now() / (365 * 24 * 60 * 60 * 1000)) - age,
        relatedEntityId: dungeonId,
        metadata: {
          dungeonLevel: level,
          bossType: 'final',
          difficulty: adjustedDifficulty,
        },
      });
    }

    // Determine theme influence based on demi-god type
    const themeInfluence: string[] = [];
    if (demiGod.demiGodType === 'fallen_divine') {
      themeInfluence.push('corruption', 'shadow');
    } else if (demiGod.demiGodType === 'ancient_creature') {
      themeInfluence.push('beast', 'nature');
    } else if (demiGod.demiGodType === 'primordial_spawn') {
      themeInfluence.push('elemental', 'chaos');
    } else {
      themeInfluence.push('divine', 'power');
    }

    return {
      id: `boss-${demiGod.id}`,
      name: demiGod.name,
      type: demiGod.demiGodType.charAt(0).toUpperCase() + demiGod.demiGodType.slice(1).replace(/_/g, ' '),
      level,
      description,
      powers: demiGod.powers.length > 0 ? demiGod.powers : ['Divine Power', 'Immortality'],
      history,
      themeInfluence,
      metadata: {
        demiGodId: demiGod.id,
        demiGodType: demiGod.demiGodType,
        demiGodAge: demiGod.age,
        difficultyMultiplier,
        difficulty: adjustedDifficulty,
        // Preserve full world content link
        worldContentId: demiGod.id,
        parentId: demiGod.parentId,
        createdAt: demiGod.createdAt,
        alignment: demiGod.alignment,
        // Subtype information
        halfGodRace: demiGod.halfGodRace,
        ancientCreatureType: demiGod.ancientCreatureType,
        divineExperimentFeatures: demiGod.divineExperimentFeatures,
        fallenDivineType: demiGod.fallenDivineType,
        primordialSpawnType: demiGod.primordialSpawnType,
      },
    };
  }
}