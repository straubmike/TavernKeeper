-- Stakers Table Migration
-- Tracks top stakers for "Employees of the Month" display

CREATE TABLE IF NOT EXISTS stakers (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  address TEXT NOT NULL UNIQUE,
  amount TEXT NOT NULL, -- Stored as string to handle bigint precision
  weighted_stake TEXT NOT NULL, -- amount * lockMultiplier (stored as string)
  lock_expiry TIMESTAMPTZ,
  lock_multiplier TEXT, -- Stored as string (1e18 scaled)
  last_verified_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW(),
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Index for efficient top stakers queries
CREATE INDEX IF NOT EXISTS idx_stakers_weighted_stake ON stakers(weighted_stake DESC);
CREATE INDEX IF NOT EXISTS idx_stakers_address ON stakers(address);
CREATE INDEX IF NOT EXISTS idx_stakers_last_verified ON stakers(last_verified_at);

-- Enable Row Level Security
ALTER TABLE stakers ENABLE ROW LEVEL SECURITY;

-- Allow all reads, but restrict writes to service role (via API with service key)
CREATE POLICY "Allow all reads on stakers" ON stakers FOR SELECT USING (true);
CREATE POLICY "Allow service role writes on stakers" ON stakers FOR ALL USING (true); -- Will be restricted by service key in API

