/**
 * Organization Name Helpers
 * 
 * Helper functions for generating complete organization names from templates
 * Includes prefixes, suffixes, and complete name lists
 */

import type { OrganizationMagnitude } from '../types/world-generation';

/**
 * Organization name suffixes for prefixes that need completion
 */
export const OrganizationNameSuffixes: Record<OrganizationMagnitude, string[]> = {
  kingdom: ['Ironhold', 'Goldcrest', 'Silvermoon', 'Dragonheart', 'Stonethrone', 'Crystalpeak', 'Shadowvale', 'Brightwood', 'Fireforge', 'Stormwind', 'Riverdeep', 'Skyreach'],
  city: ['Prosperity', 'Kings', 'Queens', 'Merchants', 'Artisans', 'Scholars', 'Heroes', 'Dawn', 'Dusk', 'Light', 'Stone'],
  town: ['Crossroads', 'Haven', 'Rest', 'Hope', 'Prosperity', 'Trade', 'Merchant', 'Bridge', 'Mill', 'Fields', 'Valley'],
  tribe: ['Wolves', 'Bears', 'Eagles', 'Ravens', 'Stags', 'Lions', 'Thunder', 'Storm', 'Iron', 'Stone'],
  clan: ['Iron', 'Stone', 'Gold', 'Silver', 'Blood', 'Storm', 'Fire', 'Ice', 'Shadow', 'Light'],
  circle: ['Magic', 'Light', 'Darkness', 'Balance', 'Wisdom', 'Knowledge', 'Power', 'Mystery'],
  band: ['Adventurers', 'Explorers', 'Mercenaries', 'Guardians', 'Rangers', 'Hunters', 'Warriors'],
  company: ['Adventurers', 'Explorers', 'Mercenaries', 'Guardians', 'Traders', 'Merchants'],
  empire: [], // Complete names only
  horde: [], // Complete names only
  realm: [], // Complete names or race-specific
  guild: [], // Complete names only
  mountainhome: ['Ironforge', 'Stonehammer', 'Goldbeard', 'Deepforge', 'Thunderaxe', 'Granitehold'],
  nest: ['Snikkit', 'Gribble', 'Quick', 'Sharp', 'Sneaky'],
  canopy: ['Moonwhisper', 'Starweaver', 'Lightbreeze', 'Silverleaf', 'Shadowglen'],
  warren: ['Comfort', 'Peace', 'Warmth', 'Home', 'Hearth'],
  stronghold: ['Blood', 'Skull', 'Iron', 'Bone', 'War', 'Death'],
  enclave: ['Mystery', 'Secrets', 'Wisdom', 'Knowledge'],
  colony: ['Prosperity', 'Hope', 'New', 'First', 'Last'],
  sanctuary: ['Peace', 'Refuge', 'Safety', 'Hope', 'Light'],
  hold: ['Iron', 'Stone', 'Gold', 'Ancient', 'Mighty'],
  grove: ['Ancient', 'Sacred', 'Whispering', 'Eternal'],
  den: ['Shadow', 'Dark', 'Hidden', 'Secret'],
  lair: ['Darkness', 'Shadows', 'Despair', 'Doom'],
  court: ['Summer', 'Winter', 'Spring', 'Autumn'],
  coven: ['Darkness', 'Shadows', 'Mystery', 'Power'],
  coterie: ['Blood', 'Night', 'Shadow', 'Eternal'],
  conclave: ['Light', 'Divine', 'Sacred', 'Holy'],
  academy: ['Arcane', 'Ancient', 'Noble', 'Great'],
  colosseum: ['Glory', 'Honor', 'Victory', 'Champion'],
  bazaar: ['Golden', 'Grand', 'Merchant', 'Prosperity'],
  port: ['Trade', 'Merchant', 'Prosperity', 'Waves'],
  fortress: ['Iron', 'Stone', 'War', 'Victory'],
  temple: ['Light', 'Divine', 'Sacred', 'Holy'],
  library: ['Knowledge', 'Wisdom', 'Ancient', 'Great'],
  forge: ['Iron', 'Steel', 'Ancient', 'Mighty'],
  tower: ['Darkness', 'Shadows', 'Sorrow', 'Despair'],
  crypt: ['Eternal', 'Dark', 'Ancient', 'Rest'],
  hive: ['Unity', 'Order', 'Strength', 'Purpose'],
  pack: ['Hunters', 'Wolves', 'Fierce', 'Wild'],
  pride: ['Noble', 'Royal', 'Majestic', 'Regal'],
  flock: ['Wings', 'Sky', 'High', 'Distant'],
  school: ['Deep', 'Vast', 'Ancient', 'Mysterious'],
  pod: ['Unity', 'Harmony', 'Flow', 'Current'],
  murder: ['Shadow', 'Dark', 'Whisper', 'Secret'],
  swarm: ['Unity', 'Endless', 'Tireless', 'Relentless'],
};

/**
 * Generate a complete organization name
 */
import { NameTemplates } from './world-templates';

export function generateOrganizationName(
  magnitude: OrganizationMagnitude,
  seed: string,
  index: number,
  raceName?: string,
  usedNames?: Set<string>
): string {
  const templates = NameTemplates.organization[magnitude] || [];
  
  // If templates are complete names (like empire, horde, guild)
  if (templates.length > 0 && !templates[0].includes(' of') && !templates[0].endsWith(' of')) {
    // Complete name templates - use directly
    const hash = simpleHash(`${seed}-org-${magnitude}-${index}`);
    let name = templates[hash % templates.length];
    
    if (usedNames) {
      let attempts = 0;
      while (usedNames.has(name) && attempts < templates.length * 2) {
        const nextIndex = (hash + attempts + 1) % templates.length;
        name = templates[nextIndex];
        attempts++;
      }
      usedNames.add(name);
    }
    
    return name;
  }
  
  // Prefix + suffix pattern
  const suffixes = OrganizationNameSuffixes[magnitude] || [];
  
  if (templates.length > 0 && suffixes.length > 0) {
    const hash = simpleHash(`${seed}-org-${magnitude}-${index}`);
    const prefix = templates[hash % templates.length];
    const suffix = suffixes[hash % suffixes.length];
    
    let name = '';
    if (magnitude === 'realm' && raceName) {
      // Realm names can be race-specific
      name = `${prefix} ${raceName}`;
    } else {
      name = `${prefix} ${suffix}`;
    }
    
    // Fix "The The" issue - if name starts with "The The", insert "Flag of" between them
    if (name.startsWith('The The ')) {
      name = name.replace(/^The The /, 'The Flag of The ');
    }
    
    // Ensure uniqueness
    if (usedNames) {
      let attempts = 0;
      while (usedNames.has(name) && attempts < suffixes.length * 2) {
        const altSuffix = suffixes[(hash + attempts + 1) % suffixes.length];
        let altName = magnitude === 'realm' && raceName 
          ? `${prefix} ${raceName}` 
          : `${prefix} ${altSuffix}`;
        // Fix "The The" for alternative names too
        if (altName.startsWith('The The ')) {
          altName = altName.replace(/^The The /, 'The Flag of The ');
        }
        name = altName;
        attempts++;
      }
      usedNames.add(name);
    }
    
    return name;
  }
  
  // Fallback
  return `The ${magnitude} ${index}`;
}

/**
 * Simple hash function
 */
function simpleHash(str: string): number {
  let hash = 0;
  for (let i = 0; i < str.length; i++) {
    const char = str.charCodeAt(i);
    hash = (hash << 5) - hash + char;
    hash = hash & hash;
  }
  return Math.abs(hash);
}