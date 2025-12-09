/**
 * Combat System - Usage Examples
 * 
 * Examples showing how to use the combat system.
 */

import type { CombatConfig } from '../types/combat';
import {
  initializeCombat,
  runCombat,
  createCombatEntityFromAdventurer,
  createCombatEntityFromMonster,
  executeTurn,
  checkCombatStatus,
  executeAmbushRound,
} from '../services/combatService';
import {
  resolveTrap,
  calculateTrapDC,
  calculateTrapDamage,
  checkAmbushPerception,
} from '../services/trapService';
import type { TrapResolutionConfig } from '../types/trap';
import type { RoomEncounter } from '../../themed-dungeon-generation/code/types/dungeon-generation';
import type { AdventurerRecord } from '../../adventurer-tracking/code/types/adventurer-stats';
import type { MonsterInstance } from '../../monster-stat-blocks/code/types/monster-stats';
import { createMonsterInstance } from '../../monster-stat-blocks/code/services/monsterService';

/**
 * Example 1: Basic combat encounter
 */
export async function exampleBasicCombat() {
  // Assume you have party members and monsters
  const partyMembers: AdventurerRecord[] = [
    // ... your party members
  ];
  
  const monsters: MonsterInstance[] = [
    // ... your monsters
  ];

  // Initialize combat
  const combatState = initializeCombat(
    partyMembers,
    monsters,
    'room-123',
    false, // Not an ambush
    {
      clericHealRatio: 0.3, // Clerics heal 30% of the time
      mageMagicRatio: 0.7,  // Mages use magic 70% of the time
    }
  );

  // Run combat to completion
  const result = await runCombat(combatState, {
    clericHealRatio: 0.3,
    mageMagicRatio: 0.7,
  });

  console.log(`Combat ${result.status}!`);
  console.log(`Turns: ${result.totalTurns}`);
  console.log(`XP Awarded: ${result.xpAwarded}`);
}

/**
 * Example 2: Ambush combat (monsters attack first)
 */
export async function exampleAmbushCombat() {
  const partyMembers: AdventurerRecord[] = [
    // ... your party members
  ];
  
  const monsters: MonsterInstance[] = [
    // ... your monsters
  ];

  // Initialize as ambush
  const combatState = initializeCombat(
    partyMembers,
    monsters,
    'room-456',
    true, // This is an ambush
    {
      clericHealRatio: 0.4,
      mageMagicRatio: 0.8,
    }
  );

  // Run combat (ambush round happens automatically)
  const result = await runCombat(combatState, {
    clericHealRatio: 0.4,
    mageMagicRatio: 0.8,
  });

  console.log(`Ambush combat ${result.status}!`);
}

/**
 * Example 3: Combat with predetermined actions (agent-controlled)
 */
export async function examplePredeterminedCombat() {
  const partyMembers: AdventurerRecord[] = [
    // ... your party members
  ];
  
  const monsters: MonsterInstance[] = [
    // ... your monsters
  ];

  const config: CombatConfig = {
    clericHealRatio: 0.0, // Ignored when using predetermined actions
    mageMagicRatio: 0.0,  // Ignored when using predetermined actions
    predeterminedActions: [
      {
        turnNumber: 0,
        entityId: 'party-1',
        actionType: 'attack',
        targetId: 'monster-1',
      },
      {
        turnNumber: 1,
        entityId: 'party-2',
        actionType: 'heal',
        targetId: 'party-1',
      },
      {
        turnNumber: 2,
        entityId: 'party-3',
        actionType: 'magic-attack',
        targetId: 'monster-1',
      },
      // ... more predetermined actions
    ],
  };

  const combatState = initializeCombat(
    partyMembers,
    monsters,
    'room-789',
    false,
    config
  );

  const result = await runCombat(combatState, config);
  console.log(`Predetermined combat ${result.status}!`);
}

/**
 * Example 4: Step-by-step combat (for real-time rendering)
 */
export async function exampleStepByStepCombat() {
  const partyMembers: AdventurerRecord[] = [
    // ... your party members
  ];
  
  const monsters: MonsterInstance[] = [
    // ... your monsters
  ];

  const combatState = initializeCombat(
    partyMembers,
    monsters,
    'room-abc',
    false,
    {
      clericHealRatio: 0.3,
      mageMagicRatio: 0.7,
    }
  );

  // Handle ambush if needed
  let state = combatState;
  if (state.isAmbush && !state.ambushCompleted) {
    state = executeAmbushRound(state, {
      clericHealRatio: 0.3,
      mageMagicRatio: 0.7,
    });
  }

  // Execute turns one by one
  
  while (state.status === 'active') {
    const { state: nextState, result } = await executeTurn(state, {
      clericHealRatio: 0.3,
      mageMagicRatio: 0.7,
    });
    
    state = nextState;
    state.status = checkCombatStatus(state);

    // Render/display the turn result
    console.log(`Turn ${state.turns.length}: ${result}`);
    
    // Wait for rendering/display time
    await new Promise(resolve => setTimeout(resolve, 1000));
  }

  console.log(`Combat ended: ${state.status}`);
}

/**
 * Example 5: Resolve a trap encounter
 */
export function exampleTrapResolution() {
  const partyMembers: AdventurerRecord[] = [
    // ... your party members
  ];

  // Create a trap encounter
  const trapEncounter: RoomEncounter = {
    id: 'trap-123',
    type: 'trap',
    name: 'Mechanical Trap',
    description: 'A room filled with mechanical traps',
    difficulty: 5,
    trapSubtype: 'mechanical',
    rewards: [
      {
        type: 'experience',
        amount: 150,
        description: '150 experience points',
      },
    ],
    metadata: {},
  };

  // Resolve the trap
  const result = resolveTrap(
    trapEncounter,
    'room-123',
    10, // Room level (affects DC)
    partyMembers
  );

  console.log(`Trap ${result.status}: ${result.message}`);
  console.log(`Detected: ${result.detected}, Disarmed: ${result.disarmed}`);
  console.log(`DC: ${result.difficultyClass}`);
  console.log(`Total Damage: ${result.totalDamage}`);
  console.log(`XP Awarded: ${result.xpAwarded}`);

  // Show perception check results
  result.perceptionChecks.forEach(check => {
    console.log(`${check.adventurerName}: ${check.roll} + ${check.modifier} + ${check.proficiencyBonus} = ${check.total} vs DC ${check.dc} (${check.success ? 'SUCCESS' : 'FAIL'})`);
  });

  // Show disarm check results (if detected)
  if (result.detected) {
    result.disarmChecks.forEach(check => {
      console.log(`${check.adventurerName}: ${check.roll} + ${check.modifier} + ${check.proficiencyBonus} = ${check.total} vs DC ${check.dc} (${check.success ? 'SUCCESS' : 'FAIL'})`);
    });
  }

  // Update party members with new HP
  result.updatedPartyMembers.forEach(updatedMember => {
    console.log(`${updatedMember.name}: HP ${updatedMember.stats.health}/${updatedMember.stats.maxHealth}`);
  });
}

/**
 * Example 6: Trap resolution with custom configuration
 */
export function exampleTrapResolutionWithConfig() {
  const partyMembers: AdventurerRecord[] = [
    // ... your party members
  ];

  const trapEncounter: RoomEncounter = {
    id: 'trap-456',
    type: 'trap',
    name: 'Magical Trap',
    description: 'A room filled with magical traps',
    difficulty: 8,
    trapSubtype: 'magical',
    rewards: [
      {
        type: 'experience',
        amount: 240,
        description: '240 experience points',
      },
      {
        type: 'lore',
        description: 'Knowledge gained from understanding the magic',
      },
    ],
    metadata: {},
  };

  const config: TrapResolutionConfig = {
    useBestRoll: true, // Any party member passing = success
    damageScalingFactor: 1.2, // 20% more damage
    puzzleTrapsDealDamage: false, // Puzzle traps don't deal damage
  };

  const result = resolveTrap(
    trapEncounter,
    'room-456',
    50, // Higher level = harder DC
    partyMembers,
    config
  );

  console.log(`Trap resolution: ${result.status}`);
  console.log(`DC: ${result.difficultyClass} (scaled with level 50)`);
}

/**
 * Example 7: Calculate trap DC and damage for different levels
 */
export function exampleTrapScaling() {
  // Show how DC and damage scale with dungeon level
  for (const level of [1, 10, 25, 50, 75, 99]) {
    const dc = calculateTrapDC(level);
    const damage = calculateTrapDamage(level, dc);
    
    console.log(`Level ${level}: DC ${dc}, Damage ~${damage}`);
  }
}

/**
 * Example 8: Check for ambush before combat
 */
export function exampleAmbushPerception() {
  const partyMembers: AdventurerRecord[] = [
    // ... your party members
  ];

  const roomLevel = 10; // Dungeon level

  // Check if party detects the ambush
  const perceptionResult = checkAmbushPerception(partyMembers, roomLevel);

  console.log(`Ambush detected: ${perceptionResult.detected}`);
  console.log(`DC: ${perceptionResult.checks[0]?.dc || 0}`);

  // Show perception check results
  perceptionResult.checks.forEach(check => {
    console.log(`${check.adventurerName}: ${check.roll} + modifiers = ${check.total} vs DC ${check.dc} (${check.success ? 'SUCCESS' : 'FAIL'})`);
  });

  // Initialize combat with appropriate flags
  const monsters: MonsterInstance[] = [
    // ... your monsters
  ];

  const combatState = initializeCombat(
    partyMembers,
    monsters,
    'room-10',
    !perceptionResult.detected, // isAmbush: true if NOT detected
    undefined,
    perceptionResult.detected // isSurprise: true if detected
  );

  // If detected, party gets surprise round (all party act first)
  // If not detected, monsters get ambush round (all monsters act first)
  console.log(`Combat initialized: isAmbush=${!perceptionResult.detected}, isSurprise=${perceptionResult.detected}`);
}
