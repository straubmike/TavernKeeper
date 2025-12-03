/**
 * Map Storage
 *
 * Handles persistence of map data (cells, dungeons, features).
 * Supports Supabase database or in-memory fallback.
 */

import type {
    Dungeon,
    MapCell,
    MapQuery,
    MapQueryResult
} from '../types/map-generation';

// Supabase-like client interface
interface SupabaseClient {
  from<T = any>(table: string): {
    select(columns?: string): {
      eq(column: string, value: unknown): { single(): Promise<{ data: T | null; error: unknown }> };
      eq(column: string, value: unknown): Promise<{ data: T[] | null; error: unknown }>;
    };
    upsert(data: unknown, config?: { onConflict?: string }): Promise<{ data: T | null; error: unknown }>;
    insert(data: unknown): Promise<{ data: T | null; error: unknown }>;
  };
}

export class MapStorage {
  // In-memory storage as fallback
  private cells: Map<string, MapCell> = new Map();
  private dungeons: Map<string, Dungeon> = new Map();
  private supabase?: SupabaseClient;

  constructor(supabase?: SupabaseClient) {
    this.supabase = supabase;
  }

  /**
   * Save a cell to storage
   */
  async saveCell(cell: MapCell): Promise<void> {
    if (this.supabase) {
      try {
        const { error } = await this.supabase.from('map_cells').upsert({
          id: cell.id,
          x: cell.x,
          y: cell.y,
          seed: cell.seed,
          features: cell.features,
          dungeon_entrances: cell.dungeonEntrances,
          discovered_at: cell.discoveredAt.toISOString(),
          discovered_by: cell.discoveredBy,
          world_content_id: cell.worldContentId,
          metadata: cell.metadata,
        }, { onConflict: 'x,y' });
        if (error) {
          console.error('Error saving cell to database:', error);
          // Fallback to in-memory
        } else {
          return; // Successfully saved to database
        }
      } catch (error) {
        console.error('Error saving cell:', error);
        // Fallback to in-memory
      }
    }

    // Fallback to in-memory storage
    const key = this.getCellKey(cell.x, cell.y);
    this.cells.set(key, cell);
  }

  /**
   * Get a cell from storage
   */
  async getCell(x: number, y: number): Promise<MapCell | null> {
    if (this.supabase) {
      try {
        const { data, error } = await this.supabase.from('map_cells')
          .select('*')
          .eq('x', x)
          .eq('y', y)
          .single();

        if (!error && data) {
          // Convert database format to MapCell
          return {
            id: data.id,
            x: data.x,
            y: data.y,
            seed: data.seed,
            features: data.features || [],
            dungeonEntrances: data.dungeon_entrances || [],
            discoveredAt: new Date(data.discovered_at),
            discoveredBy: data.discovered_by,
            worldContentId: data.world_content_id,
            metadata: data.metadata || {},
          };
        }
      } catch (error) {
        console.error('Error getting cell from database:', error);
        // Fallback to in-memory
      }
    }

    // Fallback to in-memory storage
    const key = this.getCellKey(x, y);
    return this.cells.get(key) || null;
  }

  /**
   * Save a dungeon to storage
   */
  async saveDungeon(dungeon: Dungeon): Promise<void> {
    if (this.supabase) {
      try {
        const { error } = await this.supabase.from('dungeons').upsert({
          id: dungeon.id,
          seed: dungeon.seed,
          name: dungeon.name,
          entrance_x: dungeon.entranceX,
          entrance_y: dungeon.entranceY,
          type: dungeon.type,
          max_depth: dungeon.maxDepth,
          levels: dungeon.levels,
          world_content_id: dungeon.worldContentId,
          metadata: dungeon.metadata,
        }, { onConflict: 'id' });
        if (error) {
          console.error('Error saving dungeon to database:', error);
          // Fallback to in-memory
        } else {
          return; // Successfully saved to database
        }
      } catch (error) {
        console.error('Error saving dungeon:', error);
        // Fallback to in-memory
      }
    }

    // Fallback to in-memory storage
    this.dungeons.set(dungeon.id, dungeon);
  }

  /**
   * Get a dungeon from storage
   */
  async getDungeon(dungeonId: string): Promise<Dungeon | null> {
    if (this.supabase) {
      try {
        const { data, error } = await this.supabase.from('dungeons')
          .select('*')
          .eq('id', dungeonId)
          .single();

        if (!error && data) {
          // Convert database format to Dungeon
          return {
            id: data.id,
            name: data.name,
            entranceX: data.entrance_x,
            entranceY: data.entrance_y,
            seed: data.seed,
            type: data.type,
            maxDepth: data.max_depth,
            levels: data.levels || [],
            worldContentId: data.world_content_id,
            metadata: data.metadata || {},
          };
        }
      } catch (error) {
        console.error('Error getting dungeon from database:', error);
        // Fallback to in-memory
      }
    }

    // Fallback to in-memory storage
    return this.dungeons.get(dungeonId) || null;
  }

  /**
   * Query cells based on criteria
   */
  async queryCells(query: MapQuery): Promise<MapQueryResult> {
    let results: MapCell[] = [];

    // Get all cells (in practice, would query database)
    for (const cell of this.cells.values()) {
      results.push(cell);
    }

    // Filter by region
    if (query.region) {
      results = results.filter(
        cell =>
          cell.x >= query.region!.xMin &&
          cell.x <= query.region!.xMax &&
          cell.y >= query.region!.yMin &&
          cell.y <= query.region!.yMax
      );
    }

    // Filter by feature types
    if (query.featureTypes && query.featureTypes.length > 0) {
      results = results.filter(cell =>
        cell.features.some(f => query.featureTypes!.includes(f.type))
      );
    }

    // Filter by dungeon presence
    if (query.hasDungeon !== undefined) {
      results = results.filter(
        cell =>
          (query.hasDungeon && cell.dungeonEntrances.length > 0) ||
          (!query.hasDungeon && cell.dungeonEntrances.length === 0)
      );
    }

    // Filter by discoverer
    if (query.discoveredBy && query.discoveredBy.length > 0) {
      results = results.filter(cell =>
        cell.discoveredBy?.some(id => query.discoveredBy!.includes(id))
      );
    }

    // Filter by world content ID
    if (query.worldContentId) {
      results = results.filter(
        cell =>
          cell.worldContentId === query.worldContentId ||
          cell.features.some(f => f.worldContentId === query.worldContentId) ||
          cell.dungeonEntrances.some(e => e.worldContentId === query.worldContentId)
      );
    }

    // Sort by coordinates (x, then y)
    results.sort((a, b) => {
      if (a.x !== b.x) return a.x - b.x;
      return a.y - b.y;
    });

    // Apply pagination
    const total = results.length;
    const offset = query.offset || 0;
    const limit = query.limit || 100;
    const paginated = results.slice(offset, offset + limit);
    const hasMore = offset + limit < total;

    return {
      cells: paginated,
      total,
      hasMore,
    };
  }

  /**
   * Get cells in a region
   */
  async getCellsInRegion(
    xMin: number,
    xMax: number,
    yMin: number,
    yMax: number
  ): Promise<MapCell[]> {
    const query: MapQuery = {
      region: { xMin, xMax, yMin, yMax },
    };

    const result = await this.queryCells(query);
    return result.cells;
  }

  /**
   * Check if a cell exists
   */
  async cellExists(x: number, y: number): Promise<boolean> {
    const cell = await this.getCell(x, y);
    return cell !== null;
  }

  /**
   * Get cell key for storage
   */
  private getCellKey(x: number, y: number): string {
    return `${x},${y}`;
  }

  /**
   * Clear all stored data (for testing)
   */
  async clear(): Promise<void> {
    this.cells.clear();
    this.dungeons.clear();
  }
}

