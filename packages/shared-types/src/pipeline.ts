/**
 * Pipeline Types and Interfaces
 * 
 * Core types for the pipeline SDK and artifact manifest system.
 * Every pipeline step consumes and produces ArtifactManifests.
 */

import type { PipelineConfig } from './schemas';

// ==================== Artifact Manifest ====================

/**
 * Paths to all artifacts produced by the pipeline
 */
export interface ArtifactPaths {
  /** Original downloaded video file */
  video_original?: string;
  /** Normalized video (H.264/AAC) */
  video_normalized?: string;
  /** Extracted audio in WAV format */
  audio_wav?: string;
  /** Transcript JSON file */
  transcript?: string;
  /** Word-level alignment JSON (optional) */
  word_alignment?: string;
  /** Speaker diarization output (optional) */
  diarization?: string;
  /** Scene detection output (optional) */
  scenes?: string;
  /** Topics JSON file */
  topics?: string;
  /** Topic embeddings file */
  embeddings?: string;
  /** Graph edges and metrics */
  graph?: string;
  /** Generated snippet files */
  snippets?: string[];
  /** Export files (PPTX, HTML, PDF) */
  exports?: string[];
  /** Thumbnail images */
  thumbnails?: string[];
  /** Caption files (VTT, SRT) */
  captions?: string[];
}

/**
 * Metrics collected during pipeline execution
 */
export interface ArtifactMetrics {
  /** Video duration in seconds */
  duration_s?: number;
  /** Number of transcript segments */
  transcript_segments?: number;
  /** Number of unique speakers (if diarization enabled) */
  speaker_count?: number;
  /** Number of detected topics */
  topic_count?: number;
  /** Number of edges in the graph */
  edge_count?: number;
  /** Number of hierarchy levels */
  hierarchy_levels?: number;
  /** Number of generated snippets */
  snippet_count?: number;
  /** Total processing time in milliseconds */
  processing_time_ms?: number;
  /** Per-step timing breakdown */
  step_timings?: Record<string, number>;
}

/**
 * The ArtifactManifest is passed between all pipeline steps.
 * Each step consumes the manifest, performs its work, and produces
 * an updated manifest with new paths and metrics.
 */
export interface ArtifactManifest {
  /** Unique video identifier */
  video_id: string;
  /** Graph version being processed */
  graph_version_id: string;
  /** Job identifier for tracking */
  job_id: string;
  /** Paths to all artifacts */
  paths: ArtifactPaths;
  /** Collected metrics */
  metrics: ArtifactMetrics;
  /** Snapshot of pipeline configuration used */
  config_snapshot: PipelineConfig;
  /** Manifest creation timestamp */
  created_at: string;
  /** Last update timestamp */
  updated_at: string;
  /** Current pipeline step */
  current_step?: string;
  /** Completed steps */
  completed_steps?: string[];
  /** Step errors (if any) */
  step_errors?: Record<string, string>;
}

// ==================== Pipeline Step Interface ====================

/**
 * Base interface for all pipeline steps.
 * Every step must be swappable via this interface.
 */
export interface PipelineStep {
  /** Unique step identifier */
  readonly name: string;
  /** Step version for compatibility */
  readonly version: string;
  
  /**
   * Execute the pipeline step
   * @param manifest - Input artifact manifest
   * @param context - Execution context
   * @returns Updated manifest with new artifacts
   */
  execute(
    manifest: ArtifactManifest,
    context: PipelineContext
  ): Promise<ArtifactManifest>;
  
  /**
   * Validate that required inputs exist
   * @param manifest - Input manifest to validate
   * @returns Validation result
   */
  validateInput(manifest: ArtifactManifest): ValidationResult;
  
  /**
   * Get list of required input paths
   */
  getRequiredInputs(): (keyof ArtifactPaths)[];
  
  /**
   * Get list of produced output paths
   */
  getProducedOutputs(): (keyof ArtifactPaths)[];
}

/**
 * Validation result for pipeline step inputs
 */
export interface ValidationResult {
  valid: boolean;
  errors: string[];
  warnings: string[];
}

/**
 * Pipeline execution context
 */
export interface PipelineContext {
  /** Job ID for tracking */
  jobId: string;
  /** Video ID being processed */
  videoId: string;
  /** User who initiated the job */
  userId: string;
  /** Storage service for reading/writing artifacts */
  storage: StorageService;
  /** Configuration for this execution */
  config: PipelineConfig;
  /** Logger instance */
  logger: Logger;
  /** Progress callback */
  onProgress?: (progress: number, message?: string) => void;
  /** Abort signal for cancellation */
  abortSignal?: AbortSignal;
}

/**
 * Storage service interface for artifact management
 */
export interface StorageService {
  /** Read file from storage */
  read(path: string): Promise<Buffer>;
  /** Write file to storage */
  write(path: string, data: Buffer): Promise<void>;
  /** Check if file exists */
  exists(path: string): Promise<boolean>;
  /** Delete file from storage */
  delete(path: string): Promise<void>;
  /** Get public URL for file */
  getUrl(path: string, expiresInSeconds?: number): Promise<string>;
  /** List files with prefix */
  list(prefix: string): Promise<string[]>;
}

/**
 * Logger interface
 */
export interface Logger {
  debug(message: string, meta?: Record<string, unknown>): void;
  info(message: string, meta?: Record<string, unknown>): void;
  warn(message: string, meta?: Record<string, unknown>): void;
  error(message: string, meta?: Record<string, unknown>): void;
}

// ==================== Pipeline Orchestrator Types ====================

/**
 * Pipeline definition consisting of ordered steps
 */
export interface PipelineDefinition {
  name: string;
  version: string;
  steps: PipelineStepConfig[];
}

/**
 * Configuration for a pipeline step
 */
export interface PipelineStepConfig {
  /** Step name (must match a registered step) */
  name: string;
  /** Step-specific configuration */
  config?: Record<string, unknown>;
  /** Whether this step can be retried on failure */
  retryable?: boolean;
  /** Maximum retry attempts */
  maxRetries?: number;
  /** Whether to continue on failure */
  continueOnFailure?: boolean;
  /** Step timeout in milliseconds */
  timeoutMs?: number;
}

/**
 * Pipeline execution result
 */
export interface PipelineResult {
  success: boolean;
  manifest: ArtifactManifest;
  error?: string;
  stepResults: StepResult[];
}

/**
 * Individual step execution result
 */
export interface StepResult {
  stepName: string;
  success: boolean;
  durationMs: number;
  error?: string;
}

// ==================== Step-Specific Input/Output Types ====================

/**
 * Input for video download/normalization step
 */
export interface VideoStepInput {
  sourceUrl: string;
  sourceType: string;
  outputDir: string;
}

/**
 * Output from video download/normalization step
 */
export interface VideoStepOutput {
  videoPath: string;
  audioPath: string;
  duration: number;
  format: string;
  resolution: { width: number; height: number };
  fps: number;
}

/**
 * Input for ASR step
 */
export interface AsrStepInput {
  audioPath: string;
  model: string;
  language?: string;
  enableDiarization: boolean;
  enableWordAlignment: boolean;
}

/**
 * Output from ASR step
 */
export interface AsrStepOutput {
  transcriptPath: string;
  segments: Array<{
    start: number;
    end: number;
    text: string;
    speaker?: string;
  }>;
  language: string;
}

/**
 * Input for topic segmentation step
 */
export interface TopicStepInput {
  transcriptPath: string;
  llmModel: string;
  levels: number;
  minSegmentDuration: number;
  maxSegmentDuration: number;
}

/**
 * Output from topic segmentation step
 */
export interface TopicStepOutput {
  topicsPath: string;
  topics: Array<{
    id: string;
    level: number;
    start: number;
    end: number;
    title: string;
    summary: string;
    keywords: string[];
  }>;
}

/**
 * Input for embeddings/graph step
 */
export interface EmbeddingsGraphStepInput {
  topicsPath: string;
  transcriptPath: string;
  embeddingModel: string;
  similarityThreshold: number;
}

/**
 * Output from embeddings/graph step
 */
export interface EmbeddingsGraphStepOutput {
  embeddingsPath: string;
  graphPath: string;
  edges: Array<{
    source: string;
    target: string;
    type: string;
    weight: number;
  }>;
}

/**
 * Input for snippet generation step
 */
export interface SnippetStepInput {
  videoPath: string;
  topicsPath: string;
  outputDir: string;
  quality: string;
  generateThumbnails: boolean;
  generateCaptions: boolean;
}

/**
 * Output from snippet generation step
 */
export interface SnippetStepOutput {
  snippets: Array<{
    topicId: string;
    videoPath: string;
    thumbnailPath?: string;
    captionPath?: string;
    start: number;
    end: number;
  }>;
}

/**
 * Input for export generation step
 */
export interface ExportStepInput {
  videoId: string;
  graphVersionId: string;
  topicsPath: string;
  snippetsDir: string;
  exportType: string;
  options: Record<string, unknown>;
  outputDir: string;
}

/**
 * Output from export generation step
 */
export interface ExportStepOutput {
  exportPath: string;
  exportUrl: string;
  format: string;
  size: number;
}
