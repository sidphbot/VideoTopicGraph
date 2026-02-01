/**
 * Configuration Types
 * 
 * Types for service configuration, model settings, and feature flags.
 * All design choices are config-driven as per the specification.
 */

// ==================== Model Configuration ====================

/**
 * ASR (Automatic Speech Recognition) Model Configuration
 */
export interface AsrModelConfig {
  /** Model provider */
  provider: 'whisper' | 'faster-whisper' | 'whisper-cpp' | 'custom';
  /** Model size or path */
  model: 'tiny' | 'base' | 'small' | 'medium' | 'large-v1' | 'large-v2' | 'large-v3' | string;
  /** Device for inference */
  device: 'cpu' | 'cuda' | 'mps';
  /** Compute type (for faster-whisper) */
  computeType?: 'int8' | 'int8_float16' | 'int16' | 'float16' | 'float32';
  /** Number of workers */
  numWorkers?: number;
  /** Beam size for decoding */
  beamSize?: number;
  /** Best of N for sampling */
  bestOf?: number;
  /** Temperature for sampling */
  temperature?: number;
  /** Language code (auto-detect if not specified) */
  language?: string;
  /** Path to custom model */
  modelPath?: string;
  /** VAD filter options */
  vadOptions?: {
    enabled: boolean;
    minSpeechDurationMs?: number;
    maxSpeechDurationMs?: number;
    minSilenceDurationMs?: number;
  };
}

/**
 * Speaker Diarization Configuration
 */
export interface DiarizationConfig {
  /** Enable diarization */
  enabled: boolean;
  /** Model provider */
  provider: 'pyannote' | 'resemblyzer' | 'custom';
  /** Model name or path */
  model: string;
  /** Device for inference */
  device: 'cpu' | 'cuda';
  /** Number of speakers (0 = unknown) */
  numSpeakers?: number;
  /** Minimum number of speakers */
  minSpeakers?: number;
  /** Maximum number of speakers */
  maxSpeakers?: number;
}

/**
 * Embedding Model Configuration
 */
export interface EmbeddingModelConfig {
  /** Model provider */
  provider: 'sentence-transformers' | 'ollama' | 'openai' | 'custom';
  /** Model name */
  model: string;
  /** Device for inference */
  device: 'cpu' | 'cuda' | 'mps';
  /** Batch size for encoding */
  batchSize?: number;
  /** Normalize embeddings */
  normalize?: boolean;
  /** Embedding dimension */
  dimension?: number;
  /** Ollama-specific: host URL */
  ollamaHost?: string;
  /** Custom model path */
  modelPath?: string;
}

/**
 * LLM (Large Language Model) Configuration
 */
export interface LlmModelConfig {
  /** Model provider */
  provider: 'llama-cpp' | 'vllm' | 'ollama' | 'transformers' | 'custom';
  /** Model name or path */
  model: string;
  /** Device for inference */
  device: 'cpu' | 'cuda' | 'auto';
  /** GPU layers (for llama.cpp) */
  gpuLayers?: number;
  /** Context window size */
  contextWindow?: number;
  /** Maximum tokens to generate */
  maxTokens?: number;
  /** Temperature for sampling */
  temperature?: number;
  /** Top-p sampling */
  topP?: number;
  /** Top-k sampling */
  topK?: number;
  /** Repeat penalty */
  repeatPenalty?: number;
  /** Batch size */
  batchSize?: number;
  /** Number of workers */
  numWorkers?: number;
  /** vLLM-specific: tensor parallel size */
  tensorParallelSize?: number;
  /** Ollama-specific: host URL */
  ollamaHost?: string;
  /** Custom model path */
  modelPath?: string;
}

// ==================== Service Configuration ====================

/**
 * API Service Configuration
 */
export interface ApiServiceConfig {
  /** Server port */
  port: number;
  /** Server host */
  host: string;
  /** Log level */
  logLevel: 'debug' | 'info' | 'warn' | 'error';
  /** Request timeout in milliseconds */
  requestTimeoutMs: number;
  /** Maximum request body size */
  maxBodySize: string;
  /** Rate limiting */
  rateLimit: {
    enabled: boolean;
    windowMs: number;
    maxRequests: number;
  };
  /** CORS configuration */
  cors: {
    enabled: boolean;
    origins: string[];
  };
  /** Upload configuration */
  upload: {
    maxFileSize: number;
    allowedMimeTypes: string[];
  };
}

/**
 * Worker Orchestrator Configuration
 */
export interface WorkerOrchestratorConfig {
  /** Queue provider */
  queueProvider: 'redis' | 'bull' | 'sqs' | 'memory';
  /** Redis URL (if using Redis) */
  redisUrl?: string;
  /** Number of concurrent workers */
  concurrency: number;
  /** Job timeout in milliseconds */
  jobTimeoutMs: number;
  /** Retry configuration */
  retry: {
    attempts: number;
    backoff: 'fixed' | 'exponential';
    delayMs: number;
  };
  /** Dead letter queue configuration */
  deadLetter: {
    enabled: boolean;
    maxAgeHours: number;
  };
  /** Health check interval */
  healthCheckIntervalMs: number;
}

/**
 * Pipeline Worker Configuration
 */
export interface PipelineWorkerConfig {
  /** Worker ID */
  workerId: string;
  /** Pipeline steps this worker handles */
  steps: string[];
  /** Maximum concurrent jobs */
  maxConcurrentJobs: number;
  /** Resource limits */
  resources: {
    maxMemoryGb: number;
    maxCpuPercent: number;
    maxGpuMemoryGb?: number;
  };
  /** Model configurations */
  models: {
    asr: AsrModelConfig;
    diarization: DiarizationConfig;
    embedding: EmbeddingModelConfig;
    llm: LlmModelConfig;
  };
  /** Temporary directory for processing */
  tempDir: string;
  /** Cleanup temporary files after processing */
  cleanupTempFiles: boolean;
}

// ==================== Storage Configuration ====================

/**
 * Object Storage Configuration
 */
export interface StorageConfig {
  /** Storage provider */
  provider: 'minio' | 's3' | 'gcs' | 'azure' | 'filesystem';
  /** Endpoint URL (for MinIO/S3-compatible) */
  endpoint?: string;
  /** Region (for cloud providers) */
  region?: string;
  /** Access key */
  accessKey: string;
  /** Secret key */
  secretKey: string;
  /** Bucket name */
  bucket: string;
  /** Use SSL */
  useSsl: boolean;
  /** Path prefix for all objects */
  pathPrefix?: string;
  /** Presigned URL expiration in seconds */
  presignedUrlExpirySeconds: number;
  /** Local filesystem path (for filesystem provider) */
  localPath?: string;
}

// ==================== Database Configuration ====================

/**
 * Database Configuration
 */
export interface DatabaseConfig {
  /** Database provider */
  provider: 'postgresql' | 'sqlite' | 'mysql';
  /** Connection host */
  host: string;
  /** Connection port */
  port: number;
  /** Database name */
  database: string;
  /** Connection user */
  user: string;
  /** Connection password */
  password: string;
  /** SSL configuration */
  ssl?: boolean | { rejectUnauthorized: boolean };
  /** Connection pool size */
  poolSize: number;
  /** Connection timeout in milliseconds */
  connectionTimeoutMs: number;
  /** pgvector-specific: embedding dimension */
  vectorDimension?: number;
}

// ==================== Authentication Configuration ====================

/**
 * OIDC/Keycloak Configuration
 */
export interface AuthConfig {
  /** Authentication provider */
  provider: 'keycloak' | 'auth0' | 'cognito' | 'custom';
  /** OIDC issuer URL */
  issuerUrl: string;
  /** OIDC client ID */
  clientId: string;
  /** OIDC client secret */
  clientSecret: string;
  /** OIDC scopes */
  scopes: string[];
  /** Token validation */
  tokenValidation: {
    /** Validate issuer */
    validateIssuer: boolean;
    /** Validate audience */
    validateAudience: boolean;
    /** Clock skew tolerance in seconds */
    clockSkewSeconds: number;
  };
  /** Keycloak-specific: realm */
  realm?: string;
  /** Keycloak-specific: admin username */
  adminUsername?: string;
  /** Keycloak-specific: admin password */
  adminPassword?: string;
}

// ==================== Feature Flags ====================

/**
 * Feature Flags for Configurable Behavior
 */
export interface FeatureFlags {
  /** Enable video scene detection */
  sceneDetection: boolean;
  /** Enable speaker diarization */
  diarization: boolean;
  /** Enable word-level alignment */
  wordAlignment: boolean;
  /** Enable visual topic analysis */
  visualTopics: boolean;
  /** Enable OCR on video frames */
  ocr: boolean;
  /** Enable multi-video super graphs */
  multiVideoGraphs: boolean;
  /** Enable eager snippet generation */
  eagerSnippetGeneration: boolean;
  /** Enable deep search with LLM */
  deepSearch: boolean;
  /** Enable export embedding */
  exportEmbedding: boolean;
  /** Enable real-time processing updates */
  realtimeUpdates: boolean;
  /** Enable graph versioning */
  graphVersioning: boolean;
  /** Enable sharing with expiration */
  shareExpiration: boolean;
  /** Enable quota enforcement */
  quotaEnforcement: boolean;
  /** Enable multi-parent topics (vs tree projection) */
  multiParentTopics: boolean;
}

// ==================== Global Configuration ====================

/**
 * Global Application Configuration
 * 
 * This is the root configuration object that combines all
 * service-specific configurations.
 */
export interface AppConfig {
  /** Application environment */
  env: 'development' | 'staging' | 'production';
  /** Application name */
  appName: string;
  /** Application version */
  version: string;
  /** API configuration */
  api: ApiServiceConfig;
  /** Worker orchestrator configuration */
  workerOrchestrator: WorkerOrchestratorConfig;
  /** Pipeline worker configuration */
  pipelineWorker: PipelineWorkerConfig;
  /** Database configuration */
  database: DatabaseConfig;
  /** Storage configuration */
  storage: StorageConfig;
  /** Authentication configuration */
  auth: AuthConfig;
  /** Feature flags */
  features: FeatureFlags;
  /** Default pipeline configuration */
  defaultPipeline: import('./schemas').PipelineConfig;
}

// ==================== Configuration Loading ====================

/**
 * Configuration source
 */
export interface ConfigSource {
  /** Source name */
  name: string;
  /** Source priority (lower = higher priority) */
  priority: number;
  /** Load configuration from this source */
  load(): Promise<Partial<AppConfig>>;
}

/**
 * Configuration manager
 */
export interface ConfigManager {
  /** Get current configuration */
  getConfig(): AppConfig;
  /** Reload configuration from all sources */
  reload(): Promise<void>;
  /** Register a configuration source */
  registerSource(source: ConfigSource): void;
  /** Watch for configuration changes */
  onChange(callback: (config: AppConfig) => void): void;
}
