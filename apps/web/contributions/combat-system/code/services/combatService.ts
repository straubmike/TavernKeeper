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
// Dynamic import to avoid module resolution issues in tsx
// import { getEquippedItems } from '../../inventory-tracking/code/services/inventoryService';
import { determineTurnOrder, filterAliveEntities, getCurrentEntity } from '../engine/turn-order';
import { resolveAttack, applyDamage, applyHealing, rollDice } from '../engine/attack-resolution';
import { SeededRNG } from '../../../../lib/utils/seededRNG';

/**
 * Get or create RNG from combat state seed
 */
function getCombatRNG(state: CombatState, turnNumber?: number): SeededRNG {
  const seed = state.seed || `${state.combatId}-${state.roomId}`;
  const turnSeed = turnNumber !== undefined ? `${seed}-turn-${turnNumber}` : seed;
  return new SeededRNG(turnSeed);
}

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
 * 
 * NOTE: This uses the adventurer's current health/mana values.
 * For dungeon runs:
 * - HP/mana should start at max for level 1 of the dungeon
 * - HP/mana carry over between combat rooms
 * - Only safe rooms reset HP/mana to max (via restoreAdventurer)
 * 
 * Callers should ensure adventurer records have appropriate HP/mana values
 * before creating combat entities.
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
    proficiencyBonus: adventurer.stats.proficiencyBonus,
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
 * 
 * @param isAmbush - If true, monsters get ambush round (party failed perception)
 * @param isSurprise - If true, party gets surprise round (party passed perception)
 * Note: Only one of isAmbush or isSurprise should be true, not both
 */
export function initializeCombat(
  partyMembers: AdventurerRecord[],
  monsters: MonsterInstance[],
  roomId: string,
  isAmbush: boolean = false,
  config?: CombatConfig,
  isSurprise: boolean = false,
  seed?: string
): CombatState {
  // Create combat entities
  const partyEntities = partyMembers.map(a => createCombatEntityFromAdventurer(a));
  const monsterEntities = monsters.map(m => createCombatEntityFromMonster(m));
  const allEntities = [...partyEntities, ...monsterEntities];

  // Create seeded RNG for deterministic combat
  const combatSeed = seed || `${roomId}-${Date.now()}`;
  const rng = new SeededRNG(combatSeed);

  // Determine turn order using seeded RNG
  const turnOrder = determineTurnOrder(allEntities, rng);

  return {
    combatId: `combat-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`,
    roomId,
    entities: allEntities,
    turnOrder,
    currentTurn: 0,
    turns: [],
    isAmbush,
    isSurprise,
    ambushCompleted: !isAmbush, // If not ambush, consider it "completed"
    surpriseCompleted: !isSurprise, // If not surprise, consider it "completed"
    status: 'active',
    startedAt: new Date(),
    seed: combatSeed,
  };
}

/**
 * Get weapon for an entity (from inventory or default fallback)
 * 
 * This function uses the inventory-tracking service to get equipped weapons.
 * If no weapon is equipped, it falls back to default class-based weapons.
 * 
 * NOTE: When heroes are minted, they should be initialized with a base weapon
 * via the inventory-tracking service:
 * 1. Generate base weapon (common rarity, appropriate for hero class)
 * 2. Add to inventory via inventoryService.addItemToInventory()
 * 3. Equip via inventoryService.equipItem() with slot 'main_hand'
 * 
 * This ensures heroes start with appropriate equipment and the combat system
 * can retrieve their weapons from inventory rather than using defaults.
 */
async function getEntityWeapon(entity: CombatEntity): Promise<Weapon> {
  // TODO: Re-enable inventory check once module resolution is fixed
  // For now, always use default weapons to allow worker to run
  // The inventory service import causes tsx module resolution errors in the worker
  
  // Try to get equipped weapon from inventory (disabled for now)
  // if (entity.adventurerRecord) {
  //   try {
  //     const { getEquippedItems } = await import('../../inventory-tracking/code/services/inventoryService');
  //     const equipped = await getEquippedItems(entity.adventurerRecord.heroId);
  //     if (equipped.mainHand && equipped.mainHand.category === 'weapon') {
  //       return inventoryItemToWeapon(equipped.mainHand);
  //     }
  //   } catch (error) {
  //     // Fall through to default weapon
  //   }
  // }

  // Use default weapon based on class
  // Heroes should be initialized with base weapons, but for now we use defaults
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
    console.warn(`[Combat] executeTurn: No alive entities in turn order, ending combat`);
    return { state, result: null };
  }

  // Get current entity
  const currentEntityId = getCurrentEntity(aliveTurnOrder, state.currentTurn);
  if (!currentEntityId) {
    console.warn(`[Combat] executeTurn: Could not get current entity from turn order`);
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
    console.warn(`[Combat] executeTurn: No valid action for ${entity.name}, ending combat`);
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

    // Validate mana cost before healing
    const manaCost = action.weapon.manaCost || 0;
    const currentMana = updatedEntity.mana || 0;
    if (currentMana < manaCost) {
      // Not enough mana - skip this action
      const nextState = {
        ...state,
        currentTurn: (state.currentTurn + 1) % aliveTurnOrder.length,
      };
      return { state: nextState, result: null };
    }

    // Capture HP before healing for accurate display
    const hpBefore = target.currentHp;

    // Calculate healing (applyHealing already caps at maxHp)
    const rng = getCombatRNG(state, state.turns.length + 1);
    const healDice = rollDice(action.weapon.damageDice, rng);
    const healAmount = healDice.total;
    const healedTarget = applyHealing(target, healAmount);

    // Spend mana (already validated above)
    updatedEntity = {
      ...updatedEntity,
      mana: Math.max(0, currentMana - manaCost),
    };

    // Update entities
    const targetIndex = updatedEntities.findIndex(e => e.id === target.id);
    updatedEntities[entityIndex] = updatedEntity;
    updatedEntities[targetIndex] = healedTarget;

    result = {
      casterId: entity.id,
      targetId: target.id,
      amount: healAmount,
      targetHpBefore: hpBefore, // HP before healing (for accurate display)
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

    // Validate mana cost before magic attack
    const manaCost = action.weapon.manaCost || 0;
    const currentMana = updatedEntity.mana || 0;
    if (currentMana < manaCost) {
      // Not enough mana - skip this action
      const nextState = {
        ...state,
        currentTurn: (state.currentTurn + 1) % aliveTurnOrder.length,
      };
      return { state: nextState, result: null };
    }

    // Capture HP before damage for display
    const hpBefore = target.currentHp;

    // Calculate damage
    const rng = getCombatRNG(state, state.turns.length + 1);
    const damageResult = rollDice(action.weapon.damageDice, rng);
    const damage = damageResult.total;
    const damagedTarget = applyDamage(target, damage);

    // Spend mana (already validated above)
    updatedEntity = {
      ...updatedEntity,
      mana: Math.max(0, currentMana - manaCost),
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
      targetHpBefore: hpBefore,
      targetHpAfter: damagedTarget.currentHp,
      targetMaxHp: target.maxHp,
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

    // resolveAttack already captures targetHpBefore, but we need to update targetHpAfter after applying damage
    const rng = getCombatRNG(state, state.turns.length + 1);
    const attackResult = resolveAttack(entity, target, action.weapon, rng);
    
    if (attackResult.hit && attackResult.damage) {
      const damagedTarget = applyDamage(target, attackResult.damage);
      const targetIndex = updatedEntities.findIndex(e => e.id === target.id);
      updatedEntities[targetIndex] = damagedTarget;
      // Update attack result with actual HP after damage
      attackResult.targetHpAfter = damagedTarget.currentHp;
    } else {
      // Even if miss, HP didn't change
      attackResult.targetHpAfter = target.currentHp;
    }
    
    result = attackResult;
  }

  // Get target name for turn log
  let targetName: string | undefined;
  if (action && action.targetId) {
    const targetEntity = updatedEntities.find(e => e.id === action.targetId);
    targetName = targetEntity?.name;
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
        targetId: action?.targetId,
        targetName, // Include target name for proper display
        action,
        result,
      },
    ],
  };
  
  // Check combat status after updating entities (in case a monster or party member died)
  updatedState.status = checkCombatStatus(updatedState);

  return { state: updatedState, result };
}

/**
 * Check combat status (victory/defeat)
 * 
 * Returns:
 * - 'defeat' if all party members are dead
 * - 'victory' if all monsters are dead
 * - 'active' if both sides have alive members
 */
export function checkCombatStatus(state: CombatState): 'active' | 'victory' | 'defeat' {
  const aliveEntities = state.entities.filter(e => e.currentHp > 0);
  const partyAlive = aliveEntities.filter(e => e.type === 'party');
  const monstersAlive = aliveEntities.filter(e => e.type === 'monster');

  // Defeat: no party members alive
  if (partyAlive.length === 0) {
    return 'defeat';
  }
  
  // Victory: no monsters alive
  if (monstersAlive.length === 0) {
    return 'victory';
  }
  
  // Active: both sides have alive members
  return 'active';
}

/**
 * Execute ambush round (monsters attack first - party failed perception)
 */
export function executeAmbushRound(
  state: CombatState,
  config: CombatConfig
): CombatState {
  if (!state.isAmbush || state.ambushCompleted) {
    return state;
  }

  let updatedState = { ...state, entities: [...state.entities] };
  const monsters = updatedState.entities.filter(e => e.type === 'monster' && e.currentHp > 0);
  const party = updatedState.entities.filter(e => e.type === 'party' && e.currentHp > 0);

  // Each monster attacks a random party member (deterministic selection)
  const rng = getCombatRNG(state, state.turns.length + 1);
  for (let i = 0; i < monsters.length; i++) {
    if (party.length === 0) break;

    const targetIndex = rng.range(0, party.length - 1);
    const target = party[targetIndex];
    const weapon = {
      name: 'Claw',
      type: 'melee-strength' as const,
      damageDice: '1d6',
      damageModifier: 0,
      attackModifier: 0,
    };

    const attackRNG = new SeededRNG(`${state.seed || state.combatId}-ambush-${i}`);
    const attackResult = resolveAttack(monster, target, weapon, attackRNG);
    
    // Apply damage and update targetHpAfter
    if (attackResult.hit && attackResult.damage) {
      const targetIndex = updatedState.entities.findIndex(e => e.id === target.id);
      const damagedTarget = applyDamage(
        updatedState.entities[targetIndex],
        attackResult.damage
      );
      updatedState.entities[targetIndex] = damagedTarget;
      // Update attack result with actual HP after damage
      attackResult.targetHpAfter = damagedTarget.currentHp;
    } else {
      // Even if miss, HP didn't change
      attackResult.targetHpAfter = target.currentHp;
    }

    // Record turn with target name for proper display
    updatedState.turns.push({
      turnNumber: updatedState.turns.length + 1,
      entityId: monster.id,
      entityName: monster.name,
      targetId: target.id,
      targetName: target.name, // Set target name for proper display
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
 * Execute surprise round (party attacks first - party passed perception)
 */
export async function executeSurpriseRound(
  state: CombatState,
  config: CombatConfig
): Promise<CombatState> {
  if (!state.isSurprise || state.surpriseCompleted) {
    return state;
  }

  let updatedState = { ...state, entities: [...state.entities] };
  const party = updatedState.entities.filter(e => e.type === 'party' && e.currentHp > 0);
  const monsters = updatedState.entities.filter(e => e.type === 'monster' && e.currentHp > 0);

  // Each party member attacks a random monster
  for (const partyMember of party) {
    if (monsters.length === 0) break;

    const target = monsters[Math.floor(Math.random() * monsters.length)];
    
    // Determine action for party member
    const action = await determineAction(partyMember, updatedState.entities, config);
    if (!action || action.actionType === 'heal') {
      // Skip healing during surprise round, focus on attacks
      continue;
    }

    let result: AttackResult | HealResult;
    const targetIndex = updatedState.entities.findIndex(e => e.id === target.id);

    if (action.actionType === 'magic-attack') {
      // Magic attack (auto-hits)
      const manaCost = action.weapon.manaCost || 0;
      const currentMana = partyMember.mana || 0;
      
      if (currentMana >= manaCost) {
        const hpBefore = target.currentHp;
        const rng = getCombatRNG(state, state.turns.length + 1);
        const damageResult = rollDice(action.weapon.damageDice, rng);
        const damage = damageResult.total;
        const damagedTarget = applyDamage(target, damage);
        
        updatedState.entities[targetIndex] = damagedTarget;
        
        // Update party member mana
        const partyIndex = updatedState.entities.findIndex(e => e.id === partyMember.id);
        updatedState.entities[partyIndex] = {
          ...partyMember,
          mana: Math.max(0, currentMana - manaCost),
        };

        result = {
          attackerId: partyMember.id,
          targetId: target.id,
          hit: true,
          attackRoll: 20,
          attackTotal: 999,
          targetAC: target.ac,
          damage,
          damageRoll: damageResult.rolls,
          criticalHit: false,
          targetHpBefore: hpBefore,
          targetHpAfter: damagedTarget.currentHp,
          targetMaxHp: target.maxHp,
        };
      } else {
        continue; // Not enough mana
      }
    } else {
      // Regular attack
      const weapon = await getEntityWeapon(partyMember);
      const rng = getCombatRNG(state, state.turns.length + 1);
      const attackResult = resolveAttack(partyMember, target, weapon, rng);
      
      if (attackResult.hit && attackResult.damage) {
        const damagedTarget = applyDamage(target, attackResult.damage);
        updatedState.entities[targetIndex] = damagedTarget;
        attackResult.targetHpAfter = damagedTarget.currentHp;
      } else {
        attackResult.targetHpAfter = target.currentHp;
      }
      
      result = attackResult;
    }

    // Record turn
    updatedState.turns.push({
      turnNumber: updatedState.turns.length + 1,
      entityId: partyMember.id,
      entityName: partyMember.name,
      targetId: target.id,
      targetName: target.name,
      action,
      result,
    });
  }

  updatedState.surpriseCompleted = true;
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
  const combatStartTime = Date.now();
  const partyCount = state.entities.filter(e => e.type === 'party').length;
  const monsterCount = state.entities.filter(e => e.type === 'monster').length;
  
  console.log(`[Combat] Starting combat ${state.combatId}: ${partyCount} party vs ${monsterCount} monsters`);

  // Execute surprise round if applicable (party detected ambush)
  if (state.isSurprise && !state.surpriseCompleted) {
    console.log(`[Combat] Executing surprise round (party detected ambush)...`);
    const surpriseStartTime = Date.now();
    state = await executeSurpriseRound(state, config);
    console.log(`[Combat] Surprise round completed in ${Date.now() - surpriseStartTime}ms, ${state.turns.length} turns`);
  }

  // Execute ambush round if applicable (party failed to detect ambush)
  if (state.isAmbush && !state.ambushCompleted) {
    console.log(`[Combat] Executing ambush round (monsters attack first)...`);
    const ambushStartTime = Date.now();
    state = executeAmbushRound(state, config);
    console.log(`[Combat] Ambush round completed in ${Date.now() - ambushStartTime}ms, ${state.turns.length} turns`);
  }

  // Main combat loop
  const maxTurns = 1000; // Safety limit
  let turnCount = 0;
  const lastLogTurn = { count: 0 };

  while (state.status === 'active' && turnCount < maxTurns) {
    const turnStartTime = Date.now();
    const { state: nextState } = await executeTurn(state, config);
    state = nextState;
    // Status is already checked in executeTurn, but double-check to be safe
    if (state.status === 'active') {
      state.status = checkCombatStatus(state);
    }
    turnCount++;

    // Log progress every 10 turns
    if (turnCount % 10 === 0 || turnCount - lastLogTurn.count >= 10) {
      const partyAlive = state.entities.filter(e => e.type === 'party' && e.currentHp > 0).length;
      const monstersAlive = state.entities.filter(e => e.type === 'monster' && e.currentHp > 0).length;
      console.log(`[Combat] Turn ${turnCount}: ${partyAlive} party alive, ${monstersAlive} monsters alive, status: ${state.status}`);
      lastLogTurn.count = turnCount;
    }

    // Check if combat ended
    if (state.status !== 'active') {
      state.endedAt = new Date();
      const combatDuration = Date.now() - combatStartTime;
      console.log(`[Combat] Combat ended at turn ${turnCount}: ${state.status} (${combatDuration}ms)`);
      break;
    }
  }

  // Final status check (in case loop ended due to max turns)
  if (turnCount >= maxTurns) {
    console.warn(`[Combat] Combat reached max turns (${maxTurns}), forcing end`);
    // Force end combat - check status but if still active, force defeat (stalemate)
    const finalStatus = checkCombatStatus(state);
    if (finalStatus === 'active') {
      // Stalemate - party loses if combat can't be resolved
      console.warn(`[Combat] Combat stalemate after ${maxTurns} turns, forcing defeat`);
      state.status = 'defeat';
    } else {
      state.status = finalStatus;
    }
  } else {
    state.status = checkCombatStatus(state);
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

  const totalDuration = Date.now() - combatStartTime;
  console.log(`[Combat] Combat ${state.combatId} finished: ${state.status}, ${state.turns.length} turns, ${xpAwarded} XP, ${totalDuration}ms total`);

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
    finalState: state, // Include final state with updated HP/mana for party members
  };
}
