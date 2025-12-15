/**
 * SeededRNG - Deterministic Random Number Generator
 * 
 * Matches the implementation from master-generator-tool.html exactly (line 671-712)
 * Used for deterministic dungeon generation, combat, traps, and item generation.
 */

export class SeededRNG {
  private seed: number;

  constructor(seed: string | number) {
    if (typeof seed === 'string') {
      this.seed = this.hashString(seed);
    } else {
      this.seed = seed || Math.floor(Math.random() * 0xFFFFFFFF);
    }
  }

  /**
   * Hash a string to a number (matches master-generator-tool.html line 680-688)
   */
  private hashString(str: string): number {
    let hash = 0;
    for (let i = 0; i < str.length; i++) {
      const char = str.charCodeAt(i);
      hash = ((hash << 5) - hash) + char;
      hash = hash & hash;
    }
    return Math.abs(hash);
  }

  /**
   * Generate next random number (matches master-generator-tool.html line 690-695)
   */
  private next(): number {
    let t = this.seed += 0x6D2B79F5;
    t = Math.imul(t ^ t >>> 15, t | 1);
    t ^= t + Math.imul(t ^ t >>> 7, t | 61);
    return ((t ^ t >>> 14) >>> 0) / 4294967296;
  }

  /**
   * Get a random number between 0 and 1 (matches master-generator-tool.html line 697-699)
   */
  random(): number {
    return this.next();
  }

  /**
   * Get a random integer in range [min, max] inclusive (matches master-generator-tool.html line 701-703)
   */
  range(min: number, max: number): number {
    return Math.floor(this.next() * (max - min + 1)) + min;
  }

  /**
   * Choose a random element from an array (matches master-generator-tool.html line 705-707)
   */
  choice<T>(array: T[]): T {
    return array[Math.floor(this.next() * array.length)];
  }

  /**
   * Get the current seed value (matches master-generator-tool.html line 709-711)
   */
  getSeed(): number {
    return this.seed;
  }

  /**
   * Shuffle an array in place (Fisher-Yates shuffle)
   * Note: Not in master-generator-tool.html but useful for deterministic shuffling
   */
  shuffle<T>(array: T[]): T[] {
    const result = [...array];
    for (let i = result.length - 1; i > 0; i--) {
      const j = Math.floor(this.next() * (i + 1));
      [result[i], result[j]] = [result[j], result[i]];
    }
    return result;
  }
}

