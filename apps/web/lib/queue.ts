import { Queue, QueueOptions } from 'bullmq';
import Redis from 'ioredis';

// BullMQ requires maxRetriesPerRequest to be null
const redisUrl = process.env.REDIS_URL || 'redis://localhost:6379';
console.log('[Queue] Connecting to Redis:', redisUrl.replace(/:[^:@]+@/, ':****@'));

const connection = new Redis(redisUrl, {
  maxRetriesPerRequest: null,
  retryStrategy: (times) => {
    const delay = Math.min(times * 50, 2000);
    console.log(`[Queue] Redis retry attempt ${times}, waiting ${delay}ms`);
    return delay;
  },
  reconnectOnError: (err) => {
    console.error('[Queue] Redis connection error:', err.message);
    return true;
  },
});

// Test connection
connection.on('connect', () => {
  console.log('[Queue] Redis connected');
});

connection.on('ready', () => {
  console.log('[Queue] Redis ready');
});

connection.on('error', (err) => {
  console.error('[Queue] Redis error:', err);
});

connection.ping().then(() => {
  console.log('[Queue] Redis ping successful');
}).catch((err) => {
  console.error('[Queue] Redis ping failed:', err);
});

export const runQueue = new Queue('run-simulation', {
  connection,
} as QueueOptions);

export const replayQueue = new Queue('replay-generation', {
  connection,
} as QueueOptions);

