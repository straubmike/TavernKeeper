# Database Migrations Required

The following migrations from contributions need to be run to enable full game functionality:

## Required Migrations

1. **Adventurer Tracking** (`apps/web/contributions/adventurer-tracking/code/database/migration.sql`)
   - Creates `adventurers` table
   - Creates `adventurer_stat_history` table
   - Required for hero stat tracking

2. **Inventory Tracking** (`apps/web/contributions/inventory-tracking/code/database/migration.sql`)
   - Creates `inventory_items` table
   - Creates `item_equip_history` table
   - Creates `item_transfers` table
   - Required for equipment and inventory management

3. **Game Logging System** (`apps/web/contributions/game-logging-system/code/database/migration.sql`)
   - Creates `detailed_logs` table
   - Creates `key_events` table
   - Required for event logging during dungeon runs

4. **World Content Hierarchy** (`apps/web/contributions/world-content-hierarchy/code/database/migration.sql`)
   - Creates `world_content` table (may already exist)
   - Creates `provenance` table (may already exist)
   - Creates `lore` table (may already exist)
   - Creates `historical_events` table
   - Required for world generation and lore tracking

## Running Migrations

These migrations should be run in order using your Supabase migration system. Check if any tables already exist before running migrations to avoid conflicts.

## Notes

- The `dungeons` table should already exist from initial schema
- The `world_content`, `provenance`, and `lore` tables may already exist from previous migrations
- Check existing migrations in `supabase/migrations/` before running new ones

