/**
 * World Generator
 * 
 * Main coordinator for world generation. Generates world content
 * from primordial beings down to individual mortals.
 */

import type {
  WorldGenerationConfig,
  GeneratedWorld,
  GenerationContext,
  GenerationLevel,
} from '../types/world-generation';
import { PrimordialGenerator } from './primordial-generator';
import { CosmicGenerator } from './cosmic-generator';
import { GeographyGenerator } from './geography-generator';
import { ConceptualGenerator } from './conceptual-generator';
import { DemiGodGenerator } from './demigod-generator';
import { MortalGenerator } from './mortal-generator';
import { OrganizationGenerator } from './organization-generator';
import { StandoutGenerator } from './standout-generator';
import { DungeonGenerator } from './dungeon-generator';
// Note: This should import from @innkeeper/engine after integration
// For now, using a simple seeded RNG
function makeRng(seed: string): () => number {
  let state = seed.split('').reduce((acc, char) => acc + char.charCodeAt(0), 0);
  return () => {
    state = (state * 9301 + 49297) % 233280;
    return state / 233280;
  };
}

/**
 * Main World Generator
 */
export class WorldGenerator {
  private primordialGenerator: PrimordialGenerator;
  private cosmicGenerator: CosmicGenerator;
  private geographyGenerator: GeographyGenerator;
  private conceptualGenerator: ConceptualGenerator;
  private demiGodGenerator: DemiGodGenerator;
  private mortalGenerator: MortalGenerator;
  private organizationGenerator: OrganizationGenerator;
  private standoutGenerator: StandoutGenerator;
  private dungeonGenerator: DungeonGenerator;

  constructor() {
    this.primordialGenerator = new PrimordialGenerator();
    this.cosmicGenerator = new CosmicGenerator();
    this.geographyGenerator = new GeographyGenerator();
    this.conceptualGenerator = new ConceptualGenerator();
    this.demiGodGenerator = new DemiGodGenerator();
    this.mortalGenerator = new MortalGenerator();
    this.organizationGenerator = new OrganizationGenerator();
    this.standoutGenerator = new StandoutGenerator();
    this.dungeonGenerator = new DungeonGenerator();
  }

  /**
   * Generate a complete world
   */
  async generateWorld(config: WorldGenerationConfig): Promise<GeneratedWorld> {
    console.log('[WorldGenerator] Starting world generation...');
    console.log(`[WorldGenerator] Seed: ${config.seed}`);
    console.log(`[WorldGenerator] Levels to generate: ${config.includeLevels?.join(', ') || 'all'}`);
    
    const rng = makeRng(config.seed);
    const levels = config.includeLevels || [1, 2, 2.5, 3, 4, 5, 6, 6.5, 7];

    const context: GenerationContext = {
      seed: config.seed,
      rng,
      primordials: [],
      cosmicCreators: [],
      geography: [],
      conceptualBeings: [],
      demiGods: [],
      mortalRaces: [],
      organizations: [],
      standoutMortals: [],
      dungeons: [],
      worldEvents: [], // Accumulate world events during generation
    };
    
    console.log('[WorldGenerator] Context initialized, starting level generation...');

    // Level 1: Primordials
    if (levels.includes(1)) {
      console.log('[WorldGenerator] Level 1: Generating primordials...');
      context.primordials = await this.primordialGenerator.generate(
        context,
        config.customPrimordials
      );
      console.log(`[WorldGenerator] Level 1 complete: ${context.primordials.length} primordials`);
    }

    // Level 2: Cosmic Creators
    if (levels.includes(2)) {
      console.log('[WorldGenerator] Level 2: Generating cosmic creators...');
      context.cosmicCreators = await this.cosmicGenerator.generate(context);
      console.log(`[WorldGenerator] Level 2 complete: ${context.cosmicCreators.length} cosmic creators`);
    }

    // Level 2.5: Geography
    if (levels.includes(2.5)) {
      console.log('[WorldGenerator] Level 2.5: Generating geography...');
      context.geography = await this.geographyGenerator.generate(context);
      console.log(`[WorldGenerator] Level 2.5 complete: ${context.geography.length} geography entries`);
    }

    // Level 5: Mortal Races (MUST come before Level 3: Conceptual Beings)
    // Conceptual beings are born from mortal worship, so mortals must exist first
    if (levels.includes(5)) {
      console.log('[WorldGenerator] Level 5: Generating mortal races...');
      context.mortalRaces = await this.mortalGenerator.generate(
        context,
        config.customRaces
      );
      console.log(`[WorldGenerator] Level 5 complete: ${context.mortalRaces.length} mortal races`);
    }

    // Level 3: Conceptual Beings (depends on mortal races existing)
    if (levels.includes(3)) {
      console.log('[WorldGenerator] Level 3: Generating conceptual beings...');
      context.conceptualBeings = await this.conceptualGenerator.generate(context);
      console.log(`[WorldGenerator] Level 3 complete: ${context.conceptualBeings.length} conceptual beings`);
    }

    // Level 4: Demi-Gods
    if (levels.includes(4)) {
      console.log('[WorldGenerator] Level 4: Generating demi-gods...');
      context.demiGods = await this.demiGodGenerator.generate(context);
      console.log(`[WorldGenerator] Level 4 complete: ${context.demiGods.length} demi-gods`);
    }

    // Level 6: Organizations
    if (levels.includes(6)) {
      console.log('[WorldGenerator] Level 6: Generating organizations...');
      context.organizations = await this.organizationGenerator.generate(
        context,
        config.organizationDensity || 'normal'
      );
      console.log(`[WorldGenerator] Level 6 complete: ${context.organizations.length} organizations`);
    }

    // Level 6.5: Standout Mortals
    if (levels.includes(6.5)) {
      console.log('[WorldGenerator] Level 6.5: Generating standout mortals...');
      context.standoutMortals = await this.standoutGenerator.generate(context);
      console.log(`[WorldGenerator] Level 6.5 complete: ${context.standoutMortals.length} standout mortals`);
    }

    // Level 7.5: Dungeons
    if (levels.includes(7.5)) {
      console.log('[WorldGenerator] Level 7.5: Generating dungeons...');
      context.dungeons = await this.dungeonGenerator.generate(context);
      console.log(`[WorldGenerator] Level 7.5 complete: ${context.dungeons.length} dungeons`);
    }
    
    console.log('[WorldGenerator] All levels complete!');
    console.log(`[WorldGenerator] Summary:`);
    console.log(`  - Primordials: ${context.primordials.length}`);
    console.log(`  - Cosmic Creators: ${context.cosmicCreators.length}`);
    console.log(`  - Geography: ${context.geography.length}`);
    console.log(`  - Mortal Races: ${context.mortalRaces.length}`);
    console.log(`  - Conceptual Beings: ${context.conceptualBeings.length}`);
    console.log(`  - Demi-Gods: ${context.demiGods.length}`);
    console.log(`  - Organizations: ${context.organizations.length}`);
    console.log(`  - Standout Mortals: ${context.standoutMortals.length}`);
    console.log(`  - Dungeons: ${context.dungeons.length}`);

    return {
      seed: config.seed,
      primordials: context.primordials,
      cosmicCreators: context.cosmicCreators,
      geography: context.geography,
      conceptualBeings: context.conceptualBeings,
      demiGods: context.demiGods,
      mortalRaces: context.mortalRaces,
      organizations: context.organizations,
      standoutMortals: context.standoutMortals,
      dungeons: context.dungeons,
      familyMembers: [],
      familyLineages: [],
      worldEvents: context.worldEvents, // Include world events in generated world
      generatedAt: new Date(),
    };
  }

  /**
   * Get primordials from generated world
   */
  async getPrimordialBeings(seed: string): Promise<any[]> {
    const world = await this.generateWorld({
      seed,
      includeLevels: [1],
      depth: 'minimal',
    });
    return world.primordials;
  }

  /**
   * Get geography by type
   */
  async getGeography(seed: string, type?: string): Promise<any[]> {
    const world = await this.generateWorld({
      seed,
      includeLevels: [2.5],
      depth: 'minimal',
    });
    if (type) {
      return world.geography.filter((g) => g.geographyType === type);
    }
    return world.geography;
  }

  /**
   * Get organizations by magnitude
   */
  async getOrganizations(seed: string, magnitude?: string): Promise<any[]> {
    const world = await this.generateWorld({
      seed,
      includeLevels: [6],
      depth: 'minimal',
    });
    if (magnitude) {
      return world.organizations.filter((o) => o.magnitude === magnitude);
    }
    return world.organizations;
  }
}

