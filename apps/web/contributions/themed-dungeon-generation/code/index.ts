/**
 * Themed Dungeon Generation System
 * 
 * Main entry point for the themed dungeon generation system.
 * This is the primary implementation that should be integrated into the game.
 */

// Export main generator class
export { ThemedDungeonGenerator } from './generators/dungeon-generator';

// Export individual generators (for advanced usage)
export { BossGenerator } from './generators/boss-generator';
export { ThemeGenerator } from './generators/theme-generator';
export { RoomGenerator } from './generators/room-generator';

// Export types
export type {
  ThemedDungeon,
  DungeonTheme,
  Boss,
  DungeonRoom,
  RoomEncounter,
  RoomType,
  DungeonLevelLayout,
  RoomTemplate,
  DungeonGenerationOptions,
  RoomGenerationOptions,
  GeneratedRoom,
  EncounterReward,
} from './types/dungeon-generation';

// Export theme definitions (for reference)
export { DUNGEON_THEMES, getThemeById, getThemesByBossInfluence, getAllThemeIds } from './themes/theme-definitions';

// Export builder definitions
export {
  DUNGEON_BUILDERS,
  NECROMANCER_BUILDER,
  getBuilderById,
  getBuildersByCategory,
  getPurposeForBuilder,
  getRoomFlavorForBuilder,
  getAgeCategory,
  getDifficultyMultiplier,
  type DungeonBuilder,
  type BuilderCategory,
  type AgeCategory,
} from './builders/dungeon-builders';

// Export world context types
export type {
  DungeonWorldContext,
  DungeonProvenance,
} from './types/dungeon-generation';