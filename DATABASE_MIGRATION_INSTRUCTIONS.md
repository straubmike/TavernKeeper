# Database Migration Instructions

## What are Database Migrations?

Database migrations are SQL scripts that create or modify database tables, columns, indexes, and other database structures. They ensure your database schema matches what your application code expects.

## Step-by-Step Instructions

### Step 1: Access Supabase SQL Editor

1. Go to [https://supabase.com](https://supabase.com) and log in
2. Select your project (the one for TavernKeeper)
3. In the left sidebar, click on **"SQL Editor"** (it has a `</>` icon)
4. Click **"New query"** button (top right)

### Step 2: Run Migrations in Order

You need to run these migrations **in this exact order**. Copy and paste each migration file's contents into the SQL Editor and run them one at a time.

#### Migration 1: Inventory Tracking
**File:** `supabase/migrations/20250115000000_inventory_tracking.sql`

1. Open the file `supabase/migrations/20250115000000_inventory_tracking.sql` in your code editor
2. Copy **ALL** the contents (Ctrl+A, then Ctrl+C)
3. Paste into Supabase SQL Editor
4. Click **"Run"** button (or press Ctrl+Enter)
5. Wait for success message: "Success. No rows returned"

#### Migration 2: Game Logging
**File:** `supabase/migrations/20250115000001_game_logging.sql`

1. Open the file `supabase/migrations/20250115000001_game_logging.sql` in your code editor
2. Copy **ALL** the contents
3. Paste into Supabase SQL Editor (you can clear the previous query or use a new query)
4. Click **"Run"**
5. Wait for success message

#### Migration 3: Timer System
**File:** `supabase/migrations/20250115000003_timer_system.sql`

1. Open the file `supabase/migrations/20250115000003_timer_system.sql` in your code editor
2. Copy **ALL** the contents
3. Paste into Supabase SQL Editor
4. Click **"Run"**
5. Wait for success message

### Step 3: Verify Migrations Applied

After running all migrations, verify they worked:

1. In Supabase, go to **"Table Editor"** in the left sidebar
2. You should see these new tables:
   - `inventory_items`
   - `item_transfers`
   - `item_equip_history`
   - `key_events`
   - `detailed_logs_temp`
3. Check the `world_events` table - it should now have:
   - `scheduled_delivery_time` column (timestamp)
   - `delivered` column (boolean)

### Troubleshooting

**If you get an error like "relation already exists":**
- This means the table already exists. The migrations use `CREATE TABLE IF NOT EXISTS`, so this is usually safe to ignore.
- However, if you're getting errors about columns already existing, you may need to check what's already in your database.

**If you get a permission error:**
- Make sure you're using the SQL Editor (not the Table Editor)
- The SQL Editor runs with elevated permissions

**If you want to check what tables exist:**
- Run this query in SQL Editor:
  ```sql
  SELECT table_name 
  FROM information_schema.tables 
  WHERE table_schema = 'public'
  ORDER BY table_name;
  ```

## What These Migrations Do

### Inventory Tracking (`20250115000000_inventory_tracking.sql`)
- Creates `inventory_items` table - stores all items owned by wallets
- Creates `item_transfers` table - tracks item movement history
- Creates `item_equip_history` table - tracks equipment changes
- Enables Row Level Security (RLS) for security

### Game Logging (`20250115000001_game_logging.sql`)
- Creates `key_events` table - stores important game events permanently
- Creates `detailed_logs_temp` table - temporary storage for detailed logs
- Sets up automatic cleanup for expired logs

### Timer System (`20250115000003_timer_system.sql`)
- Adds `scheduled_delivery_time` column to `world_events` table
- Adds `delivered` column to `world_events` table
- Creates indexes for efficient event querying

## Important Notes

- **Run migrations in order** - The timestamps in the filenames indicate the order (000000, 000001, 000003)
- **Don't skip migrations** - Each one builds on the previous
- **Backup first** (optional but recommended) - If you have important data, export it before running migrations
- **These migrations are safe** - They use `IF NOT EXISTS` clauses, so running them multiple times won't break anything

