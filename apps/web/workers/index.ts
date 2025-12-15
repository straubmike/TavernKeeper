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
  console.log('[Worker] Importing runWorker module...');
  const runWorkerModule = await import('./runWorker');
  console.log('✅ Run worker loaded and ready to process jobs');
  console.log('[Worker] Worker instance:', runWorkerModule.runWorker ? '✅ Found' : '❌ Missing');
  console.log('[Worker] Worker name:', runWorkerModule.runWorker?.name || 'unknown');
  console.log('[Worker] Worker isRunning:', runWorkerModule.runWorker?.isRunning() || false);
  console.log('[Worker] Worker isPaused:', runWorkerModule.runWorker?.isPaused() || false);
  
  // Ensure worker is not paused
  if (runWorkerModule.runWorker?.isPaused()) {
    console.log('[Worker] ⚠️ Worker was paused! Resuming...');
    runWorkerModule.runWorker.resume();
  }
  
  // Wait a moment then verify worker is ready
  setTimeout(() => {
    if (runWorkerModule.runWorker) {
      console.log('[Worker] 🔍 Post-startup worker check:');
      console.log('[Worker]   - isRunning:', runWorkerModule.runWorker.isRunning());
      console.log('[Worker]   - isPaused:', runWorkerModule.runWorker.isPaused());
      console.log('[Worker]   - name:', runWorkerModule.runWorker.name);
      
      if (runWorkerModule.runWorker.isPaused()) {
        console.log('[Worker] ⚠️ Worker is paused! Attempting to resume...');
        runWorkerModule.runWorker.resume();
      }
    }
  }, 2000);
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

  // Start timer worker for event delivery
  console.log('Starting timer worker...');
  try {
    const { startTimerWorker } = await import('./timerWorker');
    await startTimerWorker();
    console.log('✅ Timer worker started');
  } catch (error) {
    console.error('Failed to start timer worker:', error);
  }

  console.log('Workers started. Listening for jobs...');
}

start().catch((error) => {
  console.error('❌ Fatal error starting workers:', error);
  process.exit(1);
});

// Keep process alive and handle crashes
process.on('SIGTERM', () => {
  console.log('SIGTERM received, shutting down workers...');
  process.exit(0);
});

process.on('SIGINT', () => {
  console.log('SIGINT received, shutting down workers...');
  process.exit(0);
});

// Handle uncaught errors
process.on('uncaughtException', (error) => {
  console.error('❌ [WORKER] Uncaught Exception:', error);
  console.error('Stack:', error.stack);
  // Don't exit - let the worker try to recover
});

process.on('unhandledRejection', (reason, promise) => {
  console.error('❌ [WORKER] Unhandled Rejection at:', promise);
  console.error('Reason:', reason);
  // Don't exit - let the worker try to recover
});

