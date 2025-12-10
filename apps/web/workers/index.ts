// Load environment variables BEFORE importing any modules that use them
import dotenv from 'dotenv';
import path from 'path';

// Load environment variables
// Load environment variables
// 2. Try default .env in current dir (apps/web) - in case they have one there
dotenv.config();

// 3. Try root .env - multiple possible locations
const possibleEnvPaths = [
  path.resolve(process.cwd(), '../../.env'), // From apps/web/workers -> root
  path.resolve(process.cwd(), '../.env'),   // From apps/web -> root
  path.resolve(process.cwd(), '.env'),       // Current directory
];

let envLoaded = false;
for (const envPath of possibleEnvPaths) {
  const result = dotenv.config({ path: envPath, override: false });
  if (!result.error) {
    console.log(`✅ Loaded .env file from: ${envPath}`);
    envLoaded = true;
    break;
  }
}

if (!envLoaded) {
  console.warn('⚠️  Warning: Could not load .env file from any of these locations:');
  possibleEnvPaths.forEach(p => console.warn(`   - ${p}`));
}

console.log('Worker Environment Loaded. REDIS_URL present:', !!process.env.REDIS_URL);
if (process.env.REDIS_URL) {
  console.log('REDIS_URL:', process.env.REDIS_URL.replace(/:[^:@]+@/, ':****@'));
}

async function start() {
  // Initialize world on startup if not already initialized
  console.log('🌍 Checking world initialization status...');
  try {
    const { initializeWorldOnStartup } = await import('../lib/services/worldInitializationService');
    await initializeWorldOnStartup();
    console.log('✅ World initialization check complete');
  } catch (error) {
    console.error('❌ World initialization error (non-fatal, workers will continue):', error);
    console.error('   You can manually initialize via: POST /api/world/initialize');
  }

  // Use dynamic imports to ensure env vars are loaded BEFORE modules initialize
  console.log('📦 Loading workers...');
  await import('./runWorker');
  console.log('✅ Run worker loaded');
  await import('./replayWorker');
  console.log('✅ Replay worker loaded');

  // Start auto-harvest worker if enabled
  if (process.env.ENABLE_AUTO_HARVEST === 'true') {
    console.log('Starting auto-harvest worker...');
    try {
      // Import and start auto-harvest worker
      const { startAutoHarvestWorker } = await import('../../packages/contracts/scripts/auto-harvest');
      await startAutoHarvestWorker();
      console.log('✅ Auto-harvest worker started');
    } catch (error) {
      console.error('Failed to start auto-harvest worker:', error);
    }
  }

  // Start staking tracker worker if enabled
  if (process.env.ENABLE_STAKING_TRACKER === 'true') {
    console.log('Starting staking tracker worker...');
    try {
      const { startStakingTrackerWorker } = await import('./stakingTrackerWorker');
      await startStakingTrackerWorker();
      console.log('✅ Staking tracker worker started');
    } catch (error) {
      console.error('Failed to start staking tracker worker:', error);
    }
  }

  console.log('Workers started. Listening for jobs...');
}

start();

// Keep process alive
process.on('SIGTERM', () => {
  console.log('SIGTERM received, shutting down workers...');
  process.exit(0);
});

process.on('SIGINT', () => {
  console.log('SIGINT received, shutting down workers...');
  process.exit(0);
});

