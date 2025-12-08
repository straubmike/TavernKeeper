/**
 * Combat System - Master Generator Tool Helpers
 * 
 * Helper functions specifically designed for integration with the master-generator-tool.html.
 * These functions format combat data for HTML display and create visual representations.
 */

import type {
  CombatResult,
  CombatState,
  CombatTurn,
} from '../types/combat';
import type { AdventurerRecord } from '../../adventurer-tracking/code/types/adventurer-stats';
import type { MonsterInstance } from '../../monster-stat-blocks/code/types/monster-stats';
import type { CombatTestData, CombatTestResult, CombatReport } from './integration-helpers';
import {
  setupCombatFromTestData,
  runCombatWithTestData,
  createCombatReport,
} from './integration-helpers';

/**
 * HTML-formatted combat result
 */
export interface HTMLCombatResult {
  html: string;
  summary: string;
  turnCount: number;
  status: 'victory' | 'defeat';
}

/**
 * Combat visualization data
 */
export interface CombatVisualization {
  html: string;
  turns: Array<{
    turnNumber: number;
    html: string;
    entityName: string;
    action: string;
    result: string;
  }>;
  summary: {
    status: string;
    duration: string;
    xp: number;
    partyAlive: number;
    partyTotal: number;
    monstersAlive: number;
    monstersTotal: number;
  };
}

/**
 * Generate combat test scenario for master generator tool
 * 
 * Creates a complete combat test with party and monsters, ready to run.
 * This is the main entry point for the master generator tool.
 */
export async function generateCombatTest(
  partyMembers: AdventurerRecord[],
  monsters: MonsterInstance[],
  options?: {
    roomId?: string;
    isAmbush?: boolean;
    clericHealRatio?: number;
    mageMagicRatio?: number;
    predeterminedActions?: CombatTestData['config']['predeterminedActions'];
  }
): Promise<CombatTestResult> {
  const testData: CombatTestData = {
    partyMembers,
    monsters,
    roomId: options?.roomId || `combat-${Date.now()}`,
    isAmbush: options?.isAmbush || false,
    config: {
      clericHealRatio: options?.clericHealRatio ?? 0.3,
      mageMagicRatio: options?.mageMagicRatio ?? 0.7,
      predeterminedActions: options?.predeterminedActions,
    },
  };
  
  return runCombatWithTestData(testData);
}

/**
 * Format combat results for HTML display
 * 
 * Creates HTML-formatted output suitable for displaying in the master generator tool.
 * Returns both a formatted HTML string and summary information.
 */
export function formatCombatForDisplay(
  result: CombatResult,
  report: CombatReport,
  initialState: CombatState
): HTMLCombatResult {
  // Build HTML output
  let html = '<div class="combat-result">';
  
  // Status header
  const statusClass = result.status === 'victory' ? 'victory' : 'defeat';
  html += `<div class="combat-status ${statusClass}">`;
  html += `<h3>Combat ${result.status.toUpperCase()}</h3>`;
  html += '</div>';
  
  // Summary stats
  html += '<div class="combat-summary">';
  html += `<div class="stat"><strong>Turns:</strong> ${result.totalTurns}</div>`;
  html += `<div class="stat"><strong>Duration:</strong> ${report.duration}</div>`;
  html += `<div class="stat"><strong>Party:</strong> ${report.partyStatus.alive}/${report.partyStatus.total} alive</div>`;
  html += `<div class="stat"><strong>Monsters:</strong> ${report.monsterStatus.alive}/${report.monsterStatus.total} remaining</div>`;
  if (result.status === 'victory' && result.xpAwarded) {
    html += `<div class="stat"><strong>XP Awarded:</strong> ${result.xpAwarded}</div>`;
  }
  html += '</div>';
  
  // Turn-by-turn log
  html += '<div class="combat-log">';
  html += '<h4>Combat Log</h4>';
  html += '<div class="turn-list">';
  
  result.turns.forEach((turn) => {
    html += formatTurnForHTML(turn, initialState);
  });
  
  html += '</div>';
  html += '</div>';
  
  html += '</div>';
  
  // Create summary text
  let summary = report.summary;
  
  return {
    html,
    summary,
    turnCount: result.totalTurns,
    status: result.status,
  };
}

/**
 * Format a single turn for HTML display
 */
function formatTurnForHTML(turn: CombatTurn, initialState: CombatState): string {
  let html = `<div class="turn turn-${turn.turnNumber}">`;
  html += `<span class="turn-number">Turn ${turn.turnNumber}:</span>`;
  html += `<span class="entity-name">${turn.entityName}</span>`;
  
  const targetEntity = initialState.entities.find(e => e.id === turn.action.targetId);
  const targetName = targetEntity?.name || turn.action.targetId;
  
  // Format action
  let actionText = '';
  if (turn.action.actionType === 'attack') {
    actionText = `attacks <span class="target-name">${targetName}</span>`;
  } else if (turn.action.actionType === 'heal') {
    actionText = `heals <span class="target-name">${targetName}</span>`;
  } else if (turn.action.actionType === 'magic-attack') {
    actionText = `casts magic at <span class="target-name">${targetName}</span>`;
  }
  
  html += `<span class="action">${actionText}</span>`;
  
  // Format result
  let resultClass = 'result-neutral';
  let resultText = '';
  
  if (turn.result && 'hit' in turn.result) {
    const attackResult = turn.result as any;
    if (attackResult.hit) {
      resultClass = 'result-hit';
      resultText = `Hit for ${attackResult.damage} damage`;
      if (attackResult.criticalHit) {
        resultText += ' <span class="critical">(CRITICAL!)</span>';
      }
    } else {
      resultClass = 'result-miss';
      resultText = 'Missed (AC ' + attackResult.targetAC + ')';
    }
  } else if (turn.result && 'amount' in turn.result) {
    const healResult = turn.result as any;
    resultClass = 'result-heal';
    resultText = `Healed ${healResult.amount} HP (${healResult.targetNewHp}/${healResult.targetMaxHp})`;
  }
  
  html += `<span class="result ${resultClass}">${resultText}</span>`;
  html += '</div>';
  
  return html;
}

/**
 * Create visual combat log for master generator tool
 * 
 * Generates a complete HTML visualization of the combat with turn-by-turn details,
 * formatted for display in the master generator tool interface.
 */
export function createCombatVisualization(
  result: CombatResult,
  report: CombatReport,
  initialState: CombatState
): CombatVisualization {
  // Format full HTML
  const htmlResult = formatCombatForDisplay(result, report, initialState);
  
  // Create turn-by-turn visualization
  const turns = result.turns.map((turn) => {
    const targetEntity = initialState.entities.find(e => e.id === turn.action.targetId);
    const targetName = targetEntity?.name || turn.action.targetId;
    
    let action = '';
    if (turn.action.actionType === 'attack') {
      action = `attacks ${targetName}`;
    } else if (turn.action.actionType === 'heal') {
      action = `heals ${targetName}`;
    } else if (turn.action.actionType === 'magic-attack') {
      action = `casts magic at ${targetName}`;
    }
    
    let resultText = '';
    if (turn.result && 'hit' in turn.result) {
      const attackResult = turn.result as any;
      if (attackResult.hit) {
        resultText = `Hit for ${attackResult.damage} damage`;
        if (attackResult.criticalHit) {
          resultText += ' (CRITICAL!)';
        }
      } else {
        resultText = `Missed (AC ${attackResult.targetAC})`;
      }
    } else if (turn.result && 'amount' in turn.result) {
      const healResult = turn.result as any;
      resultText = `Healed ${healResult.amount} HP`;
    }
    
    return {
      turnNumber: turn.turnNumber,
      html: formatTurnForHTML(turn, initialState),
      entityName: turn.entityName,
      action,
      result: resultText,
    };
  });
  
  // Create summary
  const summary = {
    status: result.status.toUpperCase(),
    duration: report.duration,
    xp: result.xpAwarded || 0,
    partyAlive: report.partyStatus.alive,
    partyTotal: report.partyStatus.total,
    monstersAlive: report.monsterStatus.alive,
    monstersTotal: report.monsterStatus.total,
  };
  
  return {
    html: htmlResult.html,
    turns,
    summary,
  };
}

/**
 * Generate simple combat test for quick testing in master generator
 * 
 * Simplified function that takes minimal parameters and generates a complete combat test.
 */
export async function generateSimpleCombatTest(
  partySize: number,
  monsterCount: number,
  options?: {
    partyLevel?: number;
    monsterCR?: number;
    isAmbush?: boolean;
  }
): Promise<{
  testResult: CombatTestResult;
  visualization: CombatVisualization;
  htmlDisplay: HTMLCombatResult;
} | null> {
  // Note: This function would need test data generators from other systems
  // For now, it's a placeholder that shows the expected interface
  // In a real implementation, this would call test-helpers from:
  // - adventurer-tracking/code/utils/test-helpers.ts (createTestAdventurer, createTestParty)
  // - monster-stat-blocks/code/utils/test-helpers.ts (createMonsterEncounter)
  
  // This is a placeholder - actual implementation would generate test data
  throw new Error(
    'generateSimpleCombatTest requires test-helpers from adventurer-tracking and monster-stat-blocks. ' +
    'Please use generateCombatTest with pre-generated party members and monsters.'
  );
}

/**
 * Format combat state for JSON export (for master generator tool)
 * 
 * Creates a JSON-serializable representation of combat state and results
 * for saving/exporting from the master generator tool.
 */
export function exportCombatToJSON(
  result: CombatResult,
  initialState: CombatState
): string {
  const exportData = {
    combatId: result.combatId,
    status: result.status,
    totalTurns: result.totalTurns,
    partyMembersTotal: result.partyMembersTotal,
    partyMembersAlive: result.partyMembersAlive,
    monstersTotal: result.monstersTotal,
    monstersAlive: result.monstersAlive,
    xpAwarded: result.xpAwarded,
    duration: result.duration,
    roomId: initialState.roomId,
    isAmbush: initialState.isAmbush,
    turns: result.turns.map((turn) => ({
      turnNumber: turn.turnNumber,
      entityName: turn.entityName,
      actionType: turn.action.actionType,
      targetId: turn.action.targetId,
      weaponName: turn.action.weapon.name,
      result: turn.result,
    })),
    entities: initialState.entities.map((entity) => ({
      id: entity.id,
      name: entity.name,
      type: entity.type,
      class: entity.class,
      maxHp: entity.maxHp,
      ac: entity.ac,
    })),
  };
  
  return JSON.stringify(exportData, null, 2);
}