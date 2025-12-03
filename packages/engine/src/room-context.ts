/**
 * Room Context Helpers
 *
 * Helper functions for getting room-related context for agents
 */

import type {
    ActionType,
    DungeonLevel,
    DungeonMap,
    Entity,
    Room,
} from '@innkeeper/lib';
import { getCurrentLevel, getEntitiesInRoom as spatialGetEntitiesInRoom } from './spatial';

/**
 * Get room details by ID (considering z-level)
 */
export function getRoomDetails(
  roomId: string,
  map: DungeonMap,
  levelZ?: number
): Room | null {
  // If multi-level map, search in specific level
  if (map.levels && levelZ !== undefined) {
    const level = getCurrentLevel(map, levelZ);
    if (level) {
      const room = level.rooms.find((r) => r.id === roomId);
      if (room) {
        return room;
      }
    }
  }

  // Fallback to flat room list
  return map.rooms.find((r) => r.id === roomId) || null;
}

/**
 * Get all entities in a specific room (considering z-level)
 */
export function getEntitiesInRoom(
  roomId: string,
  entities: Map<string, Entity>,
  levelZ?: number
): Entity[] {
  return spatialGetEntitiesInRoom(roomId, entities, levelZ);
}

/**
 * Get rooms connected to a specific room (considering z-level)
 */
export function getConnectedRooms(
  roomId: string,
  map: DungeonMap,
  levelZ?: number
): Room[] {
  const room = getRoomDetails(roomId, map, levelZ);
  if (!room) {
    return [];
  }

  const connectedRooms: Room[] = [];
  for (const connectedRoomId of room.connections) {
    const connectedRoom = getRoomDetails(connectedRoomId, map, levelZ);
    if (connectedRoom) {
      connectedRooms.push(connectedRoom);
    }
  }

  return connectedRooms;
}

/**
 * Get all rooms in the current level
 */
export function getCurrentLevelRooms(map: DungeonMap, levelZ: number): Room[] {
  if (map.levels) {
    const level = getCurrentLevel(map, levelZ);
    if (level) {
      return level.rooms;
    }
  }

  // Fallback: filter rooms by levelZ if set
  return map.rooms.filter((room) => room.levelZ === levelZ);
}

/**
 * Get available actions for an entity based on current context
 */
export function getAvailableActions(
  entity: Entity,
  map: DungeonMap,
  entities: Map<string, Entity>,
  levelZ?: number
): ActionType[] {
  const availableActions: ActionType[] = ['move', 'attack', 'skill_check', 'use_item', 'interact'];

  // Check if entity can move (has valid position and room)
  if (!entity.position || !entity.roomId) {
    availableActions.splice(availableActions.indexOf('move'), 1);
  }

  // Check if entity can attack (has enemies in same room)
  if (!entity.roomId) {
    availableActions.splice(availableActions.indexOf('attack'), 1);
    return availableActions;
  }

  const room = getRoomDetails(entity.roomId, map, levelZ ?? entity.position?.z);
  if (room) {
    const entitiesInRoom = getEntitiesInRoom(room.id, entities, levelZ ?? entity.position?.z);
    const hasEnemies = entitiesInRoom.some(
      (e) => !e.isPlayer && e.id !== entity.id
    );
    if (!hasEnemies) {
      availableActions.splice(availableActions.indexOf('attack'), 1);
    }
  } else {
    availableActions.splice(availableActions.indexOf('attack'), 1);
  }

  // Check if entity has items to use
  if (!entity.inventory || entity.inventory.length === 0) {
    availableActions.splice(availableActions.indexOf('use_item'), 1);
  }

  return availableActions;
}

/**
 * Get level connections (stairs/portals) for a specific z-level
 */
export function getLevelConnections(map: DungeonMap, levelZ: number): DungeonLevel['connections'] {
  if (map.levels) {
    const level = getCurrentLevel(map, levelZ);
    if (level) {
      return level.connections;
    }
  }
  return [];
}

/**
 * Check if a room exists in the map
 */
export function roomExists(roomId: string, map: DungeonMap, levelZ?: number): boolean {
  return getRoomDetails(roomId, map, levelZ) !== null;
}
