/**
 * Map Converter
 *
 * Converts Mike's map generator format (Dungeon with multi-level structure)
 * to engine format (DungeonMap with optional multi-level support)
 */

import type {
    DungeonLevel,
    DungeonMap,
    DungeonObjective,
    LevelConnection,
    MapEnemy,
    MapItem,
    Room,
    SpawnPoint,
} from '@innkeeper/lib';

// Import Mike's types (using type-only imports to avoid runtime dependency)
type MikesDungeon = {
  id: string;
  name: string;
  entranceX: number;
  entranceY: number;
  seed: string;
  type: 'dungeon' | 'tower';
  maxDepth: number;
  levels: MikesDungeonLevel[];
  worldContentId?: string;
  metadata: Record<string, unknown>;
};

type MikesDungeonLevel = {
  z: number;
  rooms: MikesRoom[];
  connections: MikesLevelConnection[];
  metadata?: Record<string, unknown>;
};

type MikesRoom = {
  id: string;
  name: string;
  description: string;
  type: 'chamber' | 'corridor' | 'boss_room' | 'treasure_room' | 'trap_room' | 'puzzle_room' | 'entrance' | 'exit';
  encounters?: MikesEncounter[];
  loot?: MikesLootEntry[];
  connections: MikesRoomConnection[];
  metadata?: Record<string, unknown>;
};

type MikesLevelConnection = {
  fromZ: number;
  toZ: number;
  type: 'staircase' | 'ladder' | 'portal' | 'elevator';
  description: string;
};

type MikesRoomConnection = {
  targetRoomId: string;
  type: 'door' | 'corridor' | 'passage' | 'secret_passage';
  description: string;
};

type MikesEncounter = {
  id: string;
  type: 'boss' | 'monster' | 'trap' | 'puzzle' | 'event';
  name: string;
  description: string;
  worldContentId?: string;
  metadata: Record<string, unknown>;
};

type MikesLootEntry = {
  id: string;
  itemId: string;
  name: string;
  rarity: string;
  worldContentId?: string;
  metadata: Record<string, unknown>;
};

/**
 * Convert Mike's Dungeon format to engine DungeonMap format
 * Preserves multi-level structure
 */
export function convertDungeonToDungeonMap(mikesDungeon: MikesDungeon): DungeonMap {
  // Convert all levels
  const levels: DungeonLevel[] = mikesDungeon.levels.map((level) => {
    const rooms = level.rooms.map((mikesRoom, index) => convertRoom(mikesRoom, level.z, index, level.rooms.length));

    const levelConnections: LevelConnection[] = level.connections.map((conn) => ({
      fromZ: conn.fromZ,
      toZ: conn.toZ,
      type: conn.type,
      description: conn.description,
    }));

    return {
      z: level.z,
      rooms,
      connections: levelConnections,
      metadata: level.metadata,
    };
  });

  // Flatten all rooms for backward compatibility
  const allRooms: Room[] = [];
  for (const level of levels) {
    allRooms.push(...level.rooms);
  }

  // Generate objectives from encounters
  const objectives = generateObjectives(mikesDungeon.levels);

  // Calculate map bounds
  const bounds = calculateBounds(allRooms);

  return {
    id: mikesDungeon.id,
    name: mikesDungeon.name,
    seed: mikesDungeon.seed,
    rooms: allRooms,
    width: bounds.width,
    height: bounds.height,
    objectives,
    levels, // Multi-level structure
  };
}

/**
 * Convert Mike's Room format to engine Room format
 */
function convertRoom(
  mikesRoom: MikesRoom,
  levelZ: number,
  index: number,
  totalRooms: number
): Room {
  // Generate position (grid layout)
  const cols = Math.ceil(Math.sqrt(totalRooms));
  const row = Math.floor(index / cols);
  const col = index % cols;
  const roomSize = 100; // Default room size
  const spacing = 150;

  const x = col * spacing;
  const y = row * spacing;
  const width = roomSize;
  const height = roomSize;

  // Convert room type
  const roomType = convertRoomType(mikesRoom.type);

  // Convert connections (simple array of room IDs)
  const connections = mikesRoom.connections.map((conn) => conn.targetRoomId);

  // Generate spawn points
  const spawnPoints = generateSpawnPoints(x, y, width, height, mikesRoom.type);

  // Convert encounters to enemies
  const enemies = convertEncountersToEnemies(mikesRoom.encounters || []);

  // Convert loot to items
  const items = convertLootToItems(mikesRoom.loot || []);

  return {
    id: mikesRoom.id,
    x,
    y,
    width,
    height,
    type: roomType,
    connections,
    spawnPoints,
    items,
    enemies,
    levelZ, // Set z-coordinate
  };
}

/**
 * Convert room type from Mike's format to engine format
 */
function convertRoomType(mikesType: MikesRoom['type']): Room['type'] {
  const typeMap: Record<MikesRoom['type'], Room['type']> = {
    chamber: 'chamber',
    corridor: 'corridor',
    boss_room: 'boss',
    treasure_room: 'chamber',
    trap_room: 'chamber',
    puzzle_room: 'chamber',
    entrance: 'room',
    exit: 'room',
  };
  return typeMap[mikesType] || 'chamber';
}

/**
 * Generate spawn points for a room
 */
function generateSpawnPoints(
  x: number,
  y: number,
  width: number,
  height: number,
  roomType: MikesRoom['type']
): SpawnPoint[] {
  const spawnPoints: SpawnPoint[] = [];
  const centerX = x + width / 2;
  const centerY = y + height / 2;

  // Entrance room gets spawn point at center
  if (roomType === 'entrance') {
    spawnPoints.push({ x: centerX, y: centerY });
  } else {
    // Other rooms get 1-3 spawn points
    const count = roomType === 'boss_room' ? 1 : Math.floor(Math.random() * 3) + 1;
    for (let i = 0; i < count; i++) {
      const offsetX = (Math.random() - 0.5) * (width * 0.6);
      const offsetY = (Math.random() - 0.5) * (height * 0.6);
      spawnPoints.push({
        x: Math.floor(centerX + offsetX),
        y: Math.floor(centerY + offsetY),
      });
    }
  }

  return spawnPoints;
}

/**
 * Convert encounters to enemies with generated stats
 */
function convertEncountersToEnemies(encounters: MikesEncounter[]): MapEnemy[] {
  return encounters
    .filter((enc) => enc.type === 'boss' || enc.type === 'monster')
    .map((encounter) => {
      const stats = generateEnemyStats(encounter.type, encounter.metadata);
      return {
        id: encounter.id,
        name: encounter.name,
        stats,
      };
    });
}

/**
 * Generate enemy stats based on encounter type
 */
function generateEnemyStats(
  type: 'boss' | 'monster' | 'trap' | 'puzzle' | 'event',
  metadata: Record<string, unknown>
): MapEnemy['stats'] {
  // Base stats
  let baseStats = {
    str: 10,
    dex: 10,
    con: 10,
    int: 10,
    wis: 10,
    cha: 10,
    ac: 10,
    hp: 10,
    maxHp: 10,
    attackBonus: 0,
  };

  if (type === 'boss') {
    baseStats = {
      str: 16,
      dex: 12,
      con: 14,
      int: 8,
      wis: 10,
      cha: 8,
      ac: 15,
      hp: 50,
      maxHp: 50,
      attackBonus: 5,
    };
  } else if (type === 'monster') {
    baseStats = {
      str: 12,
      dex: 14,
      con: 12,
      int: 6,
      wis: 10,
      cha: 6,
      ac: 12,
      hp: 20,
      maxHp: 20,
      attackBonus: 3,
    };
  }

  // Override with metadata if provided
  if (metadata.stats && typeof metadata.stats === 'object') {
    baseStats = { ...baseStats, ...(metadata.stats as Partial<typeof baseStats>) };
  }

  return baseStats;
}

/**
 * Convert loot entries to items
 */
function convertLootToItems(loot: MikesLootEntry[]): MapItem[] {
  return loot.map((lootEntry) => {
    // Determine item type from rarity or name
    let itemType: MapItem['type'] = 'misc';
    if (lootEntry.name.toLowerCase().includes('weapon') || lootEntry.name.toLowerCase().includes('sword')) {
      itemType = 'weapon';
    } else if (lootEntry.name.toLowerCase().includes('armor') || lootEntry.name.toLowerCase().includes('shield')) {
      itemType = 'armor';
    } else if (lootEntry.name.toLowerCase().includes('potion') || lootEntry.name.toLowerCase().includes('consumable')) {
      itemType = 'consumable';
    }

    return {
      id: lootEntry.itemId || lootEntry.id,
      name: lootEntry.name,
      type: itemType,
    };
  });
}

/**
 * Generate objectives from dungeon encounters
 */
function generateObjectives(levels: MikesDungeonLevel[]): DungeonObjective[] {
  const objectives: DungeonObjective[] = [];

  // Find boss encounters
  for (const level of levels) {
    for (const room of level.rooms) {
      if (room.encounters) {
        for (const encounter of room.encounters) {
          if (encounter.type === 'boss') {
            objectives.push({
              type: 'defeat_boss',
              target: encounter.id,
            });
          }
        }
      }

      // Check for treasure rooms
      if (room.type === 'treasure_room' && room.loot && room.loot.length > 0) {
        const firstTreasure = room.loot[0];
        objectives.push({
          type: 'retrieve_item',
          target: firstTreasure.itemId || firstTreasure.id,
        });
      }
    }
  }

  // Default objective if none found
  if (objectives.length === 0) {
    objectives.push({
      type: 'survive',
      target: 'party',
    });
  }

  return objectives;
}

/**
 * Calculate map bounds from room positions
 */
function calculateBounds(rooms: Room[]): { width: number; height: number } {
  if (rooms.length === 0) {
    return { width: 400, height: 300 };
  }

  let minX = Infinity;
  let minY = Infinity;
  let maxX = -Infinity;
  let maxY = -Infinity;

  for (const room of rooms) {
    minX = Math.min(minX, room.x);
    minY = Math.min(minY, room.y);
    maxX = Math.max(maxX, room.x + room.width);
    maxY = Math.max(maxY, room.y + room.height);
  }

  return {
    width: Math.max(400, maxX - minX + 100), // Add padding
    height: Math.max(300, maxY - minY + 100),
  };
}
