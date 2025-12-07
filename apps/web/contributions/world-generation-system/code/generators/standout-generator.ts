/**
 * Standout Generator
 * 
 * Generates Level 6.5: Standout Mortals
 * Heroes, villains, and powerful individuals
 * IMPORTANT: Heroes are born in organizations, not random geography
 * 
 * Also creates world events for special cases (e.g., necromancers building towers)
 */

import type { StandoutMortal, GenerationContext, StandoutType, WorldEvent } from '../types/world-generation';
import { NameTemplates, generateName } from '../templates/world-templates';

export class StandoutGenerator {
  /**
   * Generate standout mortals (heroes, villains, etc.)
   */
  async generate(context: GenerationContext): Promise<StandoutMortal[]> {
    if (context.mortalRaces.length === 0) {
      throw new Error('Mortal races must be generated before standout mortals');
    }

    if (context.organizations.length === 0) {
      // Can still generate, but without org-based birthplaces
      console.warn('No organizations found - standout mortals will use geography for birthplaces');
    }

    const standoutMortals: StandoutMortal[] = [];
    const usedNames = new Set<string>(); // Track used names to prevent duplicates
    
    // Standout types to generate with counts - based on remarkable events
    const standoutTypes: Array<{ type: StandoutType; count: number; baseYear: number }> = [
      // Royalty - founders of organizations, rulers
      { type: 'king', count: 3, baseYear: -2300 },
      { type: 'queen', count: 2, baseYear: -2300 },
      { type: 'prince', count: 2, baseYear: -2250 },
      { type: 'princess', count: 2, baseYear: -2250 },
      { type: 'emperor', count: 1, baseYear: -2200 },
      { type: 'empress', count: 1, baseYear: -2200 },
      { type: 'founder', count: 4, baseYear: -2400 },
      // High ranking military
      { type: 'general', count: 3, baseYear: -2350 },
      { type: 'commander', count: 3, baseYear: -2300 },
      { type: 'war_chief', count: 2, baseYear: -2250 },
      { type: 'marshal', count: 2, baseYear: -2200 },
      { type: 'admiral', count: 1, baseYear: -2150 },
      // Heroic participants in battle
      { type: 'knight', count: 4, baseYear: -2400 },
      { type: 'champion', count: 3, baseYear: -2350 },
      { type: 'hero', count: 5, baseYear: -2500 },
      // Slayers of standout adversaries
      { type: 'dragon_slayer', count: 2, baseYear: -2100 },
      { type: 'giant_slayer', count: 1, baseYear: -2050 },
      { type: 'demon_slayer', count: 1, baseYear: -2000 },
      { type: 'monster_slayer', count: 2, baseYear: -1950 },
      // Saviors in dire circumstances
      { type: 'savior', count: 3, baseYear: -2450 },
      { type: 'protector', count: 2, baseYear: -2400 },
      { type: 'guardian', count: 2, baseYear: -2350 },
      // Unique in their craft - magic practitioners
      { type: 'wizard', count: 4, baseYear: -2400 },
      { type: 'archmage', count: 2, baseYear: -2350 },
      { type: 'necromancer', count: 2, baseYear: -1900 },
      { type: 'lich', count: 1, baseYear: -2150 },
      { type: 'sorcerer', count: 2, baseYear: -2300 },
      { type: 'warlock', count: 1, baseYear: -2250 },
      { type: 'witch', count: 2, baseYear: -2200 },
      { type: 'enchanter', count: 2, baseYear: -2150 },
      { type: 'alchemist', count: 2, baseYear: -2100 },
      // Other remarkable individuals
      { type: 'villain', count: 3, baseYear: -2450 },
      { type: 'vampire', count: 1, baseYear: -2200 },
      { type: 'high_priest', count: 2, baseYear: -2000 },
      { type: 'oracle', count: 1, baseYear: -1850 },
      { type: 'prophet', count: 2, baseYear: -1800 },
    ];

    let index = 0;

    standoutTypes.forEach(({ type, count, baseYear }) => {
      for (let i = 0; i < count; i++) {
        // Select race
        const race = context.mortalRaces[Math.floor(context.rng() * context.mortalRaces.length)];
        const raceName = this.formatRaceName(race.name);

        // Select organization for birthplace (prefer race-matching organizations)
        let organization = null;
        let locationId: string | null = null;
        let organizationId: string | null = null;

        if (context.organizations.length > 0) {
          // Filter organizations by race
          const raceOrgs = context.organizations.filter(o => o.race === race.id);
          const orgsToChooseFrom = raceOrgs.length > 0 ? raceOrgs : context.organizations;

          if (orgsToChooseFrom.length > 0) {
            organization = orgsToChooseFrom[Math.floor(context.rng() * orgsToChooseFrom.length)];
            organizationId = organization.id;
            locationId = organization.location || null;
          }
        }

        // Fallback to geography if no organizations available
        if (!organization && context.geography.length > 0) {
          const location = context.geography[Math.floor(context.rng() * context.geography.length)];
          locationId = location.id;
        }

        // Generate name with proper race-based names and titles
        const name = this.generateStandoutName(type, raceName, context, index, usedNames, organization);

        // Calculate birth and notable year
        const notableYear = baseYear - (i * 30);
        const birthYearOffset = 30 + Math.floor(context.rng() * 40); // Born 30-70 years before becoming notable
        const birthYear = notableYear - birthYearOffset;
        const birthDate = new Date(birthYear);
        const notableDate = new Date(notableYear);

        const entityId = `standout-${type}-${index}`;

        // Determine alignment and powers
        const alignment = this.determineAlignment(type, context.rng);
        const powers = this.generatePowers(type, context.rng);
        const age = Math.floor((Date.now() - birthDate.getTime()) / (365 * 24 * 60 * 60 * 1000));

        const standoutMortal: StandoutMortal = {
          id: entityId,
          type: 'standout_mortal',
          standoutType: type,
          name,
          description: this.generateDescription(type, name, raceName, organization),
          parentId: race.id,
          createdAt: birthDate,
          discoveredAt: new Date(),
          race: race.id,
          organization: organizationId || undefined,
          location: locationId || 'unknown',
          powers,
          age,
          alignment,
          isBoss: alignment === 'evil', // Evil standout mortals are dungeon boss candidates
        };

        standoutMortals.push(standoutMortal);
        
        // Create world events for special cases
        if (type === 'necromancer' && locationId) {
          // Necromancers build towers as a key world event
          const towerEvent: WorldEvent = {
            type: 'built_tower',
            entityId: entityId,
            locationId: locationId,
            description: `${name} built a tower for study and experimentation. The tower's construction is magical in nature and radiates a feeling of corruption and dread in great distances around it.`,
            year: notableYear,
            metadata: {
              purpose: 'necromantic research',
              standoutType: type,
            },
          };
          context.worldEvents.push(towerEvent);
        }
        
        index++;
      }
    });

    return standoutMortals;
  }

  /**
   * Generate standout mortal name with proper race-based names and titles
   */
  private generateStandoutName(
    type: StandoutType,
    raceName: string,
    context: GenerationContext,
    index: number,
    usedNames: Set<string>,
    organization: any
  ): string {
    // Get race-specific first and last names
    const raceNames = this.getRaceNames(raceName);
    const firstName = raceNames.firstNames[Math.floor(context.rng() * raceNames.firstNames.length)];
    const lastName = raceNames.lastNames[Math.floor(context.rng() * raceNames.lastNames.length)];
    
    // Get title for this standout type
    const title = this.getTitleForType(type);
    
    // Get location name for "of [location]" suffix
    let locationSuffix = '';
    if (organization?.name) {
      locationSuffix = ` of ${organization.name}`;
    } else if (organization?.location) {
      const location = context.geography.find(g => g.id === organization.location);
      if (location) {
        locationSuffix = ` of ${location.name}`;
      }
    }
    
    // Construct full name: "Title FirstName LastName of Location"
    const fullName = `${title} ${firstName} ${lastName}${locationSuffix}`;
    
    // Ensure uniqueness
    let finalName = fullName;
    let attempts = 0;
    while (usedNames.has(finalName) && attempts < 100) {
      // Try different last name
      const altLastName = raceNames.lastNames[Math.floor(context.rng() * raceNames.lastNames.length)];
      finalName = `${title} ${firstName} ${altLastName}${locationSuffix}`;
      attempts++;
    }
    
    usedNames.add(finalName);
    return finalName;
  }

  /**
   * Get race-specific name pools
   */
  private getRaceNames(raceName: string): { firstNames: string[]; lastNames: string[] } {
    const namePools: Record<string, { firstNames: string[]; lastNames: string[] }> = {
      'Human': {
        firstNames: ['Aethelred', 'Isolde', 'Valerius', 'Elena', 'Marcus', 'Sophia', 'Theodore', 'Victoria', 'Adrian', 'Alabaster', 'Benedict', 'Catherine', 'Darius', 'Eleanor', 'Frederick', 'Gwendolyn', 'Harold', 'Isabella', 'Julian', 'Katherine'],
        lastNames: ['Alabaster', 'Blackwood', 'Brightblade', 'Goldleaf', 'Ironheart', 'Stormwind', 'Thornwood', 'Whitehall', 'Silvermoon', 'Dragonheart', 'Fireforge', 'Shadowvale', 'Brightwood', 'Crystalpeak', 'Stonethrone'],
      },
      'Dwarf': {
        firstNames: ['Thorgrim', 'Borin', 'Helga', 'Grimbold', 'Thorin', 'Dagna', 'Balder', 'Frida', 'Gunnar', 'Hilda', 'Ivar', 'Kara', 'Magnus', 'Nora', 'Olaf'],
        lastNames: ['Ironforge', 'Stonehammer', 'Goldbeard', 'Deepforge', 'Thunderaxe', 'Granitehold', 'Ironbeard', 'Stonefist', 'Goldhammer', 'Deepstone', 'Thunderforge', 'Ironhold'],
      },
      'Elf': {
        firstNames: ['Aeliana', 'Thalius', 'Lyralei', 'Elandris', 'Sylvan', 'Arielle', 'Caladriel', 'Eldrin', 'Faelan', 'Galadriel', 'Ithilien', 'Lothiriel', 'Mithrandir', 'Nimrodel', 'Orophin'],
        lastNames: ['Moonwhisper', 'Starweaver', 'Lightbreeze', 'Silverleaf', 'Shadowglen', 'Dawnblade', 'Starlight', 'Moonbeam', 'Sunfire', 'Windrider', 'Cloudwalker', 'Stormcaller'],
      },
      'Orc': {
        firstNames: ['Grubnak', 'Bloodaxe', 'Skullcrusher', 'Grimjaw', 'Bonebreaker', 'Gorefang', 'Ironjaw', 'Ragefist', 'Skullsplitter', 'Warhammer', 'Deathclaw', 'Brutal'],
        lastNames: ['Bloodfang', 'Skullcrusher', 'Ironjaw', 'Goreaxe', 'Bonebreaker', 'Deathclaw', 'Ragefist', 'Warhammer', 'Brutal', 'Grimjaw'],
      },
      'Goblin': {
        firstNames: ['Snikkit', 'Gribble', 'Nix', 'Zog', 'Sneak', 'Grab', 'Quick', 'Sharp', 'Trick', 'Sly'],
        lastNames: ['Quickfinger', 'Sharpnose', 'Greedygrab', 'Sneakypaw', 'Trickfoot', 'Slyhand', 'Grabby', 'Quickpaw'],
      },
      'Halfling': {
        firstNames: ['Bilbo', 'Frodo', 'Merry', 'Pippin', 'Samwise', 'Rosie', 'Peregrin', 'Meriadoc', 'Hamfast', 'Bell'],
        lastNames: ['Greenbottle', 'Goldcup', 'Merryweather', 'Quickstep', 'Goodbarrel', 'Underhill', 'Baggins', 'Took'],
      },
      'Gnome': {
        firstNames: ['Fizzle', 'Gizmo', 'Tinker', 'Sparkle', 'Cog', 'Gear', 'Spring', 'Wind', 'Bell', 'Chip'],
        lastNames: ['Cogwheel', 'Gearbox', 'Springwind', 'Tinkerbell', 'Clockwork', 'Gadget', 'Widget', 'Sprocket'],
      },
      'Kobold': {
        firstNames: ['Snik', 'Grik', 'Zik', 'Tik', 'Krik', 'Nix', 'Pix', 'Rix'],
        lastNames: ['Quickclaw', 'Sharpfang', 'Sneakscale', 'Tricktail', 'Grabby', 'Quickpaw'],
      },
      'Dragon': {
        firstNames: ['Draconis', 'Ignis', 'Frost', 'Storm', 'Shadow', 'Gold', 'Silver', 'Iron'],
        lastNames: ['Flameheart', 'Frostwing', 'Stormscale', 'Shadowclaw', 'Goldhoard', 'Ironhide', 'Dragonfire', 'Wyrmheart'],
      },
      'Aarakocra': {
        firstNames: ['Aeris', 'Zephyr', 'Sky', 'Wind', 'Cloud', 'Storm', 'Gale', 'Breeze'],
        lastNames: ['Skywing', 'Windrider', 'Clouddancer', 'Stormcaller', 'Galeheart', 'Breezeflight', 'Skysoar', 'Windwhisper'],
      },
      'Merfolk': {
        firstNames: ['Aqua', 'Marina', 'Coral', 'Wave', 'Tide', 'Current', 'Deep', 'Pearl'],
        lastNames: ['Deepwater', 'Coralreef', 'Wavecrest', 'Tidecaller', 'Currentflow', 'Pearlscale', 'Seadancer', 'Oceanheart'],
      },
    };

    return namePools[raceName] || {
      firstNames: ['Unknown'],
      lastNames: ['Unknown'],
    };
  }

  /**
   * Get title for standout type
   */
  private getTitleForType(type: StandoutType): string {
    const titles: Record<StandoutType, string> = {
      // Royalty
      king: 'King',
      queen: 'Queen',
      prince: 'Prince',
      princess: 'Princess',
      emperor: 'Emperor',
      empress: 'Empress',
      founder: 'Founder',
      // High ranking military
      general: 'General',
      commander: 'Commander',
      war_chief: 'War-Chief',
      marshal: 'Marshal',
      admiral: 'Admiral',
      // Heroic participants in battle
      knight: 'Knight',
      champion: 'Champion',
      hero: 'The Hero',
      // Slayers
      dragon_slayer: 'Dragon Slayer',
      giant_slayer: 'Giant Slayer',
      demon_slayer: 'Demon Slayer',
      monster_slayer: 'Monster Slayer',
      // Saviors
      savior: 'The Savior',
      protector: 'The Protector',
      guardian: 'The Guardian',
      // Magic practitioners
      wizard: 'Wizard',
      archmage: 'Archmage',
      necromancer: 'Necromancer',
      lich: 'Lich',
      sorcerer: 'Sorcerer',
      warlock: 'Warlock',
      witch: 'Witch',
      enchanter: 'Enchanter',
      alchemist: 'Alchemist',
      // Other
      villain: 'The Villain',
      vampire: 'Vampire Lord',
      high_priest: 'High Priest',
      oracle: 'Oracle',
      prophet: 'Prophet',
    };

    return titles[type] || 'The Notable';
  }

  /**
   * Generate description for standout mortal
   */
  private generateDescription(
    type: StandoutType,
    name: string,
    raceName: string,
    organization: any
  ): string {
    const orgName = organization?.name || 'their homeland';
    const descriptions: Record<StandoutType, string> = {
      // Royalty
      king: `${name} is a king of the ${raceName}, born in ${orgName} and ruler of their people.`,
      queen: `${name} is a queen of the ${raceName}, born in ${orgName} and ruler of their people.`,
      prince: `${name} is a prince of the ${raceName}, born in ${orgName} and heir to the throne.`,
      princess: `${name} is a princess of the ${raceName}, born in ${orgName} and heir to the throne.`,
      emperor: `${name} is an emperor of the ${raceName}, born in ${orgName} and ruler of vast territories.`,
      empress: `${name} is an empress of the ${raceName}, born in ${orgName} and ruler of vast territories.`,
      founder: `${name} is the founder of ${orgName}, establishing the organization and shaping its destiny.`,
      // High ranking military
      general: `${name} is a general of the ${raceName}, born in ${orgName} and master of military strategy.`,
      commander: `${name} is a commander of the ${raceName}, born in ${orgName} and leader of warriors.`,
      war_chief: `${name} is a war-chief of the ${raceName}, born in ${orgName} and leader of their warriors.`,
      marshal: `${name} is a marshal of the ${raceName}, born in ${orgName} and organizer of military forces.`,
      admiral: `${name} is an admiral of the ${raceName}, born in ${orgName} and master of naval warfare.`,
      // Heroic participants in battle
      knight: `${name} is a knight of the ${raceName}, born in ${orgName} and renowned for their valor in battle.`,
      champion: `${name} is a champion of the ${raceName}, born in ${orgName} and victor of many battles.`,
      hero: `${name} is a legendary hero of the ${raceName}, born in ${orgName} and renowned for their courage and deeds.`,
      // Slayers
      dragon_slayer: `${name} is a dragon slayer of the ${raceName}, born in ${orgName} and slayer of great wyrms.`,
      giant_slayer: `${name} is a giant slayer of the ${raceName}, born in ${orgName} and slayer of colossal foes.`,
      demon_slayer: `${name} is a demon slayer of the ${raceName}, born in ${orgName} and banisher of infernal beings.`,
      monster_slayer: `${name} is a monster slayer of the ${raceName}, born in ${orgName} and hunter of terrible beasts.`,
      // Saviors
      savior: `${name} is a savior of the ${raceName}, born in ${orgName} and rescuer in dire circumstances.`,
      protector: `${name} is a protector of the ${raceName}, born in ${orgName} and defender of the innocent.`,
      guardian: `${name} is a guardian of the ${raceName}, born in ${orgName} and watcher over sacred places.`,
      // Magic practitioners
      wizard: `${name} is a powerful wizard of the ${raceName}, born in ${orgName} and master of the arcane arts.`,
      archmage: `${name} is an archmage of the ${raceName}, born in ${orgName} and one of the greatest magical practitioners.`,
      necromancer: `${name} is a necromancer of the ${raceName}, practicing dark arts in ${orgName} and master of the undead.`,
      lich: `${name} is a powerful lich of the ${raceName}, achieving undeath in ${orgName} and master of death magic.`,
      sorcerer: `${name} is a sorcerer of the ${raceName}, born in ${orgName} with innate magical power.`,
      warlock: `${name} is a warlock of the ${raceName}, born in ${orgName} and wielder of forbidden magic.`,
      witch: `${name} is a witch of the ${raceName}, born in ${orgName} and practitioner of ancient magic.`,
      enchanter: `${name} is an enchanter of the ${raceName}, born in ${orgName} and master of magical enhancement.`,
      alchemist: `${name} is an alchemist of the ${raceName}, born in ${orgName} and master of transformation.`,
      // Other
      villain: `${name} is a feared villain of the ${raceName}, born in ${orgName} and known for their dark deeds.`,
      vampire: `${name} is an immortal vampire of the ${raceName}, transformed in ${orgName} and terror of the night.`,
      high_priest: `${name} is a high priest of the ${raceName}, serving the divine in ${orgName} with unwavering faith.`,
      oracle: `${name} is an oracle of the ${raceName}, seeing the future from ${orgName} and guide to destiny.`,
      prophet: `${name} is a prophet of the ${raceName}, speaking divine words from ${orgName} and voice of the gods.`,
    };

    return descriptions[type] || `${name} is a notable ${type} of the ${raceName}, born in ${orgName}.`;
  }

  /**
   * Determine alignment
   */
  private determineAlignment(
    type: StandoutType,
    rng: () => number
  ): 'good' | 'neutral' | 'evil' {
    const alignments: Record<StandoutType, 'good' | 'neutral' | 'evil'> = {
      // Royalty
      king: rng() > 0.5 ? 'good' : 'neutral',
      queen: rng() > 0.5 ? 'good' : 'neutral',
      prince: rng() > 0.5 ? 'good' : 'neutral',
      princess: rng() > 0.5 ? 'good' : 'neutral',
      emperor: rng() > 0.7 ? 'good' : rng() > 0.3 ? 'neutral' : 'evil',
      empress: rng() > 0.7 ? 'good' : rng() > 0.3 ? 'neutral' : 'evil',
      founder: rng() > 0.6 ? 'good' : 'neutral',
      // High ranking military
      general: rng() > 0.7 ? 'good' : rng() > 0.3 ? 'neutral' : 'evil',
      commander: rng() > 0.6 ? 'good' : 'neutral',
      war_chief: rng() > 0.5 ? 'neutral' : 'evil',
      marshal: rng() > 0.6 ? 'good' : 'neutral',
      admiral: rng() > 0.6 ? 'good' : 'neutral',
      // Heroic participants in battle
      knight: 'good',
      champion: 'good',
      hero: 'good',
      // Slayers
      dragon_slayer: 'good',
      giant_slayer: 'good',
      demon_slayer: 'good',
      monster_slayer: 'good',
      // Saviors
      savior: 'good',
      protector: 'good',
      guardian: 'good',
      // Magic practitioners
      wizard: 'neutral',
      archmage: 'neutral',
      necromancer: 'evil',
      lich: 'evil',
      sorcerer: rng() > 0.5 ? 'neutral' : 'evil',
      warlock: 'evil',
      witch: rng() > 0.5 ? 'neutral' : 'evil',
      enchanter: 'neutral',
      alchemist: 'neutral',
      // Other
      villain: 'evil',
      vampire: 'evil',
      high_priest: 'good',
      oracle: 'neutral',
      prophet: 'good',
    };

    return alignments[type] || 'neutral';
  }

  /**
   * Generate powers based on type
   */
  private generatePowers(type: StandoutType, rng: () => number): string[] {
    const powers: string[] = [];

    switch (type) {
      case 'hero':
      case 'knight':
      case 'champion':
        powers.push('Heroic Strike', 'Inspiring Presence', 'Combat Expertise');
        break;
      case 'villain':
        powers.push('Dark Strike', 'Intimidating Presence', 'Combat Mastery');
        break;
      case 'wizard':
      case 'archmage':
      case 'sorcerer':
        powers.push('Arcane Magic', 'Spell Mastery', 'Mana Control');
        if (type === 'archmage') powers.push('Greater Spellcasting', 'Metamagic');
        break;
      case 'necromancer':
      case 'lich':
        powers.push('Necromancy', 'Undead Control', 'Death Magic');
        if (type === 'lich') powers.push('Immortality', 'Soul Binding');
        break;
      case 'vampire':
        powers.push('Vampiric Touch', 'Transformation', 'Regeneration', 'Immortality');
        break;
      case 'dragon_slayer':
      case 'giant_slayer':
      case 'demon_slayer':
      case 'monster_slayer':
        powers.push('Slayer\'s Strike', 'Monster Knowledge', 'Combat Mastery', 'Fearless');
        break;
      case 'savior':
      case 'protector':
      case 'guardian':
        powers.push('Protective Aura', 'Healing Touch', 'Inspiring Presence');
        break;
      case 'general':
      case 'commander':
      case 'marshal':
      case 'admiral':
        powers.push('Tactical Genius', 'Leadership', 'Combat Expertise');
        break;
      case 'king':
      case 'queen':
      case 'emperor':
      case 'empress':
      case 'prince':
      case 'princess':
        powers.push('Royal Authority', 'Leadership', 'Diplomacy');
        break;
      case 'founder':
        powers.push('Visionary Leadership', 'Organization', 'Influence');
        break;
      case 'high_priest':
      case 'prophet':
        powers.push('Divine Magic', 'Healing', 'Divine Favor');
        break;
      case 'oracle':
        powers.push('Foresight', 'Divination', 'Prophecy');
        break;
      case 'warlock':
        powers.push('Forbidden Magic', 'Pact Power', 'Dark Spells');
        break;
      case 'witch':
        powers.push('Ancient Magic', 'Herbalism', 'Curses');
        break;
      case 'enchanter':
        powers.push('Enchantment', 'Item Enhancement', 'Magical Crafting');
        break;
      case 'alchemist':
        powers.push('Alchemy', 'Potion Making', 'Transmutation');
        break;
      default:
        powers.push('Combat Expertise', 'Leadership');
    }

    return powers;
  }

  /**
   * Format race name (remove "The" prefix if present)
   */
  private formatRaceName(raceName: string): string {
    return raceName.replace(/^The /, '');
  }
}
