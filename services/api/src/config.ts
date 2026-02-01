/**
 * API Service Configuration
 * 
 * Loads configuration from environment variables.
 */

import { config as dotenvConfig } from 'dotenv';

dotenvConfig();

function getEnv(name: string, defaultValue?: string): string {
  const value = process.env[name] ?? defaultValue;
  if (value === undefined) {
    throw new Error(`Missing required environment variable: ${name}`);
  }
  return value;
}

function getEnvInt(name: string, defaultValue?: number): number {
  const value = process.env[name];
  if (value === undefined) {
    if (defaultValue === undefined) {
      throw new Error(`Missing required environment variable: ${name}`);
    }
    return defaultValue;
  }
  return parseInt(value, 10);
}

function getEnvBool(name: string, defaultValue = false): boolean {
  const value = process.env[name];
  if (value === undefined) {
    return defaultValue;
  }
  return value === 'true' || value === '1';
}

export const config = {
  // App
  env: getEnv('NODE_ENV', 'development') as 'development' | 'staging' | 'production',
  appName: getEnv('APP_NAME', 'video-topic-graph-api'),
  version: getEnv('APP_VERSION', '1.0.0'),

  // Server
  port: getEnvInt('PORT', 3000),
  host: getEnv('HOST', '0.0.0.0'),
  logLevel: getEnv('LOG_LEVEL', 'info') as 'debug' | 'info' | 'warn' | 'error',
  requestTimeoutMs: getEnvInt('REQUEST_TIMEOUT_MS', 30000),

  // CORS
  cors: {
    origins: getEnv('CORS_ORIGINS', 'http://localhost:3001,http://localhost:5173').split(','),
  },

  // Rate limiting
  rateLimit: {
    enabled: getEnvBool('RATE_LIMIT_ENABLED', true),
    windowMs: getEnvInt('RATE_LIMIT_WINDOW_MS', 60000),
    maxRequests: getEnvInt('RATE_LIMIT_MAX_REQUESTS', 100),
  },

  // Upload
  upload: {
    maxFileSize: getEnvInt('UPLOAD_MAX_FILE_SIZE', 100 * 1024 * 1024), // 100MB
  },

  // Database
  database: {
    host: getEnv('DB_HOST', 'localhost'),
    port: getEnvInt('DB_PORT', 5432),
    database: getEnv('DB_NAME', 'videograph'),
    user: getEnv('DB_USER', 'postgres'),
    password: getEnv('DB_PASSWORD', 'postgres'),
    poolSize: getEnvInt('DB_POOL_SIZE', 10),
    vectorDimension: getEnvInt('DB_VECTOR_DIMENSION', 384),
  },

  // Redis
  redis: {
    url: getEnv('REDIS_URL', 'redis://localhost:6379'),
  },

  // Storage (MinIO/S3)
  storage: {
    provider: getEnv('STORAGE_PROVIDER', 'minio') as 'minio' | 's3',
    endpoint: getEnv('STORAGE_ENDPOINT', 'http://localhost:9000'),
    region: getEnv('STORAGE_REGION', 'us-east-1'),
    accessKey: getEnv('STORAGE_ACCESS_KEY', 'minioadmin'),
    secretKey: getEnv('STORAGE_SECRET_KEY', 'minioadmin'),
    bucket: getEnv('STORAGE_BUCKET', 'videograph'),
    useSsl: getEnvBool('STORAGE_USE_SSL', false),
    presignedUrlExpirySeconds: getEnvInt('STORAGE_PRESIGNED_URL_EXPIRY', 3600),
  },

  // Auth (Keycloak)
  auth: {
    provider: getEnv('AUTH_PROVIDER', 'keycloak') as 'keycloak',
    issuerUrl: getEnv('AUTH_ISSUER_URL', 'http://localhost:8080'),
    realm: getEnv('AUTH_REALM', 'videograph'),
    clientId: getEnv('AUTH_CLIENT_ID', 'videograph-api'),
    clientSecret: getEnv('AUTH_CLIENT_SECRET', ''),
    adminUsername: getEnv('AUTH_ADMIN_USERNAME', 'admin'),
    adminPassword: getEnv('AUTH_ADMIN_PASSWORD', 'admin'),
  },

  // Worker Orchestrator
  worker: {
    queueProvider: getEnv('WORKER_QUEUE_PROVIDER', 'redis') as 'redis' | 'bull',
    redisUrl: getEnv('WORKER_REDIS_URL', 'redis://localhost:6379'),
  },

  // Feature flags
  features: {
    sceneDetection: getEnvBool('FEATURE_SCENE_DETECTION', false),
    diarization: getEnvBool('FEATURE_DIARIZATION', false),
    wordAlignment: getEnvBool('FEATURE_WORD_ALIGNMENT', false),
    visualTopics: getEnvBool('FEATURE_VISUAL_TOPICS', false),
    ocr: getEnvBool('FEATURE_OCR', false),
    multiVideoGraphs: getEnvBool('FEATURE_MULTI_VIDEO_GRAPHS', false),
    eagerSnippetGeneration: getEnvBool('FEATURE_EAGER_SNIPPET_GENERATION', true),
    deepSearch: getEnvBool('FEATURE_DEEP_SEARCH', true),
    exportEmbedding: getEnvBool('FEATURE_EXPORT_EMBEDDING', false),
    realtimeUpdates: getEnvBool('FEATURE_REALTIME_UPDATES', true),
    graphVersioning: getEnvBool('FEATURE_GRAPH_VERSIONING', true),
    shareExpiration: getEnvBool('FEATURE_SHARE_EXPIRATION', true),
    quotaEnforcement: getEnvBool('FEATURE_QUOTA_ENFORCEMENT', true),
    multiParentTopics: getEnvBool('FEATURE_MULTI_PARENT_TOPICS', true),
  },

  // Default pipeline config
  defaultPipeline: {
    asr_model: getEnv('DEFAULT_ASR_MODEL', 'faster-whisper') as 'whisper' | 'faster-whisper' | 'whisper-cpp',
    asr_language: getEnv('DEFAULT_ASR_LANGUAGE', undefined),
    enable_diarization: getEnvBool('DEFAULT_ENABLE_DIARIZATION', false),
    enable_scene_detection: getEnvBool('DEFAULT_ENABLE_SCENE_DETECTION', false),
    topic_levels: getEnvInt('DEFAULT_TOPIC_LEVELS', 3),
    embedding_model: getEnv('DEFAULT_EMBEDDING_MODEL', 'all-MiniLM-L6-v2') as 'all-MiniLM-L6-v2' | 'all-mpnet-base-v2' | 'ollama-nomic',
    llm_model: getEnv('DEFAULT_LLM_MODEL', 'mistral') as 'llama2' | 'mistral' | 'mixtral' | 'ollama-phi',
    snippet_quality: getEnv('DEFAULT_SNIPPET_QUALITY', 'medium') as 'low' | 'medium' | 'high',
  },
};
