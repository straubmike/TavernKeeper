-- Allow public updates to office_managers table
-- This is needed for server-side API routes that update manager data

-- Drop the restrictive update policy if it exists
DROP POLICY IF EXISTS "Users can update own data" ON office_managers;

-- Allow public updates (needed for API routes updating manager info)
CREATE POLICY "Allow public updates" ON office_managers FOR UPDATE
    USING (true)
    WITH CHECK (true);

