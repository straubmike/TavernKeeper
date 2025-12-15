-- Game Logging System Migration
-- Creates table for permanent key events storage

-- Key events table - stores important events permanently
CREATE TABLE IF NOT EXISTS key_events (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  event_id TEXT NOT NULL, -- Reference to original event ID
  type TEXT NOT NULL, -- Event type (combat, exploration, etc.)
  importance TEXT NOT NULL CHECK (importance IN ('critical', 'important', 'normal', 'verbose')),
  actor_id TEXT,
  target_id TEXT,
  summary TEXT NOT NULL, -- Human-readable summary
  payload JSONB NOT NULL, -- Full event payload
  timestamp TIMESTAMPTZ NOT NULL,
  run_id UUID REFERENCES runs(id) ON DELETE CASCADE,
  agent_id UUID REFERENCES agents(id) ON DELETE SET NULL,
  metadata JSONB,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Indexes for efficient querying
CREATE INDEX IF NOT EXISTS idx_key_events_type ON key_events(type);
CREATE INDEX IF NOT EXISTS idx_key_events_importance ON key_events(importance);
CREATE INDEX IF NOT EXISTS idx_key_events_timestamp ON key_events(timestamp);
CREATE INDEX IF NOT EXISTS idx_key_events_actor_id ON key_events(actor_id);
CREATE INDEX IF NOT EXISTS idx_key_events_run_id ON key_events(run_id);
CREATE INDEX IF NOT EXISTS idx_key_events_agent_id ON key_events(agent_id);
CREATE INDEX IF NOT EXISTS idx_key_events_created_at ON key_events(created_at);

-- Composite index for common query patterns
CREATE INDEX IF NOT EXISTS idx_key_events_importance_timestamp ON key_events(importance, timestamp DESC);
CREATE INDEX IF NOT EXISTS idx_key_events_agent_timestamp ON key_events(agent_id, timestamp DESC);

-- Optional: Temporary table for detailed logs (if persistence is enabled)
-- This table can have a TTL or be periodically cleaned
CREATE TABLE IF NOT EXISTS detailed_logs_temp (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  event JSONB NOT NULL,
  importance TEXT NOT NULL,
  context JSONB,
  metadata JSONB,
  timestamp TIMESTAMPTZ NOT NULL,
  expires_at TIMESTAMPTZ NOT NULL, -- For automatic cleanup
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Index for cleanup queries
CREATE INDEX IF NOT EXISTS idx_detailed_logs_expires_at ON detailed_logs_temp(expires_at);
CREATE INDEX IF NOT EXISTS idx_detailed_logs_timestamp ON detailed_logs_temp(timestamp);

-- Enable Row Level Security
ALTER TABLE key_events ENABLE ROW LEVEL SECURITY;
ALTER TABLE detailed_logs_temp ENABLE ROW LEVEL SECURITY;

-- Basic policies (adjust for production)
CREATE POLICY "Allow all on key_events" ON key_events FOR ALL USING (true);
CREATE POLICY "Allow all on detailed_logs_temp" ON detailed_logs_temp FOR ALL USING (true);

-- Function to automatically clean expired detailed logs
CREATE OR REPLACE FUNCTION cleanup_expired_detailed_logs()
RETURNS void AS $$
BEGIN
  DELETE FROM detailed_logs_temp
  WHERE expires_at < NOW();
END;
$$ LANGUAGE plpgsql;

-- Optional: Create a scheduled job to run cleanup (requires pg_cron extension)
-- SELECT cron.schedule('cleanup-detailed-logs', '0 * * * *', 'SELECT cleanup_expired_detailed_logs();');

