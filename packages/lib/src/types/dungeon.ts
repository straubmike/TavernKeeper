export interface SpawnPoint {
  x: number;
  y: number;
}

export interface MapItem {
  id: string;
  name: string;
  type: 'weapon' | 'armor' | 'consumable' | 'misc';
}

export interface MapEnemy {
  id: string;
  name: string;
  stats: {
    str: number;
    dex: number;
    con: number;
    int: number;
    wis: number;
    cha: number;
    ac: number;
    hp: number;
    maxHp: number;
    attackBonus: number;
  };
}

export interface Room {
  id: string;
  x: number;
  y: number;
  width: number;
  height: number;
  type: 'room' | 'corridor' | 'chamber' | 'boss';
  connections: string[]; // Room IDs this room connects to
  spawnPoints: SpawnPoint[]; // Spawn points in this room
  items: MapItem[]; // Items in this room
  enemies: MapEnemy[]; // Enemies in this room
  entities?: string[]; // Entity IDs currently in this room
  levelZ?: number; // Z-coordinate for multi-level dungeons
}

export interface DungeonObjective {
  type: 'defeat_boss' | 'retrieve_item' | 'clear_room' | 'survive';
  target: string; // Entity ID or item ID
}

export interface LevelConnection {
  fromZ: number;
  toZ: number;
  type: 'staircase' | 'ladder' | 'portal' | 'elevator';
  description?: string;
}

export interface DungeonLevel {
  z: number;
  rooms: Room[];
  connections: LevelConnection[];
  metadata?: Record<string, unknown>;
}

export interface DungeonMap {
  id: string;
  name: string;
  seed: string;
  rooms: Room[];
  width: number;
  height: number;
  objectives: DungeonObjective[];
  levels?: DungeonLevel[]; // Multi-level structure (optional for backward compatibility)
}

export interface DungeonState {
  map: DungeonMap;
  entities: Record<string, { roomId: string; position: { x: number; y: number; z?: number } }>;
  currentRoom?: string;
  currentLevelZ?: number; // Current z-level for multi-level dungeons
  discoveredRooms: Set<string>;
}

