/**
 * Item Generator Class
 *
 * INTEGRATION NOTES FOR MAIN DEV:
 * =================================
 *
 * All generated items include a `requiredClass` property that MUST be checked
 * during equipment validation. This ensures class-specific items can only be
 * equipped by the correct class.
 *
 * Equipment Validation Pseudocode:
 * ---------------------------------
 * function canEquipItem(agent, item) {
 *     if (item.requiredClass && item.requiredClass !== agent.class) {
 *         return false; // Class mismatch - cannot equip
 *     }
 *     return true; // Class matches or no restriction
 * }
 *
 * Class-Specific Items:
 * ---------------------
 * Weapons:
 *   - Longsword → requiredClass: 'warrior'
 *   - Staff → requiredClass: 'mage'
 *   - Dagger → requiredClass: 'rogue'
 *   - Mace → requiredClass: 'cleric'
 *
 * Armor:
 *   - Full Plate, Chain Mail → requiredClass: 'warrior'
 *   - Mage Robes, Enchanted Cloak → requiredClass: 'mage'
 *   - Leather Armor, Studded Leather → requiredClass: 'rogue'
 *   - Scale Mail, Breastplate → requiredClass: 'cleric'
 */

import { SeededRNG } from './seeded-rng';
import type {
  GeneratedItem,
  GenerationOptions,
  Rarity,
  ItemCategory,
  GenerationContext,
  PlayerClass,
  ItemCounts,
} from '../types/item-generation';

export class ItemGenerator {
  private rng: SeededRNG;
  private readonly SCARCITY_CAP = 100; // Maximum items of each type that can exist

  /**
   * ============================================================================
   * SCARCITY SYSTEM - WEIGHTED POOL AVAILABILITY
   * ============================================================================
   *
   * OPTIONAL FEATURE: This system can be removed if not desired.
   *
   * How it works:
   * - Tracks how many of each item type have been generated (capped at 100 per type)
   * - When selecting items, weights are based on remaining availability
   * - Example: If 99 Staves exist, only 1 is left, so Staff weight = 1 (very low)
   * - Example: If 0 Longswords exist, all 100 are available, so weight = 100 (high)
   *
   * To REMOVE this system:
   * 1. Remove all methods: getItemCounts(), saveItemCounts(), incrementItemCount(),
   *    getAvailabilityWeight(), resetItemCounts()
   * 2. Remove scarcity weighting logic in generateWeapon() and generateArmor()
   * 3. Remove the incrementItemCount() call in generateItem()
   * 4. Replace weighted selection with simple random choice
   *
   * Search for "SCARCITY" in this file to find all related code.
   * ============================================================================
   */

  // SCARCITY SYSTEM: Storage interface (implement based on your storage system)
  // TO REMOVE: Delete this if removing scarcity system
  private itemCounts: ItemCounts | null = null;

  constructor(seed?: number | string | null) {
    this.rng = new SeededRNG(seed);
    // SCARCITY SYSTEM: Initialize counts
    // TO REMOVE: Delete this line if removing scarcity system
    this.itemCounts = this.getItemCounts();
  }

  // SCARCITY SYSTEM: Get current item counts
  // TO REMOVE: Delete this method if removing scarcity system
  private getItemCounts(): ItemCounts {
    // In a real implementation, this would read from your database/storage
    // For now, return initialized counts (you'll need to implement persistence)
    if (this.itemCounts) {
      return this.itemCounts;
    }

    return {
      // Weapons
      'Longsword': 0,
      'Staff': 0,
      'Dagger': 0,
      'Mace': 0,
      // Armor
      'Full Plate': 0,
      'Chain Mail': 0,
      'Mage Robes': 0,
      'Enchanted Cloak': 0,
      'Leather Armor': 0,
      'Studded Leather': 0,
      'Scale Mail': 0,
      'Breastplate': 0,
    };
  }

  // SCARCITY SYSTEM: Save item counts (implement based on your storage system)
  // TO REMOVE: Delete this method if removing scarcity system
  private saveItemCounts(counts: ItemCounts): void {
    // In a real implementation, this would save to your database/storage
    this.itemCounts = counts;
    // TODO: Implement persistence (database, Redis, etc.)
  }

  // SCARCITY SYSTEM: Increment count for a specific item type
  // TO REMOVE: Delete this method if removing scarcity system
  private incrementItemCount(itemType: string): void {
    const counts = this.getItemCounts();
    const key = itemType as keyof ItemCounts;
    if (counts[key] !== undefined && counts[key] < this.SCARCITY_CAP) {
      counts[key]++;
      this.saveItemCounts(counts);
    }
  }

  // SCARCITY SYSTEM: Get availability weight for an item type
  // TO REMOVE: Delete this method if removing scarcity system
  private getAvailabilityWeight(itemType: string): number {
    const counts = this.getItemCounts();
    const key = itemType as keyof ItemCounts;
    const current = counts[key] || 0;
    const remaining = Math.max(0, this.SCARCITY_CAP - current);
    return remaining; // Weight = how many are left available
  }

  // SCARCITY SYSTEM: Reset all item counts (for testing)
  // TO REMOVE: Delete this method if removing scarcity system
  public resetItemCounts(): void {
    const counts = this.getItemCounts();
    for (const key in counts) {
      counts[key as keyof ItemCounts] = 0;
    }
    this.saveItemCounts(counts);
  }
  // END SCARCITY SYSTEM

  /**
   * Rarity distribution (can be modified by rarity modifier) - 4 tiers only
   */
  private getRarityDistribution(rarityModifier = 100): Record<Rarity, number> {
    const mod = rarityModifier / 100;
    return {
      common: Math.max(0, 60 - (mod - 1) * 15),
      uncommon: Math.max(0, 28 + (mod - 1) * 8),
      rare: Math.max(0, 10 + (mod - 1) * 5),
      epic: Math.max(0, 2 + (mod - 1) * 2),
    };
  }

  /**
   * Determine item rarity based on modifier
   */
  private determineRarity(rarityModifier = 100): Rarity {
    const dist = this.getRarityDistribution(rarityModifier);
    const roll = this.rng.random() * 100;
    let cumulative = 0;

    const rarities: Rarity[] = ['common', 'uncommon', 'rare', 'epic'];
    for (const rarity of rarities) {
      cumulative += dist[rarity];
      if (roll <= cumulative) {
        return rarity;
      }
    }
    return 'common';
  }

  /**
   * Generate an item based on options
   */
  public generateItem(options: GenerationOptions): GeneratedItem {
    const {
      context,
      level,
      classPreference = 'any',
      rarityModifier = 100,
      seed,
    } = options;

    // Create new RNG with seed if provided
    if (seed !== undefined && seed !== null) {
      this.rng = new SeededRNG(seed);
    }

    const rarity = this.determineRarity(rarityModifier);
    const category = this.selectCategory(context, classPreference);

    let item: Partial<GeneratedItem>;
    switch (category) {
      case 'weapon':
        item = this.generateWeapon(rarity, level, classPreference);
        break;
      case 'armor':
        item = this.generateArmor(rarity, level, classPreference);
        break;
      default:
        item = this.generateWeapon(rarity, level, classPreference);
    }

    // Add metadata
    const generatedItem: GeneratedItem = {
      id: `item-${Date.now()}-${this.rng.range(1000, 9999)}`,
      name: item.name!,
      type: item.type!,
      category: category,
      rarity: rarity,
      level: level,
      context: context,
      seed: this.rng.getSeed(),
      itemType: item.itemType!,
      requiredClass: item.requiredClass!,
      ...(item.class && { class: item.class }),
      ...(item.damage && { damage: item.damage }),
      ...(item.attackBonus && { attackBonus: item.attackBonus }),
      ...(item.ac && { ac: item.ac }),
      ...(item.properties && { properties: item.properties }),
      ...(item.enhancements && { enhancements: item.enhancements }),
      ...(item.description && { description: item.description }),
    };

    // SCARCITY SYSTEM: Increment counter for this item type
    // TO REMOVE: Delete this block if removing scarcity system
    if (generatedItem.itemType) {
      this.incrementItemCount(generatedItem.itemType);
    }
    // END SCARCITY SYSTEM

    return generatedItem;
  }

  /**
   * Select item category based on context
   */
  private selectCategory(context: GenerationContext, classPreference: PlayerClass): ItemCategory {
    const contextWeights: Record<GenerationContext, { weapon: number; armor: number }> = {
      dungeon_loot: { weapon: 50, armor: 50 },
      monster_drop: { weapon: 50, armor: 50 },
      boss_drop: { weapon: 50, armor: 50 },
      vendor: { weapon: 50, armor: 50 },
      quest_reward: { weapon: 50, armor: 50 },
    };

    const weights = contextWeights[context] || contextWeights.dungeon_loot;
    const roll = this.rng.random() * 100;
    let cumulative = 0;

    for (const [cat, weight] of Object.entries(weights)) {
      cumulative += weight;
      if (roll <= cumulative) {
        return cat as ItemCategory;
      }
    }
    return 'weapon';
  }

  /**
   * CLASS-SPECIFIC WEAPON MAPPING WITH SCARCITY WEIGHTING
   * IMPORTANT FOR EQUIPMENT VALIDATION:
   * Each weapon type is restricted to its specific class.
   * When integrating with the agent/equipment system, check:
   * - item.requiredClass === agent.class before allowing equip
   *
   * Weapon → Class mappings:
   * - Longsword → Warrior ONLY
   * - Staff → Mage ONLY
   * - Dagger → Rogue ONLY
   * - Mace → Cleric ONLY
   *
   * SCARCITY: Selection is weighted by remaining availability (100 - current count)
   */
  private generateWeapon(
    rarity: Rarity,
    level: number,
    classPreference: PlayerClass
  ): Partial<GeneratedItem> {
    const allWeapons: Record<PlayerClass, { type: string; damage: number; isMagic: boolean; requiredClass: PlayerClass }> = {
      warrior: {
        type: 'Longsword',
        damage: 8,
        isMagic: false,
        requiredClass: 'warrior',
      },
      mage: {
        type: 'Staff',
        damage: 6,
        isMagic: true,
        requiredClass: 'mage',
      },
      rogue: {
        type: 'Dagger',
        damage: 4,
        isMagic: false,
        requiredClass: 'rogue',
      },
      cleric: {
        type: 'Mace',
        damage: 6,
        isMagic: false,
        requiredClass: 'cleric',
      },
      any: {
        type: 'Longsword', // Default fallback
        damage: 8,
        isMagic: false,
        requiredClass: 'warrior',
      },
    };

    // SCARCITY SYSTEM: Weighted selection based on availability
    // TO REMOVE: Replace this block with: const weapon = allWeapons[classPreference] || allWeapons.warrior;
    let candidateWeapons: Array<{ type: string; damage: number; isMagic: boolean; requiredClass: PlayerClass }>;
    if (classPreference === 'any') {
      candidateWeapons = [
        allWeapons.warrior,
        allWeapons.mage,
        allWeapons.rogue,
        allWeapons.cleric,
      ];
    } else {
      candidateWeapons = [allWeapons[classPreference] || allWeapons.warrior];
    }

    // Apply scarcity weighting: weight = remaining availability
    const weightedWeapons = candidateWeapons.map((weapon) => ({
      ...weapon,
      weight: this.getAvailabilityWeight(weapon.type),
    }));

    // Select weapon based on weighted random
    const totalWeight = weightedWeapons.reduce((sum, w) => sum + w.weight, 0);
    let weapon: { type: string; damage: number; isMagic: boolean; requiredClass: PlayerClass } | undefined = undefined;
    if (totalWeight === 0) {
      // All weapons are at cap, select randomly
      weapon = this.rng.choice(candidateWeapons);
    } else {
      let roll = this.rng.random() * totalWeight;
      let cumulative = 0;
      for (const w of weightedWeapons) {
        cumulative += w.weight;
        if (roll <= cumulative) {
          weapon = w;
          break;
        }
      }
      if (!weapon) weapon = weightedWeapons[0]; // Fallback
    }
    // END SCARCITY SYSTEM

    const baseType = weapon.type;

    const rarityStats: Record<Rarity, { attackBonus: number; enhancementCount: number }> = {
      common: { attackBonus: 0, enhancementCount: 0 },
      uncommon: { attackBonus: 1, enhancementCount: 0 },
      rare: { attackBonus: 2, enhancementCount: 1 },
      epic: { attackBonus: 3, enhancementCount: 2 },
    };

    const stats = rarityStats[rarity];
    const attackBonus = stats.attackBonus + Math.floor(level / 5);
    const damageDice = `1d${weapon.damage} + ${attackBonus}`;

    const enhancements = this.generateEnhancements(stats.enhancementCount, rarity, level);

    return {
      name: this.generateWeaponName(baseType, rarity, enhancements),
      type: weapon.isMagic ? 'weapon (magic)' : 'weapon (melee)',
      itemType: baseType,
      class: classPreference, // Deprecated - use requiredClass instead
      requiredClass: weapon.requiredClass, // USE THIS for equipment validation
      damage: damageDice,
      attackBonus: `+${attackBonus}`,
      properties: this.getWeaponProperties(baseType),
      enhancements: enhancements,
      description: this.generateWeaponDescription(baseType, rarity, enhancements),
    };
  }

  /**
   * CLASS-SPECIFIC ARMOR KIT MAPPING WITH SCARCITY WEIGHTING
   * IMPORTANT FOR EQUIPMENT VALIDATION:
   * Each armor kit is restricted to its specific class.
   * When integrating with the agent/equipment system, check:
   * - item.requiredClass === agent.class before allowing equip
   *
   * Armor → Class mappings:
   * - Full Plate, Chain Mail → Warrior ONLY
   * - Mage Robes, Enchanted Cloak → Mage ONLY
   * - Leather Armor, Studded Leather → Rogue ONLY
   * - Scale Mail, Breastplate → Cleric ONLY
   *
   * Each armor represents a COMPLETE ARMOR SET (not individual pieces)
   *
   * SCARCITY: Selection is weighted by remaining availability (100 - current count)
   */
  private generateArmor(
    rarity: Rarity,
    level: number,
    classPreference: PlayerClass
  ): Partial<GeneratedItem> {
    const allArmorKits: Record<PlayerClass, Array<{ type: string; baseAC: number; armorType: 'Light' | 'Medium' | 'Heavy'; requiredClass: PlayerClass }>> = {
      warrior: [
        {
          type: 'Full Plate',
          baseAC: 8,
          armorType: 'Heavy',
          requiredClass: 'warrior',
        },
        {
          type: 'Chain Mail',
          baseAC: 6,
          armorType: 'Medium',
          requiredClass: 'warrior',
        },
      ],
      mage: [
        {
          type: 'Mage Robes',
          baseAC: 3,
          armorType: 'Light',
          requiredClass: 'mage',
        },
        {
          type: 'Enchanted Cloak',
          baseAC: 2,
          armorType: 'Light',
          requiredClass: 'mage',
        },
      ],
      rogue: [
        {
          type: 'Leather Armor',
          baseAC: 3,
          armorType: 'Light',
          requiredClass: 'rogue',
        },
        {
          type: 'Studded Leather',
          baseAC: 4,
          armorType: 'Light',
          requiredClass: 'rogue',
        },
      ],
      cleric: [
        {
          type: 'Scale Mail',
          baseAC: 6,
          armorType: 'Medium',
          requiredClass: 'cleric',
        },
        {
          type: 'Breastplate',
          baseAC: 5,
          armorType: 'Medium',
          requiredClass: 'cleric',
        },
      ],
      any: [
        {
          type: 'Full Plate',
          baseAC: 8,
          armorType: 'Heavy',
          requiredClass: 'warrior',
        },
      ],
    };

    // SCARCITY SYSTEM: Weighted selection based on availability
    // TO REMOVE: Replace this block with: const armor = this.rng.choice(allArmorKits[classPreference] || allArmorKits.warrior);
    let candidateArmor: Array<{ type: string; baseAC: number; armorType: 'Light' | 'Medium' | 'Heavy'; requiredClass: PlayerClass }>;
    if (classPreference === 'any') {
      candidateArmor = [
        ...allArmorKits.warrior,
        ...allArmorKits.mage,
        ...allArmorKits.rogue,
        ...allArmorKits.cleric,
      ];
    } else {
      candidateArmor = allArmorKits[classPreference] || allArmorKits.warrior;
    }

    // Apply scarcity weighting: weight = remaining availability
    const weightedArmor = candidateArmor.map((armor) => ({
      ...armor,
      weight: this.getAvailabilityWeight(armor.type),
    }));

    // Select armor based on weighted random
    const totalWeight = weightedArmor.reduce((sum, a) => sum + a.weight, 0);
    let armor: { type: string; baseAC: number; armorType: 'Light' | 'Medium' | 'Heavy'; requiredClass: PlayerClass } | undefined = undefined;
    if (totalWeight === 0) {
      // All armor is at cap, select randomly
      armor = this.rng.choice(candidateArmor);
    } else {
      let roll = this.rng.random() * totalWeight;
      let cumulative = 0;
      for (const a of weightedArmor) {
        cumulative += a.weight;
        if (roll <= cumulative) {
          armor = a;
          break;
        }
      }
      if (!armor) armor = weightedArmor[0]; // Fallback
    }
    // END SCARCITY SYSTEM

    const baseType = armor.type;

    const rarityStats: Record<Rarity, { acBonus: number; enhancementCount: number }> = {
      common: { acBonus: 0, enhancementCount: 0 },
      uncommon: { acBonus: 1, enhancementCount: 0 },
      rare: { acBonus: 2, enhancementCount: 1 },
      epic: { acBonus: 3, enhancementCount: 2 },
    };

    const stats = rarityStats[rarity];
    const acBonus = armor.baseAC + stats.acBonus + Math.floor(level / 5);

    const enhancements = this.generateEnhancements(stats.enhancementCount, rarity, level);

    return {
      name: this.generateArmorName(baseType, rarity, enhancements),
      type: 'armor',
      itemType: baseType,
      class: classPreference, // Deprecated - use requiredClass instead
      requiredClass: armor.requiredClass, // USE THIS for equipment validation
      ac: `+${acBonus}`,
      properties: this.getArmorProperties(baseType, armor.armorType),
      enhancements: enhancements,
      description: this.generateArmorDescription(baseType, rarity, enhancements),
    };
  }

  /**
   * Generate enhancements based on rarity and level
   */
  private generateEnhancements(count: number, rarity: Rarity, level: number): string[] {
    const enhancements: string[] = [];
    const allEnhancements = [
      'Flaming',
      'Frost',
      'Shock',
      'Venomous',
      'Regeneration',
      'Lifesteal',
      'Fortified',
      'Swift',
    ];

    for (let i = 0; i < count; i++) {
      enhancements.push(this.rng.choice(allEnhancements));
    }
    return enhancements;
  }

  /**
   * Generate weapon name
   */
  private generateWeaponName(baseType: string, rarity: Rarity, enhancements: string[]): string {
    let name = baseType;

    if (enhancements.length > 0) {
      name = `${enhancements[0]} ${name}`;
    }

    if (rarity !== 'common') {
      const rarityPrefixes: Record<Rarity, string> = {
        uncommon: '+1',
        rare: '+2',
        epic: '+3',
        common: '',
      };
      name += ` ${rarityPrefixes[rarity] || ''}`;
    }

    return name.trim();
  }

  /**
   * Generate armor name
   */
  private generateArmorName(baseType: string, rarity: Rarity, enhancements: string[]): string {
    let name = baseType;

    if (enhancements.length > 0) {
      name = `${baseType} of ${enhancements[0]}`;
    }

    if (rarity === 'epic') {
      const suffixes = ['Protection', 'the Guardian', 'Valor'];
      name = `${name} ${this.rng.choice(suffixes)}`;
    }

    return name;
  }

  /**
   * Get weapon properties
   */
  private getWeaponProperties(baseType: string): string {
    if (baseType === 'Dagger') return 'Finesse, Light';
    if (baseType === 'Staff') return 'Spell Focus, Two-handed';
    if (baseType === 'Longsword') return 'Versatile';
    if (baseType === 'Mace') return 'Standard';
    return 'Standard';
  }

  /**
   * Get armor properties
   */
  private getArmorProperties(baseType: string, armorType: 'Light' | 'Medium' | 'Heavy'): string {
    let props = `${armorType} Armor`;
    if (armorType === 'Heavy') {
      props += ', Stealth Disadvantage';
    }
    return props;
  }

  /**
   * Generate weapon description
   */
  private generateWeaponDescription(baseType: string, rarity: Rarity, enhancements: string[]): string {
    let desc = `A ${rarity} ${baseType.toLowerCase()}.`;
    if (enhancements.length > 0) {
      desc += ` It glows with ${enhancements[0].toLowerCase()} energy.`;
    }
    return desc;
  }

  /**
   * Generate armor description
   */
  private generateArmorDescription(baseType: string, rarity: Rarity, enhancements: string[]): string {
    return `A ${rarity} piece of ${baseType.toLowerCase()} that provides excellent protection.`;
  }
}

