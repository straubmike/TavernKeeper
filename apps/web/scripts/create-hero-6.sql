-- Create adventurer record for Hero #6
-- Run this in Supabase SQL Editor

INSERT INTO adventurers (
  token_id,
  contract_address,
  chain_id,
  wallet_address,
  name,
  class,
  level,
  experience,
  health,
  max_health,
  mana,
  max_mana,
  strength,
  dexterity,
  wisdom,
  intelligence,
  constitution,
  charisma,
  perception,
  armor_class,
  attack_bonus,
  spell_attack_bonus
) VALUES (
  '6',
  '0x0000000000000000000000000000000000000000',
  143,
  '0x3ec3a92e44952bae7ea96fd9c1c3f6b65c9a1b6d',
  'Hero #6',
  'warrior',
  1,
  0,
  30,
  30,
  0,
  0,
  16,
  12,
  10,
  10,
  14,
  8,
  10,
  11,
  3,
  0
)
ON CONFLICT (token_id, contract_address, chain_id) 
DO UPDATE SET
  wallet_address = EXCLUDED.wallet_address,
  name = EXCLUDED.name,
  health = EXCLUDED.health,
  max_health = EXCLUDED.max_health,
  updated_at = NOW();

