-- Timer System Migration
-- Adds scheduled_delivery_time column to world_events table for time-based event delivery

-- Add scheduled_delivery_time column to world_events table
-- This allows events to be scheduled for delivery at specific times (6-second intervals)
ALTER TABLE world_events 
ADD COLUMN IF NOT EXISTS scheduled_delivery_time TIMESTAMPTZ;

-- Add delivered column to track if event has been delivered to frontend
ALTER TABLE world_events
ADD COLUMN IF NOT EXISTS delivered BOOLEAN DEFAULT FALSE NOT NULL;

-- Create index for efficient querying of events ready to deliver
CREATE INDEX IF NOT EXISTS idx_world_events_scheduled_delivery ON world_events(scheduled_delivery_time, delivered) 
WHERE scheduled_delivery_time IS NOT NULL AND delivered = FALSE;

-- Create index for querying events by run_id and scheduled time
CREATE INDEX IF NOT EXISTS idx_world_events_run_scheduled ON world_events(run_id, scheduled_delivery_time) 
WHERE scheduled_delivery_time IS NOT NULL;

