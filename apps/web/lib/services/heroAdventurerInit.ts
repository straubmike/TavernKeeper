/**
 * Hero Adventurer Initialization
 * 
 * Helper functions to initialize adventurer stats when a hero is minted or synced.
 * Also initializes starter weapon.
 */

import { getHeroByTokenId } from './heroOwnership';
import { 
  upsertAdventurer,
  getAdventurer,
  type AdventurerRecord,
  type HeroIdentifier,
  type HeroClass,
} from '../../contributions/adventurer-tracking/code/services/adventurerService';
import {
  calculateMaxHP,
  calculateProficiencyBonus,
  calculateAbilityModifier,
  type AdventurerStats,
} from '../../contributions/adventurer-tracking/code/types/adventurer-stats';
import { ItemGenerator } from '../../contributions/procedural-item-generation/code/generators/item-generator';
import { 
  addItemToInventory,
  equipItem,
  getEquippedItems,
} from '../../contributions/inventory-tracking/code/services/inventoryService';

const HERO_CONTRACT_ADDRESS = process.env.NEXT_PUBLIC_HERO_CONTRACT_ADDRESS || '0x0000000000000000000000000000000000000000';
const CHAIN_ID = parseInt(process.env.NEXT_PUBLIC_CHAIN_ID || '143', 10);

/**
 * Hit dice by class (D&D 5e)
 */
const HIT_DICE: Record<string, number> = {
  warrior: 10,  // d10
  mage: 6,      // d6
  rogue: 8,     // d8
  cleric: 8,    // d8
};

/**
 * Base stats by class (rolled stats)
 */
const BASE_STATS: Record<string, Partial<AdventurerStats>> = {
  warrior: {
    strength: 16,
    dexterity: 12,
    constitution: 14,
    intelligence: 10,
    wisdom: 10,
    charisma: 8,
  },
  mage: {
    strength: 8,
    dexterity: 12,
    constitution: 10,
    intelligence: 16,
    wisdom: 14,
    charisma: 10,
  },
  rogue: {
    strength: 10,
    dexterity: 16,
    constitution: 12,
    intelligence: 14,
    wisdom: 10,
    charisma: 8,
  },
  cleric: {
    strength: 12,
    dexterity: 10,
    constitution: 14,
    intelligence: 10,
    wisdom: 16,
    charisma: 12,
  },
};

/**
 * Initialize adventurer stats for a newly minted/synced hero
 */
export async function initializeAdventurerStats(
  tokenId: string,
  contractAddress: string,
  chainId: number,
  walletAddress: string,
  heroClass?: string,
  heroName?: string
): Promise<AdventurerRecord> {
  // Check if adventurer already exists
  const heroId: HeroIdentifier = {
    tokenId,
    contractAddress,
    chainId,
  };

  const existing = await getAdventurer(heroId);
  if (existing) {
    // Already initialized, return existing
    return existing;
  }

  // Get hero data if not provided
  let classToUse = heroClass?.toLowerCase();
  let nameToUse = heroName;

  if (!classToUse || !nameToUse) {
    try {
      const hero = await getHeroByTokenId(tokenId);
      classToUse = classToUse || hero.metadata?.hero?.class?.toLowerCase() || 
                   hero.metadata?.attributes?.find((a: any) => a.trait_type === 'Class')?.value?.toLowerCase() || 
                   'warrior';
      nameToUse = nameToUse || hero.name || `Hero #${tokenId}`;
    } catch (error) {
      console.warn(`Could not fetch hero data for ${tokenId}, using defaults:`, error);
      classToUse = classToUse || 'warrior';
      nameToUse = nameToUse || `Hero #${tokenId}`;
    }
  }

  // Normalize class name
  const normalizedClass = classToUse.toLowerCase() as HeroClass;
  const baseStats = BASE_STATS[normalizedClass] || BASE_STATS.warrior;

  // Calculate stats
  const level = 1;
  const proficiencyBonus = calculateProficiencyBonus(level);
  const hitDie = HIT_DICE[normalizedClass] || 8;

  // Calculate HP from CON and level
  const maxHealth = calculateMaxHP(
    baseStats.constitution || 10,
    level,
    hitDie
  );

  // Calculate mana (only for mages and clerics)
  const maxMana = (normalizedClass === 'mage' || normalizedClass === 'cleric') ? 50 : 0;

  // Calculate AC (base 10 + DEX modifier)
  const armorClass = 10 + calculateAbilityModifier(baseStats.dexterity || 10);

  // Calculate perception (WIS modifier + proficiency if proficient)
  const perceptionBase = 10 + calculateAbilityModifier(baseStats.wisdom || 10);
  const perceptionProficient = Math.random() < 0.35; // 35% chance
  const perception = perceptionProficient 
    ? perceptionBase + proficiencyBonus 
    : perceptionBase;

  // Calculate attack bonuses
  const attackBonus = calculateAbilityModifier(baseStats.strength || 10);
  const spellAttackBonus = (normalizedClass === 'mage' || normalizedClass === 'cleric')
    ? calculateAbilityModifier(baseStats.wisdom || 10)
    : 0;

  // Build stats object
  const stats: AdventurerStats = {
    health: maxHealth,
    maxHealth,
    mana: maxMana,
    maxMana,
    strength: baseStats.strength || 10,
    dexterity: baseStats.dexterity || 10,
    wisdom: baseStats.wisdom || 10,
    intelligence: baseStats.intelligence || 10,
    constitution: baseStats.constitution || 10,
    charisma: baseStats.charisma || 10,
    perception,
    armorClass,
    proficiencyBonus,
    skillProficiencies: {
      perception: perceptionProficient,
    },
    attackBonus,
    spellAttackBonus,
  };

  // Create adventurer record
  const adventurer: AdventurerRecord = {
    heroId,
    walletAddress: walletAddress.toLowerCase(),
    name: nameToUse,
    class: normalizedClass,
    level,
    experience: 0,
    stats,
    createdAt: new Date(),
    updatedAt: new Date(),
  };

  // Save to database
  const savedAdventurer = await upsertAdventurer(adventurer);

  // Initialize starter weapon
  try {
    await initializeStarterWeapon(heroId, walletAddress, normalizedClass);
  } catch (weaponError) {
    console.warn(`Failed to initialize starter weapon for hero ${tokenId}:`, weaponError);
    // Non-fatal - adventurer is still initialized
  }

  return savedAdventurer;
}

/**
 * Initialize starter weapon for a hero
 */
async function initializeStarterWeapon(
  heroId: HeroIdentifier,
  walletAddress: string,
  heroClass: HeroClass
): Promise<void> {
  // Check if hero already has a weapon equipped
  const equipped = await getEquippedItems(heroId);
  if (equipped.mainHand) {
    // Already has a weapon, skip
    return;
  }

  // Map hero class to item generator class preference
  const classPreferenceMap: Record<HeroClass, 'warrior' | 'mage' | 'rogue' | 'cleric'> = {
    warrior: 'warrior',
    mage: 'mage',
    rogue: 'rogue',
    cleric: 'cleric',
  };

  const itemClassPreference = classPreferenceMap[heroClass] || 'warrior';

  // Generate base weapon (common rarity, level 1)
  const itemGenerator = new ItemGenerator();
  const baseWeapon = itemGenerator.generateItem({
    context: 'dungeon_loot',
    level: 1,
    classPreference: itemClassPreference,
    rarityModifier: 100, // Common rarity (100% = all common)
    seed: `hero-${heroId.tokenId}-starter-weapon`,
  });

  // Add to inventory
  const inventoryItem = await addItemToInventory(
    walletAddress,
    baseWeapon,
    1,
    'hero_mint' // Source: hero was minted
  );

  // Equip weapon
  await equipItem({
    itemId: inventoryItem.id,
    heroId,
    slot: 'main_hand',
    action: 'equip',
  });
}

/**
 * Initialize adventurer stats when hero is synced
 * This should be called from syncUserHeroes or after hero mint
 */
export async function initializeAdventurerOnSync(
  tokenId: string,
  walletAddress: string,
  contractAddress: string = HERO_CONTRACT_ADDRESS,
  chainId: number = CHAIN_ID
): Promise<AdventurerRecord | null> {
  try {
    return await initializeAdventurerStats(
      tokenId,
      contractAddress,
      chainId,
      walletAddress
    );
  } catch (error) {
    console.error(`Error initializing adventurer for hero ${tokenId}:`, error);
    // Don't throw - allow sync to continue even if adventurer init fails
    return null;
  }
}

