-- Add missing proficiency columns to adventurers table
-- These columns are required by the adventurer service but were missing from the initial migration

-- Add proficiency_bonus column (INTEGER, defaults to 2 for level 1)
ALTER TABLE adventurers 
ADD COLUMN IF NOT EXISTS proficiency_bonus INTEGER DEFAULT 2;

-- Add perception_proficient column (BOOLEAN, defaults to false)
ALTER TABLE adventurers 
ADD COLUMN IF NOT EXISTS perception_proficient BOOLEAN DEFAULT false;

-- Update existing records to have default values if they're NULL
UPDATE adventurers 
SET proficiency_bonus = 2 
WHERE proficiency_bonus IS NULL;

UPDATE adventurers 
SET perception_proficient = false 
WHERE perception_proficient IS NULL;

-- Add comment for documentation
COMMENT ON COLUMN adventurers.proficiency_bonus IS 'Proficiency bonus based on level (+2 to +6)';
COMMENT ON COLUMN adventurers.perception_proficient IS 'Whether the adventurer is proficient in Perception skill';

