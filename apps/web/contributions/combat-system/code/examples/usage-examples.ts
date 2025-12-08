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