/**
 * Geography Generator
 * 
 * Generates Level 2.5: Geography
 * Physical features of the world
 */

import type {
  Geography,
  GeographyType,
  GenerationContext,
  CosmicCreator,
} from '../types/world-generation';
import { NameTemplates, getGeographyDescription, generateName } from '../templates/world-templates';

export class GeographyGenerator {
  /**
   * Generate geography
   */
  async generate(
    context: GenerationContext
  ): Promise<Geography[]> {
    if (context.cosmicCreators.length === 0) {
      throw new Error('Cosmic creators must be generated before geography');
    }

    const geographyTypes: Array<{ type: GeographyType; count: number }> = [
      { type: 'continent', count: 3 },
      { type: 'ocean', count: 2 },
      { type: 'mountain_range', count: 5 },
      { type: 'river', count: 8 },
      { type: 'forest', count: 6 },
      { type: 'desert', count: 2 },
      { type: 'underground_system', count: 3 },
      { type: 'swamp', count: 3 },
      { type: 'tundra', count: 2 },
      { type: 'canyon', count: 4 },
      { type: 'archipelago', count: 2 },
      { type: 'fjord', count: 2 },
      { type: 'steppe', count: 3 },
      { type: 'jungle', count: 4 },
      { type: 'badlands', count: 2 },
      { type: 'glacier', count: 2 },
      { type: 'marsh', count: 3 },
      { type: 'plateau', count: 3 },
      { type: 'coast', count: 6 },
      { type: 'bay', count: 4 },
      { type: 'peninsula', count: 3 },
    ];

    const geography: Geography[] = [];
    let index = 0;
    const usedNames = new Set<string>(); // Track used names to ensure uniqueness

    geographyTypes.forEach(({ type, count }) => {
      for (let i = 0; i < count; i++) {
        // Assign to an appropriate cosmic creator based on geography type
        const createdBy = this.selectAppropriateCreator(type, context.cosmicCreators, context.rng, index);

        // Use random selection with uniqueness tracking
        const name = generateName(
          NameTemplates.geography[type],
          context.seed,
          index,
          usedNames, // Pass usedNames set to ensure uniqueness
          context.rng // Pass RNG for random selection
        );

        const geo: Geography = {
          id: `geo-${type}-${index}`,
          type: 'geography',
          geographyType: type,
          name,
          description: getGeographyDescription(type, name, createdBy),
          parentId: createdBy,
          createdAt: new Date(2000), // After cosmic creators
          discoveredAt: new Date(),
          createdBy,
          magnitude: this.getMagnitude(type),
          location: this.generateLocation(context.rng, index), // TODO: Remove - location generation will be replaced by new map system
          metadata: {
            seed: context.seed,
            index,
            geographyType: type,
          },
        };

        geography.push(geo);
        index++;
      }
    });

    return geography;
  }

  /**
   * Get magnitude for geography type
   */
  private getMagnitude(type: GeographyType): 'vast' | 'large' | 'medium' | 'small' {
    const magnitudes: Record<GeographyType, 'vast' | 'large' | 'medium' | 'small'> = {
      continent: 'vast',
      ocean: 'vast',
      mountain_range: 'large',
      river: 'medium',
      underground_system: 'large',
      forest: 'large',
      desert: 'large',
      plains: 'medium',
      island: 'small',
      volcano: 'small',
      swamp: 'medium',
      tundra: 'large',
      canyon: 'large',
      archipelago: 'medium',
      fjord: 'medium',
      steppe: 'large',
      jungle: 'large',
      badlands: 'medium',
      glacier: 'large',
      marsh: 'medium',
      plateau: 'large',
      coast: 'medium',
      bay: 'small',
      peninsula: 'medium',
    };
    return magnitudes[type] || 'medium';
  }

  /**
   * Select appropriate cosmic creator for geography type
   */
  private selectAppropriateCreator(
    geoType: GeographyType,
    cosmicCreators: CosmicCreator[],
    rng: () => number,
    index: number
  ): string {
    // Map geography types to appropriate cosmic elements
    const elementMapping: Record<GeographyType, string[]> = {
      // Water-related geography
      ocean: ['water'],
      river: ['water'],
      swamp: ['water'],
      marsh: ['water'],
      fjord: ['water'],
      bay: ['water'],
      coast: ['water'],
      peninsula: ['water'],
      // Fire-related geography
      volcano: ['fire'],
      desert: ['fire'],
      badlands: ['fire'],
      // Ice-related geography
      glacier: ['ice'],
      tundra: ['ice'],
      // Life-related geography
      forest: ['life'],
      jungle: ['life'],
      plains: ['life'],
      steppe: ['life'],
      // Earth/Rock-related geography
      mountain_range: ['rock', 'earth'],
      canyon: ['rock', 'earth'],
      plateau: ['rock', 'earth'],
      underground_system: ['rock', 'earth'],
      continent: ['earth', 'rock'],
      // Mixed/ambiguous
      island: ['earth', 'water'],
      archipelago: ['water', 'earth'],
    };

    // Filter out magic creators - they don't create geography
    const geographyCreators = cosmicCreators.filter(c => c.element !== 'magic');

    // Safety check: if no cosmic creators exist, this shouldn't happen but handle it gracefully
    if (geographyCreators.length === 0) {
      throw new Error('Cannot generate geography: no cosmic creators exist');
    }

    const preferredElements = elementMapping[geoType] || ['earth'];
    
    // Try to find a creator with a preferred element (case-insensitive matching)
    for (const element of preferredElements) {
      const creator = geographyCreators.find(c => 
        c.element.toLowerCase() === element.toLowerCase()
      );
      if (creator) {
        return creator.id;
      }
    }

    // Fallback: use any available creator if no preferred creator found (excluding magic)
    const creatorIndex = index % geographyCreators.length;
    return geographyCreators[creatorIndex].id;
  }

  /**
   * Generate location coordinates
   * @deprecated This will be removed when map generation system is replaced
   */
  private generateLocation(rng: () => number, index: number): { x: number; y: number } {
    return {
      x: Math.floor(rng() * 1000),
      y: Math.floor(rng() * 1000),
    };
  }
}
