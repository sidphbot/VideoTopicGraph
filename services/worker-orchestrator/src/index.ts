/**
 * Worker Orchestrator Service
 * 
 * Manages job queue and orchestrates pipeline workers.
 * Uses BullMQ with Redis for job distribution.
 */

import { Queue, Worker, Job as BullJob } from 'bullmq';
import Redis from 'ioredis';
import { config } from './config.js';
import { logger } from './logger.js';
import { JobProcessor } from './processor.js';

// Redis connection
const redis = new Redis(config.redisUrl, {
  maxRetriesPerRequest: null,
});

// Job queues
const videoAnalysisQueue = new Queue('video-analysis', { connection: redis });
const exportQueue = new Queue('export', { connection: redis });
const snippetQueue = new Queue('snippet-generation', { connection: redis });

// Job processor
const processor = new JobProcessor();

// Workers
const videoAnalysisWorker = new Worker(
  'video-analysis',
  async (job: BullJob) => {
    logger.info({ jobId: job.id }, 'Processing video analysis job');
    return processor.processVideoAnalysis(job.data);
  },
  {
    connection: redis,
    concurrency: config.concurrency,
    limiter: {
      max: config.rateLimitMax,
      duration: config.rateLimitDuration,
    },
  }
);

const exportWorker = new Worker(
  'export',
  async (job: BullJob) => {
    logger.info({ jobId: job.id }, 'Processing export job');
    return processor.processExport(job.data);
  },
  {
    connection: redis,
    concurrency: 2,
  }
);

const snippetWorker = new Worker(
  'snippet-generation',
  async (job: BullJob) => {
    logger.info({ jobId: job.id }, 'Processing snippet generation job');
    return processor.processSnippetGeneration(job.data);
  },
  {
    connection: redis,
    concurrency: config.concurrency,
  }
);

// Event handlers
videoAnalysisWorker.on('completed', (job) => {
  logger.info({ jobId: job.id }, 'Video analysis job completed');
});

videoAnalysisWorker.on('failed', (job, err) => {
  logger.error({ jobId: job?.id, error: err }, 'Video analysis job failed');
});

exportWorker.on('completed', (job) => {
  logger.info({ jobId: job.id }, 'Export job completed');
});

exportWorker.on('failed', (job, err) => {
  logger.error({ jobId: job?.id, error: err }, 'Export job failed');
});

snippetWorker.on('completed', (job) => {
  logger.info({ jobId: job.id }, 'Snippet generation job completed');
});

snippetWorker.on('failed', (job, err) => {
  logger.error({ jobId: job?.id, error: err }, 'Snippet generation job failed');
});

// Graceful shutdown
async function shutdown() {
  logger.info('Shutting down worker orchestrator...');
  
  await videoAnalysisWorker.close();
  await exportWorker.close();
  await snippetWorker.close();
  
  await videoAnalysisQueue.close();
  await exportQueue.close();
  await snippetQueue.close();
  
  await redis.quit();
  
  logger.info('Worker orchestrator shut down');
  process.exit(0);
}

process.on('SIGINT', shutdown);
process.on('SIGTERM', shutdown);

logger.info('Worker orchestrator started');
