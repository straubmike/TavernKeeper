/**
 * Boss Entity Helper
 * 
 * Helper functions for registering bosses and mid-bosses as entities with history
 */

import type {
  GenerationContext,
  StandoutMortal,
  StandoutType,
} from '../types/world-generation';

export interface BossData {
  name: string;
  type: string; // Boss type (e.g., 'Lich', 'Ancient Dragon')
  level: number; // Dungeon level (negative for depth)
  dungeonId: string; // ID of the dungeon
  dungeonName: string; // Name of the dungeon
  powers: string[];
  description: string;
  history: string;
  isMainBoss: boolean; // true for main boss, false for mid-boss
  dungeonAge: number; // Age of the dungeon (to calculate when boss took control)
}

/**
 * Register a boss or mid-boss as a standout mortal entity with history
 */
export function registerBossEntity(
  context: GenerationContext,
  bossData: BossData
): StandoutMortal {
  const { name, type, level, dungeonId, dungeonName, powers, description, history, isMainBoss, dungeonAge } = bossData;

  // Calculate when boss took control (some time after dungeon was built)
  const dungeonCreationYear = -Math.abs(dungeonAge); // Years before present
  const bossControlYear = dungeonCreationYear + Math.floor(context.rng() * 100) + 50; // 50-150 years after dungeon creation

  // Determine boss type for standout mortal
  const standoutType: StandoutType = isMainBoss ? 'dungeon_boss' : 'dungeon_boss';
  
  // Find appropriate race based on boss type (for entity registration)
  const bossRaceMapping: Record<string, string> = {
    'Lich': 'undead',
    'Ancient Dragon': 'dragon',
    'Demon Lord': 'demon',
    'Vampire Lord': 'vampire',
    'Dark Archmage': 'human',
    'Orc Warlord': 'orc',
    'Troll Chietain': 'giant',
    'Dark Knight': 'human',
    'Necromancer': 'human',
    'Giant Spider Queen': 'monster',
  };

  // Try to find a matching race from context
  let raceId: string = 'unknown';
  const bossRaceName = bossRaceMapping[type] || 'human';
  const matchingRace = context.mortalRaces.find(r => 
    r.raceType?.toLowerCase().includes(bossRaceName.toLowerCase()) ||
    r.name.toLowerCase().includes(bossRaceName.toLowerCase())
  );
  if (matchingRace) {
    raceId = matchingRace.id;
  } else if (context.mortalRaces.length > 0) {
    raceId = context.mortalRaces[0].id; // Fallback to first race
  }

  // Find dungeon location (geography) if available
  let locationId: string = 'unknown';
  if (context.geography.length > 0) {
    locationId = context.geography[Math.floor(context.rng() * context.geography.length)].id;
  }

  // Generate unique entity ID
  const entityId = `boss-${dungeonId}-${isMainBoss ? 'main' : 'mid'}-${level}`;

  // Create standout mortal entity for the boss
  const bossEntity: StandoutMortal = {
    id: entityId,
    type: 'standout_mortal',
    standoutType,
    name,
    description,
    parentId: raceId,
    createdAt: new Date(bossControlYear),
    discoveredAt: new Date(),
    race: raceId,
    organization: undefined, // Bosses don't belong to organizations
    location: locationId,
    powers,
    level: isMainBoss ? 80 + Math.floor(context.rng() * 20) : 50 + Math.floor(context.rng() * 30), // Main: 80-100, Mid: 50-80
    age: 100 + Math.floor(context.rng() * 500), // Bosses are old
    alignment: 'evil', // Most bosses are evil
    isBoss: true,
    metadata: {
      seed: context.seed,
      bossType: type,
      dungeonId,
      dungeonName,
      dungeonLevel: level,
      isMainBoss,
      history,
    },
  };

  return bossEntity;
}

