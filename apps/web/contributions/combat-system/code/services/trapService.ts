/**
 * Trap Resolution Service
 * 
 * Service for resolving trap room encounters in dungeons.
 * Handles perception checks, disarm checks, damage calculation, and rewards.
 */

import type {
  TrapResolutionState,
  TrapResolutionResult,
  TrapResolutionConfig,
  PerceptionCheck,
  DisarmCheck,
  TrapDamage,
  TrapCheckType,
} from '../types/trap';
// Type-only import - using correct relative path (from combat-system/code/services to contributions root)
import type { AdventurerRecord } from '../../../adventurer-tracking/code/types/adventurer-stats';
import type { RoomEncounter } from '../../../themed-dungeon-generation/code/types/dungeon-generation';
import { SeededRNG } from '../../../../lib/utils/seededRNG';

// Inline utility functions to avoid module resolution issues in tsx worker
function calculateAbilityModifier(score: number): number {
  return Math.floor((score - 10) / 2);
}

function calculateProficiencyBonus(level: number): number {
  // D&D 5e proficiency bonus formula: 2 + floor((level - 1) / 4)
  return 2 + Math.floor((level - 1) / 4);
}

/**
 * Roll a d20 using seeded RNG
 */
function rollD20(rng: SeededRNG): number {
  return rng.range(1, 20);
}

/**
 * Check if party detects an ambush trap
 * Returns true if ANY party member passes the perception check
 */
export function checkAmbushPerception(
  partyMembers: AdventurerRecord[],
  roomLevel: number,
  rng: SeededRNG
): { detected: boolean; checks: Array<{ adventurerId: string; adventurerName: string; roll: number; total: number; dc: number; success: boolean }> } {
  const dc = calculateTrapDC(roomLevel);
  const checks = partyMembers.map((member, index) => {
    const roll = rollD20(new SeededRNG(`${rng.getSeed()}-perception-${index}`));
    const wisdomModifier = calculateAbilityModifier(member.stats.wisdom);
    const proficiencyBonus = member.stats.skillProficiencies?.perception
      ? member.stats.proficiencyBonus
      : 0;
    const total = roll + wisdomModifier + proficiencyBonus;
    const success = total >= dc;

    return {
      adventurerId: `${member.heroId.tokenId}-${member.heroId.contractAddress}`,
      adventurerName: member.name || `Hero ${member.heroId.tokenId}`,
      roll,
      total,
      dc,
      success,
    };
  });

  // Any party member passing = detected
  const detected = checks.some(check => check.success);

  return { detected, checks };
}

/**
 * Calculate difficulty class (DC) based on dungeon level
 * Level 1: DC 10 (easy)
 * Level 99: DC 25 (very hard)
 * Linear scaling: DC = 10 + (level * 15 / 99)
 */
export function calculateTrapDC(level: number): number {
  // Clamp level between 1 and 100
  const clampedLevel = Math.max(1, Math.min(100, level));
  
  // Linear scaling: DC 10 at level 1, DC 25 at level 99
  // Formula: 10 + (level - 1) * (25 - 10) / (99 - 1)
  const dc = 10 + ((clampedLevel - 1) * 15) / 98;
  
  // Round to nearest integer
  return Math.round(dc);
}

/**
 * Calculate trap damage based on dungeon level
 * Level 1: ~5-10 damage
 * Level 99: ~50-100 damage
 * Scales with DC
 */
export function calculateTrapDamage(level: number, dc: number, rng: SeededRNG, config?: TrapResolutionConfig): number {
  const scalingFactor = config?.damageScalingFactor ?? 1.0;
  
  // Base damage scales with DC
  // DC 10 (level 1) = ~5-10 damage
  // DC 25 (level 99) = ~50-100 damage
  const baseDamage = dc * 2; // DC 10 = 20, DC 25 = 50
  
  // Add some randomness (80% to 120% of base) using seeded RNG
  const randomFactor = 0.8 + (rng.random() * 0.4);
  const damage = Math.round(baseDamage * randomFactor * scalingFactor);
  
  return Math.max(1, damage); // Minimum 1 damage
}

/**
 * Map trap subtype to trap check type
 * Determines which stat is used for disarming
 */
export function getTrapCheckType(trapSubtype: 'mechanical' | 'magical' | 'fake_treasure' | 'trapped_treasure', rng: SeededRNG): {
  checkType: TrapCheckType;
  requiresStrength?: boolean; // Some mechanical traps might use STR instead of DEX
} {
  // Normalize 'trapped_treasure' to 'fake_treasure' for consistency
  const normalizedSubtype = trapSubtype === 'trapped_treasure' ? 'fake_treasure' : trapSubtype;
  
  switch (normalizedSubtype) {
    case 'mechanical':
      // Mechanical traps: 70% DEX, 30% STR
      // This allows variety - some traps are dexterity-based (tripwires, pressure plates)
      // Others are strength-based (forcing doors, breaking mechanisms)
      const useStrength = rng.random() < 0.3;
      return {
        checkType: useStrength ? 'strength' : 'dexterity',
        requiresStrength: useStrength,
      };
    case 'magical':
      return { checkType: 'wisdom' };
    case 'fake_treasure':
      // Fake treasure can be either mechanical or magical (50/50)
      const isMagical = rng.random() < 0.5;
      if (isMagical) {
        return { checkType: 'wisdom' };
      } else {
        const useStrength = rng.random() < 0.3;
        return {
          checkType: useStrength ? 'strength' : 'dexterity',
          requiresStrength: useStrength,
        };
      }
    default:
      return { checkType: 'dexterity' };
  }
}

/**
 * Perform perception check for a party member
 */
function performPerceptionCheck(
  adventurer: AdventurerRecord,
  dc: number,
  rng: SeededRNG
): PerceptionCheck {
  const roll = rollD20(rng);
  const wisdomModifier = calculateAbilityModifier(adventurer.stats.wisdom);
  const proficiencyBonus = adventurer.stats.skillProficiencies?.perception
    ? adventurer.stats.proficiencyBonus
    : 0;
  const total = roll + wisdomModifier + proficiencyBonus;
  const success = total >= dc;

  return {
    adventurerId: `${adventurer.heroId.tokenId}-${adventurer.heroId.contractAddress}`,
    adventurerName: adventurer.name || `Hero ${adventurer.heroId.tokenId}`,
    statUsed: 'perception',
    roll,
    modifier: wisdomModifier,
    proficiencyBonus,
    total,
    dc,
    success,
  };
}

/**
 * Perform disarm check for a party member
 */
function performDisarmCheck(
  adventurer: AdventurerRecord,
  checkType: TrapCheckType,
  dc: number,
  rng: SeededRNG
): DisarmCheck {
  const roll = rollD20(rng);
  
  let statValue: number;
  let statModifier: number;
  
  switch (checkType) {
    case 'dexterity':
      statValue = adventurer.stats.dexterity;
      statModifier = calculateAbilityModifier(statValue);
      break;
    case 'strength':
      statValue = adventurer.stats.strength;
      statModifier = calculateAbilityModifier(statValue);
      break;
    case 'wisdom':
      statValue = adventurer.stats.wisdom;
      statModifier = calculateAbilityModifier(statValue);
      break;
    case 'intelligence':
      statValue = adventurer.stats.intelligence;
      statModifier = calculateAbilityModifier(statValue);
      break;
    default:
      statValue = adventurer.stats.dexterity;
      statModifier = calculateAbilityModifier(statValue);
  }
  
  // All heroes are proficient with tools/weapons, so use proficiency bonus
  const proficiencyBonus = adventurer.stats.proficiencyBonus;
  const total = roll + statModifier + proficiencyBonus;
  const success = total >= dc;

  return {
    adventurerId: `${adventurer.heroId.tokenId}-${adventurer.heroId.contractAddress}`,
    adventurerName: adventurer.name || `Hero ${adventurer.heroId.tokenId}`,
    statUsed: checkType,
    roll,
    modifier: statModifier,
    proficiencyBonus,
    total,
    dc,
    success,
  };
}

/**
 * Apply damage to an adventurer
 */
function applyTrapDamage(
  adventurer: AdventurerRecord,
  damage: number
): AdventurerRecord {
  const newHealth = Math.max(0, adventurer.stats.health - damage);
  return {
    ...adventurer,
    stats: {
      ...adventurer.stats,
      health: newHealth,
    },
  };
}

/**
 * Resolve a trap encounter
 * 
 * Process:
 * 1. All party members make perception checks
 * 2. If any party member detects the trap, proceed to disarm checks
 * 3. If any party member disarms the trap, party progresses unharmed
 * 4. If all fail perception or all fail disarm, party takes damage
 * 5. Puzzle traps don't deal damage, they cost time (not yet implemented)
 */
export function resolveTrap(
  encounter: RoomEncounter,
  roomId: string,
  roomLevel: number,
  partyMembers: AdventurerRecord[],
  config?: TrapResolutionConfig,
  seed?: string
): TrapResolutionResult {
  if (encounter.type !== 'trap') {
    throw new Error('Encounter is not a trap');
  }

  let trapSubtype = encounter.trapSubtype;
  if (!trapSubtype) {
    throw new Error('Trap encounter missing subtype');
  }

  // Normalize 'trapped_treasure' to 'fake_treasure' for consistency
  if (trapSubtype === 'trapped_treasure') {
    trapSubtype = 'fake_treasure';
  }

  // Skip ambush traps - they're handled by combat system
  if (trapSubtype === 'ambush') {
    throw new Error('Ambush traps are handled by the combat system');
  }

  // Create seeded RNG for deterministic trap resolution
  const trapSeed = seed || `${roomId}-trap-${Date.now()}`;
  const rng = new SeededRNG(trapSeed);

  const useBestRoll = config?.useBestRoll ?? true;
  const dc = calculateTrapDC(roomLevel);
  
  // Step 1: All party members make perception checks
  const perceptionChecks = partyMembers.map((member, index) =>
    performPerceptionCheck(member, dc, new SeededRNG(`${trapSeed}-perception-${index}`))
  );

  // Check if any party member detected the trap
  const detected = useBestRoll
    ? perceptionChecks.some(check => check.success)
    : perceptionChecks.every(check => check.success);

  // Step 2: If detected, proceed to disarm checks
  let disarmChecks: DisarmCheck[] = [];
  let disarmed = false;
  
  if (detected) {
    // Determine which stat to use for disarming (deterministic based on seed)
    const { checkType } = getTrapCheckType(trapSubtype, new SeededRNG(`${trapSeed}-checktype`));
    
    // All party members attempt to disarm
    disarmChecks = partyMembers.map((member, index) =>
      performDisarmCheck(member, checkType, dc, new SeededRNG(`${trapSeed}-disarm-${index}`))
    );

    // Check if any party member disarmed the trap
    disarmed = useBestRoll
      ? disarmChecks.some(check => check.success)
      : disarmChecks.every(check => check.success);
  }

  // Step 3: Calculate damage and apply to party
  const damageDealt: TrapDamage[] = [];
  let updatedPartyMembers = [...partyMembers];

  // Puzzle traps don't deal damage (time cost only, not yet implemented)
  const isPuzzleTrap = false; // TODO: Add puzzle trap subtype when implemented
  const puzzleDealsDamage = config?.puzzleTrapsDealDamage ?? false;

  if (!isPuzzleTrap || puzzleDealsDamage) {
    // Determine if party takes damage
    const takesDamage = !detected || !disarmed;

    if (takesDamage) {
      const damage = calculateTrapDamage(roomLevel, dc, new SeededRNG(`${trapSeed}-damage`), config);
      
      // Apply damage to all party members
      updatedPartyMembers = partyMembers.map((member, index) => {
        const memberDamage = applyTrapDamage(member, damage);
        const reason = !detected ? 'perception_failed' : 'disarm_failed';
        
        damageDealt.push({
          adventurerId: `${member.heroId.tokenId}-${member.heroId.contractAddress}`,
          adventurerName: member.name || `Hero ${member.heroId.tokenId}`,
          damage,
          hpBefore: member.stats.health,
          hpAfter: memberDamage.stats.health,
          maxHp: member.stats.maxHealth,
          reason,
        });
        
        return memberDamage;
      });
    }
  }

  // Step 4: Calculate XP and rewards
  const totalDamage = damageDealt.reduce((sum, d) => sum + d.damage, 0);
  
  // XP scales with level and success
  let xpAwarded = 0;
  if (disarmed) {
    // Full XP for successfully disarming
    xpAwarded = Math.round(encounter.difficulty * 30);
  } else if (detected) {
    // Partial XP for detecting but not disarming
    xpAwarded = Math.round(encounter.difficulty * 15);
  } else {
    // Minimal XP for surviving
    xpAwarded = Math.round(encounter.difficulty * 5);
  }

  // Get rewards from encounter (if trap was disarmed)
  const rewards = disarmed ? encounter.rewards : undefined;

  // Determine status and message
  let status: 'success' | 'partial_success' | 'failure';
  let message: string;

  if (disarmed) {
    status = 'success';
    message = 'Trap successfully detected and disarmed!';
  } else if (detected) {
    status = 'partial_success';
    message = 'Trap detected but failed to disarm. Party takes damage.';
  } else {
    status = 'failure';
    message = 'Trap not detected! Party takes damage.';
  }

  return {
    trapId: encounter.id,
    roomId,
    roomLevel,
    trapSubtype,
    difficultyClass: dc,
    perceptionChecks,
    disarmChecks,
    detected,
    disarmed,
    damageDealt,
    totalDamage,
    rewards,
    xpAwarded,
    status,
    message,
    updatedPartyMembers,
  };
}

/**
 * Initialize trap resolution state (for step-by-step resolution if needed)
 */
export function initializeTrapResolution(
  encounter: RoomEncounter,
  roomId: string,
  roomLevel: number,
  partyMembers: AdventurerRecord[]
): TrapResolutionState {
  if (encounter.type !== 'trap') {
    throw new Error('Encounter is not a trap');
  }

  const trapSubtype = encounter.trapSubtype;
  if (!trapSubtype) {
    throw new Error('Trap encounter missing subtype');
  }

  const dc = calculateTrapDC(roomLevel);

  return {
    trapId: encounter.id,
    roomId,
    roomLevel,
    trapSubtype,
    difficultyClass: dc,
    partyMembers,
    perceptionChecks: [],
    disarmChecks: [],
    status: 'detecting',
  };
}
