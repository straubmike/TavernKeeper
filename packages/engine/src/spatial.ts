import type { DungeonLevel, DungeonMap, Entity, ExplorationEvent, LevelConnection, Position, Room } from '@innkeeper/lib';

/**
 * Check if a position is within a room's boundaries
 */
export function isPositionInRoom(position: Position, room: Room): boolean {
  return (
    position.x >= room.x &&
    position.x < room.x + room.width &&
    position.y >= room.y &&
    position.y < room.y + room.height
  );
}

/**
 * Get current level by z-coordinate
 */
export function getCurrentLevel(map: DungeonMap, levelZ?: number): DungeonLevel | null {
  if (!map.levels || levelZ === undefined) {
    return null;
  }
  return map.levels.find((level) => level.z === levelZ) || null;
}

/**
 * Get level connections for a specific z-level
 */
export function getLevelConnections(map: DungeonMap, levelZ: number): LevelConnection[] {
  const level = getCurrentLevel(map, levelZ);
  return level?.connections || [];
}

/**
 * Find which room a position is in (considering z-level)
 */
export function findRoomForPosition(position: Position, map: DungeonMap, levelZ?: number): Room | null {
  // If multi-level map, filter rooms by level
  if (map.levels && levelZ !== undefined) {
    const level = getCurrentLevel(map, levelZ);
    if (level) {
      for (const room of level.rooms) {
        if (isPositionInRoom(position, room)) {
          return room;
        }
      }
      return null;
    }
  }

  // Fallback to flat room list (backward compatibility)
  for (const room of map.rooms) {
    // Check if room matches levelZ if specified
    if (levelZ !== undefined && room.levelZ !== undefined && room.levelZ !== levelZ) {
      continue;
    }
    if (isPositionInRoom(position, room)) {
      return room;
    }
  }
  return null;
}

/**
 * Get room details by ID
 */
export function getRoomDetails(roomId: string, map: DungeonMap, levelZ?: number): Room | null {
  if (map.levels && levelZ !== undefined) {
    const level = getCurrentLevel(map, levelZ);
    return level?.rooms.find((r) => r.id === roomId) || null;
  }
  return map.rooms.find((r) => r.id === roomId) || null;
}

/**
 * Get connected rooms for a given room
 */
export function getConnectedRooms(roomId: string, map: DungeonMap, levelZ?: number): string[] {
  const room = getRoomDetails(roomId, map, levelZ);
  return room?.connections || [];
}

/**
 * Get available actions for an entity
 */
export function getAvailableActions(
  entity: Entity,
  map: DungeonMap,
  entities: Map<string, Entity>,
  levelZ?: number
): string[] {
  // Basic actions available to all entities
  const actions = ['wait'];

  // If in a room, can move to connected rooms
  if (entity.roomId) {
    const connected = getConnectedRooms(entity.roomId, map, levelZ);
    if (connected.length > 0) {
      actions.push('move');
    }
  }

  // If near enemies, can attack
  // This is a simplified check
  return actions;
}

/**
 * Check if two positions are in the same room (considering z-level)
 */
export function arePositionsInSameRoom(
  pos1: Position,
  pos2: Position,
  map: DungeonMap
): boolean {
  // Must be on same z-level
  if (pos1.z !== pos2.z) {
    return false;
  }
  const room1 = findRoomForPosition(pos1, map, pos1.z);
  const room2 = findRoomForPosition(pos2, map, pos2.z);
  return room1 !== null && room2 !== null && room1.id === room2.id;
}

/**
 * Check if a level transition should occur based on movement
 */
export function checkLevelTransition(
  entity: Entity,
  newPosition: Position,
  map: DungeonMap,
  currentLevelZ?: number
): { transitioned: boolean; fromLevelZ?: number; toLevelZ?: number; connection?: LevelConnection } {
  const newLevelZ = newPosition.z;

  // No z-coordinate change
  if (newLevelZ === undefined || newLevelZ === currentLevelZ) {
    return { transitioned: false };
  }

  // Check if level transition is valid via connections
  if (currentLevelZ !== undefined) {
    const connections = getLevelConnections(map, currentLevelZ);
    const validConnection = connections.find((conn) => conn.toZ === newLevelZ);

    if (!validConnection) {
      return { transitioned: false };
    }

    return {
      transitioned: true,
      fromLevelZ: currentLevelZ,
      toLevelZ: newLevelZ,
      connection: validConnection,
    };
  }

  // First time entering a level
  return {
    transitioned: true,
    toLevelZ: newLevelZ,
  };
}

/**
 * Check if a room transition should occur based on movement (handles level transitions)
 */
export function checkRoomTransition(
  entity: Entity,
  newPosition: Position,
  map: DungeonMap,
  currentRoomId?: string,
  currentLevelZ?: number
): { transitioned: boolean; fromRoom?: string; toRoom?: string; levelTransition?: { fromLevelZ: number; toLevelZ: number } } {
  const newLevelZ = newPosition.z;
  const entityLevelZ = currentLevelZ ?? entity.position?.z;

  // Check for level transition first
  const levelTransition = checkLevelTransition(entity, newPosition, map, entityLevelZ);
  if (levelTransition.transitioned && levelTransition.fromLevelZ !== undefined && levelTransition.toLevelZ !== undefined) {
    // Level transition occurred - find room in new level
    const newRoom = findRoomForPosition(newPosition, map, levelTransition.toLevelZ);
    if (newRoom) {
      return {
        transitioned: true,
        fromRoom: currentRoomId,
        toRoom: newRoom.id,
        levelTransition: {
          fromLevelZ: levelTransition.fromLevelZ,
          toLevelZ: levelTransition.toLevelZ,
        },
      };
    }
  }

  // Same level - check room transition
  const newRoom = findRoomForPosition(newPosition, map, entityLevelZ);

  if (!newRoom) {
    // Position is outside all rooms - invalid movement
    return { transitioned: false };
  }

  if (currentRoomId === newRoom.id) {
    // Still in same room
    return { transitioned: false };
  }

  // Check if rooms are connected
  if (currentRoomId) {
    const currentRoom = map.levels
      ? getCurrentLevel(map, entityLevelZ)?.rooms.find((r) => r.id === currentRoomId)
      : map.rooms.find((r) => r.id === currentRoomId);

    if (currentRoom && !currentRoom.connections.includes(newRoom.id)) {
      // Rooms are not connected - invalid transition
      return { transitioned: false };
    }
  }

  return {
    transitioned: true,
    fromRoom: currentRoomId,
    toRoom: newRoom.id,
  };
}

/**
 * Validate movement within room boundaries (including level transitions)
 */
export function validateMovement(
  entity: Entity,
  targetPosition: Position,
  map: DungeonMap,
  currentLevelZ?: number
): { valid: boolean; reason?: string } {
  const entityLevelZ = currentLevelZ ?? entity.position?.z;
  const targetLevelZ = targetPosition.z;
  const targetRoom = findRoomForPosition(targetPosition, map, targetLevelZ);

  if (!targetRoom) {
    return { valid: false, reason: 'Target position is outside all rooms' };
  }

  // Check level transition if z-level changed
  if (targetLevelZ !== undefined && entityLevelZ !== undefined && targetLevelZ !== entityLevelZ) {
    const levelTransition = checkLevelTransition(entity, targetPosition, map, entityLevelZ);
    if (!levelTransition.transitioned) {
      return { valid: false, reason: 'Level transition not allowed - no connection between levels' };
    }
  }

  // If entity is in a room, check if target is in same room or connected room
  if (entity.roomId) {
    const currentRoom = map.levels
      ? getCurrentLevel(map, entityLevelZ)?.rooms.find((r) => r.id === entity.roomId)
      : map.rooms.find((r) => r.id === entity.roomId);

    if (currentRoom) {
      if (currentRoom.id === targetRoom.id) {
        // Same room - valid
        return { valid: true };
      }
      // Different room - check connection
      if (!currentRoom.connections.includes(targetRoom.id)) {
        return { valid: false, reason: 'Target room is not connected to current room' };
      }
    }
  }

  return { valid: true };
}

/**
 * Generate room transition events (including level transitions)
 */
export function generateRoomTransitionEvents(
  entityId: string,
  fromRoomId: string | undefined,
  toRoomId: string,
  timestamp: number,
  levelTransition?: { fromLevelZ: number; toLevelZ: number }
): ExplorationEvent[] {
  const events: ExplorationEvent[] = [];

  if (fromRoomId) {
    events.push({
      type: 'exploration',
      id: `exit-room-${timestamp}-${entityId}`,
      timestamp,
      actorId: entityId,
      action: 'exit_room',
      roomId: fromRoomId,
      // fromLevelZ: levelTransition?.fromLevelZ,
    });
  }

  // Add level transition event if applicable
  if (levelTransition) {
    events.push({
      type: 'exploration',
      id: `level-transition-${timestamp}-${entityId}`,
      timestamp,
      actorId: entityId,
      action: 'level_transition',
      // fromLevelZ: levelTransition.fromLevelZ,
      // toLevelZ: levelTransition.toLevelZ,
    });
  }

  events.push({
    type: 'exploration',
    id: `enter-room-${timestamp}-${entityId}`,
    timestamp,
    actorId: entityId,
    action: 'enter_room',
    roomId: toRoomId,
    // toLevelZ: levelTransition?.toLevelZ,
  });

  return events;
}

/**
 * Check if two entities are in the same room (for interactions/attacks, considering z-level)
 */
export function areEntitiesInSameRoom(
  entity1: Entity,
  entity2: Entity,
  map: DungeonMap
): boolean {
  if (!entity1.roomId || !entity2.roomId) {
    return false;
  }

  // Must be in same room AND same z-level
  if (entity1.roomId !== entity2.roomId) {
    return false;
  }

  // Check z-level if specified
  if (entity1.position?.z !== undefined && entity2.position?.z !== undefined) {
    return entity1.position.z === entity2.position.z;
  }

  return true;
}

/**
 * Get all entities in a specific room (optionally filtered by z-level)
 */
export function getEntitiesInRoom(
  roomId: string,
  entities: Map<string, Entity>,
  levelZ?: number
): Entity[] {
  return Array.from(entities.values()).filter((e) => {
    if (e.roomId !== roomId) {
      return false;
    }
    // Filter by z-level if specified
    if (levelZ !== undefined && e.position?.z !== undefined) {
      return e.position.z === levelZ;
    }
    return true;
  });
}

/**
 * Calculate Euclidean distance between two positions
 */
export function calculateDistance(pos1: Position, pos2: Position): number {
  const dx = pos1.x - pos2.x;
  const dy = pos1.y - pos2.y;
  const dz = (pos1.z || 0) - (pos2.z || 0);
  return Math.sqrt(dx * dx + dy * dy + dz * dz);
}

/**
 * Get distance between two entities
 */
export function getDistance(entity1: Entity, entity2: Entity): number {
  if (!entity1.position || !entity2.position) {
    return Infinity;
  }
  return calculateDistance(entity1.position, entity2.position);
}
