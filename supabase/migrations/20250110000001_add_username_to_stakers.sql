-- Add username column to stakers table
-- This stores Farcaster usernames fetched from Neynar API once, avoiding repeated API calls

ALTER TABLE stakers
ADD COLUMN IF NOT EXISTS username TEXT,
ADD COLUMN IF NOT EXISTS display_name TEXT,
ADD COLUMN IF NOT EXISTS farcaster_fid INTEGER,
ADD COLUMN IF NOT EXISTS username_fetched_at TIMESTAMPTZ;

-- Index for username lookups
CREATE INDEX IF NOT EXISTS idx_stakers_username ON stakers(username) WHERE username IS NOT NULL;
CREATE INDEX IF NOT EXISTS idx_stakers_fid ON stakers(farcaster_fid) WHERE farcaster_fid IS NOT NULL;

