/**
 * Dungeon Generator
 * 
 * Generates Level 7.5: Dungeons
 * Dungeons created by organizations or standout mortals with provenance tracking.
 * 
 * Location Logic:
 * - Organization-made dungeons: exist in geography where organization is founded
 * - Standout mortal-made dungeons: exist in organization the mortal is linked to,
 *   or random geography if mortal has no organization
 */

import type {
  Dungeon,
  DungeonBoss,
  GenerationContext,
  Organization,
  StandoutMortal,
} from '../types/world-generation';

export class DungeonGenerator {
  /**
   * Generate dungeons from organizations and standout mortals
   */
  async generate(context: GenerationContext): Promise<Dungeon[]> {
    if (context.organizations.length === 0 && context.standoutMortals.length === 0) {
      console.warn('No organizations or standout mortals found - skipping dungeon generation');
      return [];
    }

    if (context.geography.length === 0) {
      throw new Error('Geography must be generated before dungeons');
    }

    const dungeons: Dungeon[] = [];

    // Generate dungeons from organizations
    for (const org of context.organizations) {
      // Not all organizations create dungeons - determine based on type/purpose
      if (this.shouldOrganizationCreateDungeon(org, context)) {
        const dungeon = await this.generateDungeonFromOrganization(org, context);
        if (dungeon) {
          dungeons.push(dungeon);
        }
      }
    }

    // Generate dungeons from standout mortals (necromancers, wizards, etc.)
    for (const mortal of context.standoutMortals) {
      // Only certain standout mortals create dungeons
      if (this.shouldMortalCreateDungeon(mortal)) {
        const dungeon = await this.generateDungeonFromMortal(mortal, context);
        if (dungeon) {
          dungeons.push(dungeon);
        }
      }
    }

    // Assign bosses to dungeons (Rules 2 & 3)
    await this.assignBossesToDungeons(dungeons, context);

    return dungeons;
  }

  /**
   * Assign bosses to dungeons (Rules 2 & 3)
   * Rule 2: Evil demi-gods and standout mortals that don't create dungeons can become final bosses
   * Rule 3: Proc-gen bosses for remaining positions
   */
  private async assignBossesToDungeons(
    dungeons: Dungeon[],
    context: GenerationContext
  ): Promise<void> {
    // Find all available evil entities for boss assignment
    const availableEvilDemigods = context.demiGods.filter(
      d => d.alignment === 'evil' && d.isBoss
    );
    
    const availableEvilMortals = context.standoutMortals.filter(
      m => m.alignment === 'evil' && m.isBoss
    );

    // Get IDs of mortals that already created dungeons (they're already final bosses)
    const dungeonCreatorIds = new Set(
      dungeons
        .filter(d => d.createdBy === 'standout_mortal')
        .map(d => d.creatorId)
    );

    // Filter out mortals that already created dungeons
    const assignableEvilMortals = availableEvilMortals.filter(
      m => !dungeonCreatorIds.has(m.id)
    );

    // Rule 2: Assign evil entities to dungeons without final bosses
    for (const dungeon of dungeons) {
      // Skip if dungeon already has a final boss (Rule 1 - creator is boss)
      if (dungeon.finalBoss) {
        continue;
      }

      // Try to assign an evil demi-god or mortal as final boss
      let assigned = false;

      // Prefer demi-gods for more powerful dungeons
      if (availableEvilDemigods.length > 0 && context.rng() < 0.6) {
        const demigod = availableEvilDemigods.splice(
          Math.floor(context.rng() * availableEvilDemigods.length),
          1
        )[0];
        
        dungeon.finalBoss = {
          level: dungeon.depth,
          bossId: demigod.id,
          bossType: 'demigod',
          bossName: demigod.name,
          bossAlignment: demigod.alignment,
        };
        assigned = true;
      } else if (assignableEvilMortals.length > 0) {
        const mortal = assignableEvilMortals.splice(
          Math.floor(context.rng() * assignableEvilMortals.length),
          1
        )[0];
        
        dungeon.finalBoss = {
          level: dungeon.depth,
          bossId: mortal.id,
          bossType: 'standout_mortal',
          bossName: mortal.name,
          bossRace: mortal.race,
          bossAlignment: mortal.alignment,
        };
        assigned = true;
      }

      // Rule 3: If no evil entity available, generate proc-gen boss
      if (!assigned) {
        dungeon.finalBoss = await this.generateProcGenBoss(
          dungeon,
          'final',
          context
        );
      }

      // Assign mid-bosses at significant levels (every 25 levels, excluding final)
      dungeon.midBosses = await this.assignMidBosses(dungeon, context);
    }
  }

  /**
   * Assign mid-bosses to a dungeon at significant levels
   */
  private async assignMidBosses(
    dungeon: Dungeon,
    context: GenerationContext
  ): Promise<DungeonBoss[]> {
    const midBosses: DungeonBoss[] = [];
    const midBossLevels: number[] = [];

    // Determine mid-boss levels (every 25 levels, excluding final)
    for (let level = 25; level < dungeon.depth; level += 25) {
      midBossLevels.push(level);
    }

    // Find available evil entities for mid-bosses (only standout mortals, no demi-gods)
    const availableEvilMortals = context.standoutMortals.filter(
      m => m.alignment === 'evil' && m.isBoss
    );

    // Get IDs already used as final bosses
    const usedBossIds = new Set<string>();
    if (dungeon.finalBoss) {
      usedBossIds.add(dungeon.finalBoss.bossId);
    }

    // Assign bosses to mid-boss levels
    for (const level of midBossLevels) {
      // Try to assign an evil standout mortal (30% chance per level)
      let assigned = false;
      
      if (context.rng() < 0.3 && availableEvilMortals.length > 0) {
        const mortal = availableEvilMortals.find(
          m => !usedBossIds.has(m.id) && m.id !== dungeon.creatorId
        );
        if (mortal) {
          usedBossIds.add(mortal.id);
          midBosses.push({
            level,
            bossId: mortal.id,
            bossType: 'standout_mortal',
            bossName: mortal.name,
            bossRace: mortal.race,
            bossAlignment: mortal.alignment,
          });
          assigned = true;
        }
      }

      // If no entity assigned, generate proc-gen mid-boss
      if (!assigned) {
        const procGenBoss = await this.generateProcGenBoss(
          dungeon,
          'mid',
          context,
          level
        );
        if (procGenBoss) {
          midBosses.push(procGenBoss);
        }
      }
    }

    return midBosses;
  }

  /**
   * Generate a procedural boss for a dungeon
   * Rule 3: Proc-gen bosses for positions not filled by permanent entities
   */
  private async generateProcGenBoss(
    dungeon: Dungeon,
    type: 'final' | 'mid',
    context: GenerationContext,
    level?: number
  ): Promise<DungeonBoss | null> {
    const bossLevel = type === 'final' ? dungeon.depth : (level || 25);
    const bossSeed = `${dungeon.seed}-boss-${type}-${bossLevel}`;
    const rng = context.rng;

    // Determine boss theme based on dungeon
    const bossTypes: string[] = [];
    
    // If dungeon has a creator with race/type info, theme accordingly
    if (dungeon.createdBy === 'organization') {
      const org = context.organizations.find(o => o.id === dungeon.creatorId);
      if (org) {
        // Get race name from race ID
        const raceName = this.getRaceNameFromId(org.race, context);
        if (raceName) {
          const bossTypeSuffix = this.getBossTypeForRace(raceName, rng);
          bossTypes.push(`${raceName} ${bossTypeSuffix}`);
        }
      }
    }
    // Note: standout_mortal creators are already the final boss, so no fallback needed

    // Fallback boss types (if no organization race found)
    if (bossTypes.length === 0) {
      bossTypes.push(
        'Orc War-Chief',
        'Lich',
        'Necromancer',
        'Dragon',
        'Troll King',
        'Giant',
        'Demon',
        'Undead Lord'
      );
    }

    const bossType = bossTypes[Math.floor(rng() * bossTypes.length)];
    const bossName = this.generateProcGenBossName(bossType, bossSeed);

    // Determine race/alignment from boss type
    let bossRace: string | undefined;
    let bossAlignment: 'good' | 'neutral' | 'evil' = 'evil';
    
    if (bossType.includes('Orc')) {
      bossRace = 'Orc';
    } else if (bossType.includes('Lich') || bossType.includes('Necromancer') || bossType.includes('Undead')) {
      bossAlignment = 'evil';
    }

    return {
      level: bossLevel,
      bossId: `procgen-boss-${bossSeed}`,
      bossType: 'procgen',
      bossName,
      bossRace,
      bossAlignment,
    };
  }

  /**
   * Get race name from race ID by looking it up in mortal races
   */
  private getRaceNameFromId(raceId: string, context: GenerationContext): string | null {
    // Look up the race in mortalRaces
    const race = context.mortalRaces.find(r => r.id === raceId);
    if (race) {
      // Return the race name (without "The" prefix if present)
      return race.name.replace(/^The /, '');
    }
    
    // Fallback: try to extract race name from ID format (e.g., "race-orc-6" -> "Orc")
    // This handles cases where the race might not be found
    if (raceId.startsWith('race-')) {
      const parts = raceId.split('-');
      if (parts.length >= 2) {
        const raceType = parts[1];
        // Capitalize first letter
        return raceType.charAt(0).toUpperCase() + raceType.slice(1);
      }
    }
    
    return null;
  }

  /**
   * Get boss type suggestion based on race name
   */
  private getBossTypeForRace(raceName: string, rng: () => number): string {
    const raceBossTypes: Record<string, string[]> = {
      'Orc': ['War-Chief', 'Warlord', 'Brute', 'Berserker'],
      'Goblin': ['Chieftain', 'King', 'Overlord'],
      'Human': ['Bandit Lord', 'Dark Knight', 'Cult Leader'],
      'Elf': ['Dark Elf', 'Corrupted Mage'],
      'Dwarf': ['King', 'Lord'],
    };

    const types = raceBossTypes[raceName] || ['Leader', 'Lord', 'King'];
    return types[Math.floor(rng() * types.length)];
  }

  /**
   * Generate a name for a proc-gen boss
   */
  private generateProcGenBossName(bossType: string, seed: string): string {
    // Simple name generation - can be enhanced later
    // Use a simple seeded hash for deterministic generation
    let hash = 0;
    for (let i = 0; i < seed.length; i++) {
      hash = ((hash << 5) - hash) + seed.charCodeAt(i);
      hash = hash & hash; // Convert to 32-bit integer
    }
    const prefixes = ['The', 'Lord', 'King', 'Master', 'General'];
    const prefix = prefixes[Math.abs(hash) % prefixes.length];
    return `${prefix} ${bossType}`;
  }

  /**
   * Determine if an organization should create a dungeon
   */
  private shouldOrganizationCreateDungeon(
    org: Organization,
    context: GenerationContext
  ): boolean {
    const rng = context.rng;
    
    // Some organization types are more likely to create dungeons
    const dungeonLikelyTypes: string[] = ['kingdom', 'horde', 'realm', 'stronghold'];
    const isLikelyType = dungeonLikelyTypes.includes(org.magnitude);
    
    // Check if purpose suggests dungeon creation
    const dungeonPurposes = ['mining', 'fortress', 'citadel', 'stronghold', 'vault'];
    const hasDungeonPurpose = dungeonPurposes.some(p => 
      org.purpose.toLowerCase().includes(p)
    );

    // Base probability
    let probability = 0.1; // 10% base chance
    
    if (isLikelyType) {
      probability = 0.3; // 30% for likely types
    }
    
    if (hasDungeonPurpose) {
      probability = 0.7; // 70% if purpose matches
    }

    return rng() < probability;
  }

  /**
   * Generate a dungeon from an organization
   */
  private async generateDungeonFromOrganization(
    org: Organization,
    context: GenerationContext
  ): Promise<Dungeon | null> {
    // Location: geography where organization is founded
    const locationId = org.location;
    if (!locationId) {
      console.warn(`Organization ${org.id} has no location - skipping dungeon`);
      return null;
    }

    // Generate dungeon details
    const dungeonType = this.determineDungeonType(org, context);
    const purpose = this.generateDungeonPurpose(org, context);
    const age = this.generateDungeonAge(context);
    const depth = this.generateDungeonDepth(context);
    
    // Generate name
    const name = this.generateDungeonName(org, dungeonType, context);
    
    // Generate description
    const description = this.generateDungeonDescription(org, dungeonType, purpose, context);

    // Create seed for deterministic dungeon structure generation
    const dungeonSeed = `${context.seed}-dungeon-${org.id}`;

    const dungeon: Dungeon = {
      id: `dungeon-org-${org.id}`,
      name,
      type: 'dungeon',
      dungeonType,
      location: locationId,
      createdBy: 'organization',
      creatorId: org.id,
      purpose,
      age,
      depth,
      seed: dungeonSeed,
      description,
      createdAt: new Date(), // Will be calculated from age in-world time
      discoveredAt: new Date(),
      parentId: org.id,
      finalBoss: null, // Will be assigned later in boss assignment phase
      midBosses: [], // Will be assigned later
      metadata: {
        organizationMagnitude: org.magnitude,
        organizationRace: org.race,
      },
    };

    return dungeon;
  }

  /**
   * Determine if a standout mortal should create a dungeon
   */
  private shouldMortalCreateDungeon(mortal: StandoutMortal): boolean {
    // Types that commonly create dungeons/towers
    const dungeonCreatorTypes: string[] = [
      'necromancer',
      'wizard',
      'archmage',
      'lich',
      'sorcerer',
      'warlock',
      'villain',
      'vampire',
    ];

    return dungeonCreatorTypes.includes(mortal.standoutType);
  }

  /**
   * Generate a dungeon from a standout mortal
   */
  private async generateDungeonFromMortal(
    mortal: StandoutMortal,
    context: GenerationContext
  ): Promise<Dungeon | null> {
    // Location logic:
    // 1. If mortal has organization, use that organization's location
    // 2. Otherwise, use random geography
    
    let locationId: string;
    
    if (mortal.organization) {
      // Find the organization
      const org = context.organizations.find(o => o.id === mortal.organization);
      if (org && org.location) {
        locationId = org.location;
      } else {
        // Fallback to random geography
        locationId = this.selectRandomGeography(context);
      }
    } else {
      // No organization - use random geography
      locationId = this.selectRandomGeography(context);
    }

    if (!locationId) {
      console.warn(`Could not determine location for mortal ${mortal.id} - skipping dungeon`);
      return null;
    }

    // Determine if it's a tower (necromancers, liches) or regular dungeon
    const isTower = mortal.standoutType === 'necromancer' || 
                    mortal.standoutType === 'lich' ||
                    mortal.standoutType === 'wizard' ||
                    mortal.standoutType === 'archmage';
    
    const dungeonType = isTower ? 'tower' : 'dungeon';
    
    // Generate dungeon details
    const purpose = this.generateDungeonPurposeForMortal(mortal, context);
    const age = this.generateDungeonAge(context);
    const depth = this.generateDungeonDepth(context);
    
    // Generate name
    const name = this.generateDungeonNameForMortal(mortal, dungeonType, context);
    
    // Generate description
    const description = this.generateDungeonDescriptionForMortal(
      mortal, 
      dungeonType, 
      purpose, 
      context
    );

    // Create seed for deterministic dungeon structure generation
    const dungeonSeed = `${context.seed}-dungeon-${mortal.id}`;

    // Rule 1: If a standout mortal creates a dungeon, they ARE the final boss
    const finalBoss: DungeonBoss = {
      level: depth, // Final boss at deepest level
      bossId: mortal.id,
      bossType: 'standout_mortal',
      bossName: mortal.name,
      bossRace: mortal.race,
      bossAlignment: mortal.alignment,
    };

    const dungeon: Dungeon = {
      id: `dungeon-mortal-${mortal.id}`,
      name,
      type: 'dungeon',
      dungeonType,
      location: locationId,
      createdBy: 'standout_mortal',
      creatorId: mortal.id,
      purpose,
      age,
      depth,
      seed: dungeonSeed,
      description,
      createdAt: new Date(), // Will be calculated from age in-world time
      discoveredAt: new Date(),
      parentId: mortal.organization || mortal.location,
      finalBoss,
      midBosses: [], // Will be assigned later
      metadata: {
        mortalType: mortal.standoutType,
        mortalRace: mortal.race,
        mortalAlignment: mortal.alignment,
      },
    };

    return dungeon;
  }

  /**
   * Determine dungeon type from organization
   */
  private determineDungeonType(org: Organization, context: GenerationContext): 'dungeon' | 'tower' {
    // Most organizations create dungeons, but some create towers
    const towerOrganizations = ['necromancer_cult', 'wizard_guild'];
    
    if (towerOrganizations.some(t => org.purpose.toLowerCase().includes(t))) {
      return 'tower';
    }

    // Check world events for tower construction
    const towerEvents = context.worldEvents.filter(e => 
      e.type === 'built_tower' && e.locationId === org.location
    );
    
    if (towerEvents.length > 0) {
      return 'tower';
    }

    return 'dungeon';
  }

  /**
   * Generate dungeon purpose based on organization
   */
  private generateDungeonPurpose(org: Organization, context: GenerationContext): string {
    const purposes: string[] = [
      'mining operation',
      'fortress',
      'vault',
      'prison',
      'temple',
      'laboratory',
      'barracks',
      'warehouse',
      'citadel',
    ];

    // Use organization purpose if it suggests a dungeon purpose
    if (org.purpose.toLowerCase().includes('mining')) {
      return 'mining operation';
    }
    if (org.purpose.toLowerCase().includes('fortress') || 
        org.purpose.toLowerCase().includes('stronghold')) {
      return 'fortress';
    }

    // Otherwise random
    return purposes[Math.floor(context.rng() * purposes.length)];
  }

  /**
   * Generate dungeon purpose for a mortal
   */
  private generateDungeonPurposeForMortal(
    mortal: StandoutMortal,
    context: GenerationContext
  ): string {
    const typePurposes: Record<string, string[]> = {
      necromancer: ['necromantic research', 'tower of undeath', 'dark experiments'],
      lich: ['phylactery vault', 'undead sanctum', 'dark citadel'],
      wizard: ['magical research', 'spell library', 'arcane laboratory'],
      archmage: ['grand library', 'arcane tower', 'spell repository'],
      sorcerer: ['power focus', 'magical nexus'],
      warlock: ['pact sanctum', 'dark altar'],
      villain: ['hidden lair', 'secret base'],
      vampire: ['blood sanctum', 'underground crypt'],
    };

    const purposes = typePurposes[mortal.standoutType] || ['lair', 'sanctum'];
    return purposes[Math.floor(context.rng() * purposes.length)];
  }

  /**
   * Generate dungeon age (years ago, negative for past)
   */
  private generateDungeonAge(context: GenerationContext): number {
    const ages = [-50, -100, -200, -500, -1000, -2000];
    return ages[Math.floor(context.rng() * ages.length)];
  }

  /**
   * Generate dungeon depth (number of levels)
   */
  private generateDungeonDepth(context: GenerationContext): number {
    // Typically 50-100 levels
    const minDepth = 50;
    const maxDepth = 100;
    return Math.floor(context.rng() * (maxDepth - minDepth + 1)) + minDepth;
  }

  /**
   * Generate dungeon name for organization
   */
  private generateDungeonName(
    org: Organization,
    dungeonType: 'dungeon' | 'tower',
    context: GenerationContext
  ): string {
    const prefixes = ['Ancient', 'Forgotten', 'Dark', 'Cursed', 'Lost'];
    const suffixes = dungeonType === 'tower'
      ? ['Tower', 'Spire', 'Keep', 'Citadel', 'Fortress']
      : ['Caverns', 'Depths', 'Catacombs', 'Mines', 'Labyrinth'];

    const prefix = prefixes[Math.floor(context.rng() * prefixes.length)];
    const suffix = suffixes[Math.floor(context.rng() * suffixes.length)];
    
    // Sometimes include organization name
    if (context.rng() < 0.3) {
      return `${org.name}'s ${suffix}`;
    }

    return `${prefix} ${suffix}`;
  }

  /**
   * Generate dungeon name for mortal
   */
  private generateDungeonNameForMortal(
    mortal: StandoutMortal,
    dungeonType: 'dungeon' | 'tower',
    context: GenerationContext
  ): string {
    // For towers, often named after the mortal
    if (dungeonType === 'tower') {
      if (context.rng() < 0.7) {
        return `${mortal.name}'s Tower`;
      }
    }

    // Fallback to generic name
    const prefixes = ['Dark', 'Forgotten', 'Ancient', 'Cursed'];
    const suffixes = dungeonType === 'tower'
      ? ['Tower', 'Spire', 'Keep']
      : ['Sanctum', 'Lair', 'Crypt'];

    const prefix = prefixes[Math.floor(context.rng() * prefixes.length)];
    const suffix = suffixes[Math.floor(context.rng() * suffixes.length)];

    return `${prefix} ${suffix}`;
  }

  /**
   * Generate dungeon description for organization
   */
  private generateDungeonDescription(
    org: Organization,
    dungeonType: 'dungeon' | 'tower',
    purpose: string,
    context: GenerationContext
  ): string {
    return `A ${dungeonType} built by ${org.name} as a ${purpose}.`;
  }

  /**
   * Generate dungeon description for mortal
   */
  private generateDungeonDescriptionForMortal(
    mortal: StandoutMortal,
    dungeonType: 'dungeon' | 'tower',
    purpose: string,
    context: GenerationContext
  ): string {
    return `A ${dungeonType} built by ${mortal.name}, a ${mortal.standoutType.replace(/_/g, ' ')}, as a ${purpose}.`;
  }

  /**
   * Select random geography for dungeon location
   */
  private selectRandomGeography(context: GenerationContext): string {
    if (context.geography.length === 0) {
      throw new Error('No geography available for dungeon location');
    }
    const index = Math.floor(context.rng() * context.geography.length);
    return context.geography[index].id;
  }
}