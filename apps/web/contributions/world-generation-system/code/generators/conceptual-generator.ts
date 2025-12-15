/**
 * Conceptual Generator
 * 
 * Generates Level 3: Conceptual Beings
 * Born from mortal worship and emotion
 */

import type { ConceptualBeing, GenerationContext, ConceptualType } from '../types/world-generation';
import { NameTemplates, generateName } from '../templates/world-templates';

export class ConceptualGenerator {
  /**
   * Generate conceptual beings from mortal worship
   */
  async generate(context: GenerationContext): Promise<ConceptualBeing[]> {
    if (context.mortalRaces.length === 0) {
      throw new Error('Mortal races must be generated before conceptual beings');
    }

    const conceptualBeings: ConceptualBeing[] = [];
    const usedNames = new Set<string>();
    let index = 0;

    // Race-specific concept preferences (what each race is likely to worship)
    const raceConceptPreferences: Record<string, ConceptualType[]> = {
      'Human': ['war', 'justice', 'love', 'wealth', 'trade', 'courage', 'honor', 'fertility', 'harvest'],
      'Dwarf': ['craft', 'forge', 'stone', 'metal', 'mining', 'smithing', 'wealth', 'honor', 'order'],
      'Elf': ['nature', 'forest', 'wisdom', 'magic', 'art', 'music', 'beauty', 'life', 'growth'],
      'Orc': ['war', 'battle', 'blood', 'strength', 'rage', 'fury', 'chaos', 'hunting', 'beasts'],
      'Goblin': ['trickery', 'cunning', 'secrets', 'stealth', 'greed', 'chaos', 'darkness', 'mischief'],
      'Halfling': ['comfort', 'home', 'community', 'stories', 'feast', 'joy', 'peace', 'love', 'harvest'],
      'Gnome': ['invention', 'curiosity', 'tinkering', 'wonder', 'knowledge', 'craft', 'art', 'magic', 'wisdom'],
      'Kobold': ['survival', 'traps', 'caves', 'hoarding', 'servitude', 'cunning', 'secrets', 'darkness', 'fear'],
      'Dragon': ['power', 'treasure', 'dominance', 'ancient', 'magic', 'wisdom', 'strength', 'hoarding', 'beasts'],
      'Aarakocra': ['sky', 'wind', 'freedom', 'travel', 'heights', 'nature', 'peace', 'wisdom', 'joy'],
      'Merfolk': ['sea', 'water', 'depths', 'currents', 'mysteries', 'beauty', 'nature', 'life', 'healing'],
    };

    // Generate pantheons for each race
    context.mortalRaces.forEach((race) => {
      const raceName = race.name;
      const raceType = race.raceType || raceName;
      const preferredConcepts = raceConceptPreferences[raceName] || 
                                raceConceptPreferences[raceType] ||
                                ['wisdom', 'strength', 'courage'];

      // Each race gets 2-4 conceptual beings from their preferred concepts
      const numBeings = 2 + Math.floor(context.rng() * 3); // 2-4 beings per race
      const selectedConcepts: ConceptualType[] = [];

      // Select from preferred concepts first
      for (let i = 0; i < numBeings && i < preferredConcepts.length; i++) {
        const conceptIndex = Math.floor(context.rng() * preferredConcepts.length);
        const concept = preferredConcepts[conceptIndex];
        if (!selectedConcepts.includes(concept)) {
          selectedConcepts.push(concept);
        }
      }

      // Fill remaining slots from all available concepts if needed
      const allConcepts: ConceptualType[] = [
        'luck', 'love', 'fertility', 'justice', 'war', 'death', 'wisdom', 'wealth',
        'art', 'music', 'craft', 'hunting', 'harvest', 'blood', 'party', 'sacrifice',
        'vengeance', 'mercy', 'betrayal', 'loyalty', 'honor', 'courage', 'fear',
        'madness', 'healing', 'disease', 'plague', 'famine', 'feast', 'celebration',
        'mourning', 'grief', 'joy', 'rage', 'peace', 'chaos', 'order', 'freedom',
        'tyranny', 'hope', 'despair', 'truth', 'lies', 'secrets', 'knowledge',
        'ignorance', 'beauty', 'ugliness', 'strength', 'weakness', 'cunning', 'stupidity',
        'trade', 'forge', 'stone', 'metal', 'mining', 'smithing', 'nature', 'forest',
        'magic', 'life', 'growth', 'battle', 'fury', 'beasts', 'trickery', 'stealth',
        'greed', 'darkness', 'mischief', 'comfort', 'home', 'community', 'stories',
        'invention', 'curiosity', 'tinkering', 'wonder', 'survival', 'traps', 'caves',
        'hoarding', 'servitude', 'power', 'treasure', 'dominance', 'ancient', 'sky',
        'wind', 'travel', 'heights', 'sea', 'water', 'depths', 'currents', 'mysteries',
      ];

      while (selectedConcepts.length < numBeings) {
        const concept = allConcepts[Math.floor(context.rng() * allConcepts.length)];
        if (!selectedConcepts.includes(concept)) {
          selectedConcepts.push(concept);
        }
      }

      // Generate conceptual beings for this race's pantheon
      selectedConcepts.forEach((concept, conceptIndex) => {
        // Get templates for this concept type
        const templates = NameTemplates.conceptual[concept] || [`The ${concept.charAt(0).toUpperCase() + concept.slice(1)}`];
        
        // Generate name ensuring uniqueness
        const name = this.generateConceptualBeingName(concept, templates, context, index, usedNames);

        // Calculate year - starts after the race exists, spaced out over time
        const raceCreatedAt = race.createdAt instanceof Date ? race.createdAt.getTime() : new Date(-3000).getTime();
        const yearsAfterRace = 50 + (conceptIndex * 30); // 50, 80, 110, 140 years after race creation
        const createdYear = new Date(raceCreatedAt + (yearsAfterRace * 365 * 24 * 60 * 60 * 1000));

        const entityId = `conceptual-${raceName}-${concept}-${index}`;

        const conceptualBeing: ConceptualBeing = {
          id: entityId,
          type: 'conceptual',
          conceptualType: concept,
          name,
          description: `${name} is a god of ${concept}, born from the worship and beliefs of the ${raceName}. As the ${raceName} began to believe in ${concept}, their collective faith gave form to this conceptual being.`,
          parentId: race.id,
          createdAt: createdYear,
          discoveredAt: new Date(),
          worshipedBy: [race.id],
          domain: concept,
        };

        conceptualBeings.push(conceptualBeing);
        index++;
      });
    });

    return conceptualBeings;
  }

  /**
   * Generate conceptual being name, avoiding redundant "The"
   */
  private generateConceptualBeingName(
    concept: ConceptualType,
    templates: string[],
    context: GenerationContext,
    index: number,
    usedNames: Set<string>
  ): string {
    // Use generateName with uniqueness tracking
    let name = generateName(templates, context.seed, index, usedNames);

    // Fix redundant "The" issues (e.g., "Lady The Metal" -> "Lady Metal")
    // Check if name already has a prefix like "Lady", "Lord", etc.
    const prefixes = ['Lady', 'Lord', 'The'];
    const nameParts = name.split(' ');
    
    if (nameParts.length >= 2) {
      const firstPart = nameParts[0];
      const secondPart = nameParts[1];
      
      // If first part is a prefix and second part is "The", remove "The"
      if ((prefixes.includes(firstPart) || firstPart.startsWith("The")) && secondPart === 'The') {
        nameParts.splice(1, 1); // Remove "The"
        name = nameParts.join(' ');
      }
    }

    // Also check if template itself starts with "The" and we're adding another
    if (name.startsWith('The The ')) {
      name = name.replace(/^The The /, 'The ');
    }

    return name;
  }

}
