/**
 * Demi-God Generator
 * 
 * Generates Level 4: Demi-Gods
 * Divine experiments and ancient beings
 */

import type {
  DemiGod,
  GenerationContext,
  DemiGodType,
  HalfGodRace,
  AncientCreatureType,
  AnimalFeature,
  FallenDivineType,
  PrimordialSpawnType,
} from '../types/world-generation';
import {
  NameTemplates,
  getDemiGodDescription,
  generateName,
} from '../templates/world-templates';

export class DemiGodGenerator {
  /**
   * Generate demi-gods
   */
  async generate(context: GenerationContext): Promise<DemiGod[]> {
    if (context.cosmicCreators.length === 0 && context.conceptualBeings.length === 0) {
      // Can still generate from primordials
      if (context.primordials.length === 0) {
        throw new Error('Primordials, cosmic creators, or conceptual beings must be generated before demi-gods');
      }
    }

    const demiGods: DemiGod[] = [];
    const demiGodTypes: DemiGodType[] = [
      'half_god',
      'ancient_creature',
      'divine_experiment',
      'fallen_divine',
      'ascended_mortal',
      'primordial_spawn',
    ];

    const usedNames = new Set<string>(); // Track used names to prevent duplicates
    const divineExperimentCreators = new Set<string>(); // Track creators used for divine experiments

    // Generate 1-3 demi-gods of each type
    demiGodTypes.forEach((type, typeIndex) => {
      const count = this.getCountForType(type, context.rng);
      
      for (let i = 0; i < count; i++) {
        const index = demiGods.length;
        const demiGod = this.generateDemiGod(context, type, index, typeIndex, usedNames, divineExperimentCreators);
        demiGods.push(demiGod);
      }
    });

    return demiGods;
  }

  /**
   * Generate a single demi-god
   */
  private generateDemiGod(
    context: GenerationContext,
    type: DemiGodType,
    index: number,
    typeIndex: number,
    usedNames: Set<string>,
    divineExperimentCreators: Set<string>
  ): DemiGod {
    const name = generateName(
      NameTemplates.demigod[type],
      context.seed,
      index,
      usedNames // Pass usedNames to ensure uniqueness
    );

    // Determine origin (pass divineExperimentCreators to ensure unique creators)
    const origin = this.selectOrigin(context, type, divineExperimentCreators);

    // Generate subtype-specific data (pass origin to restrict races for conceptual beings)
    const subtype = this.generateSubtype(context, type, index, origin);

    // Generate description
    const description = getDemiGodDescription(type, name, origin, subtype);

    // Generate powers
    const powers = this.generatePowers(type, subtype, context.rng);

    // Determine alignment
    const alignment = this.determineAlignment(type, subtype, context.rng);

    // Determine age
    const age = this.determineAge(type, context.rng);

    const demiGod: DemiGod = {
      id: `demigod-${type}-${index}`,
      type: 'demigod',
      demiGodType: type,
      name,
      description,
      parentId: origin,
      createdAt: new Date(Date.now() - age * 365 * 24 * 60 * 60 * 1000),
      discoveredAt: new Date(),
      origin,
      age,
      powers,
      alignment,
      isBoss: alignment === 'evil', // Evil demi-gods are dungeon boss candidates
      ...subtype,
      metadata: {
        seed: context.seed,
        index,
        typeIndex,
      },
    };

    return demiGod;
  }

  /**
   * Get count of demi-gods to generate for a type
   */
  private getCountForType(type: DemiGodType, rng: () => number): number {
    const baseCounts: Record<DemiGodType, number> = {
      half_god: 2,
      ancient_creature: 3,
      divine_experiment: 2,
      fallen_divine: 1,
      ascended_mortal: 1,
      primordial_spawn: 1,
    };
    const base = baseCounts[type] || 1;
    // Add some randomness
    return base + Math.floor(rng() * 2);
  }

  /**
   * Select origin for demi-god
   * For divine experiments, ensures each creator only creates one experiment
   */
  private selectOrigin(
    context: GenerationContext,
    type: DemiGodType,
    divineExperimentCreators: Set<string>
  ): string {
    // Prefer conceptual beings for some types, cosmic creators for others
    if (type === 'half_god' || type === 'ascended_mortal') {
      if (context.conceptualBeings.length > 0) {
        const index = Math.floor(context.rng() * context.conceptualBeings.length);
        return context.conceptualBeings[index].id;
      }
    }
    
    if (type === 'divine_experiment') {
      // Each divine experiment must have a unique creator
      const availableCreators = context.cosmicCreators.filter(c => 
        !divineExperimentCreators.has(c.id)
      );
      
      if (availableCreators.length > 0) {
        const index = Math.floor(context.rng() * availableCreators.length);
        const creatorId = availableCreators[index].id;
        divineExperimentCreators.add(creatorId); // Mark creator as used
        return creatorId;
      }
      
      // If all creators used, allow reuse but prefer conceptual beings
      if (context.conceptualBeings.length > 0) {
        const index = Math.floor(context.rng() * context.conceptualBeings.length);
        return context.conceptualBeings[index].id;
      }
      
      // Fallback to cosmic creators
      if (context.cosmicCreators.length > 0) {
        const index = Math.floor(context.rng() * context.cosmicCreators.length);
        return context.cosmicCreators[index].id;
      }
    }

    if (type === 'primordial_spawn') {
      if (context.primordials.length > 0) {
        const index = Math.floor(context.rng() * context.primordials.length);
        return context.primordials[index].id;
      }
    }

    // Fallback to any available
    if (context.cosmicCreators.length > 0) {
      const index = Math.floor(context.rng() * context.cosmicCreators.length);
      return context.cosmicCreators[index].id;
    }
    if (context.primordials.length > 0) {
      const index = Math.floor(context.rng() * context.primordials.length);
      return context.primordials[index].id;
    }
    
    return 'unknown';
  }

  /**
   * Generate subtype information
   */
  private generateSubtype(
    context: GenerationContext,
    type: DemiGodType,
    index: number,
    origin: string
  ): Partial<{
    halfGodRace: HalfGodRace;
    ancientCreatureType: AncientCreatureType;
    divineExperimentFeatures: AnimalFeature[];
    fallenDivineType: FallenDivineType;
    primordialSpawnType: PrimordialSpawnType;
  }> {
    switch (type) {
      case 'half_god': {
        // Check if origin is a conceptual being - if so, restrict to that race
        const conceptualBeing = context.conceptualBeings.find(cb => cb.id === origin);
        if (conceptualBeing && conceptualBeing.worshipedBy && conceptualBeing.worshipedBy.length > 0) {
          // Get the race that worshiped this conceptual being
          const worshipingRaceId = conceptualBeing.worshipedBy[0];
          const worshipingRace = context.mortalRaces.find(r => r.id === worshipingRaceId);
          
          if (worshipingRace) {
            // Map race type to half-god race
            // For races that exist in both types, use direct mapping
            // For races that don't exist in HalfGodRace, map to closest match
            const raceTypeToHalfGodRace: Record<string, HalfGodRace> = {
              // Direct matches
              'human': 'human',
              'elf': 'elf',
              'dwarf': 'dwarf',
              'orc': 'orc',
              'goblin': 'goblin',
              'halfling': 'halfling',
              'gnome': 'gnome',
              'dragon': 'dragon',
              'fey': 'fey',
              'giant': 'giant',
              'tiefling': 'tiefling',
              'aasimar': 'aasimar',
              'genasi': 'genasi',
              'kobold': 'kobold',
              'lizardfolk': 'lizardfolk',
              'yuan_ti': 'yuan_ti',
              'kenku': 'kenku',
              // Variants map to base race
              'drow': 'elf',
              'wood_elf': 'elf',
              'high_elf': 'elf',
              'deep_gnome': 'gnome',
              'rock_gnome': 'gnome',
              'forest_gnome': 'gnome',
              'orc_variant': 'orc',
              // Similar races
              'tabaxi': 'fey', // Cat-like, closest to fey
              'triton': 'genasi', // Water-based, closest to genasi
              'goliath': 'giant', // Large humanoid, closest to giant
              'bugbear': 'goblin', // Goblinoid
              'hobgoblin': 'goblin', // Goblinoid
              // Special cases
              'undead': 'undead',
              'construct': 'construct',
              'elemental': 'elemental',
            };
            
            const halfGodRace = raceTypeToHalfGodRace[worshipingRace.raceType] || 'human';
            return { halfGodRace };
          }
        }
        
        // For non-conceptual origins (primordials, cosmic creators), allow any race
        const races: HalfGodRace[] = [
          'human', 'elf', 'dwarf', 'orc', 'dragon', 'fey', 'giant',
          'tiefling', 'aasimar', 'genasi', 'kobold', 'lizardfolk',
        ];
        const raceIndex = Math.floor(context.rng() * races.length);
        return { halfGodRace: races[raceIndex] };
      }

      case 'ancient_creature': {
        const creatures: AncientCreatureType[] = [
          'hydra', 'kraken', 'phoenix', 'colossus', 'leviathan',
          'behemoth', 'basilisk', 'chimera', 'griffin', 'roc',
          'sphinx', 'wyvern', 'manticore', 'cerberus', 'pegasus',
          'unicorn', 'dragon_turtle', 'tarrasque',
        ];
        const creatureIndex = Math.floor(context.rng() * creatures.length);
        return { ancientCreatureType: creatures[creatureIndex] };
      }

      case 'divine_experiment': {
        // Select 3-6 random features
        const allFeatures: AnimalFeature[] = [
          // Basic features
          'scales', 'fur', 'feathers', 'claws', 'fangs',
          'horns', 'tentacles', 'tail', 'mane', 'shell', 'venom',
          'multiple_heads', 'multiple_limbs', 'gills', 'trunk',
          'hooves', 'paws', 'beak', 'antlers', 'wings',
          // Bug-like features
          'scorpion_stinger', 'web_spinner', 'compound_eyes',
          'carapace', 'antenna', 'finger_like_mandibles',
          // Wing varieties (mutually exclusive with basic 'wings')
          'bat_wings', 'bird_wings', 'insect_wings',
          // Non-animal specific features
          'bony_protrusions', 'patches_of_hair', 'skin_boils',
          'crawling_with_maggots',
          // Attack methods
          'searing_hot_to_touch', 'emits_noxious_fumes',
          'breathes_thick_smokescreen', 'dims_light_around_it',
          'rusts_metal_with_spit',
        ];
        const featureCount = 3 + Math.floor(context.rng() * 4); // 3-6 features
        const selectedFeatures: AnimalFeature[] = [];
        const availableFeatures = [...allFeatures];
        
        for (let i = 0; i < featureCount && availableFeatures.length > 0; i++) {
          const featureIndex = Math.floor(context.rng() * availableFeatures.length);
          const selectedFeature = availableFeatures[featureIndex];
          selectedFeatures.push(selectedFeature);
          availableFeatures.splice(featureIndex, 1);
          
          // Remove mutually exclusive features
          if (selectedFeature === 'bat_wings' || selectedFeature === 'bird_wings' || selectedFeature === 'insect_wings') {
            // Remove generic wings if specific wing type selected
            const wingIndex = availableFeatures.indexOf('wings' as AnimalFeature);
            if (wingIndex !== -1) availableFeatures.splice(wingIndex, 1);
            // Remove other specific wing types
            (['bat_wings', 'bird_wings', 'insect_wings'] as AnimalFeature[]).forEach(wingType => {
              const otherWingIndex = availableFeatures.indexOf(wingType);
              if (otherWingIndex !== -1) availableFeatures.splice(otherWingIndex, 1);
            });
          } else if (selectedFeature === 'wings') {
            // Remove specific wing types if generic wings selected
            (['bat_wings', 'bird_wings', 'insect_wings'] as AnimalFeature[]).forEach(wingType => {
              const specificWingIndex = availableFeatures.indexOf(wingType);
              if (specificWingIndex !== -1) availableFeatures.splice(specificWingIndex, 1);
            });
          }
        }
        
        return { divineExperimentFeatures: selectedFeatures };
      }

      case 'fallen_divine': {
        const fallenTypes: FallenDivineType[] = [
          'fallen_angel', 'risen_demon', 'lost_celestial',
          'corrupted_seraph', 'exiled_archon', 'tainted_deva',
          'dark_angel', 'infernal_being',
        ];
        const fallenIndex = Math.floor(context.rng() * fallenTypes.length);
        return { fallenDivineType: fallenTypes[fallenIndex] };
      }

      case 'primordial_spawn': {
        const spawnTypes: PrimordialSpawnType[] = [
          'chaos_born', 'order_manifest',
          'time_child', 'space_fragment', 'light_shard',
          'dark_essence',
        ];
        const spawnIndex = Math.floor(context.rng() * spawnTypes.length);
        return { primordialSpawnType: spawnTypes[spawnIndex] };
      }

      default:
        return {};
    }
  }

  /**
   * Generate powers based on type and subtype
   */
  private generatePowers(
    type: DemiGodType,
    subtype: any,
    rng: () => number
  ): string[] {
    const powers: string[] = [];

    switch (type) {
      case 'half_god':
        powers.push('Divine Magic', 'Mortal Empathy', 'Immortal Longevity');
        if (subtype.halfGodRace === 'dragon') powers.push('Dragon Breath');
        if (subtype.halfGodRace === 'fey') powers.push('Fey Glamour');
        break;

      case 'ancient_creature':
        const creature = subtype.ancientCreatureType;
        if (creature === 'phoenix') powers.push('Immortal Rebirth', 'Flame Mastery');
        else if (creature === 'hydra') powers.push('Regeneration', 'Multiple Attacks');
        else if (creature === 'kraken') powers.push('Tentacle Mastery', 'Deep Sea Control');
        else if (creature === 'basilisk') powers.push('Petrifying Gaze', 'Venomous Bite');
        else powers.push('Ancient Strength', 'Primal Power');
        break;

      case 'divine_experiment':
        const features = subtype.divineExperimentFeatures || [];
        // Flight powers
        if (features.includes('wings') || features.includes('bat_wings') || 
            features.includes('bird_wings') || features.includes('insect_wings')) {
          powers.push('Flight');
        }
        // Defensive powers
        if (features.includes('venom') || features.includes('scorpion_stinger')) {
          powers.push('Venomous Attack');
        }
        if (features.includes('multiple_heads')) powers.push('Multi-Sight', 'Multiple Attacks');
        if (features.includes('gills')) powers.push('Aquatic Adaptation');
        if (features.includes('scales') || features.includes('carapace') || features.includes('shell')) {
          powers.push('Natural Armor');
        }
        if (features.includes('claws') || features.includes('finger_like_mandibles')) {
          powers.push('Razor Claws');
        }
        // Bug-like powers
        if (features.includes('web_spinner')) powers.push('Web Spinning');
        if (features.includes('compound_eyes')) powers.push('360-Degree Vision');
        if (features.includes('antenna')) powers.push('Enhanced Senses');
        // Attack method powers
        if (features.includes('searing_hot_to_touch')) powers.push('Searing Touch');
        if (features.includes('emits_noxious_fumes')) powers.push('Toxic Fumes');
        if (features.includes('breathes_thick_smokescreen')) powers.push('Smokescreen');
        if (features.includes('dims_light_around_it')) powers.push('Darkness Aura');
        if (features.includes('rusts_metal_with_spit')) powers.push('Corrosive Spit');
        powers.push('Divine Resilience', 'Hybrid Form');
        break;

      case 'fallen_divine':
        powers.push('Dark Light Manipulation', 'Immortal Resilience', 'Fallen Grace');
        break;

      case 'ascended_mortal':
        powers.push('Divine Authority', 'Mortal Empathy', 'Heroic Legacy');
        break;

      case 'primordial_spawn':
        powers.push('Reality Distortion', 'Primordial Power', 'Formless Shape');
        break;
    }

    return powers;
  }

  /**
   * Determine alignment
   */
  private determineAlignment(
    type: DemiGodType,
    subtype: any,
    rng: () => number
  ): 'good' | 'neutral' | 'evil' {
    switch (type) {
      case 'fallen_divine':
        return 'evil';
      case 'ancient_creature':
        if (subtype.ancientCreatureType === 'phoenix' || subtype.ancientCreatureType === 'unicorn') {
          return 'good';
        }
        if (subtype.ancientCreatureType === 'tarrasque' || subtype.ancientCreatureType === 'manticore') {
          return 'evil';
        }
        return 'neutral';
      case 'divine_experiment':
        // Experiments are often neutral or chaotic
        return rng() > 0.7 ? 'evil' : 'neutral';
      default:
        const roll = rng();
        if (roll < 0.33) return 'good';
        if (roll < 0.66) return 'neutral';
        return 'evil';
    }
  }

  /**
   * Determine age in years
   */
  private determineAge(type: DemiGodType, rng: () => number): number {
    const ageRanges: Record<DemiGodType, [number, number]> = {
      half_god: [100, 5000],
      ancient_creature: [1000000, 10000000],
      divine_experiment: [500000, 5000000],
      fallen_divine: [10000, 100000],
      ascended_mortal: [100, 10000],
      primordial_spawn: [5000000, 50000000],
    };

    const [min, max] = ageRanges[type] || [1000, 10000];
    return Math.floor(min + rng() * (max - min));
  }
}






