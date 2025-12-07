/**
 * Mortal Generator
 * 
 * Generates Level 5: Mortal Races
 * Variety of life
 */

import type { MortalRace, GenerationContext, MortalRaceType } from '../types/world-generation';

export class MortalGenerator {
  /**
   * Generate mortal races
   */
  async generate(
    context: GenerationContext,
    customRaces?: string[]
  ): Promise<MortalRace[]> {
    if (context.cosmicCreators.length === 0 && context.demiGods.length === 0) {
      throw new Error('Cosmic creators or demi-gods must be generated before mortal races');
    }

    const mortalRaces: MortalRace[] = [];

    // Race characteristics
    const raceCharacteristics: Record<MortalRaceType, {
      lifespan: { min: number; max: number };
      traits: string[];
      homelandTypes: string[];
    }> = {
      human: { lifespan: { min: 60, max: 100 }, traits: ['Adaptable', 'Ambitious', 'Resourceful'], homelandTypes: ['continent', 'plains', 'coast'] },
      dwarf: { lifespan: { min: 200, max: 350 }, traits: ['Hardy', 'Skilled Craftsmen', 'Tunnel-sighted'], homelandTypes: ['mountain_range', 'underground_system'] },
      elf: { lifespan: { min: 500, max: 750 }, traits: ['Long-lived', 'Graceful', 'Magically Attuned'], homelandTypes: ['forest', 'canopy', 'grove'] },
      orc: { lifespan: { min: 40, max: 60 }, traits: ['Strong', 'Aggressive', 'Tribal'], homelandTypes: ['desert', 'badlands', 'stronghold'] },
      goblin: { lifespan: { min: 20, max: 40 }, traits: ['Quick', 'Cunning', 'Resourceful'], homelandTypes: ['nest', 'swamp', 'underground_system'] },
      halfling: { lifespan: { min: 80, max: 120 }, traits: ['Lucky', 'Stealthy', 'Content'], homelandTypes: ['warren', 'town', 'plains'] },
      gnome: { lifespan: { min: 300, max: 500 }, traits: ['Inventive', 'Curious', 'Magical'], homelandTypes: ['enclave', 'town', 'forest'] },
      dragon: { lifespan: { min: 2000, max: 5000 }, traits: ['Powerful', 'Ancient', 'Hoarding'], homelandTypes: ['lair', 'mountain_range'] },
      undead: { lifespan: { min: 0, max: 0 }, traits: ['Undying', 'Dark', 'Unholy'], homelandTypes: ['crypt', 'graveyard'] },
      construct: { lifespan: { min: 0, max: 0 }, traits: ['Artificial', 'Durable', 'Obedient'], homelandTypes: ['forge', 'city'] },
      elemental: { lifespan: { min: 1000, max: 3000 }, traits: ['Elemental', 'Powerful', 'Primordial'], homelandTypes: ['volcano', 'ocean', 'mountain_range'] },
      fey: { lifespan: { min: 500, max: 1000 }, traits: ['Magical', 'Trickster', 'Nature-bound'], homelandTypes: ['court', 'grove', 'forest'] },
      giant: { lifespan: { min: 400, max: 600 }, traits: ['Massive', 'Strong', 'Ancient'], homelandTypes: ['mountain_range', 'stronghold'] },
      tiefling: { lifespan: { min: 80, max: 120 }, traits: ['Fiend-touched', 'Charismatic', 'Resilient'], homelandTypes: ['city', 'town'] },
      aasimar: { lifespan: { min: 100, max: 150 }, traits: ['Celestial-touched', 'Radiant', 'Divine'], homelandTypes: ['temple', 'city'] },
      genasi: { lifespan: { min: 90, max: 130 }, traits: ['Elemental-touched', 'Adaptable', 'Magical'], homelandTypes: ['city', 'town'] },
      kobold: { lifespan: { min: 50, max: 80 }, traits: ['Small', 'Crafty', 'Tunnel-dwelling'], homelandTypes: ['nest', 'underground_system'] },
      lizardfolk: { lifespan: { min: 60, max: 90 }, traits: ['Reptilian', 'Aquatic', 'Primitive'], homelandTypes: ['swamp', 'jungle'] },
      yuan_ti: { lifespan: { min: 100, max: 150 }, traits: ['Serpentine', 'Cunning', 'Magical'], homelandTypes: ['jungle', 'temple'] },
      kenku: { lifespan: { min: 50, max: 80 }, traits: ['Avian', 'Mimics', 'Thieves'], homelandTypes: ['city', 'town'] },
      tabaxi: { lifespan: { min: 70, max: 100 }, traits: ['Feline', 'Curious', 'Nimble'], homelandTypes: ['jungle', 'forest'] },
      triton: { lifespan: { min: 150, max: 200 }, traits: ['Aquatic', 'Noble', 'Warrior'], homelandTypes: ['ocean', 'coast'] },
      goliath: { lifespan: { min: 70, max: 100 }, traits: ['Large', 'Strong', 'Mountain-dwellers'], homelandTypes: ['mountain_range', 'plateau'] },
      bugbear: { lifespan: { min: 60, max: 90 }, traits: ['Large', 'Stealthy', 'Aggressive'], homelandTypes: ['forest', 'stronghold'] },
      hobgoblin: { lifespan: { min: 60, max: 90 }, traits: ['Military', 'Disciplined', 'Organized'], homelandTypes: ['stronghold', 'fortress'] },
      orc_variant: { lifespan: { min: 40, max: 60 }, traits: ['Strong', 'Tribal', 'Warlike'], homelandTypes: ['desert', 'badlands'] },
      drow: { lifespan: { min: 500, max: 750 }, traits: ['Dark', 'Spider-worshiping', 'Elite'], homelandTypes: ['underground_system', 'city'] },
      wood_elf: { lifespan: { min: 500, max: 750 }, traits: ['Forest-dwelling', 'Wild', 'Natural'], homelandTypes: ['forest', 'grove'] },
      high_elf: { lifespan: { min: 500, max: 750 }, traits: ['Noble', 'Magical', 'Refined'], homelandTypes: ['city', 'canopy'] },
      deep_gnome: { lifespan: { min: 300, max: 500 }, traits: ['Underground', 'Stone-work', 'Cunning'], homelandTypes: ['underground_system', 'enclave'] },
      rock_gnome: { lifespan: { min: 300, max: 500 }, traits: ['Inventive', 'Mechanical', 'Curious'], homelandTypes: ['enclave', 'city'] },
      forest_gnome: { lifespan: { min: 300, max: 500 }, traits: ['Nature-bond', 'Illusionist', 'Small'], homelandTypes: ['forest', 'grove'] },
      aarakocra: { lifespan: { min: 30, max: 50 }, traits: ['Avian', 'Sky-born', 'Flying'], homelandTypes: ['mountain_range', 'plateau'] },
      merfolk: { lifespan: { min: 80, max: 150 }, traits: ['Aquatic', 'Amphibious', 'Ocean-dwelling'], homelandTypes: ['ocean', 'coast'] },
    };

    // Predefined cosmic creator to race mappings
    const cosmicCreatorRaces: Record<string, MortalRaceType[]> = {
      life: ['human'],
      earth: ['elf', 'halfling'],
      rock: ['dwarf', 'gnome'],
      fire: ['orc', 'goblin', 'kobold'],
      wind: ['aarakocra', 'dragon'],
      water: ['merfolk'],
    };

    // Select appropriate creators for each race (legacy mapping for custom races)
    const raceCreatorMapping: Record<MortalRaceType, string[]> = {
      human: ['life'],
      dwarf: ['rock', 'earth'],
      elf: ['life', 'nature'],
      orc: ['chaos', 'war'],
      goblin: ['dark', 'chaos'],
      halfling: ['life', 'earth'],
      gnome: ['earth', 'magic'],
      dragon: ['fire', 'earth'],
      undead: ['dark', 'death'],
      construct: ['earth', 'order'],
      elemental: ['fire', 'water', 'earth', 'air'],
      fey: ['life', 'nature'],
      giant: ['earth', 'rock'],
      tiefling: ['fire', 'chaos'],
      aasimar: ['light', 'order'],
      genasi: ['fire', 'water', 'earth', 'air'],
      kobold: ['earth', 'dark'],
      lizardfolk: ['water', 'life'],
      yuan_ti: ['dark', 'wisdom'],
      kenku: ['air', 'wind'],
      tabaxi: ['nature', 'chaos'],
      triton: ['water'],
      goliath: ['earth', 'rock'],
      bugbear: ['dark', 'chaos'],
      hobgoblin: ['order', 'war'],
      orc_variant: ['chaos', 'war'],
      drow: ['dark', 'magic'],
      wood_elf: ['life', 'nature'],
      high_elf: ['light', 'magic'],
      deep_gnome: ['earth', 'dark'],
      rock_gnome: ['earth', 'rock'],
      forest_gnome: ['nature', 'life'],
    };

    // Generate races based on predefined arrangements
    let raceIndex = 0;
    
    // Determine which races to generate
    const racesToGenerate: MortalRaceType[] = [];
    
    if (customRaces && customRaces.length > 0) {
      // Custom races provided - use those
      racesToGenerate.push(...(customRaces as MortalRaceType[]));
    } else {
      // No custom races - generate all races from predefined arrangements
      context.cosmicCreators.forEach(creator => {
        const racesForCreator = cosmicCreatorRaces[creator.element] || [];
        racesForCreator.forEach(race => {
          if (!racesToGenerate.includes(race)) {
            racesToGenerate.push(race);
          }
        });
      });
    }
    
    // Generate each race, finding its creator from predefined arrangements
    racesToGenerate.forEach(raceType => {
      // Find which cosmic creator should create this race
      let creator = null;
      for (const [element, races] of Object.entries(cosmicCreatorRaces)) {
        if (races.includes(raceType)) {
          creator = context.cosmicCreators.find(c => c.element === element);
          if (creator) break;
        }
      }
      
      // Fallback if creator not found (for custom races not in predefined mapping)
      if (!creator && context.cosmicCreators.length > 0) {
        creator = context.cosmicCreators[raceIndex % context.cosmicCreators.length];
      }
      
      if (creator) {
        
        const raceData = raceCharacteristics[raceType] || raceCharacteristics.human;
        const index = raceIndex++;
        
        const creatorId = creator.id;
        const creatorName = creator.name;

        // Find appropriate homeland geography
        const preferredHomelandTypes = raceData.homelandTypes;
        let homeland = context.geography.find(g => 
          preferredHomelandTypes.includes(g.geographyType)
        );
        
        // Fallback to any geography
        if (!homeland && context.geography.length > 0) {
          homeland = context.geography[index % context.geography.length];
        }

        const homelandId = homeland?.id || 'unknown';
        const homelandName = homeland?.name || 'Unknown Lands';

        // Calculate creation year (spaced out after cosmic creators)
        const baseYear = -3000;
        const creationYear = new Date(baseYear - (index * 100));

        // Generate race name
        const raceName = this.capitalizeFirst(raceType.replace(/_/g, ' '));
        const entityId = `race-${raceType}`;

        // Generate creation description
        const creationMethods = [
          `were given life by ${creatorName}`,
          `were born from the essence of ${creatorName}`,
          `emerged as ${creatorName} breathed life into the world`,
          `were created when ${creatorName} shaped the first mortals`,
        ];
        const method = creationMethods[Math.floor(context.rng() * creationMethods.length)];

        const mortalRace: MortalRace = {
          id: entityId,
          type: 'mortal_race',
          raceType: raceType,
          name: raceName,
          description: `The ${raceName} ${method} and settled in ${homelandName}, establishing the first mortal civilizations.`,
          parentId: creatorId,
          createdAt: creationYear,
          discoveredAt: new Date(),
          createdBy: creatorId,
          homeland: homelandId,
          characteristics: raceData.traits,
          lifespan: raceData.lifespan,
          population: 1000 + Math.floor(context.rng() * 9000), // 1000-10000 initial population
        };

        mortalRaces.push(mortalRace);
      }
    });

    return mortalRaces;
  }

  /**
   * Capitalize first letter of string
   */
  private capitalizeFirst(str: string): string {
    return str.charAt(0).toUpperCase() + str.slice(1);
  }
}
