/**
 * Simple script to create an adventurer record directly in the database
 */

import dotenv from 'dotenv';
import path from 'path';

// Load environment variables
dotenv.config();
const rootEnvPath = path.resolve(process.cwd(), '../../.env');
dotenv.config({ path: rootEnvPath });

async function createAdventurerSimple() {
  const args = process.argv.slice(2);
  
  if (args.length < 1) {
    console.log('Usage: pnpm tsx scripts/create-adventurer-simple.ts <tokenId> [walletAddress]');
    process.exit(1);
  }
  
  const tokenId = args[0];
  const walletAddress = args[1] || '0x3Ec3a92e44952BAE7Ea96FD9C1C3F6B65c9A1B6d';
  
  const HERO_CONTRACT_ADDRESS = process.env.NEXT_PUBLIC_HERO_CONTRACT_ADDRESS || '0x0000000000000000000000000000000000000000';
  const CHAIN_ID = parseInt(process.env.NEXT_PUBLIC_CHAIN_ID || '143', 10);
  
  console.log('🚀 Creating Adventurer Record (Simple)...\n');
  console.log(`   Token ID: ${tokenId}`);
  console.log(`   Contract: ${HERO_CONTRACT_ADDRESS}`);
  console.log(`   Chain ID: ${CHAIN_ID}`);
  console.log(`   Wallet: ${walletAddress}\n`);
  
  try {
    const { supabase } = await import('../lib/supabase');
    
    // Default warrior stats
    const adventurerData = {
      token_id: tokenId,
      contract_address: HERO_CONTRACT_ADDRESS,
      chain_id: CHAIN_ID,
      wallet_address: walletAddress.toLowerCase(),
      name: `Hero #${tokenId}`,
      class: 'warrior',
      level: 1,
      experience: 0,
      health: 30,
      max_health: 30,
      mana: 0,
      max_mana: 0,
      strength: 16,
      dexterity: 12,
      wisdom: 10,
      intelligence: 10,
      constitution: 14,
      charisma: 8,
      perception: 10,
      armor_class: 11,
      attack_bonus: 3,
      spell_attack_bonus: 0,
    };
    
    console.log('📝 Inserting adventurer record...');
    const { data, error } = await supabase
      .from('adventurers')
      .insert(adventurerData)
      .select()
      .single();
    
    if (error) {
      if (error.message?.includes('duplicate') || error.message?.includes('unique')) {
        console.log('⚠️  Adventurer already exists, updating...');
        const { data: updated, error: updateError } = await supabase
          .from('adventurers')
          .update(adventurerData)
          .eq('token_id', tokenId)
          .eq('contract_address', HERO_CONTRACT_ADDRESS)
          .eq('chain_id', CHAIN_ID)
          .select()
          .single();
        
        if (updateError) {
          throw updateError;
        }
        console.log('\n✅ Adventurer updated successfully!');
        console.log(`   Name: ${updated.name}`);
        console.log(`   Class: ${updated.class}`);
        console.log(`   Level: ${updated.level}`);
        console.log(`   Health: ${updated.health}/${updated.max_health}\n`);
        return;
      }
      throw error;
    }
    
    console.log('\n✅ Adventurer created successfully!');
    console.log(`   Name: ${data.name}`);
    console.log(`   Class: ${data.class}`);
    console.log(`   Level: ${data.level}`);
    console.log(`   Health: ${data.health}/${data.max_health}`);
    console.log(`   Strength: ${data.strength}`);
    console.log(`   Dexterity: ${data.dexterity}`);
    console.log(`   Constitution: ${data.constitution}\n`);
    
  } catch (error) {
    console.error('❌ Error creating adventurer:', error);
    if (error instanceof Error) {
      console.error('   Message:', error.message);
    }
    process.exit(1);
  }
  
  process.exit(0);
}

createAdventurerSimple();

