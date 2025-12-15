/**
 * Organization Generator
 * 
 * Generates Level 6: Organizations
 * Named groups organized by magnitude
 */

import type { Organization, GenerationContext, OrganizationMagnitude } from '../types/world-generation';
import { generateOrganizationName } from '../templates/organization-name-helpers';

export class OrganizationGenerator {
  async generate(
    context: GenerationContext,
    density: 'sparse' | 'normal' | 'dense' = 'normal'
  ): Promise<Organization[]> {
    console.log(`[OrganizationGenerator] Starting generation (density: ${density})...`);
    if (context.mortalRaces.length === 0) {
      throw new Error('Mortal races must be generated before organizations');
    }
    
    if (context.geography.length === 0) {
      throw new Error('Geography must be generated before organizations');
    }
    
    console.log(`[OrganizationGenerator] Found ${context.mortalRaces.length} races and ${context.geography.length} geography entries`);

    const densityMap = {
      sparse: 0.5,
      normal: 1.0,
      dense: 1.5,
    };

    const multiplier = densityMap[density];
    const organizations: Organization[] = [];
    const usedNames = new Set<string>();
    let orgIndex = 0;

    // Race-specific organization types
    const raceOrgTypes: Record<string, OrganizationMagnitude[]> = {
      'human': ['kingdom', 'city', 'town', 'guild', 'empire'],
      'dwarf': ['kingdom', 'city', 'guild', 'clan', 'mountainhome', 'hold', 'forge'],
      'elf': ['realm', 'city', 'tribe', 'circle', 'canopy', 'grove'],
      'orc': ['horde', 'tribe', 'stronghold', 'band'],
      'goblin': ['tribe', 'nest', 'band', 'clan'],
      'halfling': ['town', 'warren', 'tribe'],
      'gnome': ['town', 'enclave', 'city'],
      'dragon': ['lair', 'court'],
      'undead': ['crypt', 'sanctuary'],
      'fey': ['court', 'circle'],
      'giant': ['stronghold', 'tribe'],
    };

    // Generate organizations for each race
    context.mortalRaces.forEach((race, raceIndex) => {
      const raceType = race.raceType.toLowerCase();
      const availableTypes = raceOrgTypes[raceType] || ['kingdom', 'city', 'tribe'];
      
      // Each race gets 2-4 organizations based on density
      const orgCount = Math.ceil((2 + Math.floor(context.rng() * 3)) * multiplier);
      
      // Select organization types for this race
      const selectedTypes: OrganizationMagnitude[] = [];
      for (let i = 0; i < orgCount && i < availableTypes.length; i++) {
        const typeIndex = Math.floor(context.rng() * availableTypes.length);
        const type = availableTypes[typeIndex];
        if (!selectedTypes.includes(type)) {
          selectedTypes.push(type);
        }
      }
      
      // Fill remaining slots if needed (with safety limit)
      let fillAttempts = 0;
      const maxFillAttempts = availableTypes.length * 10;
      while (selectedTypes.length < orgCount && fillAttempts < maxFillAttempts) {
        const type = availableTypes[Math.floor(context.rng() * availableTypes.length)];
        if (!selectedTypes.includes(type)) {
          selectedTypes.push(type);
        }
        fillAttempts++;
      }
      
      // If we still don't have enough unique types, just use what we have
      // (This can happen if orgCount > availableTypes.length)
      
      // Generate organizations
      selectedTypes.forEach((orgType, typeIndex) => {
        // Generate organization name
        const orgName = generateOrganizationName(
          orgType,
          context.seed,
          orgIndex,
          race.name,
          usedNames
        );
        
        // Select location (prefer race homeland or related geography)
        const homelandGeo = context.geography.find(g => g.id === race.homeland);
        let locationGeo = homelandGeo;
        
        if (!locationGeo && context.geography.length > 0) {
          // Pick random geography
          const geoIndex = Math.floor(context.rng() * context.geography.length);
          locationGeo = context.geography[geoIndex];
        }
        
        const locationId = locationGeo ? locationGeo.id : null;
        
        // Calculate founding year (after race exists, spaced over time)
        const yearsAfterRace = 100 + (typeIndex * 50);
        const foundingYear = -2500 + (raceIndex * -100) - yearsAfterRace; // Relative to race creation
        
        // Generate founder/leader (simplified - would use StandoutGenerator in full implementation)
        const leaderId = `standout-org-leader-${orgIndex}`;
        
        const org: Organization = {
          id: `org-${orgType}-${orgIndex}`,
          type: 'organization',
          magnitude: orgType,
          name: orgName,
          description: `${orgName} is a ${orgType} of the ${race.name}, established in ${locationGeo?.name || 'unknown lands'}.`,
          parentId: locationId,
          createdAt: new Date(foundingYear),
          discoveredAt: new Date(),
          race: race.id,
          location: locationId || '',
          leader: leaderId,
          members: Math.floor(100 + context.rng() * 900), // 100-1000 members
          purpose: this.getOrganizationPurpose(orgType),
          founded: new Date(foundingYear),
          metadata: {
            seed: context.seed,
            index: orgIndex,
            organizationType: orgType,
            race: race.name,
          },
        };
        
        organizations.push(org);
        orgIndex++;
      });
    });

    console.log(`[OrganizationGenerator] Completed! Generated ${organizations.length} organizations.`);
    return organizations;
  }
  
  /**
   * Get organization purpose based on type
   */
  private getOrganizationPurpose(type: OrganizationMagnitude): string {
    const purposes: Record<OrganizationMagnitude, string> = {
      empire: 'Rule vast territories and maintain imperial power',
      kingdom: 'Govern a realm and protect its people',
      horde: 'Conquer and pillage',
      realm: 'Maintain elven traditions and protect the land',
      city: 'Serve as a center of commerce and culture',
      town: 'Provide a safe haven for travelers and traders',
      tribe: 'Protect tribal lands and maintain traditions',
      guild: 'Train and organize professionals',
      band: 'Adventure and seek fortune',
      clan: 'Maintain family honor and lineage',
      circle: 'Practice and study magic',
      company: 'Trade goods and services',
      mountainhome: 'Mine and forge in the depths',
      nest: 'Scavenge and survive',
      canopy: 'Live in harmony with the forest',
      warren: 'Live peacefully in comfortable burrows',
      stronghold: 'Defend orc territories',
      enclave: 'Preserve knowledge and secrets',
      colony: 'Establish new settlements',
      sanctuary: 'Provide refuge and safety',
      hold: 'Defend dwarven territory',
      grove: 'Protect nature and druidic traditions',
      den: 'Hunt and survive',
      lair: 'Hoard treasure and dominate',
      court: 'Rule with fey magic and whimsy',
      coven: 'Study dark magic',
      coterie: 'Rule over the night',
      conclave: 'Serve the divine',
      academy: 'Teach and learn',
      colosseum: 'Entertain through combat',
      bazaar: 'Trade exotic goods',
      port: 'Facilitate maritime trade',
      fortress: 'Defend strategic locations',
      temple: 'Worship and serve the gods',
      library: 'Preserve and study knowledge',
      forge: 'Create masterworks',
      tower: 'Study arcane mysteries',
      crypt: 'Guard the dead',
      hive: 'Work in perfect unity',
      pack: 'Hunt together',
      pride: 'Rule with majesty',
      flock: 'Soar and migrate',
      school: 'Swim and hunt in the deep',
      pod: 'Travel the currents',
      murder: 'Gather in the shadows',
      swarm: 'Overwhelm through numbers',
    };
    
    return purposes[type] || 'Serve its members';
  }
}
