/**
 * Cosmic Generator
 * 
 * Generates Level 2: Cosmic Creators
 * Elemental beings that created the world
 */

import type {
  CosmicCreator,
  CosmicElement,
  GenerationContext,
} from '../types/world-generation';
import { NameTemplates, getCosmicDescription, generateName } from '../templates/world-templates';

export class CosmicGenerator {
  /**
   * Generate cosmic creators
   */
  async generate(
    context: GenerationContext,
    customElements?: CosmicElement[]
  ): Promise<CosmicCreator[]> {
    if (context.primordials.length === 0) {
      throw new Error('Primordials must be generated before cosmic creators');
    }

    const elements: CosmicElement[] = customElements || [
      'rock',
      'wind',
      'water',
      'life',
      'fire',
      'earth',
      'ice',
      'magic',
    ];

    const creators: CosmicCreator[] = [];

    elements.forEach((element, index) => {
      // Assign to a primordial
      let createdBy: string;
      if (element === 'ice' || element === 'magic') {
        // Ice and magic get random primordial creators
        const randomIndex = Math.floor(context.rng() * context.primordials.length);
        createdBy = context.primordials[randomIndex].id;
      } else {
        // Other elements use deterministic round-robin assignment
        const primordialIndex = index % context.primordials.length;
        createdBy = context.primordials[primordialIndex].id;
      }

      const name = generateName(
        NameTemplates.cosmic[element],
        context.seed,
        index
      );

      const creator: CosmicCreator = {
        id: `cosmic-${element}-${index}`,
        type: 'cosmic_creator',
        element,
        name,
        description: getCosmicDescription(element, name, createdBy),
        parentId: createdBy,
        createdAt: new Date(1000), // Shortly after primordials
        discoveredAt: new Date(),
        createdBy,
        creations: [], // Will be populated as world is generated
        metadata: {
          seed: context.seed,
          index,
          element,
        },
      };

      creators.push(creator);
    });

    return creators;
  }
}







