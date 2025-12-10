/**
 * World Initialization Service
 * 
 * Handles one-time world generation on game deploy.
 * Generates world, lore, history, and initial dungeons.
 */

import { supabase } from '../supabase';
import { WorldGenerator } from '../../contributions/world-generation-system/code/generators/world-generator';
import { ThemedDungeonGenerator } from '../../contributions/themed-dungeon-generation/code/index';
import type { ThemedDungeon, DungeonWorldContext } from '../../contributions/themed-dungeon-generation/code/types/dungeon-generation';

const WORLD_SEED = process.env.WORLD_SEED || 'innkeeper-world-v1';

/**
 * Check if world is already initialized
 */
export async function isWorldInitialized(): Promise<boolean> {
  try {
    // PRIMARY check: Must have world_content entry with type='world'
    const { data: worldContent, error: worldError } = await supabase
      .from('world_content')
      .select('id')
      .eq('type', 'world')
      .limit(1);

    if (worldError && worldError.code !== 'PGRST116') {
      console.error('Error checking world initialization:', worldError);
      return false;
    }

    // World is only initialized if we have a world_content entry
    // Having dungeons alone is not enough - we need the world entry
    if (worldContent && worldContent.length > 0) {
      return true;
    }

    // If no world_content entry, check if we have multiple dungeons (indicating full initialization)
    // Single dungeon might be old/test data
    const { data: dungeons, error: dungeonError } = await supabase
      .from('dungeons')
      .select('id')
      .limit(10);

    if (dungeonError && dungeonError.code !== 'PGRST116') {
      console.error('Error checking dungeons:', dungeonError);
      return false;
    }

    // Require at least 3 dungeons to consider initialized (single dungeon is likely old data)
    return (dungeons && dungeons.length >= 3) || false;
  } catch (error) {
    console.error('Error checking world initialization:', error);
    return false;
  }
}

/**
 * Initialize the world - generates world content and initial dungeons
 */
export async function initializeWorld(): Promise<void> {
  console.log('🌍 Starting world initialization...');

  // Check if already initialized
  const initialized = await isWorldInitialized();
  if (initialized) {
    console.log('✅ World already initialized, skipping...');
    return;
  }

  try {
    // Step 1: Generate world using WorldGenerator
    // NOTE: The world generator now handles dependency order correctly
    // (Mortal races are generated before conceptual beings)
    console.log('📦 Generating world content...');
    const worldGenerator = new WorldGenerator();
    
    // Generate with progress logging and timeout protection
    const startTime = Date.now();
    console.log('   Starting world generation with seed:', WORLD_SEED);
    
    // Add timeout wrapper (5 minutes max - should be plenty for world generation)
    const generationPromise = worldGenerator.generateWorld({
      seed: WORLD_SEED,
      includeLevels: [1, 2, 2.5, 3, 4, 5, 6, 6.5, 7.5], // All levels including dungeons
      depth: 'full',
      organizationDensity: 'normal', // Match the HTML tool's default 'normal' density
    });
    
    const timeoutPromise = new Promise((_, reject) => {
      setTimeout(() => reject(new Error('World generation timed out after 5 minutes')), 5 * 60 * 1000);
    });
    
    const generatedWorld = await Promise.race([generationPromise, timeoutPromise]) as Awaited<typeof generationPromise>;
    const generationTime = ((Date.now() - startTime) / 1000).toFixed(2);

    console.log(`✅ Generated world in ${generationTime}s`);
    console.log(`   - ${generatedWorld.primordials.length} primordials`);
    console.log(`   - ${generatedWorld.cosmicCreators.length} cosmic creators`);
    console.log(`   - ${generatedWorld.geography.length} geography entries`);
    console.log(`   - ${generatedWorld.mortalRaces.length} mortal races`);
    console.log(`   - ${generatedWorld.conceptualBeings.length} conceptual beings`);
    console.log(`   - ${generatedWorld.demiGods.length} demi-gods`);
    console.log(`   - ${generatedWorld.organizations.length} organizations`);
    console.log(`   - ${generatedWorld.standoutMortals.length} standout mortals`);
    console.log(`   - ${generatedWorld.dungeons.length} dungeons (from world generator)`);
    
    // Warn if dungeon count seems low (HTML tool typically generates 20+)
    if (generatedWorld.dungeons.length < 5) {
      console.warn(`   ⚠️  Low dungeon count (${generatedWorld.dungeons.length}). Expected 20+ with normal density.`);
      console.warn(`      This might indicate incomplete generation or filtering issues.`);
    }

    // Step 2: Store world content in database
    console.log('💾 Storing world content in database...');
    const worldContentId = `world-${WORLD_SEED}`;
    const { error: worldContentError } = await supabase
      .from('world_content')
      .upsert({
        id: worldContentId,
        type: 'world',
        name: 'TavernKeeper World',
        description: 'The world of TavernKeeper, generated from cosmic forces down to individual mortals.',
        parent_id: null,
        created_at: new Date().toISOString(),
        discovered_at: new Date().toISOString(),
        metadata: {
          seed: WORLD_SEED,
          primordials: generatedWorld.primordials.length,
          cosmicCreators: generatedWorld.cosmicCreators.length,
          geography: generatedWorld.geography.length,
          conceptualBeings: generatedWorld.conceptualBeings.length,
          demiGods: generatedWorld.demiGods.length,
          mortalRaces: generatedWorld.mortalRaces.length,
          organizations: generatedWorld.organizations.length,
          standoutMortals: generatedWorld.standoutMortals.length,
          dungeons: generatedWorld.dungeons.length,
        },
      }, {
        onConflict: 'id',
      });

    if (worldContentError) {
      console.error('❌ Error storing world content:', worldContentError);
      throw worldContentError;
    }
    console.log('✅ World content stored');

    // Step 3: Generate themed dungeons from world dungeons
    console.log(`🏰 Generating ${generatedWorld.dungeons.length} themed dungeons...`);
    const themedDungeonGenerator = new ThemedDungeonGenerator();
    let dungeonIndex = 0;
    const dungeonPromises = generatedWorld.dungeons.map(async (worldDungeon) => {
      dungeonIndex++;
      console.log(`   [${dungeonIndex}/${generatedWorld.dungeons.length}] Generating dungeon: ${worldDungeon.name || worldDungeon.id}...`);
      // Create world context for dungeon generation
      const worldContext: DungeonWorldContext = {
        locationId: worldDungeon.locationId,
        standoutMortals: generatedWorld.standoutMortals
          .filter(m => m.isBoss && m.location === worldDungeon.locationId)
          .map(m => ({
            id: m.id,
            name: m.name,
            standoutType: m.standoutType,
            location: m.location,
            race: m.race,
            organization: m.organization,
            powers: m.powers,
            level: m.level,
            age: m.age,
            alignment: m.alignment,
            isBoss: m.isBoss,
            parentId: m.parentId,
            createdAt: m.createdAt,
            description: m.description,
            metadata: m.metadata,
          })),
        demiGods: generatedWorld.demiGods
          .filter(d => d.isBoss && d.alignment === 'evil')
          .map(d => ({
            id: d.id,
            name: d.name,
            demiGodType: d.demiGodType,
            origin: d.origin,
            powers: d.powers,
            age: d.age,
            alignment: d.alignment,
            isBoss: d.isBoss,
            parentId: d.parentId,
            createdAt: d.createdAt,
            description: d.description,
            metadata: d.metadata,
            halfGodRace: d.halfGodRace,
            ancientCreatureType: d.ancientCreatureType,
            divineExperimentFeatures: d.divineExperimentFeatures,
            fallenDivineType: d.fallenDivineType,
            primordialSpawnType: d.primordialSpawnType,
          })),
        worldEvents: generatedWorld.worldEvents || [],
      };

      // Generate themed dungeon
      const dungeonSeed = worldDungeon.seed || `${WORLD_SEED}-dungeon-${worldDungeon.id}`;
      const themedDungeon = await themedDungeonGenerator.generate({
        seed: dungeonSeed,
        depth: worldDungeon.depth || 100,
        worldContext,
        worldContentId: worldDungeon.id,
      });

      // Store dungeon in database
      const { error: dungeonError } = await supabase
        .from('dungeons')
        .upsert({
          seed: dungeonSeed,
          map: {
            id: themedDungeon.id,
            name: themedDungeon.name,
            depth: themedDungeon.depth,
            theme: themedDungeon.theme,
            finalBoss: themedDungeon.finalBoss,
            midBosses: themedDungeon.midBosses,
            levelLayout: themedDungeon.levelLayout,
            provenance: themedDungeon.provenance,
          },
          updated_at: new Date().toISOString(),
        }, {
          onConflict: 'seed',
        });

      if (dungeonError) {
        console.error(`❌ Error storing dungeon ${dungeonSeed}:`, dungeonError);
        throw dungeonError;
      }

      console.log(`   ✅ Stored dungeon: ${themedDungeon.name}`);
      return themedDungeon;
    });

    const themedDungeons = await Promise.all(dungeonPromises);
    console.log(`✅ Generated and stored ${themedDungeons.length} themed dungeons`);

    console.log('✅ World initialization complete!');
  } catch (error) {
    console.error('❌ Error initializing world:', error);
    throw error;
  }
}

/**
 * Initialize world on startup if not already initialized
 * This should be called from workers/index.ts
 * 
 * This is a non-fatal initialization - if it fails, workers will still start
 * and world can be initialized manually via the API endpoint.
 */
export async function initializeWorldOnStartup(): Promise<void> {
  console.log('[WORKER] Checking if world needs initialization...');
  try {
    // Check first to avoid unnecessary work
    const initialized = await isWorldInitialized();
    if (initialized) {
      console.log('[WORKER] ✅ World already initialized, skipping generation');
      return;
    }

    console.log('[WORKER] World not initialized, starting generation...');
    await initializeWorld();
    console.log('[WORKER] ✅ World initialization completed successfully');
  } catch (error) {
    console.error('[WORKER] ❌ Failed to initialize world on startup:', error);
    console.error('[WORKER]    This is non-fatal - workers will continue running');
    console.error('[WORKER]    You can manually initialize via: POST /api/world/initialize');
    // Don't throw - allow workers to start even if world init fails
    // World can be initialized manually via API endpoint
  }
}

