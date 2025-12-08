/**
 * Combat System - Integration Helpers
 * 
 * Helper functions for integrating combat system with test data and other systems.
 * These utilities simplify setting up and running combat scenarios for testing.
 */

import type {
  CombatState,
  CombatResult,
  CombatConfig,
} from '../types/combat';
import type { AdventurerRecord } from '../../adventurer-tracking/code/types/adventurer-stats';
import type { MonsterInstance } from '../../monster-stat-blocks/code/types/monster-stats';
import {
  initializeCombat,
  runCombat,
} from '../services/combatService';

/**
 * Combat test data configuration
 */
export interface CombatTestData {
  partyMembers: AdventurerRecord[];
  monsters: MonsterInstance[];
  roomId: string;
  isAmbush?: boolean;
  config?: CombatConfig;
}

/**
 * Combat test result with formatted report
 */
export interface CombatTestResult {
  result: CombatResult;
  report: CombatReport;
}

/**
 * Formatted combat report
 */
export interface CombatReport {
  status: 'victory' | 'defeat';
  summary: string;
  duration: string;
  turns: number;
  partyStatus: {
    total: number;
    alive: number;
    defeated: number;
  };
  monsterStatus: {
    total: number;
    alive: number;
    defeated: number;
  };
  xpAwarded: number;
  turnDetails: Array<{
    turnNumber: number;
    entityName: string;
    actionType: string;
    targetName?: string;
    result: string;
  }>;
}

/**
 * Setup combat from test data - one-function combat initialization
 * 
 * This is a convenience function that initializes combat with test data,
 * making it easy to set up combat scenarios for testing.
 */
export function setupCombatFromTestData(data: CombatTestData): CombatState {
  return initializeCombat(
    data.partyMembers,
    data.monsters,
    data.roomId,
    data.isAmbush || false,
    data.config || {
      clericHealRatio: 0.3,
      mageMagicRatio: 0.7,
    }
  );
}

/**
 * Run combat with test data - complete combat test from start to finish
 * 
 * This function sets up combat and runs it to completion, returning
 * both the combat result and a formatted report.
 */
export async function runCombatWithTestData(
  data: CombatTestData
): Promise<CombatTestResult> {
  // Setup combat
  const combatState = setupCombatFromTestData(data);
  
  // Run combat to completion
  const config = data.config || {
    clericHealRatio: 0.3,
    mageMagicRatio: 0.7,
  };
  
  const result = await runCombat(combatState, config);
  
  // Create formatted report
  const report = createCombatReport(result, combatState);
  
  return {
    result,
    report,
  };
}

/**
 * Create formatted combat report from combat result
 * 
 * Formats combat results into a readable report structure suitable
 * for display in logs, UI, or test output.
 */
export function createCombatReport(
  result: CombatResult,
  initialState: CombatState
): CombatReport {
  const partyAlive = result.partyMembersAlive;
  const partyTotal = result.partyMembersTotal;
  const monstersAlive = result.monstersAlive;
  const monstersTotal = result.monstersTotal;
  
  // Format duration
  const durationMs = result.duration;
  const durationSeconds = Math.floor(durationMs / 1000);
  const durationMinutes = Math.floor(durationSeconds / 60);
  let duration: string;
  if (durationMinutes > 0) {
    duration = `${durationMinutes}m ${durationSeconds % 60}s`;
  } else {
    duration = `${durationSeconds}s`;
  }
  
  // Create summary
  let summary = `Combat ${result.status.toUpperCase()}`;
  summary += ` - ${result.totalTurns} turns`;
  summary += ` - Party: ${partyAlive}/${partyTotal} alive`;
  summary += ` - Monsters: ${monstersAlive}/${monstersTotal} remaining`;
  if (result.status === 'victory' && result.xpAwarded) {
    summary += ` - ${result.xpAwarded} XP awarded`;
  }
  
  // Create turn details
  const turnDetails = result.turns.map((turn, index) => {
    let resultText = '';
    
    if (turn.result && 'hit' in turn.result) {
      const attackResult = turn.result as any;
      if (attackResult.hit) {
        resultText = `Hit for ${attackResult.damage} damage`;
        if (attackResult.criticalHit) {
          resultText += ' (CRITICAL!)';
        }
      } else {
        resultText = 'Missed';
      }
    } else if (turn.result && 'amount' in turn.result) {
      const healResult = turn.result as any;
      resultText = `Healed ${healResult.amount} HP`;
    }
    
    const targetEntity = initialState.entities.find(
      e => e.id === turn.action.targetId
    );
    const targetName = targetEntity?.name || turn.action.targetId;
    
    return {
      turnNumber: turn.turnNumber,
      entityName: turn.entityName,
      actionType: turn.action.actionType,
      targetName: turn.action.actionType !== 'attack' && turn.action.actionType !== 'magic-attack' 
        ? targetName 
        : targetName,
      result: resultText,
    };
  });
  
  return {
    status: result.status,
    summary,
    duration,
    turns: result.totalTurns,
    partyStatus: {
      total: partyTotal,
      alive: partyAlive,
      defeated: partyTotal - partyAlive,
    },
    monsterStatus: {
      total: monstersTotal,
      alive: monstersAlive,
      defeated: monstersTotal - monstersAlive,
    },
    xpAwarded: result.xpAwarded || 0,
    turnDetails,
  };
}

/**
 * Quick combat test - simplified interface for rapid testing
 * 
 * Runs a complete combat scenario with minimal configuration.
 */
export async function quickCombatTest(
  partyMembers: AdventurerRecord[],
  monsters: MonsterInstance[],
  options?: {
    roomId?: string;
    isAmbush?: boolean;
    clericHealRatio?: number;
    mageMagicRatio?: number;
  }
): Promise<CombatTestResult> {
  return runCombatWithTestData({
    partyMembers,
    monsters,
    roomId: options?.roomId || `room-test-${Date.now()}`,
    isAmbush: options?.isAmbush || false,
    config: {
      clericHealRatio: options?.clericHealRatio ?? 0.3,
      mageMagicRatio: options?.mageMagicRatio ?? 0.7,
    },
  });
}