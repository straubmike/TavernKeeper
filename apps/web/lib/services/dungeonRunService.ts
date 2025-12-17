/**
 * Dungeon Run Service
 *
 * Orchestrates dungeon runs using all contribution systems.
 * Handles level-by-level generation, combat, traps, loot, and completion.
 */

import { supabase } from '../supabase';
import { ThemedDungeonGenerator } from '../../contributions/themed-dungeon-generation/code/index';
import type { ThemedDungeon, GeneratedRoom, RoomType } from '../../contributions/themed-dungeon-generation/code/types/dungeon-generation';
import { getAdventurer, getAdventurersByWallet, updateAdventurerStats, addXP, restoreAdventurer } from '../../contributions/adventurer-tracking/code/services/adventurerService';
import type { HeroIdentifier, AdventurerRecord } from '../../contributions/adventurer-tracking/code/types/adventurer-stats';
import { getEquippedItems, addItemToInventory } from '../../contributions/inventory-tracking/code/services/inventoryService';
import { initializeCombat, runCombat } from '../../contributions/combat-system/code/services/combatService';
import type { CombatResult } from '../../contributions/combat-system/code/types/combat';
import { resolveTrap } from '../../contributions/combat-system/code/services/trapService';
import type { TrapResolutionResult } from '../../contributions/combat-system/code/types/trap';
import { createMonsterInstanceByName, getMonsterStatBlock } from '../../contributions/monster-stat-blocks/code/services/monsterService';
import type { MonsterInstance } from '../../contributions/monster-stat-blocks/code/types/monster-stats';
import { ItemGenerator } from '../../contributions/procedural-item-generation/code/generators/item-generator';
import { scheduleEventsSequentially } from '../../contributions/timer-system/code/services/timerService';
import { logGameEvent, persistKeyEvent } from './gameLoggingService';
import { CONTRACT_ADDRESSES } from '../contracts/addresses';
import Redis from 'ioredis';

// Single source of truth for contract address resolution
function getValidatedHeroContractAddress(): string {
  const FALLBACK_ADDRESS = '0x4Fff2Ce5144989246186462337F0eE2C086F913E';

  let envAddress: string | undefined;
  try {
    envAddress = typeof process !== 'undefined' && process.env ? process.env.NEXT_PUBLIC_HERO_CONTRACT_ADDRESS : undefined;
  } catch (e) {
    // process.env might not be available in some contexts
  }

  let contractAddressesValue: string | undefined;
  try {
    if (typeof CONTRACT_ADDRESSES !== 'undefined' && CONTRACT_ADDRESSES && typeof CONTRACT_ADDRESSES.ADVENTURER !== 'undefined') {
      contractAddressesValue = CONTRACT_ADDRESSES.ADVENTURER;
    }
  } catch (e) {
    // CONTRACT_ADDRESSES might not be loaded yet
  }

  const address = envAddress || contractAddressesValue || FALLBACK_ADDRESS;

  // Validate address format
  if (!address || address === '0x0000000000000000000000000000000000000000' || !/^0x[a-fA-F0-9]{40}$/.test(address)) {
    console.warn('[DungeonRunService] Invalid contract address, using fallback');
    return FALLBACK_ADDRESS;
  }

  return address;
}

// Module-level: validate once at load time
const HERO_CONTRACT_ADDRESS = getValidatedHeroContractAddress();
const CHAIN_ID = parseInt(process.env.NEXT_PUBLIC_CHAIN_ID || '143', 10);

// Log initialization once (server-side only)
if (typeof window === 'undefined') {
  console.log(`[DungeonRunService] Module initialized - HERO_CONTRACT_ADDRESS: ${HERO_CONTRACT_ADDRESS}`);
}

/**
 * Wrap a promise with a timeout
 * Note: The original promise may continue running after timeout, but the result will be ignored.
 * Full cancellation would require AbortController support in underlying operations (Supabase, etc.)
 */
function withTimeout<T>(promise: Promise<T>, timeoutMs: number, operationName: string): Promise<T> {
  let timeoutId: NodeJS.Timeout | null = null;
  let isResolved = false;

  const timeoutPromise = new Promise<T>((_, reject) => {
    timeoutId = setTimeout(() => {
      if (!isResolved) {
        isResolved = true;
        reject(new Error(`${operationName} timed out after ${timeoutMs}ms`));
      }
    }, timeoutMs);
  });

  return Promise.race([
    promise.then(result => {
      if (!isResolved) {
        isResolved = true;
        if (timeoutId) clearTimeout(timeoutId);
        return result;
      }
      // Timeout already fired, ignore result
      throw new Error(`${operationName} was cancelled due to timeout`);
    }).catch(error => {
      if (!isResolved) {
        isResolved = true;
        if (timeoutId) clearTimeout(timeoutId);
        throw error;
      }
      // Timeout already fired, ignore error
      throw new Error(`${operationName} was cancelled due to timeout`);
    }),
    timeoutPromise
  ]);
}

const DB_OPERATION_TIMEOUT = 30 * 1000; // 30 seconds

// Redis connection for checkpointing (reuse queue connection if available, otherwise create new)
let redisClient: Redis | null = null;
function getRedisClient(): Redis | null {
  if (redisClient) return redisClient;

  try {
    const redisUrl = process.env.REDIS_URL || 'redis://localhost:6379';
    redisClient = new Redis(redisUrl, {
      maxRetriesPerRequest: null,
      retryStrategy: (times) => Math.min(times * 50, 2000),
    });
    return redisClient;
  } catch (error) {
    console.warn('[DungeonRun] Failed to create Redis client for checkpointing:', error);
    return null;
  }
}

// Checkpoint key prefix for Redis
function getCheckpointKey(runId: string): string {
  return `dungeon_run:checkpoint:${runId}`;
}

export interface DungeonRunResult {
  runId: string;
  status: 'victory' | 'defeat' | 'error';
  levelsCompleted: number;
  totalXP: number;
  events: Array<{
    type: string;
    level: number;
    roomType: RoomType;
    description: string;
    timestamp: number;
    combatTurns?: any[]; // Combat turn details for combat rooms
  }>;
  finalPartyStats: AdventurerRecord[];
}

/**
 * Execute a dungeon run
 */
export async function executeDungeonRun(
  runId: string,
  dungeonId: string,
  party: string[],
  seed: string,
  walletAddress: string
): Promise<DungeonRunResult> {
  // Use module-level validated address (single source of truth)
  const heroContractAddress = HERO_CONTRACT_ADDRESS;

  const events: DungeonRunResult['events'] = [];
  const runStartTime = Date.now();
  console.log(`[DungeonRun] Starting dungeon run ${runId} for dungeon ${dungeonId} with ${party.length} heroes`);
  console.log(`[DungeonRun] Using validated HERO_CONTRACT_ADDRESS: ${heroContractAddress}`);

  // Store runId for logging context
  const loggingContext = { runId };

  // Only log run start once
  console.log(`[DungeonRun] Starting run ${runId.substring(0, 8)}... (${party.length} heroes)`);

  try {
    // 1. Load dungeon from database
    // Removed frequent log
    const { data: dungeonData, error: dungeonError } = await supabase
      .from('dungeons')
      .select('*')
      .eq('id', dungeonId)
      .single();

    if (dungeonError || !dungeonData) {
      const errorMsg = `Dungeon ${dungeonId} not found in database. Make sure the dungeon has been generated.`;
      console.error(`[DungeonRun] ${errorMsg}`);
      console.error(`[DungeonRun] Dungeon error:`, dungeonError);
      throw new Error(errorMsg);
    }

    const dungeonMap = dungeonData.map as any;
    const dungeonSeed = dungeonData.seed || seed;
    // Removed frequent log - only log if needed for debugging

    // 2. Initialize dungeon generator and get structure
    const dungeonGenerator = new ThemedDungeonGenerator();
    // Reconstruct dungeon from stored data
    // Clear non-boss rooms from levelLayout - they should be generated on-demand with random seeds
    const cleanedLevelLayout = (dungeonMap.levelLayout || []).map((layout: any) => {
      // Only keep pre-generated rooms if they're boss rooms
      if (layout.boss && layout.room && (layout.room.type === 'boss' || layout.room.type === 'mid_boss')) {
        return layout; // Keep boss rooms
      }
      // Remove room from non-boss levels - will be generated on-demand
      return {
        level: layout.level,
        boss: layout.boss,
        room: undefined, // Clear non-boss rooms
        roomTemplate: layout.roomTemplate,
        metadata: layout.metadata,
      };
    });
    
    const dungeon: ThemedDungeon = {
      id: dungeonMap.id || dungeonId,
      name: dungeonMap.name || 'Unknown Dungeon',
      depth: dungeonMap.depth || 100,
      theme: dungeonMap.theme || { id: 'unknown', name: 'Unknown' },
      finalBoss: dungeonMap.finalBoss,
      midBosses: dungeonMap.midBosses || [],
      levelLayout: cleanedLevelLayout,
      provenance: dungeonMap.provenance,
      seed: dungeonSeed,
      metadata: dungeonMap.metadata || {},
    };

    // 3. Load party members with stats and equipment
    // Removed frequent log
    const partyLoadStartTime = Date.now();
    const partyMembers: AdventurerRecord[] = [];

    // Use the pre-validated contract address from function start
    for (const tokenId of party) {
      const heroId: HeroIdentifier = {
        tokenId,
        contractAddress: heroContractAddress, // Use pre-validated address
        chainId: CHAIN_ID,
      };

      let adventurer = await getAdventurer(heroId);
      if (!adventurer) {
        // Auto-initialize adventurer if not found
        // Only log initialization issues, not every hero load
        try {
          const { initializeAdventurerStats } = await import('./heroAdventurerInit');

          // Try to get wallet address from hero ownership table
          let walletForInit = walletAddress;
          if (!walletForInit) {
            try {
              const { data: ownership } = await supabase
                .from('hero_ownership')
                .select('owner_address')
                .eq('token_id', tokenId)
                .single();
              if (ownership?.owner_address) {
                walletForInit = ownership.owner_address;
              }
            } catch (e) {
              console.warn(`[DungeonRun] Could not get wallet address for hero ${tokenId}:`, e instanceof Error ? e.message : String(e));
            }
          }

          if (!walletForInit) {
            throw new Error(`Cannot initialize hero ${tokenId}: wallet address not available`);
          }

          adventurer = await initializeAdventurerStats(
            tokenId,
            heroContractAddress, // Use pre-validated address
            CHAIN_ID,
            walletForInit
          );
          // Removed frequent log
        } catch (initError) {
          const errorMsg = initError instanceof Error ? initError.message : String(initError);
          // Log the full error for debugging RLS issues
          if (initError instanceof Error && (initError.message.includes('row-level security') || initError.message.includes('RLS'))) {
            console.error(`[DungeonRun] RLS policy violation when initializing hero ${tokenId}.`);
            console.error(`[DungeonRun] Error details:`, initError);
            console.error(`[DungeonRun] Ensure SUPABASE_SERVICE_ROLE_KEY is set in environment variables.`);
            // Re-throw with clearer message
            throw new Error(`Row-level security policy violation: Cannot auto-initialize adventurer for hero ${tokenId}. The worker needs SUPABASE_SERVICE_ROLE_KEY to bypass RLS policies. Error: ${errorMsg}`);
          }
          console.error(`[DungeonRun] Failed to auto-initialize hero ${tokenId}:`, errorMsg);
          throw new Error(`Could not find or initialize adventurer for hero ${tokenId}: ${errorMsg}`);
        }
      }

      if (!adventurer) {
        throw new Error(`Adventurer initialization failed for hero ${tokenId}`);
      }

      // Load equipped items and apply equipment bonuses
      try {
        const equippedItems = await getEquippedItems(heroId);

        // Apply equipment bonuses to adventurer stats
        let attackBonus = adventurer.stats.attackBonus || 0;
        let spellAttackBonus = adventurer.stats.spellAttackBonus || 0;
        let armorClass = adventurer.stats.armorClass || 10;

        // Apply weapon bonuses (mainHand)
        if (equippedItems.mainHand) {
          const weapon = equippedItems.mainHand as any;
          if (weapon.attackModifier) {
            attackBonus += weapon.attackModifier;
          }
          // Note: damage modifiers are applied during combat resolution, not here
        }

        // Apply armor bonuses
        if (equippedItems.armor) {
          const armor = equippedItems.armor as any;
          if (armor.armorClass) {
            armorClass += armor.armorClass;
          }
          if (armor.attackModifier) {
            attackBonus += armor.attackModifier;
          }
          if (armor.spellAttackModifier) {
            spellAttackBonus += armor.spellAttackModifier;
          }
        }

        // Update adventurer stats with equipment bonuses
        adventurer.stats.attackBonus = attackBonus;
        adventurer.stats.spellAttackBonus = spellAttackBonus;
        adventurer.stats.armorClass = armorClass;
      } catch (error) {
        console.warn(`[DungeonRun] Failed to load equipment for hero ${tokenId}:`, error);
        // Continue without equipment bonuses if loading fails
      }

      // Reset HP to maxHealth for new run and persist immediately
      adventurer.stats.health = adventurer.stats.maxHealth;
      try {
        await updateAdventurerStats({
          heroId: adventurer.heroId,
          updates: { health: adventurer.stats.maxHealth },
          reason: 'run_start_reset'
        });
      } catch (error) {
        console.error(`[DungeonRun] Failed to reset HP for hero ${tokenId}:`, error);
        // Continue - HP is reset in memory, will be persisted at end
      }

      partyMembers.push(adventurer);
    }
    console.log(`[DungeonRun] Party loaded in ${Date.now() - partyLoadStartTime}ms: ${partyMembers.map(p => `${p.name} (L${p.level})`).join(', ')}`);

    // 4. Execute level-by-level (HP in memory, checkpoints to Redis, final write to Supabase)
    let currentLevel = 1;
    let totalXP = 0;
    const maxLevel = Math.min(dungeon.depth, 100); // Cap at 100 levels for safety
    console.log(`[DungeonRun] Starting level-by-level execution (max ${maxLevel} levels) - HP in memory, Redis checkpoints, Supabase at end`);

    // Accumulate all DB updates to batch at the end (for final Supabase write)
    const deferredStatUpdates: Array<{ heroId: HeroIdentifier; updates: Partial<AdventurerRecord['stats']>; reason: string }> = [];
    const deferredXPUpdates: Array<{ heroId: HeroIdentifier; xp: number }> = [];

    // Helper to save checkpoint to Redis
    async function saveCheckpoint() {
      const client = getRedisClient();
      if (!client) return; // Redis not available, skip checkpoint

      try {
        const checkpoint = {
          runId,
          level: currentLevel,
          partyStats: partyMembers.map(m => ({
            tokenId: m.heroId.tokenId,
            health: m.stats.health,
            maxHealth: m.stats.maxHealth,
            mana: m.stats.mana,
            maxMana: m.stats.maxMana,
          })),
          totalXP,
          timestamp: Date.now(),
        };

        await client.setex(
          getCheckpointKey(runId),
          3600, // Expire after 1 hour
          JSON.stringify(checkpoint)
        );
      } catch (error) {
        console.warn(`[DungeonRun] Failed to save checkpoint:`, error);
        // Non-fatal, continue
      }
    }

    while (currentLevel <= maxLevel) {
      const levelStartTime = Date.now();
      // Only log every 10 levels or on important levels (1, 5, 10, etc.)
      if (currentLevel === 1 || currentLevel % 10 === 0 || currentLevel === maxLevel) {
        console.log(`[DungeonRun] Level ${currentLevel}/${maxLevel}`);
      }

      // Safety check: warn if level processing is taking too long
      const levelTimeout = 60 * 1000; // 1 minute per level
      const levelTimeoutId = setTimeout(() => {
        console.warn(`[DungeonRun] WARNING: Level ${currentLevel} processing is taking longer than 1 minute`);
      }, levelTimeout);

      // Check if party is wiped
      const aliveMembers = partyMembers.filter(m => m.stats.health > 0);
      if (aliveMembers.length === 0) {
        clearTimeout(levelTimeoutId);
        console.log(`[DungeonRun] Party wiped at level ${currentLevel}`);
        events.push({
          type: 'party_wipe',
          level: currentLevel,
          roomType: 'combat',
          description: 'All party members have been defeated',
          timestamp: Date.now(),
        });
        break;
      }
      // Only log party status if members died or every 10 levels
      if (aliveMembers.length < partyMembers.length || currentLevel % 10 === 0) {
        console.log(`[DungeonRun] Level ${currentLevel}: ${aliveMembers.length}/${partyMembers.length} alive`);
      }

      // Generate room for this level
      // Rooms are stored in levelLayout, but we may need to generate on-demand if not present
      let room: GeneratedRoom;
      const roomGenStartTime = Date.now();
      try {
        room = dungeonGenerator.getRoomForLevel(dungeon, currentLevel);
        // Removed frequent room load log
      } catch (error) {
        // Room not pre-generated, generate on-demand
        // Removed frequent log
        try {
          const { RoomGenerator } = await import('../../contributions/themed-dungeon-generation/code/generators/room-generator');
          const roomGenerator = new RoomGenerator();
          const generatedRoom = roomGenerator.generateRoom({
            seed: `${dungeonSeed}-level-${currentLevel}`,
            level: currentLevel,
            dungeon,
          });
          room = generatedRoom;
          // Removed frequent log
        } catch (genError) {
          console.error(`[DungeonRun] Error generating room for level ${currentLevel}:`, genError);
          // Create a fallback empty room to continue
          events.push({
            type: 'error',
            level: currentLevel,
            roomType: 'combat',
            description: `Error generating room: ${genError instanceof Error ? genError.message : 'Unknown error'}`,
            timestamp: Date.now(),
          });
          clearTimeout(levelTimeoutId);
          currentLevel++;
          continue; // Skip to next level
        }
      }

      // Execute room based on type
      // Only log combat/boss rooms or every 5th room
      if (room.room.type === 'combat' || room.room.type === 'boss' || room.room.type === 'mid_boss' || currentLevel % 5 === 0) {
        console.log(`[DungeonRun] Level ${currentLevel}: ${room.room.type} room`);
      }
      const roomExecStartTime = Date.now();
      let roomResult: RoomExecutionResult;
      let partyDefeated = false;
      try {
        roomResult = await executeRoom(
          room,
          currentLevel,
          partyMembers,
          walletAddress,
          dungeonSeed,
          runId,
          loggingContext
        );
        const roomExecDuration = Date.now() - roomExecStartTime;
        // Only log if room took long or is important
        if (roomExecDuration > 1000 || room.room.type === 'boss' || room.room.type === 'mid_boss') {
          console.log(`[DungeonRun] Level ${currentLevel} ${room.room.type}: ${roomResult.events.length} events, ${roomResult.xpAwarded || 0} XP`);
        }

        // Safety check: warn if no events were generated
        if (roomResult.events.length === 0) {
          console.warn(`[DungeonRun] WARNING: Level ${currentLevel} room generated no events`);
        }

        events.push(...roomResult.events);
        totalXP += roomResult.xpAwarded || 0;

        // Check if combat resulted in defeat (before updating stats)
        const defeatEvent = roomResult.events.find(e => e.type === 'combat_defeat' || e.type === 'party_wipe');
        if (defeatEvent) {
          console.log(`[DungeonRun] Party defeated detected in room events at level ${currentLevel}. Will stop after processing this room.`);
          partyDefeated = true;
        }
      } catch (roomError) {
        console.error(`[DungeonRun] Error executing room at level ${currentLevel}:`, roomError);
        // Add error event and continue to next level
        events.push({
          type: 'error',
          level: currentLevel,
          roomType: room.room.type,
          description: `Error executing room: ${roomError instanceof Error ? roomError.message : 'Unknown error'}`,
          timestamp: Date.now(),
        });
        clearTimeout(levelTimeoutId);
        currentLevel++;
        continue; // Skip to next level
      }

      // Clear level timeout
      clearTimeout(levelTimeoutId);

      // Update party stats in memory (HP stays in memory, no Supabase write yet)
      if (roomResult.partyUpdates.length > 0) {
        for (const update of roomResult.partyUpdates) {
          const member = partyMembers.find(m =>
            m.heroId.tokenId === update.heroId.tokenId
          );
          if (member) {
            // Update in memory
            member.stats = { ...member.stats, ...update.updates };
            // Accumulate for final batch DB write at end
            deferredStatUpdates.push(update);
          }
        }

        // Check if all party members are dead after updating stats
        const aliveAfterUpdate = partyMembers.filter(m => m.stats.health > 0);
        if (aliveAfterUpdate.length === 0) {
          console.log(`[DungeonRun] All party members defeated after level ${currentLevel}. Ending run.`);
          partyDefeated = true;
        }
      }

      // Save checkpoint to Redis after each level (fast, temporary storage)
      await saveCheckpoint();

      // Stop immediately if party was defeated - don't process more levels
      if (partyDefeated) {
        console.log(`[DungeonRun] Stopping dungeon run early due to party defeat at level ${currentLevel}`);
        break;
      }

      // FAST MODE: Accumulate XP updates (defer DB writes)
      if (roomResult.xpUpdates.length > 0) {
        // Removed frequent log
        // Update XP in memory and accumulate for batch write
        for (const xpUpdate of roomResult.xpUpdates) {
          const member = partyMembers.find(m =>
            m.heroId.tokenId === xpUpdate.heroId.tokenId
          );
          if (member) {
            // Update XP in memory
            member.experience = (member.experience || 0) + xpUpdate.xp;
            // Accumulate for batch DB write later
            deferredXPUpdates.push(xpUpdate);
          }
        }
      }

      const levelDuration = Date.now() - levelStartTime;
      // Only log every 10 levels or if level took long
      if (currentLevel === 1 || currentLevel % 10 === 0 || levelDuration > 5000) {
        console.log(`[DungeonRun] Level ${currentLevel} done (${levelDuration}ms, ${totalXP} XP)`);
      }

      // Safety check: warn if level took too long
      if (levelDuration > levelTimeout) {
        console.warn(`[DungeonRun] WARNING: Level ${currentLevel} took ${levelDuration}ms (exceeded ${levelTimeout}ms threshold)`);
      }

      currentLevel++;
    }

    // 5. FAST MODE: Batch all DB operations now that simulation is complete
    console.log(`[DungeonRun] Simulation complete! Batch processing ${deferredStatUpdates.length} stat updates and ${deferredXPUpdates.length} XP awards...`);
    const batchStartTime = Date.now();

    // Batch update all hero stats
    if (deferredStatUpdates.length > 0) {
      console.log(`[DungeonRun] Batch updating ${deferredStatUpdates.length} hero stat updates...`);
      const updateStartTime = Date.now();
      // Group updates by hero to merge multiple updates
      const updatesByHero = new Map<string, { heroId: HeroIdentifier; updates: Partial<AdventurerRecord['stats']>; reason: string }>();
      for (const update of deferredStatUpdates) {
        const key = `${update.heroId.tokenId}-${update.heroId.contractAddress}`;
        const existing = updatesByHero.get(key);
        if (existing) {
          // Merge updates
          existing.updates = { ...existing.updates, ...update.updates };
        } else {
          updatesByHero.set(key, update);
        }
      }

      // Execute batched updates with proper error handling
      const updateResults = await Promise.allSettled(
        Array.from(updatesByHero.values()).map(update =>
          withTimeout(
            updateAdventurerStats({
              heroId: update.heroId,
              updates: update.updates,
              reason: update.reason,
            }),
            DB_OPERATION_TIMEOUT,
            `updateAdventurerStats(${update.heroId.tokenId})`
          )
        )
      );

      // Check results and log errors (don't swallow them)
      for (let i = 0; i < updateResults.length; i++) {
        const result = updateResults[i];
        if (result.status === 'rejected') {
          const update = Array.from(updatesByHero.values())[i];
          console.error(`[DungeonRun] Error updating stats for hero ${update.heroId.tokenId}:`, result.reason);
          // Continue - other updates may have succeeded
        }
      }
      console.log(`[DungeonRun] Batch stat updates completed in ${Date.now() - updateStartTime}ms`);
    }

    // Clean up Redis checkpoint on successful completion
    try {
      const client = getRedisClient();
      if (client) {
        await client.del(getCheckpointKey(runId));
      }
    } catch (error) {
      console.warn(`[DungeonRun] Failed to clean up checkpoint:`, error);
    }

    // Batch award all XP
    if (deferredXPUpdates.length > 0) {
      console.log(`[DungeonRun] Batch awarding XP to ${deferredXPUpdates.length} heroes...`);
      const xpStartTime = Date.now();
      // Group XP by hero to sum multiple awards
      const xpByHero = new Map<string, { heroId: HeroIdentifier; xp: number }>();
      for (const xpUpdate of deferredXPUpdates) {
        const key = `${xpUpdate.heroId.tokenId}-${xpUpdate.heroId.contractAddress}`;
        const existing = xpByHero.get(key);
        if (existing) {
          existing.xp += xpUpdate.xp;
        } else {
          xpByHero.set(key, { ...xpUpdate });
        }
      }

      // Execute batched XP awards with proper error handling
      const xpResults = await Promise.allSettled(
        Array.from(xpByHero.values()).map(xpUpdate =>
          withTimeout(
            addXP(xpUpdate.heroId, xpUpdate.xp),
            DB_OPERATION_TIMEOUT,
            `addXP(${xpUpdate.heroId.tokenId})`
          )
        )
      );

      // Check results and log errors (don't swallow them)
      for (let i = 0; i < xpResults.length; i++) {
        const result = xpResults[i];
        if (result.status === 'rejected') {
          const xpUpdate = Array.from(xpByHero.values())[i];
          console.error(`[DungeonRun] Error awarding XP to hero ${xpUpdate.heroId.tokenId}:`, result.reason);
          // Continue - other XP awards may have succeeded
        }
      }
      console.log(`[DungeonRun] Batch XP awards completed in ${Date.now() - xpStartTime}ms`);
    }

    console.log(`[DungeonRun] All batch DB operations completed in ${Date.now() - batchStartTime}ms`);

    // 6. Persist key events to database
    console.log(`[DungeonRun] Persisting key events to database...`);
    try {
      const { persistAllKeyEventsForRun } = await import('./gameLoggingService');
      await persistAllKeyEventsForRun(runId);
      console.log(`[DungeonRun] Key events persisted`);
    } catch (persistError) {
      console.error(`[DungeonRun] Error persisting key events:`, persistError);
      // Don't fail the run if persistence fails
    }

    // 7. Store all events at once with sequential timestamps (6-second intervals)
    // All deterministic calculations are done, now store events for time-based delivery
    const scheduleStartTime = Date.now();
    const startDeliveryTime = new Date(); // Start delivering events immediately

    if (events.length > 0) {
      try {
        const eventPayloads = events.map(event => ({
          runId,
          type: event.type,
          payload: {
            level: event.level,
            roomType: event.roomType,
            description: event.description,
            combatTurns: event.combatTurns,
            timestamp: event.timestamp,
          },
        }));

        const scheduledEvents = await scheduleEventsSequentially(
          eventPayloads,
          startDeliveryTime,
          { eventIntervalSeconds: 6 }
        );
        console.log(`[DungeonRun] ✅ Stored ${scheduledEvents.length} events with sequential delivery times in ${Date.now() - scheduleStartTime}ms`);
      } catch (scheduleError) {
        console.error(`[DungeonRun] ❌ Error storing events:`, scheduleError);
        // Don't fail the run if scheduling fails - events are still calculated
      }
    } else {
      console.warn(`[DungeonRun] ⚠️ No events to store!`);
    }

    // 7. Determine final status
    const aliveMembers = partyMembers.filter(m => m.stats.health > 0);
    const status: 'victory' | 'defeat' = aliveMembers.length > 0 ? 'victory' : 'defeat';
    const totalDuration = Date.now() - runStartTime;

    console.log(`[DungeonRun] Dungeon run ${runId} completed: ${status}, ${currentLevel - 1} levels, ${totalXP} XP, ${events.length} events in ${totalDuration}ms`);

    return {
      runId,
      status,
      levelsCompleted: currentLevel - 1,
      totalXP,
      events,
      finalPartyStats: partyMembers,
    };
  } catch (error) {
    const errorDuration = Date.now() - runStartTime;
    console.error(`[DungeonRun] Error executing dungeon run ${runId} after ${errorDuration}ms:`, error);
    if (error instanceof Error) {
      console.error(`[DungeonRun] Error message: ${error.message}`);
      console.error(`[DungeonRun] Error stack: ${error.stack}`);
    }

    const errorEvent = {
      type: 'error',
      level: 0,
      roomType: 'combat' as RoomType,
      description: error instanceof Error ? error.message : 'Unknown error',
      timestamp: Date.now(),
    };

    // Schedule error event to world_events so UI can display it
    try {
      const startDeliveryTime = new Date();
      await scheduleEventsSequentially(
        [{
          runId,
          type: 'error',
          payload: {
            level: errorEvent.level,
            roomType: errorEvent.roomType,
            description: errorEvent.description,
            timestamp: errorEvent.timestamp,
          },
        }],
        startDeliveryTime,
        { eventIntervalSeconds: 6 }
      );
      console.log(`[DungeonRun] ✅ Scheduled error event to world_events`);
    } catch (scheduleError) {
      console.error(`[DungeonRun] ❌ Error scheduling error event:`, scheduleError);
      // Continue - at least we tried
    }

    return {
      runId,
      status: 'error',
      levelsCompleted: 0,
      totalXP: 0,
      events: [errorEvent],
      finalPartyStats: [],
    };
  }
}

interface RoomExecutionResult {
  events: Array<{
    type: string;
    level: number;
    roomType: RoomType;
    description: string;
    timestamp: number;
    combatTurns?: any[];
  }>;
  xpAwarded: number;
  partyUpdates: Array<{
    heroId: HeroIdentifier;
    updates: Partial<AdventurerRecord['stats']>;
    reason: string;
  }>;
  xpUpdates: Array<{
    heroId: HeroIdentifier;
    xp: number;
  }>;
}

/**
 * Execute a single room
 */
async function executeRoom(
  room: GeneratedRoom,
  level: number,
  partyMembers: AdventurerRecord[],
  walletAddress: string,
  dungeonSeed: string,
  runId: string,
  loggingContext: { runId: string }
): Promise<RoomExecutionResult> {
  const events: RoomExecutionResult['events'] = [];
  const partyUpdates: RoomExecutionResult['partyUpdates'] = [];
  const xpUpdates: RoomExecutionResult['xpUpdates'] = [];
  let xpAwarded = 0;

  const roomType = room.room.type;
  const encounter = room.encounter;

  console.log(`[RoomExecution] Level ${level}: Executing ${roomType} room "${room.room.name}"`);

  const roomEnterEvent = {
    type: 'room_enter',
    level,
    roomType,
    description: `Entered ${room.room.name}: ${room.room.description}`,
    timestamp: Date.now(),
  };
  events.push(roomEnterEvent);

  // Log room entry event
  logGameEvent(
    {
      id: `event-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`,
      type: 'exploration',
      timestamp: Date.now(),
      action: 'enter_room',
      actorId: 'party',
      roomId: room.room.id,
    } as any,
    { level, roomId: room.room.id, partyMembers: partyMembers.map(p => p.heroId.tokenId) },
    loggingContext
  );

  switch (roomType) {
    case 'combat':
    case 'boss':
    case 'mid_boss': {
      // Combat encounter
      if (!encounter) {
        events.push({
          type: 'room_empty',
          level,
          roomType,
          description: 'Room appears empty',
          timestamp: Date.now(),
        });
        break;
      }

      // Get monsters for encounter
      const monsters: MonsterInstance[] = [];
      if (encounter.type === 'combat') {
        // Regular combat - generate monsters based on theme/difficulty
        const monsterCount = Math.min(encounter.difficulty || 1, 4); // Max 4 monsters
        for (let i = 0; i < monsterCount; i++) {
          // TODO: Get monster from theme - for now use placeholder
          const monster = createMonsterInstanceByName('Skeleton');
          if (monster) {
            monsters.push(monster);
          }
        }
      } else if (roomType === 'boss' || roomType === 'mid_boss') {
        // Boss encounter - use boss from dungeon
        // TODO: Convert boss to monster instance
      }

      if (monsters.length === 0) {
        events.push({
          type: 'combat_skipped',
          level,
          roomType,
          description: 'No monsters found',
          timestamp: Date.now(),
        });
        break;
      }

      // Initialize combat with seeded RNG for deterministic execution
      console.log(`[RoomExecution] Initializing combat with ${monsters.length} monster(s)...`);
      const combatInitStartTime = Date.now();
      const combatSeed = `${dungeonSeed}-combat-${level}`;
      const combatState = initializeCombat(
        partyMembers,
        monsters,
        `room-${level}`,
        false, // Not ambush
        {
          clericHealRatio: 0.3,
          mageMagicRatio: 0.7,
        },
        false, // Not surprise
        combatSeed // Pass seed for deterministic combat
      );
      console.log(`[RoomExecution] Combat initialized in ${Date.now() - combatInitStartTime}ms`);

      // Run combat with timeout (2 minutes)
      console.log(`[RoomExecution] Starting combat simulation (2 minute timeout)...`);
      const combatStartTime = Date.now();
      const COMBAT_TIMEOUT = 2 * 60 * 1000; // 2 minutes

      const combatResult: CombatResult = await withTimeout(
        runCombat(combatState, {
          clericHealRatio: 0.3,
          mageMagicRatio: 0.7,
        }),
        COMBAT_TIMEOUT,
        'runCombat'
      );
      const combatDuration = Date.now() - combatStartTime;
      console.log(`[RoomExecution] Combat completed in ${combatDuration}ms: ${combatResult.status}, ${combatResult.totalTurns} turns, ${combatResult.xpAwarded || 0} XP`);

      // Add combat result event with turn details
      const combatResultEvent = {
        type: combatResult.status === 'victory' ? 'combat_victory' : 'combat_defeat',
        level,
        roomType,
        description: combatResult.status === 'victory'
          ? `Defeated ${monsters.length} monster(s) - ${combatResult.totalTurns} turns, ${combatResult.xpAwarded || 0} XP`
          : 'Party was defeated',
        timestamp: Date.now(),
        combatTurns: combatResult.turns, // Include full turn details
      };
      events.push(combatResultEvent);

      // Log combat result event
      logGameEvent(
        {
          id: `event-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`,
          type: 'combat',
          timestamp: Date.now(),
          action: combatResult.status === 'victory' ? 'victory' : 'defeat',
          actorId: 'party',
          targetId: monsters.map(m => m.id).join(','),
        } as any,
        { level, roomId: room.room.id, turn: combatResult.totalTurns },
        loggingContext
      );

      // Log each combat turn
      if (combatResult.turns) {
        for (const turn of combatResult.turns) {
          logGameEvent(
            {
              id: `event-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`,
              type: 'combat',
              timestamp: Date.now(),
              action: turn.action?.actionType || 'attack',
              actorId: turn.entityName || 'unknown',
              targetId: turn.targetName,
              hit: turn.result && 'hit' in turn.result ? turn.result.hit : true,
              damage: turn.result && 'damage' in turn.result ? turn.result.damage : (turn.result && 'amount' in turn.result ? turn.result.amount : 0),
              critical: turn.result && 'criticalHit' in turn.result ? turn.result.criticalHit : false,
            } as any,
            { level, roomId: room.room.id, turn: turn.turnNumber },
            loggingContext
          );
        }
      }

      // Update party HP from finalState
      if (combatResult.finalState && combatResult.finalState.entities) {
        const updatedPartyEntities = combatResult.finalState.entities.filter(e => e.type === 'party');
        for (const partyEntity of updatedPartyEntities) {
          // Find the corresponding party member by ID
          const partyMember = partyMembers.find(p => p.heroId.tokenId === partyEntity.id);
          if (partyMember) {
            partyUpdates.push({
              heroId: partyMember.heroId,
              updates: {
                health: partyEntity.currentHp || 0,
                mana: partyEntity.mana || 0,
              },
              reason: 'combat',
            });
          }
        }
      }

      // Award XP on victory
      if (combatResult.status === 'victory' && combatResult.xpAwarded) {
        xpAwarded = combatResult.xpAwarded;
        const xpPerMember = Math.floor(xpAwarded / partyMembers.length);
        for (const member of partyMembers) {
          xpUpdates.push({
            heroId: member.heroId,
            xp: xpPerMember,
          });
        }
      }

      // If party was defeated, stop the run
      if (combatResult.status === 'defeat') {
        console.log(`[DungeonRun] Party defeated in combat at level ${level}. Ending run.`);
        // Update party members with final HP from combat
        if (combatResult.finalState && combatResult.finalState.entities) {
          const defeatedPartyEntities = combatResult.finalState.entities.filter(e => e.type === 'party');
          for (const partyEntity of defeatedPartyEntities) {
            const partyMember = partyMembers.find(p => p.heroId.tokenId === partyEntity.id);
            if (partyMember) {
              partyUpdates.push({
                heroId: partyMember.heroId,
                updates: {
                  health: partyEntity.currentHp || 0,
                  mana: partyEntity.mana || 0,
                },
                reason: 'combat_defeat',
              });
            }
          }
        }
        // Return early - the run will be marked as defeat
        return {
          events,
          xpAwarded,
          partyUpdates,
          xpUpdates,
        };
      }

      break;
    }

    case 'trap': {
      // Trap encounter
      if (!encounter || encounter.type !== 'trap') {
        break;
      }

      console.log(`[RoomExecution] Resolving trap encounter...`);
      const trapStartTime = Date.now();
      const trapSeed = `${dungeonSeed}-trap-${level}`;
      const trapResult: TrapResolutionResult = resolveTrap(
        encounter,
        `room-${level}`,
        level,
        partyMembers,
        undefined, // config
        trapSeed // seed for deterministic trap resolution
      );
      console.log(`[RoomExecution] Trap resolved in ${Date.now() - trapStartTime}ms: ${trapResult.status}, ${trapResult.damageDealt || 0} damage, ${trapResult.xpAwarded || 0} XP`);

      const trapEvent = {
        type: trapResult.status === 'success' ? 'trap_disarmed' : 'trap_triggered',
        level,
        roomType,
        description: trapResult.status === 'success'
          ? 'Trap was successfully disarmed'
          : `Trap triggered! ${trapResult.damageDealt} damage dealt`,
        timestamp: Date.now(),
      };
      events.push(trapEvent);

      // Log trap resolution event
      logGameEvent(
        {
          id: `event-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`,
          type: 'interaction',
          timestamp: Date.now(),
          interaction: 'trap',
          action: trapResult.status === 'success' ? 'disarm_trap' : 'trigger_trap',
          actorId: 'party',
          success: trapResult.status === 'success',
          damage: trapResult.damageDealt || 0,
        } as any,
        { level, roomId: room.room.id },
        loggingContext
      );

      // Apply damage
      if (trapResult.totalDamage > 0) {
        for (const member of trapResult.updatedPartyMembers) {
          partyUpdates.push({
            heroId: member.heroId,
            updates: {
              health: member.stats.health,
            },
            reason: 'trap_damage',
          });
        }
      }

      // Award XP
      if (trapResult.xpAwarded) {
        xpAwarded = trapResult.xpAwarded;
        const xpPerMember = Math.floor(xpAwarded / partyMembers.length);
        for (const member of partyMembers) {
          xpUpdates.push({
            heroId: member.heroId,
            xp: xpPerMember,
          });
        }
      }

      break;
    }

    case 'treasure': {
      // Treasure room - generate loot
      console.log(`[RoomExecution] Generating treasure...`);
      const treasureStartTime = Date.now();
      const itemGenerator = new ItemGenerator(`${dungeonSeed}-treasure-${level}`);
      const loot = itemGenerator.generateItem({
        context: 'dungeon_loot',
        level,
        classPreference: 'any',
        rarityModifier: 100 + (level * 2), // Slightly better loot at deeper levels
      });
      console.log(`[RoomExecution] Treasure generated in ${Date.now() - treasureStartTime}ms: ${loot.name} (${loot.rarity})`);

      // Add to inventory
      console.log(`[RoomExecution] Adding treasure to inventory...`);
      const inventoryStartTime = Date.now();
      await withTimeout(
        addItemToInventory(walletAddress, loot, 1, 'dungeon_loot'),
        DB_OPERATION_TIMEOUT,
        'addItemToInventory'
      );
      console.log(`[RoomExecution] Treasure added to inventory in ${Date.now() - inventoryStartTime}ms`);

      events.push({
        type: 'treasure_found',
        level,
        roomType,
        description: `Found ${loot.name} (${loot.rarity})`,
        timestamp: Date.now(),
      });

      break;
    }

    case 'safe': {
      // Safe room - restore HP/mana
      console.log(`[RoomExecution] Restoring party HP/mana in safe room...`);
      const restoreStartTime = Date.now();
      for (const member of partyMembers) {
        try {
          const restored = await withTimeout(
            restoreAdventurer(member.heroId, {
              restoreHealth: true,
              restoreMana: true,
            }),
            DB_OPERATION_TIMEOUT,
            `restoreAdventurer(${member.heroId.tokenId})`
          );
          partyUpdates.push({
            heroId: member.heroId,
            updates: {
              health: restored.stats.health,
              mana: restored.stats.mana,
            },
            reason: 'rest',
          });
        } catch (error) {
          console.error(`[RoomExecution] Error restoring adventurer ${member.heroId.tokenId}:`, error);
        }
      }
      console.log(`[RoomExecution] Party restored in ${Date.now() - restoreStartTime}ms`);

      events.push({
        type: 'rest',
        level,
        roomType,
        description: 'Party rested and recovered',
        timestamp: Date.now(),
      });

      break;
    }

    default:
      events.push({
        type: 'room_explored',
        level,
        roomType,
        description: 'Room explored',
        timestamp: Date.now(),
      });
  }

  return {
    events,
    xpAwarded,
    partyUpdates,
    xpUpdates,
  };
}

