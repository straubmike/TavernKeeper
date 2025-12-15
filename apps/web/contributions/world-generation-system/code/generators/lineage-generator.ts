/**
 * Lineage Generator
 * 
 * Generates Level 7: Family and Role
 * Individual mortals and their place in history
 */

import type { FamilyMember, FamilyLineage, GenerationContext, RoleType } from '../types/world-generation';

export class LineageGenerator {
  /**
   * Generate family lineages and members
   * Creates a family lineage FOR each standout mortal
   */
  async generate(context: GenerationContext): Promise<{
    members: FamilyMember[];
    lineages: FamilyLineage[];
  }> {
    if (context.mortalRaces.length === 0) {
      throw new Error('Mortal races must be generated before family lineages');
    }

    if (context.standoutMortals.length === 0) {
      console.warn('No standout mortals found - cannot generate family lineages');
      return { members: [], lineages: [] };
    }

    const members: FamilyMember[] = [];
    const lineages: FamilyLineage[] = [];

    // Create a family lineage for each standout mortal
    context.standoutMortals.forEach((standout, i) => {
      const race = context.mortalRaces.find(r => r.id === standout.race);
      if (!race) return; // Skip if race not found

      const raceName = this.formatRaceName(race.name);
      
      // Get location from standout mortal
      let location = null;
      if (standout.location && standout.location !== 'unknown') {
        location = context.geography.find(g => g.id === standout.location);
      }
      // Fallback to race homeland
      if (!location && race.homeland) {
        location = context.geography.find(g => g.id === race.homeland);
      }
      // Final fallback
      if (!location && context.geography.length > 0) {
        location = context.geography[Math.floor(context.rng() * context.geography.length)];
      }

      // Generate family name
      const familyName = this.generateFamilyName(raceName, context, i);

      // Calculate founding year (based on standout mortal's creation)
      const founderYear = standout.createdAt instanceof Date 
        ? standout.createdAt.getTime() 
        : new Date(-2500).getTime();
      const lineageYear = new Date(founderYear - (i * 100));

      const lineageId = `lineage-${standout.id}`;

      // Create lineage - the standout mortal IS the founder
      const lineage: FamilyLineage = {
        id: lineageId,
        name: familyName,
        race: race.id,
        origin: location?.id || 'unknown',
        members: [],
        notableMembers: [standout.id], // Standout mortal is the notable member
        history: `The ${familyName} is a ${raceName} family founded by ${standout.name}, a ${standout.standoutType.replace(/_/g, ' ')}${location ? ` from ${location.name}` : ''}.`,
        founded: lineageYear,
        parentId: standout.id, // Family lineage is created by the standout mortal
      };

      lineages.push(lineage);

      // Register a few key family members with roles
      const roles: RoleType[] = ['blacksmith', 'merchant', 'soldier', 'scholar', 'priest', 'noble', 'artisan', 'innkeeper', 'farmer', 'guard'];
      const roleCount = 3 + Math.floor(context.rng() * 3); // 3-5 additional members per family

      // Generate additional family members (the standout mortal is implicitly the first member)
      for (let j = 0; j < roleCount; j++) {
        const role = roles[Math.floor(context.rng() * roles.length)];
        const memberYear = new Date(lineageYear.getTime() - ((j + 1) * 20 * 365 * 24 * 60 * 60 * 1000)); // Space them out

        const memberName = this.generateFamilyMemberName(raceName, familyName, context, j);
        const memberId = `family-${standout.id}-${j}`;

        // Register family member
        const member: FamilyMember = {
          id: memberId,
          name: memberName,
          role: role,
          race: race.id,
          lineage: lineageId,
          location: location?.id || 'unknown',
          createdAt: memberYear,
          discoveredAt: new Date(),
          metadata: {
            seed: context.seed,
            memberIndex: j,
            lineageIndex: i,
            standoutMortalId: standout.id,
          },
        };

        members.push(member);
        lineage.members.push(memberId);
      }
    });

    return {
      members,
      lineages,
    };
  }

  /**
   * Generate family name based on race
   */
  private generateFamilyName(raceName: string, context: GenerationContext, index: number): string {
    const familyNamePrefixes: Record<string, string[]> = {
      'Human': ['House', 'Family', 'Clan', 'Dynasty'],
      'Dwarf': ['Clan', 'House', 'Hold', 'Bloodline'],
      'Elf': ['House', 'Family', 'Line', 'Bloodline'],
      'Orc': ['Clan', 'Tribe', 'Blood', 'Horde'],
      'Goblin': ['Tribe', 'Clan', 'Gang', 'Pack'],
      'Halfling': ['Family', 'Clan', 'House', 'Line'],
      'Gnome': ['House', 'Family', 'Clan', 'Line'],
    };

    const prefixes = familyNamePrefixes[raceName] || ['Family'];
    const prefix = prefixes[Math.floor(context.rng() * prefixes.length)];

    const familyNames: Record<string, string[]> = {
      'Human': ['Stormwind', 'Ironheart', 'Goldleaf', 'Brightblade', 'Thornwood'],
      'Dwarf': ['Ironforge', 'Stonehammer', 'Goldbeard', 'Deepforge', 'Thunderaxe'],
      'Elf': ['Moonwhisper', 'Starweaver', 'Lightbreeze', 'Silverleaf', 'Shadowglen'],
      'Orc': ['Bloodfang', 'Skullcrusher', 'Ironjaw', 'Goreaxe', 'Bonebreaker'],
      'Goblin': ['Quickfinger', 'Sharpnose', 'Greedygrab', 'Sneakypaw'],
      'Halfling': ['Greenbottle', 'Goldcup', 'Merryweather', 'Quickstep'],
      'Gnome': ['Cogwheel', 'Gearbox', 'Springwind', 'Tinkerbell'],
    };

    const surnames = familyNames[raceName] || ['Unknown'];
    const surnameIndex = (index + Math.floor(context.rng() * 1000)) % surnames.length;
    const surname = surnames[surnameIndex];

    return `${prefix} ${surname}`;
  }

  /**
   * Generate family member name
   */
  private generateFamilyMemberName(
    raceName: string,
    familyName: string,
    context: GenerationContext,
    index: number
  ): string {
    // Extract surname from family name (e.g., "House Stormwind" -> "Stormwind")
    const surname = familyName.split(' ').slice(1).join(' ') || 'Unknown';

    const firstNames: Record<string, string[]> = {
      'Human': ['Aethelred', 'Isolde', 'Valerius', 'Elena', 'Marcus', 'Sophia'],
      'Dwarf': ['Thorgrim', 'Borin', 'Helga', 'Grimbold', 'Thorin', 'Dagna'],
      'Elf': ['Aeliana', 'Thalius', 'Lyralei', 'Elandris', 'Sylvan', 'Arielle'],
      'Orc': ['Grubnak', 'Bloodaxe', 'Skullcrusher', 'Grimjaw'],
      'Goblin': ['Snikkit', 'Gribble', 'Nix', 'Zog'],
      'Halfling': ['Bilbo', 'Frodo', 'Merry', 'Pippin'],
      'Gnome': ['Fizzle', 'Gizmo', 'Tinker', 'Sparkle'],
    };

    const nameList = firstNames[raceName] || ['Unknown'];
    const firstNameIndex = (index + Math.floor(context.rng() * 1000)) % nameList.length;
    const firstName = nameList[firstNameIndex];

    return `${firstName} ${surname}`;
  }

  /**
   * Format race name (remove "The" prefix if present)
   */
  private formatRaceName(raceName: string): string {
    return raceName.replace(/^The /, '');
  }
}
