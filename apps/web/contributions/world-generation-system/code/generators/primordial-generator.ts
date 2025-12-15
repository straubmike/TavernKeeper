/**
 * Primordial Generator
 * 
 * Generates Level 1: Primordial Beings
 * Fundamental forces of the universe
 */

import type {
  PrimordialBeing,
  PrimordialType,
  GenerationContext,
} from '../types/world-generation';
import { NameTemplates, getPrimordialDescription, generateName } from '../templates/world-templates';

export class PrimordialGenerator {
  /**
   * Generate primordial beings
   */
  async generate(
    context: GenerationContext,
    customTypes?: PrimordialType[]
  ): Promise<PrimordialBeing[]> {
    const types: PrimordialType[] = customTypes || [
      'space',
      'time',
      'light',
      'dark',
      'order',
      'chaos',
    ];

    const primordials: PrimordialBeing[] = [];

    types.forEach((type, index) => {
      // Use context RNG for deterministic generation (matching HTML tool behavior)
      const name = generateName(
        NameTemplates.primordial[type],
        context.seed,
        index,
        undefined, // No usedNames tracking for primordials
        context.rng // Use the seeded RNG from context
      );

      const primordial: PrimordialBeing = {
        id: `primordial-${type}-${index}`,
        type: 'primordial',
        primordialType: type,
        name,
        description: getPrimordialDescription(type, name),
        parentId: null, // Primordials have no parent
        createdAt: new Date(0), // Existed before time
        discoveredAt: new Date(), // Discovered now
        domain: this.getDomain(type),
        influence: this.getInfluence(type),
        metadata: {
          seed: context.seed,
          index,
        },
      };

      primordials.push(primordial);
    });

    return primordials;
  }

  /**
   * Get domain for primordial type
   */
  private getDomain(type: PrimordialType): string {
    const domains: Record<PrimordialType, string> = {
      space: 'The emptiness and expanse between all things, the nothingness and absence',
      time: 'The flow and progression of moments, the infinite and endless',
      light: 'Illumination, vision, and clarity',
      dark: 'Shadow, concealment, and the unknown',
      order: 'Structure, pattern, and stability',
      chaos: 'Entropy, disorder, and change',
    };
    return domains[type] || 'Unknown domain';
  }

  /**
   * Get influence for primordial type
   */
  private getInfluence(type: PrimordialType): string[] {
    const influences: Record<PrimordialType, string[]> = {
      space: ['distance', 'location', 'separation', 'containment', 'emptiness', 'absence', 'nothing'],
      time: ['past', 'present', 'future', 'duration', 'infinity', 'endlessness', 'permanence', 'timelessness'],
      light: ['vision', 'clarity', 'truth', 'warmth'],
      dark: ['secrets', 'mystery', 'fear', 'rest'],
      order: ['law', 'structure', 'predictability', 'stability'],
      chaos: ['change', 'randomness', 'creativity', 'destruction'],
    };
    return influences[type] || [];
  }
}







