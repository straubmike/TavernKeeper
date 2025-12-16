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

// Safe fallback: Use environment variable first, then fallback to testnet address
// Ensure we always have a valid address - never undefined
function getHeroContractAddress(): string {
  try {
    const envAddress = process.env.NEXT_PUBLIC_HERO_CONTRACT_ADDRESS;
    const address = envAddress || '0x4Fff2Ce5144989246186462337F0eE2C086F913E'; // Testnet fallback

    // Final safety check
    if (!address || address === '0x0000000000000000000000000000000000000000' || address === 'undefined' || typeof address !== 'string') {
      return '0x4Fff2Ce5144989246186462337F0eE2C086F913E';
    }

    return address;
  } catch (error) {
    console.error('[heroAdventurerInit] Error getting HERO_CONTRACT_ADDRESS:', error);
    return '0x4Fff2Ce5144989246186462337F0eE2C086F913E'; // Fallback to testnet
  }
}

// Initialize module-level constant - ensure it's always defined
let HERO_CONTRACT_ADDRESS: string;
try {
  HERO_CONTRACT_ADDRESS = getHeroContractAddress();
  // Final safety check
  if (!HERO_CONTRACT_ADDRESS || typeof HERO_CONTRACT_ADDRESS !== 'string') {
    console.error('[heroAdventurerInit] HERO_CONTRACT_ADDRESS was invalid after getHeroContractAddress(), using fallback');
    HERO_CONTRACT_ADDRESS = '0x4Fff2Ce5144989246186462337F0eE2C086F913E';
  }
} catch (error) {
  console.error('[heroAdventurerInit] Error initializing HERO_CONTRACT_ADDRESS:', error);
  HERO_CONTRACT_ADDRESS = '0x4Fff2Ce5144989246186462337F0eE2C086F913E';
}

// Ensure it's never undefined
if (typeof HERO_CONTRACT_ADDRESS === 'undefined') {
  console.error('[heroAdventurerInit] CRITICAL: HERO_CONTRACT_ADDRESS was still undefined! Using hardcoded fallback.');
  HERO_CONTRACT_ADDRESS = '0x4Fff2Ce5144989246186462337F0eE2C086F913E';
}

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
      // Extract class from multiple possible metadata locations
      const metadataClass = hero.metadata?.hero?.class ||
        hero.metadata?.attributes?.find((a: any) => a.trait_type === 'Class')?.value ||
        hero.metadata?.attributes?.find((a: any) => a.trait_type === 'class')?.value ||
        hero.metadata?.attributes?.find((a: any) => a.trait_type === 'Role')?.value; // Also check "Role"

      classToUse = classToUse || (metadataClass ? metadataClass.toLowerCase() : null);
      nameToUse = nameToUse || hero.name || `Hero #${tokenId}`;

      if (!classToUse) {
        console.warn(`[HeroInit] Hero ${tokenId} metadata is missing class/role. Defaulting to 'warrior'. Metadata:`, hero.metadata);
        classToUse = 'warrior';
      }
    } catch (error) {
      console.warn(`[HeroInit] Failed to fetch hero data for ${tokenId}, defaulting to warrior:`, error);
      classToUse = 'warrior';
      nameToUse = `Hero #${tokenId}`;
    }
  }

  // Normalize class name
  let normalizedClassStr = classToUse.toLowerCase();

  // Map special roles like "Tavern Keeper" to valid classes
  if (normalizedClassStr.includes('keeper')) normalizedClassStr = 'cleric'; // Keepers are clerics
  else if (normalizedClassStr.includes('wizard') || normalizedClassStr.includes('sorcerer')) normalizedClassStr = 'mage';
  else if (normalizedClassStr.includes('fighter') || normalizedClassStr.includes('knight')) normalizedClassStr = 'warrior';
  else if (normalizedClassStr.includes('thief') || normalizedClassStr.includes('assassin')) normalizedClassStr = 'rogue';

  // Final validation against known types
  if (!BASE_STATS[normalizedClassStr]) {
    console.warn(`[HeroInit] Unknown class '${normalizedClassStr}', defaulting to 'warrior'`);
    normalizedClassStr = 'warrior';
  }

  const normalizedClass = normalizedClassStr as HeroClass;
  // CRITICAL: Do NOT default to warrior stats - if class is invalid, throw error
  const baseStats = BASE_STATS[normalizedClass];
  if (!baseStats) {
    throw new Error(`[HeroInit] Invalid hero class: ${normalizedClass}. Valid classes: warrior, mage, rogue, cleric`);
  }

  // Calculate stats
  const level = 1;
  const proficiencyBonus = calculateProficiencyBonus(level);
  // CRITICAL: Do NOT default hit die - if class is invalid, we already threw error above
  const hitDie = HIT_DICE[normalizedClass];
  if (!hitDie) {
    throw new Error(`[HeroInit] Invalid hero class for hit die: ${normalizedClass}`);
  }

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
  // Force weapon generation by using 'combat' context which guarantees weapon generation
  const itemGenerator = new ItemGenerator();
  const baseWeapon = itemGenerator.generateItem({
    context: 'combat', // Use 'combat' context to guarantee weapon generation
    level: 1,
    classPreference: itemClassPreference,
    rarityModifier: 100, // Common rarity (100% = all common)
    seed: `hero-${heroId.tokenId}-starter-weapon`,
  });

  // Ensure category is set to 'weapon' explicitly
  if (!baseWeapon.category || baseWeapon.category !== 'weapon') {
    console.warn(`Generated item for hero ${heroId.tokenId} is not a weapon (category: ${baseWeapon.category}), forcing to weapon`);
    baseWeapon.category = 'weapon';
  }

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
  contractAddress?: string,
  chainId?: number
): Promise<AdventurerRecord | null> {
  // Use provided values or fallback to defaults
  const finalContractAddress = contractAddress || getHeroContractAddress();
  const finalChainId = chainId || CHAIN_ID;
  try {
    return await initializeAdventurerStats(
      tokenId,
      finalContractAddress,
      finalChainId,
      walletAddress
    );
  } catch (error) {
    console.error(`Error initializing adventurer for hero ${tokenId}:`, error);
    // Don't throw - allow sync to continue even if adventurer init fails
    return null;
  }
}

