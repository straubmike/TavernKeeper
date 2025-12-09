-- Adventurer Tracking System - Database Migration
-- Creates tables for tracking hero/adventurer stats and attributes

-- Adventurers table - stores hero stats and metadata
CREATE TABLE IF NOT EXISTS adventurers (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  
  -- On-chain identifier (composite unique key)
  token_id TEXT NOT NULL,
  contract_address TEXT NOT NULL,
  chain_id INTEGER NOT NULL,
  
  -- Wallet owner (ultimate owner - resolves through NFT ownership)
  wallet_address TEXT NOT NULL,
  
  -- Character info
  name TEXT,
  class TEXT NOT NULL CHECK (class IN ('warrior', 'mage', 'rogue', 'cleric')),
  level INTEGER DEFAULT 1,
  experience BIGINT DEFAULT 0,
  
  -- Core stats
  health INTEGER NOT NULL DEFAULT 0,
  max_health INTEGER NOT NULL DEFAULT 0,
  mana INTEGER NOT NULL DEFAULT 0,
  max_mana INTEGER NOT NULL DEFAULT 0,
  
  -- Primary attributes
  strength INTEGER NOT NULL DEFAULT 10,
  dexterity INTEGER NOT NULL DEFAULT 10,
  wisdom INTEGER NOT NULL DEFAULT 10,
  intelligence INTEGER NOT NULL DEFAULT 10,
  constitution INTEGER NOT NULL DEFAULT 10,
  charisma INTEGER NOT NULL DEFAULT 10,
  
  -- Secondary attributes
  perception INTEGER NOT NULL DEFAULT 10,
  armor_class INTEGER NOT NULL DEFAULT 10,
  
  -- Combat bonuses
  attack_bonus INTEGER NOT NULL DEFAULT 0,
  spell_attack_bonus INTEGER NOT NULL DEFAULT 0,
  
  -- Timestamps
  created_at TIMESTAMPTZ DEFAULT NOW() NOT NULL,
  updated_at TIMESTAMPTZ DEFAULT NOW() NOT NULL,
  last_combat_at TIMESTAMPTZ,
  last_rest_at TIMESTAMPTZ,
  
  -- Unique constraint on NFT identifier
  UNIQUE(token_id, contract_address, chain_id)
);

-- Indexes for efficient querying
CREATE INDEX IF NOT EXISTS idx_adventurers_wallet ON adventurers(wallet_address);
CREATE INDEX IF NOT EXISTS idx_adventurers_token ON adventurers(token_id, contract_address, chain_id);
CREATE INDEX IF NOT EXISTS idx_adventurers_class ON adventurers(class);
CREATE INDEX IF NOT EXISTS idx_adventurers_level ON adventurers(level);

-- Stat history table - tracks stat changes over time (optional, for analytics)
CREATE TABLE IF NOT EXISTS adventurer_stat_history (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  adventurer_id UUID NOT NULL REFERENCES adventurers(id) ON DELETE CASCADE,
  
  -- Stat snapshot
  health INTEGER,
  max_health INTEGER,
  mana INTEGER,
  max_mana INTEGER,
  strength INTEGER,
  dexterity INTEGER,
  wisdom INTEGER,
  intelligence INTEGER,
  constitution INTEGER,
  charisma INTEGER,
  perception INTEGER,
  armor_class INTEGER,
  attack_bonus INTEGER,
  spell_attack_bonus INTEGER,
  
  -- Change metadata
  reason TEXT,              -- Reason for change (e.g., "combat_damage", "rest", "level_up")
  change_amount INTEGER,    -- Amount changed (if applicable)
  stat_name TEXT,           -- Which stat changed
  
  -- Timestamp
  changed_at TIMESTAMPTZ DEFAULT NOW() NOT NULL
);

CREATE INDEX IF NOT EXISTS idx_stat_history_adventurer ON adventurer_stat_history(adventurer_id);
CREATE INDEX IF NOT EXISTS idx_stat_history_changed_at ON adventurer_stat_history(changed_at);

-- Enable Row Level Security
ALTER TABLE adventurers ENABLE ROW LEVEL SECURITY;
ALTER TABLE adventurer_stat_history ENABLE ROW LEVEL SECURITY;

-- RLS Policies
-- Users can view their own adventurers
CREATE POLICY "Users can view their own adventurers"
  ON adventurers FOR SELECT
  USING (wallet_address = current_setting('app.wallet_address', true));

-- Users can insert their own adventurers
CREATE POLICY "Users can insert their own adventurers"
  ON adventurers FOR INSERT
  WITH CHECK (wallet_address = current_setting('app.wallet_address', true));

-- Users can update their own adventurers
CREATE POLICY "Users can update their own adventurers"
  ON adventurers FOR UPDATE
  USING (wallet_address = current_setting('app.wallet_address', true));

-- Users can view their own stat history
CREATE POLICY "Users can view their own stat history"
  ON adventurer_stat_history FOR SELECT
  USING (
    EXISTS (
      SELECT 1 FROM adventurers
      WHERE adventurers.id = adventurer_stat_history.adventurer_id
      AND adventurers.wallet_address = current_setting('app.wallet_address', true)
    )
  );

-- Users can insert their own stat history
CREATE POLICY "Users can insert their own stat history"
  ON adventurer_stat_history FOR INSERT
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM adventurers
      WHERE adventurers.id = adventurer_stat_history.adventurer_id
      AND adventurers.wallet_address = current_setting('app.wallet_address', true)
    )
  );

-- Function to update updated_at timestamp
CREATE OR REPLACE FUNCTION update_adventurer_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Trigger to auto-update updated_at
CREATE TRIGGER update_adventurer_timestamp
  BEFORE UPDATE ON adventurers
  FOR EACH ROW
  EXECUTE FUNCTION update_adventurer_updated_at();
