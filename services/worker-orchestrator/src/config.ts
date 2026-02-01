/**
 * Worker Orchestrator Configuration
 */

export const config = {
  // Redis
  redisUrl: process.env.REDIS_URL || 'redis://localhost:6379',
  
  // Worker settings
  concurrency: parseInt(process.env.WORKER_CONCURRENCY || '2', 10),
  rateLimitMax: parseInt(process.env.WORKER_RATE_LIMIT_MAX || '10', 10),
  rateLimitDuration: parseInt(process.env.WORKER_RATE_LIMIT_DURATION || '1000', 10),
  
  // Job timeout (ms)
  jobTimeout: parseInt(process.env.WORKER_JOB_TIMEOUT || '3600000', 10), // 1 hour
  
  // Retry settings
  maxRetries: parseInt(process.env.WORKER_MAX_RETRIES || '3', 10),
  retryDelay: parseInt(process.env.WORKER_RETRY_DELAY || '5000', 10),
  
  // Database
  dbHost: process.env.DB_HOST || 'localhost',
  dbPort: parseInt(process.env.DB_PORT || '5432', 10),
  dbName: process.env.DB_NAME || 'videograph',
  dbUser: process.env.DB_USER || 'postgres',
  dbPassword: process.env.DB_PASSWORD || 'postgres',
  
  // Storage
  storageEndpoint: process.env.STORAGE_ENDPOINT || 'http://localhost:9000',
  storageAccessKey: process.env.STORAGE_ACCESS_KEY || 'minioadmin',
  storageSecretKey: process.env.STORAGE_SECRET_KEY || 'minioadmin',
  storageBucket: process.env.STORAGE_BUCKET || 'videograph',
};
