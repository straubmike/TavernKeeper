/**
 * Theme Generator
 * 
 * Selects and manages dungeon themes, considering boss influences.
 */

import { DUNGEON_THEMES, getThemeById, getThemesByBossInfluence } from '../themes/theme-definitions';
import type { DungeonTheme } from '../types/dungeon-generation';

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

export class ThemeGenerator {
  /**
   * Select a theme for a dungeon
   * 
   * If bossInfluence is provided, it will prefer themes influenced by that boss type.
   * If themeId is provided, it will use that specific theme.
   * Otherwise, it selects randomly.
   */
  selectTheme(
    seed: string,
    themeId?: string,
    bossInfluence?: string
  ): DungeonTheme {
    const rng = createRNG(seed);

    // If specific theme requested, use it
    if (themeId) {
      const theme = getThemeById(themeId);
      if (theme) {
        return theme;
      }
    }

    // If boss influence provided, prefer matching themes
    if (bossInfluence) {
      const influencedThemes = getThemesByBossInfluence(bossInfluence);
      if (influencedThemes.length > 0) {
        // 70% chance to pick from influenced themes, 30% random
        if (rng() < 0.7) {
          return influencedThemes[Math.floor(rng() * influencedThemes.length)];
        }
      }
    }

    // Random selection
    return DUNGEON_THEMES[Math.floor(rng() * DUNGEON_THEMES.length)];
  }

  /**
   * Get all available themes
   */
  getAllThemes(): DungeonTheme[] {
    return DUNGEON_THEMES;
  }

  /**
   * Get a theme by ID
   */
  getTheme(themeId: string): DungeonTheme | undefined {
    return getThemeById(themeId);
  }
}