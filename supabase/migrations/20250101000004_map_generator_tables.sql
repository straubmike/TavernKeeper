-- Map Generator Tables Migration
-- Creates tables for map cells and extends dungeons table for multi-level support

-- Map cells table - stores surface world cells
CREATE TABLE IF NOT EXISTS map_cells (
  id TEXT PRIMARY KEY,
  x INTEGER NOT NULL,
  y INTEGER NOT NULL,
  seed TEXT NOT NULL,
  features JSONB DEFAULT '[]'::jsonb,
  dungeon_entrances JSONB DEFAULT '[]'::jsonb,
  discovered_at TIMESTAMPTZ DEFAULT NOW(),
  discovered_by TEXT[] DEFAULT '{}',
  world_content_id TEXT,
  metadata JSONB DEFAULT '{}'::jsonb,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE(x, y)
);

-- Extend dungeons table for multi-level support
ALTER TABLE dungeons ADD COLUMN IF NOT EXISTS name TEXT;
ALTER TABLE dungeons ADD COLUMN IF NOT EXISTS entrance_x INTEGER;
ALTER TABLE dungeons ADD COLUMN IF NOT EXISTS entrance_y INTEGER;
ALTER TABLE dungeons ADD COLUMN IF NOT EXISTS type TEXT CHECK (type IN ('dungeon', 'tower'));
ALTER TABLE dungeons ADD COLUMN IF NOT EXISTS max_depth INTEGER;
ALTER TABLE dungeons ADD COLUMN IF NOT EXISTS levels JSONB;

-- Create indexes for better performance
CREATE INDEX IF NOT EXISTS idx_map_cells_x_y ON map_cells(x, y);
CREATE INDEX IF NOT EXISTS idx_map_cells_discovered_by ON map_cells USING GIN(discovered_by);
CREATE INDEX IF NOT EXISTS idx_map_cells_world_content_id ON map_cells(world_content_id);
CREATE INDEX IF NOT EXISTS idx_dungeons_entrance_coords ON dungeons(entrance_x, entrance_y);
CREATE INDEX IF NOT EXISTS idx_dungeons_type ON dungeons(type);

-- Enable Row Level Security
ALTER TABLE map_cells ENABLE ROW LEVEL SECURITY;

-- Basic policies (allow all for now - adjust for production)
CREATE POLICY "Allow all on map_cells" ON map_cells FOR ALL USING (true);
