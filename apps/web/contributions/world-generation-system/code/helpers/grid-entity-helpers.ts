/**
 * Grid Entity Helpers
 * 
 * Helper functions for registering entities that appear on the 2D surface grid:
 * - Organizations on the grid
 * - Leaders/notable people from those organizations
 */

import type {
  GenerationContext,
  Organization,
  OrganizationMagnitude,
  StandoutMortal,
  StandoutType,
} from '../types/world-generation';
import { generateOrganizationName } from '../templates/organization-name-helpers';

export interface GridOrganizationData {
  name: string;
  type: OrganizationMagnitude;
  raceId: string;
  raceName: string;
  locationId: string; // Geography ID
  locationName: string;
  gridX: number;
  gridY: number;
  age: number; // Age in years
  leaderName?: string; // Optional leader name
  leaderType?: StandoutType; // Optional leader type (e.g., 'king', 'guildmaster')
}

export interface GridLeaderData {
  name: string;
  organizationId: string;
  organizationName: string;
  raceId: string;
  raceName: string;
  locationId: string;
  locationName: string;
  leaderType: StandoutType;
  gridX: number;
  gridY: number;
  birthYear: number; // Year of birth
  riseToPowerYear: number; // Year they became leader
}

/**
 * Register an organization that appears on the grid as an entity with history
 */
export function registerGridOrganization(
  context: GenerationContext,
  orgData: GridOrganizationData
): Organization {
  const {
    name,
    type,
    raceId,
    raceName,
    locationId,
    locationName,
    gridX,
    gridY,
    age,
    leaderName,
    leaderType,
  } = orgData;

  // Calculate founding year
  const currentYear = 0; // Present day
  const foundingYear = new Date(currentYear - age);

  // Generate unique entity ID
  const entityId = `org-grid-${gridX}-${gridY}-${name.replace(/\s+/g, '-').toLowerCase()}`;

  // Determine organization purpose based on type
  const purposeMapping: Record<OrganizationMagnitude, string> = {
    kingdom: 'ruling and governance',
    city: 'commerce and urban life',
    town: 'community and trade',
    guild: 'professional association',
    horde: 'warfare and conquest',
    realm: 'governing and protection',
    tribe: 'community and survival',
    band: 'exploration and adventure',
    clan: 'kinship and tradition',
    circle: 'magic and knowledge',
    company: 'trade and commerce',
    mountainhome: 'mining and craftsmanship',
    nest: 'survival and expansion',
    canopy: 'nature and harmony',
    warren: 'community and comfort',
    stronghold: 'defense and dominance',
    enclave: 'knowledge and secrecy',
    colony: 'expansion and settlement',
    sanctuary: 'refuge and protection',
    hold: 'craftsmanship and defense',
    grove: 'nature and druidic magic',
    den: 'shelter and security',
    lair: 'territory and hoarding',
    court: 'politics and intrigue',
    coven: 'dark magic and power',
    coterie: 'sophistication and immortality',
    conclave: 'faith and doctrine',
    academy: 'education and research',
    colosseum: 'entertainment and combat',
    bazaar: 'trade and commerce',
    port: 'shipping and trade',
    fortress: 'military defense',
    temple: 'worship and faith',
    library: 'knowledge and preservation',
    forge: 'craftsmanship and creation',
    tower: 'magic and research',
    crypt: 'death and undeath',
    hive: 'collective survival',
    pack: 'hunting and territory',
    pride: 'dominance and hunting',
    flock: 'migration and survival',
    school: 'aquatic community',
    pod: 'aquatic family',
    murder: 'cunning and survival',
    swarm: 'collective action',
    empire: 'conquest and control',
  };

  const purpose = purposeMapping[type] || 'organization and community';

  // Determine membership size based on type
  const membershipRanges: Record<OrganizationMagnitude, [number, number]> = {
    empire: [100000, 1000000],
    kingdom: [10000, 100000],
    horde: [5000, 50000],
    realm: [5000, 50000],
    city: [5000, 50000],
    town: [500, 5000],
    tribe: [100, 1000],
    guild: [50, 500],
    band: [5, 50],
    clan: [20, 200],
    circle: [10, 100],
    company: [20, 200],
    mountainhome: [1000, 10000],
    nest: [100, 1000],
    canopy: [500, 5000],
    warren: [200, 2000],
    stronghold: [500, 5000],
    enclave: [50, 500],
    colony: [100, 1000],
    sanctuary: [50, 500],
    hold: [200, 2000],
    grove: [100, 1000],
    den: [50, 500],
    lair: [1, 10],
    court: [100, 1000],
    coven: [10, 100],
    coterie: [20, 200],
    conclave: [100, 1000],
    academy: [200, 2000],
    colosseum: [50, 500],
    bazaar: [100, 1000],
    port: [500, 5000],
    fortress: [500, 5000],
    temple: [100, 1000],
    library: [50, 500],
    forge: [100, 1000],
    tower: [10, 100],
    crypt: [50, 500],
    hive: [1000, 10000],
    pack: [50, 500],
    pride: [20, 200],
    flock: [100, 1000],
    school: [500, 5000],
    pod: [50, 500],
    murder: [100, 1000],
    swarm: [1000, 10000],
  };

  const [minMembers, maxMembers] = membershipRanges[type] || [100, 1000];
  const members = minMembers + Math.floor(context.rng() * (maxMembers - minMembers));

  const organization: Organization = {
    id: entityId,
    type: 'organization',
    magnitude: type,
    name,
    description: `The ${name} is a ${type} of the ${raceName}, located in ${locationName}. Founded ${age} years ago, it serves as a center for ${purpose}.`,
    parentId: raceId,
    createdAt: foundingYear,
    discoveredAt: new Date(),
    race: raceId,
    location: locationId,
    leader: undefined, // Will be set when leader is registered
    members,
    purpose,
    founded: foundingYear,
    metadata: {
      seed: context.seed,
      gridX,
      gridY,
      age,
    },
  };

  return organization;
}

/**
 * Register a leader from a grid organization as a standout mortal entity with history
 */
export function registerGridLeader(
  context: GenerationContext,
  leaderData: GridLeaderData
): StandoutMortal {
  const {
    name,
    organizationId,
    organizationName,
    raceId,
    raceName,
    locationId,
    locationName,
    leaderType,
    gridX,
    gridY,
    birthYear,
    riseToPowerYear,
  } = leaderData;

  // Generate unique entity ID
  const entityId = `leader-${organizationId}-${name.replace(/\s+/g, '-').toLowerCase()}`;

  // Determine power level and alignment based on leader type
  const levelRanges: Record<StandoutType, [number, number]> = {
    hero: [15, 25],
    villain: [15, 25],
    wizard: [10, 20],
    archmage: [20, 30],
    king: [10, 15],
    queen: [10, 15],
    war_chief: [12, 18],
    vampire: [18, 25],
    lich: [20, 30],
    dragon_lord: [25, 35],
    dungeon_boss: [15, 25],
    high_priest: [12, 20],
    legendary_warrior: [15, 22],
    necromancer: [15, 22],
    oracle: [10, 18],
    prophet: [10, 18],
    prince: [8, 15],
    princess: [8, 15],
    commander: [10, 18],
    witch: [12, 20],
    warlock: [15, 22],
    sorcerer: [12, 20],
    druid: [12, 20],
    ranger_lord: [12, 20],
    paladin: [12, 20],
    cleric: [10, 18],
    monk: [10, 18],
    barbarian_chieftain: [12, 18],
    rogue_master: [12, 20],
    bard_master: [10, 18],
    empress: [10, 15],
    emperor: [10, 15],
    duke: [8, 15],
    duchess: [8, 15],
    baron: [8, 15],
    baroness: [8, 15],
    count: [8, 15],
    countess: [8, 15],
    shaman: [10, 18],
    enchanter: [12, 20],
    alchemist: [12, 20],
    artificer: [12, 20],
    inquisitor: [12, 20],
    templar: [12, 20],
    crusader: [12, 20],
    assassin_master: [15, 22],
    spymaster: [12, 20],
    general: [10, 20],
    admiral: [10, 20],
    marshal: [10, 20],
    champion: [15, 22],
    gladiator: [12, 20],
    arena_master: [12, 20],
    guildmaster: [10, 18],
    thane: [10, 18],
    jarl: [10, 18],
    chieftain: [10, 18],
    elder: [8, 15],
    matriarch: [8, 15],
    patriarch: [8, 15],
  };

  const [minLevel, maxLevel] = levelRanges[leaderType] || [10, 20];
  const level = minLevel + Math.floor(context.rng() * (maxLevel - minLevel + 1));

  // Determine alignment based on leader type
  const alignment: 'good' | 'neutral' | 'evil' =
    leaderType === 'king' || leaderType === 'queen' || leaderType === 'hero' || leaderType === 'paladin'
      ? context.rng() > 0.5 ? 'good' : 'neutral'
      : leaderType === 'villain' || leaderType === 'necromancer' || leaderType === 'lich'
      ? 'evil'
      : 'neutral';

  // Generate powers based on leader type
  const powers: string[] = [];
  if (leaderType === 'wizard' || leaderType === 'archmage' || leaderType === 'sorcerer') {
    powers.push('Arcane Magic', 'Spell Mastery');
  } else if (leaderType === 'king' || leaderType === 'queen' || leaderType === 'emperor' || leaderType === 'empress') {
    powers.push('Leadership', 'Political Authority');
  } else if (leaderType === 'war_chief' || leaderType === 'commander' || leaderType === 'general') {
    powers.push('Combat Expertise', 'Tactical Command');
  } else {
    powers.push('Leadership', 'Expertise');
  }

  // Calculate current age
  const currentYear = 0;
  const age = currentYear - birthYear;

  const leaderEntity: StandoutMortal = {
    id: entityId,
    type: 'standout_mortal',
    standoutType: leaderType,
    name,
    description: `${name} is the ${leaderType} of ${organizationName}, a ${raceName} organization located in ${locationName}.`,
    parentId: raceId,
    createdAt: new Date(birthYear),
    discoveredAt: new Date(),
    race: raceId,
    organization: organizationId,
    location: locationId,
    powers,
    level,
    age,
    alignment,
    isBoss: false,
    metadata: {
      seed: context.seed,
      gridX,
      gridY,
      organizationId,
      organizationName,
      riseToPowerYear,
    },
  };

  return leaderEntity;
}