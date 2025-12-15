/**
 * Boss Generator
 * 
 * Generates mid-bosses and final bosses for dungeons.
 * Bosses can influence theme selection.
 */

import type { Boss } from '../types/dungeon-generation';
import { getDifficultyMultiplier } from '../builders/dungeon-builders';

/**
 * Create a seeded RNG function
 */
function createRNG(seed: string): () => number {
  let hash = 0;
  for (let i = 0; i < seed.length; i++) {
    const char = seed.charCodeAt(i);
    hash = ((hash << 5) - hash) + char;
    hash = hash & hash;
  }
  let state = Math.abs(hash);
  
  return function rng() {
    state = (state * 9301 + 49297) % 233280;
    return state / 233280;
  };
}

/**
 * Boss type definitions
 */
const FINAL_BOSS_TYPES = [
  'Lich',
  'Ancient Dragon',
  'Demon Lord',
  'Vampire Lord',
  'Dark Archmage',
  'Shadow Lord',
  'Ice Dragon',
  'Fire Lord',
  'Crystal Archmage',
  'Chaos Lord',
];

const MID_BOSS_TYPES = [
  'Orc Warlord',
  'Troll Chieftain',
  'Dark Knight',
  // NOTE: Necromancer removed - necromancers should only be final bosses of their own towers
  // They come from world generation, not random generation
  'Giant Spider Queen',
  'Death Knight',
  'Frost Giant',
  'Fire Elemental Lord',
  'Golem Master',
  'Demon General',
];

const BOSS_NAMES: Record<string, string[]> = {
  'Lich': ['Malachar the Eternal', 'Vex the Undying', 'Zephyr the Deathless', 'Mortis the Ageless'],
  'Ancient Dragon': ['Drakon the Ancient', 'Ignis the Flame-Breath', 'Frostfang the Eternal', 'Thunderwing the Mighty'],
  'Demon Lord': ['Balrog the Destroyer', 'Mephisto the Corruptor', 'Azazel the Fallen', 'Belial the Deceiver'],
  'Vampire Lord': ['Vlad the Immortal', 'Nosferatu the Ancient', 'Dracula the Blood-Drinker', 'Carmilla the Eternal'],
  'Dark Archmage': ['Malachar the Black', 'Vex the Shadow-Weaver', 'Zephyr the Dark', 'Morgoth the Cursed'],
  'Shadow Lord': ['Umbra the Eternal', 'Tenebris the Dark', 'Noctis the Shadow-King', 'Void the Absent'],
  'Ice Dragon': ['Glacius the Frozen', 'Frostbite the Eternal', 'Blizzard the Ancient', 'Icicle the Mighty'],
  'Fire Lord': ['Inferno the Burning', 'Pyros the Flame-King', 'Cinder the Scorching', 'Ember the Eternal'],
  'Crystal Archmage': ['Prisma the Brilliant', 'Spectrum the Arcane', 'Lumina the Shining', 'Crystal the Pure'],
  'Chaos Lord': ['Discord the Mad', 'Entropy the Unstable', 'Chaos the Formless', 'Void the Absent'],
  'Orc Warlord': ['Grubnak the Fierce', 'Bloodaxe the Savage', 'Skullcrusher the Brutal', 'Gorefang the Mighty'],
  'Troll Chieftain': ['Grok the Massive', 'Boulder the Unstoppable', 'Stonefist the Mighty', 'Rockbreaker the Strong'],
  'Dark Knight': ['Blackthorn the Fallen', 'Shadowblade the Cursed', 'Ironfist the Damned', 'Deathrider the Lost'],
  'Necromancer': ['Malachar the Dark', 'Vex the Death-Caller', 'Zephyr the Bone-Raiser', 'Mortis the Grave-Keeper'],
  'Giant Spider Queen': ['Arachnia the Web-Weaver', 'Venomfang the Poisonous', 'Silkstrand the Trapper', 'Widow the Black'],
  'Death Knight': ['Thanatos the Reaper', 'Grim the Death-Bringer', 'Soulreaper the Damned', 'Doom the Eternal'],
  'Frost Giant': ['Jotun the Frozen', 'Frostbeard the Ancient', 'Iceheart the Cold', 'Blizzard the Mighty'],
  'Fire Elemental Lord': ['Inferno the Burning', 'Pyros the Flame', 'Cinder the Scorching', 'Ember the Hot'],
  'Golem Master': ['Titan the Construct', 'Ironfist the Builder', 'Stoneheart the Maker', 'Metal the Forged'],
  'Demon General': ['Azazel the Fallen', 'Belial the Deceiver', 'Mammon the Greedy', 'Asmodeus the Wrathful'],
};

const BOSS_POWERS = [
  'Dark Magic',
  'Necromancy',
  'Fire Breath',
  'Shadow Manipulation',
  'Mind Control',
  'Regeneration',
  'Summoning',
  'Curses',
  'Ice Magic',
  'Lightning',
  'Poison',
  'Fear Aura',
  'Teleportation',
  'Shapeshifting',
  'Time Manipulation',
];

export class BossGenerator {
  /**
   * Generate a final boss
   */
  generateFinalBoss(
    level: number,
    seed: string,
    rng?: () => number,
    age?: number
  ): Boss {
    const bossRNG = rng || createRNG(`${seed}-final-boss-${level}`);
    const bossType = FINAL_BOSS_TYPES[Math.floor(bossRNG() * FINAL_BOSS_TYPES.length)];
    const nameList = BOSS_NAMES[bossType] || [`${bossType} of Level ${level}`];
    const name = nameList[Math.floor(bossRNG() * nameList.length)];

    // Generate powers (3-5 for final boss)
    const powerCount = Math.floor(bossRNG() * 3) + 3;
    const powers: string[] = [];
    for (let i = 0; i < powerCount; i++) {
      const power = BOSS_POWERS[Math.floor(bossRNG() * BOSS_POWERS.length)];
      if (!powers.includes(power)) {
        powers.push(power);
      }
    }

    // Determine theme influence based on boss type
    const themeInfluence = this.getThemeInfluence(bossType);

    const history = this.generateHistory(bossType, name, bossRNG);

    // Calculate difficulty based on age (if provided)
    const baseDifficulty = 10; // Final boss is always max difficulty
    const difficultyMultiplier = age ? getDifficultyMultiplier(age) : 1.0;
    const adjustedDifficulty = Math.min(10, Math.floor(baseDifficulty * difficultyMultiplier));

    return {
      id: `boss-final-${seed}-${level}`,
      name,
      type: bossType,
      level,
      description: `${name} is a ${bossType.toLowerCase()} of immense power, commanding this level of the dungeon with ${powers.join(', ')}.`,
      powers,
      history,
      themeInfluence,
      metadata: {
        isFinalBoss: true,
        difficulty: adjustedDifficulty,
        age: age || null,
        generatedAt: new Date().toISOString(),
      },
    };
  }

  /**
   * Generate a mid-boss
   */
  generateMidBoss(
    level: number,
    seed: string,
    rng?: () => number,
    age?: number
  ): Boss {
    const bossRNG = rng || createRNG(`${seed}-mid-boss-${level}`);
    const bossType = MID_BOSS_TYPES[Math.floor(bossRNG() * MID_BOSS_TYPES.length)];
    const nameList = BOSS_NAMES[bossType] || [`${bossType} of Level ${level}`];
    const name = nameList[Math.floor(bossRNG() * nameList.length)];

    // Generate powers (2-3 for mid-boss)
    const powerCount = Math.floor(bossRNG() * 2) + 2;
    const powers: string[] = [];
    for (let i = 0; i < powerCount; i++) {
      const power = BOSS_POWERS[Math.floor(bossRNG() * BOSS_POWERS.length)];
      if (!powers.includes(power)) {
        powers.push(power);
      }
    }

    // Determine theme influence
    const themeInfluence = this.getThemeInfluence(bossType);

    const history = this.generateHistory(bossType, name, bossRNG);

    // Calculate difficulty based on age (if provided)
    const baseDifficulty = Math.min(8, Math.max(5, Math.floor(level / 12.5))); // 5-8 based on level
    const difficultyMultiplier = age ? getDifficultyMultiplier(age) : 1.0;
    const adjustedDifficulty = Math.min(10, Math.floor(baseDifficulty * difficultyMultiplier));

    return {
      id: `boss-mid-${seed}-${level}`,
      name,
      type: bossType,
      level,
      description: `${name} is a powerful ${bossType.toLowerCase()} guarding this level of the dungeon.`,
      powers,
      history,
      themeInfluence,
      metadata: {
        isMidBoss: true,
        difficulty: adjustedDifficulty,
        age: age || null,
        generatedAt: new Date().toISOString(),
      },
    };
  }

  /**
   * Get theme influence based on boss type
   */
  private getThemeInfluence(bossType: string): string[] {
    const influenceMap: Record<string, string[]> = {
      'Lich': ['undead', 'shadow'],
      'Necromancer': ['undead', 'shadow'],
      'Vampire Lord': ['undead', 'shadow'],
      'Death Knight': ['undead', 'shadow'],
      'Ancient Dragon': ['fire', 'ice', 'crystal'],
      'Ice Dragon': ['ice'],
      'Fire Lord': ['fire', 'abyssal'],
      'Demon Lord': ['abyssal', 'fire', 'shadow'],
      'Dark Archmage': ['shadow', 'undead'],
      'Shadow Lord': ['shadow'],
      'Crystal Archmage': ['crystal'],
      'Chaos Lord': ['abyssal', 'shadow'],
      'Giant Spider Queen': ['nature'],
      'Golem Master': ['mechanical'],
      'Fire Elemental Lord': ['fire'],
      'Frost Giant': ['ice'],
    };

    return influenceMap[bossType] || ['shadow'];
  }

  /**
   * Generate history for a boss
   */
  private generateHistory(bossType: string, name: string, rng: () => number): string {
    const histories: Record<string, string[]> = {
      'Lich': [
        `Once a powerful archmage, ${name} sought immortality through dark magic. After centuries of undeath, they have become a master of necromancy, commanding legions of undead.`,
        `${name} was a scholar who delved too deep into forbidden knowledge. They achieved lichdom ${Math.floor(rng() * 500 + 100)} years ago and have been amassing power ever since.`,
      ],
      'Ancient Dragon': [
        `${name} has slumbered in these depths for over a thousand years. This ancient wyrm is one of the last of its kind, its scales harder than steel and its breath capable of melting stone.`,
        `A legendary dragon from the age of myth, ${name} was sealed away here long ago. The seal has weakened, and the dragon's power grows with each passing year.`,
      ],
      'Demon Lord': [
        `${name} was summoned from the depths of the abyss centuries ago. Though the summoner is long dead, the demon remains, bound to this place and growing in power.`,
        `A fallen angel who embraced darkness, ${name} was banished here long ago. They have corrupted the very stone of the dungeon, turning it into a hellish realm.`,
      ],
      'Necromancer': [
        `${name} was once a healer who turned to dark magic after losing everything. Now they command the dead and seek to build an undead army.`,
        `A former priest who was excommunicated for forbidden practices, ${name} has spent decades perfecting the art of necromancy in these dark halls.`,
      ],
    };

    const historyList = histories[bossType] || [
      `${name} has ruled this level of the dungeon for many years, their power growing with each victim they claim.`,
    ];

    return historyList[Math.floor(rng() * historyList.length)];
  }
}

