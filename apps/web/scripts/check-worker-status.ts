/**
 * Diagnostic script to check worker and queue status
 */

import dotenv from 'dotenv';
import path from 'path';

// Load environment variables
dotenv.config();
const rootEnvPath = path.resolve(process.cwd(), '../../.env');
dotenv.config({ path: rootEnvPath });

async function checkWorkerStatus() {
  console.log('🔍 Checking Worker Status...\n');
  
  // Check Redis URL
  const redisUrl = process.env.REDIS_URL;
  console.log(`Redis URL: ${redisUrl ? redisUrl.replace(/:[^:@]+@/, ':****@') : 'NOT SET'}\n`);
  
  if (!redisUrl) {
    console.error('❌ REDIS_URL is not set!');
    console.log('Please set REDIS_URL in your .env file');
    return;
  }
  
  try {
    // Import queue and check status
    const { runQueue } = await import('../lib/queue');
    
    // Check queue counts
    const waiting = await runQueue.getWaitingCount();
    const active = await runQueue.getActiveCount();
    const completed = await runQueue.getCompletedCount();
    const failed = await runQueue.getFailedCount();
    const delayed = await runQueue.getDelayedCount();
    
    console.log('📊 Queue Status:');
    console.log(`   Waiting: ${waiting}`);
    console.log(`   Active: ${active}`);
    console.log(`   Completed: ${completed}`);
    console.log(`   Failed: ${failed}`);
    console.log(`   Delayed: ${delayed}\n`);
    
    // Get recent jobs
    if (waiting > 0) {
      console.log('⏳ Waiting Jobs:');
      const waitingJobs = await runQueue.getWaiting(0, waiting - 1);
      waitingJobs.forEach((job, idx) => {
        console.log(`   ${idx + 1}. Job ${job.id} - Run ${job.data.runId}`);
        console.log(`      Created: ${new Date(job.timestamp).toISOString()}`);
      });
      console.log('');
    }
    
    if (active > 0) {
      console.log('🔄 Active Jobs:');
      const activeJobs = await runQueue.getActive();
      activeJobs.forEach((job, idx) => {
        console.log(`   ${idx + 1}. Job ${job.id} - Run ${job.data.runId}`);
        console.log(`      Started: ${job.processedOn ? new Date(job.processedOn).toISOString() : 'Unknown'}`);
      });
      console.log('');
    }
    
    if (failed > 0) {
      console.log('❌ Failed Jobs:');
      const failedJobs = await runQueue.getFailed(0, failed - 1);
      failedJobs.forEach((job, idx) => {
        console.log(`   ${idx + 1}. Job ${job.id} - Run ${job.data.runId}`);
        console.log(`      Error: ${job.failedReason || 'Unknown error'}`);
        if (job.stacktrace) {
          console.log(`      Stack: ${job.stacktrace[0]?.substring(0, 200)}...`);
        }
      });
      console.log('');
    }
    
    // Test Redis connection
    const Redis = (await import('ioredis')).default;
    const testConnection = new Redis(redisUrl, {
      maxRetriesPerRequest: null,
    });
    
    try {
      await testConnection.ping();
      console.log('✅ Redis connection: OK\n');
      testConnection.quit();
    } catch (err) {
      console.error('❌ Redis connection: FAILED');
      console.error(`   Error: ${err instanceof Error ? err.message : String(err)}\n`);
      testConnection.quit();
    }
    
  } catch (error) {
    console.error('❌ Error checking worker status:');
    console.error(error);
  }
  
  process.exit(0);
}

checkWorkerStatus();

