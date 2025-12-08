/**
 * Combat Service
 * 
 * Main service for managing combat encounters.
 */

import type {
  CombatEntity,
  CombatState,
  CombatAction,
  CombatResult,
  CombatConfig,
  AttackResult,
  HealResult,
  Weapon,
} from '../types/combat';
import type { AdventurerRecord } from '../../adventurer-tracking/code/types/adventurer-stats';
import type { MonsterInstance } from '../../monster-stat-blocks/code/types/monster-stats';
import type { InventoryItem } from '../../inventory-tracking/code/types/inventory';
import { getEquippedItems } from '../../inventory-tracking/code/services/inventoryService';
import { determineTurnOrder, filterAliveEntities, getCurrentEntity } from '../engine/turn-order';
import { resolveAttack, applyDamage, applyHealing, rollDice } from '../engine/attack-resolution';

/**
 * Default weapons for each class (fallback when no weapon is equipped)
 * 
 * These are used as fallbacks when a party member doesn't have a weapon equipped
 * from their inventory. In normal gameplay, weapons should come from the inventory system.
 */
const DEFAULT_WEAPONS = {
  warrior: {
    name: 'Sword',
    type: 'melee-strength' as const,
    damageDice: '1d8',
    damageModifier: 0,
    attackModifier: 0,
  },
  rogue: {
    name: 'Dagger',
    type: 'melee-dexterity' as const,
    damageDice: '1d4',
    damageModifier: 0,
    attackModifier: 0,
  },
  cleric: {
    name: 'Mace',
    type: 'melee-strength' as const,
    damageDice: '1d6',
    damageModifier: 0,
    attackModifier: 0,
  },
  mage: {
    name: 'Staff',
    type: 'melee-strength' as const,
    damageDice: '1d4',
    damageModifier: 0,
    attackModifier: 0,
  },
};

/**
 * Convert inventory item to combat weapon
 */
function inventoryItemToWeapon(item: InventoryItem): Weapon {
  // Determine weapon type based on itemType
  let weaponType: Weapon['type'] = 'melee-strength';
  if (item.itemType === 'Dagger') {
    weaponType = 'melee-dexterity';
  } else if (item.itemType === 'Longsword' || item.itemType === 'Mace' || item.itemType === 'Staff') {
    weaponType = 'melee-strength';
  }
  // TODO: Add ranged weapon support when implemented

  // Parse damage string (e.g., "1d8 + 1" or "1d8+1")
  let damageDice = '1d6'; // Default fallback
  let damageModifier = 0;
  if (item.damage) {
    const damageMatch = item.damage.match(/(\d+d\d+)(?:\s*\+\s*(\d+))?/);
    if (damageMatch) {
      damageDice = damageMatch[1];
      damageModifier = damageMatch[2] ? parseInt(damageMatch[2], 10) : 0;
    }
  }

  // Parse attack bonus string (e.g., "+1" or "+2")
  let attackModifier = 0;
  if (item.attackBonus) {
    const bonusMatch = item.attackBonus.match(/\+(\d+)/);
    if (bonusMatch) {
      attackModifier = parseInt(bonusMatch[1], 10);
    }
  }

  return {
    name: item.name,
    type: weaponType,
    damageDice,
    damageModifier,
    attackModifier,
  };
}

/**
 * Cleric heal spell
 */
const CLERIC_HEAL = {
  name: 'Heal',
  type: 'heal' as const,
  damageDice: '2d4+2', // Healing amount
  manaCost: 5,
};

/**
 * Mage magic attack
 */
const MAGE_MAGIC_ATTACK = {
  name: 'Magic Missile',
  type: 'magic' as const,
  damageDice: '1d4+1',
  manaCost: 3,
};

/**
 * Create combat entity from adventurer
 */
export function createCombatEntityFromAdventurer(
  adventurer: AdventurerRecord,
  id?: string
): CombatEntity {
  return {
    id: id || `party-${adventurer.heroId.tokenId}`,
    type: 'party',
    name: adventurer.name || `Hero ${adventurer.heroId.tokenId}`,
    dexterity: adventurer.stats.dexterity,
    currentHp: adventurer.stats.health,
    maxHp: adventurer.stats.maxHealth,
    ac: adventurer.stats.armorClass,
    strength: adventurer.stats.strength,
    mana: adventurer.stats.mana,
    maxMana: adventurer.stats.maxMana,
    class: adventurer.class,
    adventurerRecord: adventurer,
  };
}

/**
 * Create combat entity from monster
 */
export function createCombatEntityFromMonster(
  monster: MonsterInstance,
  id?: string
): CombatEntity {
  return {
    id: id || monster.id,
    type: 'monster',
    name: monster.statBlock.name,
    dexterity: monster.statBlock.dexterity,
    currentHp: monster.currentHp,
    maxHp: monster.maxHp,
    ac: monster.statBlock.ac,
    strength: monster.statBlock.strength,
    monsterInstance: monster,
  };
}

/**
 * Initialize combat state
 */
export function initializeCombat(
  partyMembers: AdventurerRecord[],
  monsters: MonsterInstance[],
  roomId: string,
  isAmbush: boolean = false,
  config?: CombatConfig
): CombatState {
  // Create combat entities
  const partyEntities = partyMembers.map(a => createCombatEntityFromAdventurer(a));
  const monsterEntities = monsters.map(m => createCombatEntityFromMonster(m));
  const allEntities = [...partyEntities, ...monsterEntities];

  // Determine turn order
  const turnOrder = determineTurnOrder(allEntities);

  return {
    combatId: `combat-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`,
    roomId,
    entities: allEntities,
    turnOrder,
    currentTurn: 0,
    turns: [],
    isAmbush,
    ambushCompleted: !isAmbush, // If not ambush, consider it "completed"
    status: 'active',
    startedAt: new Date(),
  };
}

/**
 * Get weapon for an entity (from inventory or default fallback)
 */
async function getEntityWeapon(entity: CombatEntity): Promise<Weapon> {
  // Try to get equipped weapon from inventory
  if (entity.adventurerRecord) {
    try {
      const equipped = await getEquippedItems(entity.adventurerRecord.heroId);
      if (equipped.mainHand && equipped.mainHand.category === 'weapon') {
        return inventoryItemToWeapon(equipped.mainHand);
      }
    } catch (error) {
      console.warn(`Failed to get equipped weapon for ${entity.name}:`, error);
      // Fall through to default weapon
    }
  }

  // Fallback to default weapon based on class
  return DEFAULT_WEAPONS[entity.class || 'warrior'];
}

/**
 * Determine action for an entity (if not predetermined)
 */
async function determineAction(
  entity: CombatEntity,
  entities: CombatEntity[],
  config: CombatConfig
): Promise<CombatAction | null> {
  // Get alive targets
  const aliveEntities = entities.filter(e => e.currentHp > 0);
  const enemies = aliveEntities.filter(e => e.type !== entity.type);
  const allies = aliveEntities.filter(e => e.type === entity.type && e.id !== entity.id);

  if (enemies.length === 0) {
    return null; // No enemies, combat should end
  }

  // Check for predetermined action
  const currentTurn = entities.findIndex(e => e.id === entity.id);
  const predetermined = config.predeterminedActions?.find(
    a => a.entityId === entity.id && a.turnNumber === currentTurn
  );

  if (predetermined) {
    const target = entities.find(e => e.id === predetermined.targetId);
    if (!target || target.currentHp <= 0) {
      // Predetermined target is dead, fall back to auto-determine
    } else {
      // Use predetermined action
      if (predetermined.actionType === 'heal') {
        return {
          entityId: entity.id,
          actionType: 'heal',
          targetId: predetermined.targetId,
          weapon: CLERIC_HEAL,
        };
      } else if (predetermined.actionType === 'magic-attack') {
        return {
          entityId: entity.id,
          actionType: 'magic-attack',
          targetId: predetermined.targetId,
          weapon: MAGE_MAGIC_ATTACK,
        };
      } else {
        // Get equipped weapon for predetermined attack
        const weapon = await getEntityWeapon(entity);
        return {
          entityId: entity.id,
          actionType: 'attack',
          targetId: predetermined.targetId,
          weapon,
        };
      }
    }
  }

  // Auto-determine action based on class
  if (entity.class === 'cleric') {
    // Check if should heal
    const woundedAllies = allies.filter(a => a.currentHp < a.maxHp);
    const shouldHeal = woundedAllies.length > 0 && Math.random() < config.clericHealRatio;

    if (shouldHeal && entity.mana && entity.mana >= CLERIC_HEAL.manaCost!) {
      // Heal most wounded ally
      const target = woundedAllies.reduce((mostWounded, ally) =>
        ally.currentHp < mostWounded.currentHp ? ally : mostWounded
      );
      return {
        entityId: entity.id,
        actionType: 'heal',
        targetId: target.id,
        weapon: CLERIC_HEAL,
      };
    }
    // Otherwise attack with equipped weapon (or mace default)
    const target = enemies[Math.floor(Math.random() * enemies.length)];
    const weapon = await getEntityWeapon(entity);
    return {
      entityId: entity.id,
      actionType: 'attack',
      targetId: target.id,
      weapon,
    };
  }

  if (entity.class === 'mage') {
    // Check if should use magic
    const shouldUseMagic = entity.mana && entity.mana >= MAGE_MAGIC_ATTACK.manaCost! &&
      Math.random() < config.mageMagicRatio;

    if (shouldUseMagic) {
      const target = enemies[Math.floor(Math.random() * enemies.length)];
      return {
        entityId: entity.id,
        actionType: 'magic-attack',
        targetId: target.id,
        weapon: MAGE_MAGIC_ATTACK,
      };
    }
    // Otherwise attack with equipped weapon (or staff default)
    const target = enemies[Math.floor(Math.random() * enemies.length)];
    const weapon = await getEntityWeapon(entity);
    return {
      entityId: entity.id,
      actionType: 'attack',
      targetId: target.id,
      weapon,
    };
  }

  // Warrior or Rogue: regular attack with equipped weapon
  const target = enemies[Math.floor(Math.random() * enemies.length)];
  const weapon = await getEntityWeapon(entity);
  return {
    entityId: entity.id,
    actionType: 'attack',
    targetId: target.id,
    weapon,
  };
}

/**
 * Execute a combat turn
 */
export async function executeTurn(
  state: CombatState,
  config: CombatConfig
): Promise<{ state: CombatState; result: AttackResult | HealResult | null }> {
  // Filter out dead entities from turn order
  const aliveTurnOrder = filterAliveEntities(state.turnOrder, state.entities);
  
  if (aliveTurnOrder.length === 0) {
    return { state, result: null };
  }

  // Get current entity
  const currentEntityId = getCurrentEntity(aliveTurnOrder, state.currentTurn);
  if (!currentEntityId) {
    return { state, result: null };
  }

  const entity = state.entities.find(e => e.id === currentEntityId);
  if (!entity || entity.currentHp <= 0) {
    // Entity is dead, skip turn
    const nextState = {
      ...state,
      currentTurn: (state.currentTurn + 1) % aliveTurnOrder.length,
    };
    return { state: nextState, result: null };
  }

  // Determine action
  const action = await determineAction(entity, state.entities, config);
  if (!action) {
    // No valid action, combat should end
    return { state, result: null };
  }

  // Execute action
  let result: AttackResult | HealResult;
  let updatedEntities = [...state.entities];
  const entityIndex = updatedEntities.findIndex(e => e.id === entity.id);
  let updatedEntity = { ...entity };

  if (action.actionType === 'heal') {
    // Heal action
    const target = updatedEntities.find(e => e.id === action.targetId);
    if (!target || target.currentHp <= 0) {
      // Can't heal dead target
      const nextState = {
        ...state,
        currentTurn: (state.currentTurn + 1) % aliveTurnOrder.length,
      };
      return { state: nextState, result: null };
    }

    // Calculate healing
    const healDice = rollDice(action.weapon.damageDice);
    const healAmount = healDice.total;
    const healedTarget = applyHealing(target, healAmount);

    // Consume mana
    const manaCost = action.weapon.manaCost || 0;
    updatedEntity = {
      ...updatedEntity,
      mana: Math.max(0, (updatedEntity.mana || 0) - manaCost),
    };

    // Update entities
    const targetIndex = updatedEntities.findIndex(e => e.id === target.id);
    updatedEntities[entityIndex] = updatedEntity;
    updatedEntities[targetIndex] = healedTarget;

    result = {
      casterId: entity.id,
      targetId: target.id,
      amount: healAmount,
      targetNewHp: healedTarget.currentHp,
      targetMaxHp: healedTarget.maxHp,
      manaCost,
      casterNewMana: updatedEntity.mana || 0,
    };
  } else if (action.actionType === 'magic-attack') {
    // Magic attack (auto-hits)
    const target = updatedEntities.find(e => e.id === action.targetId);
    if (!target || target.currentHp <= 0) {
      const nextState = {
        ...state,
        currentTurn: (state.currentTurn + 1) % aliveTurnOrder.length,
      };
      return { state: nextState, result: null };
    }

    // Calculate damage
    const damageResult = rollDice(action.weapon.damageDice);
    const damage = damageResult.total;
    const damagedTarget = applyDamage(target, damage);

    // Consume mana
    const manaCost = action.weapon.manaCost || 0;
    updatedEntity = {
      ...updatedEntity,
      mana: Math.max(0, (updatedEntity.mana || 0) - manaCost),
    };

    // Update entities
    const targetIndex = updatedEntities.findIndex(e => e.id === target.id);
    updatedEntities[entityIndex] = updatedEntity;
    updatedEntities[targetIndex] = damagedTarget;

    result = {
      attackerId: entity.id,
      targetId: target.id,
      hit: true, // Magic always hits
      attackRoll: 20, // Not used for magic
      attackTotal: 999, // Not used for magic
      targetAC: target.ac,
      damage,
      damageRoll: damageResult.rolls,
      criticalHit: false,
    };
  } else {
    // Regular attack
    const target = updatedEntities.find(e => e.id === action.targetId);
    if (!target || target.currentHp <= 0) {
      const nextState = {
        ...state,
        currentTurn: (state.currentTurn + 1) % aliveTurnOrder.length,
      };
      return { state: nextState, result: null };
    }

    const attackResult = resolveAttack(entity, target, action.weapon);
    result = attackResult;

    if (attackResult.hit && attackResult.damage) {
      const damagedTarget = applyDamage(target, attackResult.damage);
      const targetIndex = updatedEntities.findIndex(e => e.id === target.id);
      updatedEntities[targetIndex] = damagedTarget;
    }
  }

  // Update state
  const nextTurn = (state.currentTurn + 1) % aliveTurnOrder.length;
  const updatedState: CombatState = {
    ...state,
    entities: updatedEntities,
    currentTurn: nextTurn,
    turns: [
      ...state.turns,
      {
        turnNumber: state.turns.length + 1,
        entityId: entity.id,
        entityName: entity.name,
        action,
        result,
      },
    ],
  };

  return { state: updatedState, result };
}

/**
 * Check combat status (victory/defeat)
 */
export function checkCombatStatus(state: CombatState): 'active' | 'victory' | 'defeat' {
  const aliveEntities = state.entities.filter(e => e.currentHp > 0);
  const partyAlive = aliveEntities.filter(e => e.type === 'party');
  const monstersAlive = aliveEntities.filter(e => e.type === 'monster');

  if (partyAlive.length === 0) {
    return 'defeat';
  }
  if (monstersAlive.length === 0) {
    return 'victory';
  }
  return 'active';
}

/**
 * Execute ambush round (monsters attack first)
 */
export function executeAmbushRound(
  state: CombatState,
  config: CombatConfig
): CombatState {
  if (!state.isAmbush || state.ambushCompleted) {
    return state;
  }

  let updatedState = { ...state };
  const monsters = updatedState.entities.filter(e => e.type === 'monster' && e.currentHp > 0);
  const party = updatedState.entities.filter(e => e.type === 'party' && e.currentHp > 0);

  // Each monster attacks a random party member
  for (const monster of monsters) {
    if (party.length === 0) break;

    const target = party[Math.floor(Math.random() * party.length)];
    const weapon = {
      name: 'Claw',
      type: 'melee-strength' as const,
      damageDice: '1d6',
      damageModifier: 0,
      attackModifier: 0,
    };

    const attackResult = resolveAttack(monster, target, weapon);
    
    // Apply damage
    if (attackResult.hit && attackResult.damage) {
      const targetIndex = updatedState.entities.findIndex(e => e.id === target.id);
      updatedState.entities[targetIndex] = applyDamage(
        updatedState.entities[targetIndex],
        attackResult.damage
      );
    }

    // Record turn
    updatedState.turns.push({
      turnNumber: updatedState.turns.length + 1,
      entityId: monster.id,
      entityName: monster.name,
      action: {
        entityId: monster.id,
        actionType: 'attack',
        targetId: target.id,
        weapon,
      },
      result: attackResult,
    });
  }

  updatedState.ambushCompleted = true;
  return updatedState;
}

/**
 * Run full combat until completion
 */
export async function runCombat(
  initialState: CombatState,
  config: CombatConfig
): Promise<CombatResult> {
  let state = initialState;

  // Execute ambush round if applicable
  if (state.isAmbush && !state.ambushCompleted) {
    state = executeAmbushRound(state, config);
  }

  // Main combat loop
  const maxTurns = 1000; // Safety limit
  let turnCount = 0;

  while (state.status === 'active' && turnCount < maxTurns) {
    const { state: nextState } = await executeTurn(state, config);
    state = nextState;
    state.status = checkCombatStatus(state);
    turnCount++;

    // Check if combat ended
    if (state.status !== 'active') {
      state.endedAt = new Date();
      break;
    }
  }

  // Calculate result
  const partyAlive = state.entities.filter(e => e.type === 'party' && e.currentHp > 0);
  const monstersAlive = state.entities.filter(e => e.type === 'monster' && e.currentHp > 0);
  const partyTotal = state.entities.filter(e => e.type === 'party').length;
  const monstersTotal = state.entities.filter(e => e.type === 'monster').length;

  // Calculate XP (if victory)
  let xpAwarded = 0;
  if (state.status === 'victory') {
    const defeatedMonsters = state.entities.filter(
      e => e.type === 'monster' && e.monsterInstance
    );
    xpAwarded = defeatedMonsters.reduce((sum, m) => {
      return sum + (m.monsterInstance?.statBlock.xp || 0);
    }, 0);
  }

  const duration = state.endedAt
    ? state.endedAt.getTime() - state.startedAt.getTime()
    : Date.now() - state.startedAt.getTime();

  return {
    combatId: state.combatId,
    status: state.status,
    turns: state.turns,
    totalTurns: state.turns.length,
    partyMembersAlive: partyAlive.length,
    partyMembersTotal: partyTotal,
    monstersAlive: monstersAlive.length,
    monstersTotal: monstersTotal,
    xpAwarded,
    duration,
  };
}