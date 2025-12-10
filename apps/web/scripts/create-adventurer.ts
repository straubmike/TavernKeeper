/**
 * Create an adventurer record for a hero
 * Usage: pnpm tsx scripts/create-adventurer.ts <tokenId> [walletAddress] [class] [name]
 */

import dotenv from 'dotenv';
import path from 'path';

// Load environment variables
dotenv.config();
const rootEnvPath = path.resolve(process.cwd(), '../../.env');
dotenv.config({ path: rootEnvPath });

async function createAdventurer() {
  const args = process.argv.slice(2);
  
  if (args.length < 1) {
    console.log('Usage: pnpm tsx scripts/create-adventurer.ts <tokenId> [walletAddress] [class] [name]');
    console.log('');
    console.log('Example:');
    console.log('  pnpm tsx scripts/create-adventurer.ts 6 0x1234... warrior "Hero #6"');
    process.exit(1);
  }
  
  const tokenId = args[0];
  const walletAddress = args[1] || '0x0000000000000000000000000000000000000000';
  const heroClass = (args[2] || 'warrior').toLowerCase();
  const heroName = args[3] || `Hero #${tokenId}`;
  
  const HERO_CONTRACT_ADDRESS = process.env.NEXT_PUBLIC_HERO_CONTRACT_ADDRESS || '0x0000000000000000000000000000000000000000';
  const CHAIN_ID = parseInt(process.env.NEXT_PUBLIC_CHAIN_ID || '143', 10);
  
  console.log('🚀 Creating Adventurer Record...\n');
  console.log(`   Token ID: ${tokenId}`);
  console.log(`   Contract: ${HERO_CONTRACT_ADDRESS}`);
  console.log(`   Chain ID: ${CHAIN_ID}`);
  console.log(`   Wallet: ${walletAddress}`);
  console.log(`   Class: ${heroClass}`);
  console.log(`   Name: ${heroName}\n`);
  
  try {
    const { initializeAdventurerStats } = await import('../lib/services/heroAdventurerInit');
    
    console.log('📝 Initializing adventurer stats...');
    const adventurer = await initializeAdventurerStats(
      tokenId,
      HERO_CONTRACT_ADDRESS,
      CHAIN_ID,
      walletAddress,
      heroClass,
      heroName
    );
    
    console.log('\n✅ Adventurer created successfully!');
    console.log(`   Name: ${adventurer.name}`);
    console.log(`   Class: ${adventurer.class}`);
    console.log(`   Level: ${adventurer.level || 1}`);
    console.log(`   Health: ${adventurer.stats.health}/${adventurer.stats.maxHealth}`);
    console.log(`   Mana: ${adventurer.stats.mana}/${adventurer.stats.maxMana}`);
    console.log(`   Strength: ${adventurer.stats.strength}`);
    console.log(`   Dexterity: ${adventurer.stats.dexterity}`);
    console.log(`   Constitution: ${adventurer.stats.constitution}`);
    console.log(`   Intelligence: ${adventurer.stats.intelligence}`);
    console.log(`   Wisdom: ${adventurer.stats.wisdom}`);
    console.log(`   Charisma: ${adventurer.stats.charisma}\n`);
    
  } catch (error) {
    console.error('❌ Error creating adventurer:', error);
    if (error instanceof Error) {
      console.error('   Message:', error.message);
      console.error('   Stack:', error.stack);
    }
    process.exit(1);
  }
  
  process.exit(0);
}

createAdventurer();

