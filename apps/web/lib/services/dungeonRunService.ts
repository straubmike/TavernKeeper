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

const HERO_CONTRACT_ADDRESS = process.env.NEXT_PUBLIC_HERO_CONTRACT_ADDRESS || '0x0000000000000000000000000000000000000000';
const CHAIN_ID = parseInt(process.env.NEXT_PUBLIC_CHAIN_ID || '143', 10);

/**
 * Wrap a promise with a timeout
 */
function withTimeout<T>(promise: Promise<T>, timeoutMs: number, operationName: string): Promise<T> {
  return Promise.race([
    promise,
    new Promise<T>((_, reject) => {
      setTimeout(() => {
        reject(new Error(`${operationName} timed out after ${timeoutMs}ms`));
      }, timeoutMs);
    }),
  ]);
}

const DB_OPERATION_TIMEOUT = 30 * 1000; // 30 seconds

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
  const events: DungeonRunResult['events'] = [];
  const runStartTime = Date.now();
  
  // Store runId for logging context
  const loggingContext = { runId };
  
  console.log(`[DungeonRun] Starting dungeon run ${runId} for dungeon ${dungeonId} with ${party.length} party members`);
  
  try {
    // 1. Load dungeon from database
    console.log(`[DungeonRun] Loading dungeon data from database...`);
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
    console.log(`[DungeonRun] Dungeon loaded: ${dungeonMap.name || 'Unknown'}, depth: ${dungeonMap.depth || 100}, seed: ${dungeonSeed}`);

    // 2. Initialize dungeon generator and get structure
    const dungeonGenerator = new ThemedDungeonGenerator();
    // Reconstruct dungeon from stored data
    const dungeon: ThemedDungeon = {
      id: dungeonMap.id || dungeonId,
      name: dungeonMap.name || 'Unknown Dungeon',
      depth: dungeonMap.depth || 100,
      theme: dungeonMap.theme || { id: 'unknown', name: 'Unknown' },
      finalBoss: dungeonMap.finalBoss,
      midBosses: dungeonMap.midBosses || [],
      levelLayout: dungeonMap.levelLayout || [],
      provenance: dungeonMap.provenance,
    };

    // 3. Load party members with stats and equipment
    console.log(`[DungeonRun] Loading ${party.length} party members...`);
    const partyLoadStartTime = Date.now();
    const partyMembers: AdventurerRecord[] = [];
    for (const tokenId of party) {
      const heroId: HeroIdentifier = {
        tokenId,
        contractAddress: HERO_CONTRACT_ADDRESS,
        chainId: CHAIN_ID,
      };

      const adventurer = await getAdventurer(heroId);
      if (!adventurer) {
        throw new Error(`Adventurer not found for hero ${tokenId}`);
      }

      // Load equipped items and apply equipment bonuses
      try {
        const equippedItems = await getEquippedItems(heroId);
        
        // Apply equipment bonuses to adventurer stats
        let attackBonus = adventurer.stats.attackBonus || 0;
        let spellAttackBonus = adventurer.stats.spellAttackBonus || 0;
        let armorClass = adventurer.stats.armorClass || 10;

        // Apply weapon bonuses (mainHand)
        if (equippedItems.mainHand?.item_data) {
          const weapon = equippedItems.mainHand.item_data as any;
          if (weapon.attackModifier) {
            attackBonus += weapon.attackModifier;
          }
          // Note: damage modifiers are applied during combat resolution, not here
        }

        // Apply armor bonuses
        if (equippedItems.armor?.item_data) {
          const armor = equippedItems.armor.item_data as any;
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

      partyMembers.push(adventurer);
    }
    console.log(`[DungeonRun] Party loaded in ${Date.now() - partyLoadStartTime}ms: ${partyMembers.map(p => `${p.name} (L${p.level})`).join(', ')}`);

    // 4. Execute level-by-level
    let currentLevel = 1;
    let totalXP = 0;
    const maxLevel = Math.min(dungeon.depth, 100); // Cap at 100 levels for safety
    console.log(`[DungeonRun] Starting level-by-level execution (max ${maxLevel} levels)`);

    while (currentLevel <= maxLevel) {
      const levelStartTime = Date.now();
      console.log(`[DungeonRun] === Level ${currentLevel}/${maxLevel} ===`);
      
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
      console.log(`[DungeonRun] Party status: ${aliveMembers.length}/${partyMembers.length} alive`);

      // Generate room for this level
      // Rooms are stored in levelLayout, but we may need to generate on-demand if not present
      let room: GeneratedRoom;
      const roomGenStartTime = Date.now();
      try {
        room = dungeonGenerator.getRoomForLevel(dungeon, currentLevel);
        console.log(`[DungeonRun] Room loaded from levelLayout in ${Date.now() - roomGenStartTime}ms: ${room.room.name} (${room.room.type})`);
      } catch (error) {
        // Room not pre-generated, generate on-demand
        console.log(`[DungeonRun] Room not pre-generated, generating on-demand...`);
        try {
          const { RoomGenerator } = await import('../../contributions/themed-dungeon-generation/code/generators/room-generator');
          const roomGenerator = new RoomGenerator();
          const generatedRoom = roomGenerator.generateRoom({
            seed: `${dungeonSeed}-level-${currentLevel}`,
            level: currentLevel,
            dungeon,
          });
          room = generatedRoom;
          console.log(`[DungeonRun] Room generated in ${Date.now() - roomGenStartTime}ms: ${room.room.name} (${room.room.type})`);
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
      console.log(`[DungeonRun] Executing room: ${room.room.name} (${room.room.type})`);
      const roomExecStartTime = Date.now();
      let roomResult: RoomExecutionResult;
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
        console.log(`[DungeonRun] Room executed in ${roomExecDuration}ms: ${roomResult.events.length} events, ${roomResult.xpAwarded || 0} XP awarded`);

        // Safety check: warn if no events were generated
        if (roomResult.events.length === 0) {
          console.warn(`[DungeonRun] WARNING: Level ${currentLevel} room generated no events`);
        }

        events.push(...roomResult.events);
        totalXP += roomResult.xpAwarded || 0;
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

      // Update party stats
      if (roomResult.partyUpdates.length > 0) {
        console.log(`[DungeonRun] Updating ${roomResult.partyUpdates.length} party member stats...`);
        const updateStartTime = Date.now();
        for (const update of roomResult.partyUpdates) {
          const member = partyMembers.find(m => 
            m.heroId.tokenId === update.heroId.tokenId
          );
          if (member) {
            try {
              const updated = await withTimeout(
                updateAdventurerStats({
                  heroId: update.heroId,
                  updates: update.updates,
                  reason: update.reason,
                }),
                DB_OPERATION_TIMEOUT,
                `updateAdventurerStats(${update.heroId.tokenId})`
              );
              // Update in-place
              const index = partyMembers.indexOf(member);
              partyMembers[index] = updated;
            } catch (error) {
              console.error(`[DungeonRun] Error updating stats for hero ${update.heroId.tokenId}:`, error);
            }
          }
        }
        console.log(`[DungeonRun] Party stats updated in ${Date.now() - updateStartTime}ms`);
        
        // Check if all party members are dead after updating stats
        const aliveAfterUpdate = partyMembers.filter(m => m.stats.health > 0);
        if (aliveAfterUpdate.length === 0) {
          console.log(`[DungeonRun] All party members defeated after level ${currentLevel}. Ending run.`);
          // Break out of the level loop - run will be marked as defeat
          break;
        }
      }

      // Award XP
      if (roomResult.xpUpdates.length > 0) {
        console.log(`[DungeonRun] Awarding XP to ${roomResult.xpUpdates.length} party members...`);
        const xpStartTime = Date.now();
        for (const xpUpdate of roomResult.xpUpdates) {
          try {
            const result = await withTimeout(
              addXP(xpUpdate.heroId, xpUpdate.xp),
              DB_OPERATION_TIMEOUT,
              `addXP(${xpUpdate.heroId.tokenId})`
            );
            const member = partyMembers.find(m => 
              m.heroId.tokenId === xpUpdate.heroId.tokenId
            );
            if (member) {
              const index = partyMembers.indexOf(member);
              partyMembers[index] = result.adventurer;
            }
          } catch (error) {
            console.error(`[DungeonRun] Error awarding XP to hero ${xpUpdate.heroId.tokenId}:`, error);
          }
        }
        console.log(`[DungeonRun] XP awarded in ${Date.now() - xpStartTime}ms`);
      }

      const levelDuration = Date.now() - levelStartTime;
      console.log(`[DungeonRun] Level ${currentLevel} completed in ${levelDuration}ms (Total XP: ${totalXP})`);
      
      // Safety check: warn if level took too long
      if (levelDuration > levelTimeout) {
        console.warn(`[DungeonRun] WARNING: Level ${currentLevel} took ${levelDuration}ms (exceeded ${levelTimeout}ms threshold)`);
      }
      
      currentLevel++;
    }

    // 5. Persist key events to database
    console.log(`[DungeonRun] Persisting key events to database...`);
    try {
      const { persistAllKeyEventsForRun } = await import('./gameLoggingService');
      await persistAllKeyEventsForRun(runId);
      console.log(`[DungeonRun] Key events persisted`);
    } catch (persistError) {
      console.error(`[DungeonRun] Error persisting key events:`, persistError);
      // Don't fail the run if persistence fails
    }

    // 6. Schedule all events with sequential timestamps (6-second intervals)
    // All deterministic calculations are done, now schedule events for time-based delivery
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
        console.log(`[DungeonRun] ✅ Scheduled ${scheduledEvents.length} events in ${Date.now() - scheduleStartTime}ms`);
      } catch (scheduleError) {
        console.error(`[DungeonRun] ❌ Error scheduling events:`, scheduleError);
        // Don't fail the run if scheduling fails - events are still calculated
      }
    } else {
      console.warn(`[DungeonRun] ⚠️ No events to schedule!`);
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
    return {
      runId,
      status: 'error',
      levelsCompleted: 0,
      totalXP: 0,
      events: [{
        type: 'error',
        level: 0,
        roomType: 'combat',
        description: error instanceof Error ? error.message : 'Unknown error',
        timestamp: Date.now(),
      }],
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
              action: turn.action || 'attack',
              actorId: turn.actorId || 'unknown',
              targetId: turn.targetId,
              hit: turn.hit,
              damage: turn.damage,
              critical: turn.critical,
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
                health: partyEntity.currentHp || partyEntity.hp || 0,
                mana: partyEntity.currentMana || partyEntity.mana || 0,
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
                  health: partyEntity.currentHp || partyEntity.hp || 0,
                  mana: partyEntity.currentMana || partyEntity.mana || 0,
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
          action: trapResult.status === 'success' ? 'disarm_trap' : 'trigger_trap',
          actorId: 'party',
          success: trapResult.status === 'success',
          damage: trapResult.damageDealt || 0,
        } as any,
        { level, roomId: room.room.id },
        loggingContext
      );

      // Apply damage
      if (trapResult.damageDealt > 0) {
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

