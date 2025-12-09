-- Inventory Tracking System - Database Migration
-- Creates tables for tracking player inventory (equipped and non-equipped items)

-- Inventory items table - stores all items owned by wallets
CREATE TABLE IF NOT EXISTS inventory_items (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  
  -- Item identification
  item_id TEXT NOT NULL UNIQUE,  -- Unique item instance ID
  base_item_id TEXT,             -- Reference to generated item ID (if from procedural generation)
  
  -- Ownership
  wallet_address TEXT NOT NULL,
  
  -- Item data (stored as JSONB for flexibility)
  item_data JSONB NOT NULL,       -- Full item data (name, type, rarity, stats, etc.)
  
  -- Equipment status
  equipped BOOLEAN DEFAULT FALSE NOT NULL,
  equipped_by_token_id TEXT,     -- Hero token ID that has this equipped
  equipped_by_contract TEXT,     -- Hero contract address
  equipped_by_chain_id INTEGER,  -- Hero chain ID
  equipped_slot TEXT,            -- Equipment slot (main_hand, armor - CURRENTLY USED; off_hand, head, body, hands, feet - FUTURE EXPANSION)
  
  -- Stacking
  quantity INTEGER DEFAULT 1 NOT NULL,
  
  -- Metadata
  acquired_at TIMESTAMPTZ DEFAULT NOW() NOT NULL,
  acquired_from TEXT,            -- Source (dungeon_loot, vendor, quest, etc.)
  
  -- Timestamps
  created_at TIMESTAMPTZ DEFAULT NOW() NOT NULL,
  updated_at TIMESTAMPTZ DEFAULT NOW() NOT NULL,
  
  -- Constraints
  CHECK (quantity > 0),
  CHECK (
    (equipped = FALSE) OR 
    (equipped = TRUE AND equipped_by_token_id IS NOT NULL AND equipped_slot IS NOT NULL)
  )
);

-- Indexes for efficient querying
CREATE INDEX IF NOT EXISTS idx_inventory_wallet ON inventory_items(wallet_address);
CREATE INDEX IF NOT EXISTS idx_inventory_equipped ON inventory_items(equipped);
CREATE INDEX IF NOT EXISTS idx_inventory_equipped_by ON inventory_items(equipped_by_token_id, equipped_by_contract, equipped_by_chain_id);
CREATE INDEX IF NOT EXISTS idx_inventory_slot ON inventory_items(equipped_slot) WHERE equipped = TRUE;
CREATE INDEX IF NOT EXISTS idx_inventory_category ON inventory_items USING GIN ((item_data->>'category'));
CREATE INDEX IF NOT EXISTS idx_inventory_rarity ON inventory_items USING GIN ((item_data->>'rarity'));

-- Item transfer history table (optional, for tracking item movement)
CREATE TABLE IF NOT EXISTS item_transfers (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  item_id UUID NOT NULL REFERENCES inventory_items(id) ON DELETE CASCADE,
  
  from_wallet TEXT,
  to_wallet TEXT NOT NULL,
  
  quantity INTEGER DEFAULT 1 NOT NULL,
  
  transfer_type TEXT NOT NULL,  -- 'trade', 'gift', 'loot', 'vendor', etc.
  transfer_reason TEXT,
  
  transferred_at TIMESTAMPTZ DEFAULT NOW() NOT NULL
);

CREATE INDEX IF NOT EXISTS idx_transfers_item ON item_transfers(item_id);
CREATE INDEX IF NOT EXISTS idx_transfers_wallet ON item_transfers(to_wallet);
CREATE INDEX IF NOT EXISTS idx_transfers_type ON item_transfers(transfer_type);

-- Item equip history table (optional, for tracking equipment changes)
CREATE TABLE IF NOT EXISTS item_equip_history (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  item_id UUID NOT NULL REFERENCES inventory_items(id) ON DELETE CASCADE,
  
  hero_token_id TEXT NOT NULL,
  hero_contract TEXT NOT NULL,
  hero_chain_id INTEGER NOT NULL,
  
  slot TEXT NOT NULL,
  action TEXT NOT NULL CHECK (action IN ('equip', 'unequip')),
  
  equipped_at TIMESTAMPTZ DEFAULT NOW() NOT NULL
);

CREATE INDEX IF NOT EXISTS idx_equip_history_item ON item_equip_history(item_id);
CREATE INDEX IF NOT EXISTS idx_equip_history_hero ON item_equip_history(hero_token_id, hero_contract, hero_chain_id);

-- Enable Row Level Security
ALTER TABLE inventory_items ENABLE ROW LEVEL SECURITY;
ALTER TABLE item_transfers ENABLE ROW LEVEL SECURITY;
ALTER TABLE item_equip_history ENABLE ROW LEVEL SECURITY;

-- RLS Policies
-- Users can view their own inventory
CREATE POLICY "Users can view their own inventory"
  ON inventory_items FOR SELECT
  USING (wallet_address = current_setting('app.wallet_address', true));

-- Users can insert their own inventory items
CREATE POLICY "Users can insert their own inventory items"
  ON inventory_items FOR INSERT
  WITH CHECK (wallet_address = current_setting('app.wallet_address', true));

-- Users can update their own inventory items
CREATE POLICY "Users can update their own inventory items"
  ON inventory_items FOR UPDATE
  USING (wallet_address = current_setting('app.wallet_address', true));

-- Users can delete their own inventory items
CREATE POLICY "Users can delete their own inventory items"
  ON inventory_items FOR DELETE
  USING (wallet_address = current_setting('app.wallet_address', true));

-- Users can view their own transfer history
CREATE POLICY "Users can view their own transfer history"
  ON item_transfers FOR SELECT
  USING (
    EXISTS (
      SELECT 1 FROM inventory_items
      WHERE inventory_items.id = item_transfers.item_id
      AND inventory_items.wallet_address = current_setting('app.wallet_address', true)
    )
  );

-- Users can view their own equip history
CREATE POLICY "Users can view their own equip history"
  ON item_equip_history FOR SELECT
  USING (
    EXISTS (
      SELECT 1 FROM inventory_items
      WHERE inventory_items.id = item_equip_history.item_id
      AND inventory_items.wallet_address = current_setting('app.wallet_address', true)
    )
  );

-- Function to update updated_at timestamp
CREATE OR REPLACE FUNCTION update_inventory_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Trigger to auto-update updated_at
CREATE TRIGGER update_inventory_timestamp
  BEFORE UPDATE ON inventory_items
  FOR EACH ROW
  EXECUTE FUNCTION update_inventory_updated_at();
