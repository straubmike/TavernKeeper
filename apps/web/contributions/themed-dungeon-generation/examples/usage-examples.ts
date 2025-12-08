/**
 * Usage Examples for Themed Dungeon Generation
 * 
 * Demonstrates how to use the dungeon generation system.
 */

import { ThemedDungeonGenerator } from '../code/generators/dungeon-generator';
import type { DungeonGenerationOptions, RoomGenerationOptions } from '../code/types/dungeon-generation';

/**
 * Example 1: Generate a basic themed dungeon
 */
export async function example1_BasicDungeonGeneration() {
  const generator = new ThemedDungeonGenerator();

  const options: DungeonGenerationOptions = {
    seed: 'my-dungeon-seed-123',
    depth: 100,
  };

  const dungeon = await generator.generate(options);

  console.log(`Generated dungeon: ${dungeon.name}`);
  console.log(`Theme: ${dungeon.theme.name}`);
  console.log(`Final Boss: ${dungeon.finalBoss.name} (${dungeon.finalBoss.type})`);
  console.log(`Mid-Bosses: ${dungeon.midBosses.length}`);
  console.log(`Depth: ${dungeon.depth} levels`);

  return dungeon;
}

/**
 * Example 2: Generate dungeon with specific theme
 */
export async function example2_SpecificTheme() {
  const generator = new ThemedDungeonGenerator();

  const options: DungeonGenerationOptions = {
    seed: 'undead-dungeon-456',
    depth: 100,
    themeId: 'undead', // Force undead theme
  };

  const dungeon = await generator.generate(options);

  console.log(`Dungeon: ${dungeon.name}`);
  console.log(`Theme: ${dungeon.theme.name} (forced)`);
  console.log(`Monster Types: ${dungeon.theme.monsterTypes.join(', ')}`);

  return dungeon;
}

/**
 * Example 3: Generate room on-demand
 */
export async function example3_OnDemandRoomGeneration() {
  const generator = new ThemedDungeonGenerator();

  // First, generate a dungeon
  const dungeon = await generator.generate({
    seed: 'test-dungeon-789',
    depth: 100,
  });

  // Generate a room for level 25
  const roomOptions: RoomGenerationOptions = {
    level: 25,
    dungeon,
    // roomType: 'combat', // Optional: specify room type
  };

  const generatedRoom = generator.getRoomForLevel(
    dungeon,
    25,
    'combat' // Or pass undefined for auto-selection
  );

  console.log(`Room: ${generatedRoom.room.name}`);
  console.log(`Type: ${generatedRoom.room.type}`);
  console.log(`Description: ${generatedRoom.room.description}`);

  if (generatedRoom.encounter) {
    console.log(`Encounter: ${generatedRoom.encounter.name}`);
    console.log(`Difficulty: ${generatedRoom.encounter.difficulty}/10`);
  }

  return generatedRoom;
}

/**
 * Example 4: Boss influence on theme
 */
export async function example4_BossInfluence() {
  const generator = new ThemedDungeonGenerator();

  // Generate dungeon - boss will influence theme
  const dungeon = await generator.generate({
    seed: 'necromancer-dungeon',
    depth: 100,
    // No themeId specified - theme will be influenced by boss
  });

  console.log(`Final Boss: ${dungeon.finalBoss.name} (${dungeon.finalBoss.type})`);
  console.log(`Selected Theme: ${dungeon.theme.name}`);
  console.log(`Boss Theme Influence: ${dungeon.finalBoss.themeInfluence.join(', ')}`);

  // If boss is a Necromancer or Lich, theme should likely be 'undead'
  if (dungeon.finalBoss.type === 'Necromancer' || dungeon.finalBoss.type === 'Lich') {
    console.log('Boss influenced theme selection toward undead theme');
  }

  return dungeon;
}

/**
 * Example 5: Game flow simulation
 * 
 * Simulates the actual game flow:
 * 1. Player clicks "Enter Dungeon"
 * 2. Get list of dungeons
 * 3. Select random dungeon
 * 4. Begin building dungeon
 * 5. Generate rooms as player progresses
 */
export async function example5_GameFlow() {
  const generator = new ThemedDungeonGenerator();

  // Step 1: Player clicks "Enter Dungeon"
  console.log('Player clicked "Enter Dungeon"');

  // Step 2: Get list of available dungeons
  // In real implementation, this would query from storage
  const availableDungeons = await generator.getAvailableDungeons();
  console.log(`Available dungeons: ${availableDungeons.length}`);

  // Step 3: Select random dungeon
  const selectedDungeon = await generator.selectRandomDungeon('player-seed-123');
  
  if (!selectedDungeon) {
    // If no dungeons available, generate a new one
    console.log('No dungeons available, generating new dungeon...');
    const newDungeon = await generator.generate({
      seed: `dungeon-${Date.now()}`,
      depth: 100,
    });
    
    console.log(`Generated new dungeon: ${newDungeon.name}`);
    console.log(`Theme: ${newDungeon.theme.name}`);
    console.log(`Final Boss: ${newDungeon.finalBoss.name}`);
    
    // Step 4: Begin building dungeon
    // Bosses are already pre-generated
    console.log(`\nDungeon Structure:`);
    console.log(`- Depth: ${newDungeon.depth} levels`);
    console.log(`- Final Boss at level ${newDungeon.depth}: ${newDungeon.finalBoss.name}`);
    console.log(`- Mid-Bosses: ${newDungeon.midBosses.map(b => `Level ${b.level}: ${b.name}`).join(', ')}`);
    console.log(`- Theme: ${newDungeon.theme.name} (influenced by ${newDungeon.finalBoss.type})`);

    // Step 5: Generate rooms as player progresses
    console.log(`\nPlayer enters level 1...`);
    const room1 = generator.getRoomForLevel(newDungeon, 1);
    console.log(`Room: ${room1.room.name} (${room1.room.type})`);

    console.log(`\nPlayer reaches level 25...`);
    const room25 = generator.getRoomForLevel(newDungeon, 25);
    console.log(`Room: ${room25.room.name} (${room25.room.type})`);

    if (room25.encounter) {
      console.log(`Encounter: ${room25.encounter.name} (Difficulty: ${room25.encounter.difficulty})`);
    }

    return newDungeon;
  }

  return selectedDungeon;
}

/**
 * Example 6: Accessing level layout
 */
export async function example6_LevelLayout() {
  const generator = new ThemedDungeonGenerator();

  const dungeon = await generator.generate({
    seed: 'layout-test',
    depth: 100,
  });

  // Access level layout (the list data structure)
  console.log(`Dungeon has ${dungeon.levelLayout.length} levels`);

  // Check a specific level
  const level50 = dungeon.levelLayout.find(layout => layout.level === 50);
  if (level50) {
    console.log(`Level 50:`);
    console.log(`- Has Boss: ${level50.boss ? level50.boss.name : 'No'}`);
    console.log(`- Room Types Available: ${level50.roomTemplate.roomTypes.join(', ')}`);
    console.log(`- Monster Types: ${level50.roomTemplate.monsterTypes?.join(', ')}`);
    console.log(`- Difficulty Range: ${level50.roomTemplate.difficultyRange[0]}-${level50.roomTemplate.difficultyRange[1]}`);
  }

  // Find all boss levels
  const bossLevels = dungeon.levelLayout.filter(layout => layout.boss !== null);
  console.log(`\nBoss Levels: ${bossLevels.map(l => `Level ${l.level}: ${l.boss?.name}`).join(', ')}`);

  return dungeon;
}