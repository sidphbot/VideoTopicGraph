/**
 * Zod Schemas for Data Validation
 * 
 * These schemas define the shape of all data structures in the system
 * and provide runtime validation.
 */

import { z } from 'zod';

// ==================== Common Schemas ====================

export const UuidSchema = z.string().uuid();

export const TimestampSchema = z.number().nonnegative();

export const DateTimeSchema = z.string().datetime();

export const UrlSchema = z.string().url();

// ==================== Enums ====================

export const VideoStatusEnum = z.enum([
  'pending',
  'downloading',
  'processing',
  'analyzing',
  'generating_graph',
  'completed',
  'failed',
  'cancelled'
]);

export const SourceTypeEnum = z.enum(['youtube', 'vimeo', 'direct', 'file']);

export const AsrModelEnum = z.enum(['whisper', 'faster-whisper', 'whisper-cpp']);

export const EmbeddingModelEnum = z.enum(['all-MiniLM-L6-v2', 'all-mpnet-base-v2', 'ollama-nomic']);

export const LlmModelEnum = z.enum(['llama2', 'mistral', 'mixtral', 'ollama-phi']);

export const SnippetQualityEnum = z.enum(['low', 'medium', 'high']);

export const EdgeTypeEnum = z.enum(['semantic', 'hierarchy', 'sequence', 'reference']);

export const ExportTypeEnum = z.enum(['pptx', 'html', 'pdf']);

export const ExportStatusEnum = z.enum(['pending', 'processing', 'complete', 'error']);

export const JobTypeEnum = z.enum(['video_analysis', 'export', 'snippet_generation']);

export const JobStatusEnum = z.enum(['pending', 'running', 'paused', 'completed', 'failed', 'cancelled']);

export const ShareScopeEnum = z.enum(['view', 'comment', 'edit']);

export const ResourceTypeEnum = z.enum(['video', 'graph', 'topic']);

export const GraphStatusEnum = z.enum(['processing', 'complete', 'error']);

// ==================== Pipeline Config Schema ====================

export const PipelineConfigSchema = z.object({
  asr_model: AsrModelEnum.optional(),
  asr_language: z.string().length(2).optional(),
  enable_diarization: z.boolean().default(false),
  enable_scene_detection: z.boolean().default(false),
  topic_levels: z.number().int().min(1).max(5).default(3),
  embedding_model: EmbeddingModelEnum.optional(),
  llm_model: LlmModelEnum.optional(),
  snippet_quality: SnippetQualityEnum.default('medium'),
  // Advanced options
  topic_merge_threshold: z.number().min(0).max(1).default(0.85),
  edge_similarity_threshold: z.number().min(0).max(1).default(0.75),
  min_segment_duration_s: z.number().min(0).default(5),
  max_segment_duration_s: z.number().min(0).default(300),
  importance_centrality_weight: z.number().min(0).max(1).default(0.3),
  importance_duration_weight: z.number().min(0).max(1).default(0.3),
  importance_novelty_weight: z.number().min(0).max(1).default(0.4),
});

export type PipelineConfig = z.infer<typeof PipelineConfigSchema>;

// ==================== Entity Schemas ====================

export const VideoSchema = z.object({
  id: UuidSchema,
  source_url: UrlSchema,
  source_type: SourceTypeEnum,
  duration_s: z.number().nonnegative().nullable(),
  status: VideoStatusEnum,
  metadata: z.record(z.unknown()).default({}),
  created_by: z.string(),
  created_at: DateTimeSchema,
  updated_at: DateTimeSchema,
});

export type Video = z.infer<typeof VideoSchema>;

export const TranscriptSegmentSchema = z.object({
  id: UuidSchema,
  video_id: UuidSchema,
  start_ts: TimestampSchema,
  end_ts: TimestampSchema,
  speaker_id: z.string().nullable(),
  text: z.string(),
  embedding: z.array(z.number()).nullable().optional(),
  confidence: z.number().min(0).max(1).optional(),
  words: z.array(z.object({
    word: z.string(),
    start_ts: TimestampSchema,
    end_ts: TimestampSchema,
    confidence: z.number().min(0).max(1).optional(),
  })).optional(),
});

export type TranscriptSegment = z.infer<typeof TranscriptSegmentSchema>;

export const TopicNodeSchema = z.object({
  id: UuidSchema,
  video_id: UuidSchema,
  graph_version_id: UuidSchema,
  level: z.number().int().nonnegative(),
  start_ts: TimestampSchema,
  end_ts: TimestampSchema,
  title: z.string().max(200),
  summary: z.string().max(5000),
  keywords: z.array(z.string()).max(20),
  parent_ids: z.array(UuidSchema).default([]),
  child_ids: z.array(UuidSchema).default([]),
  embedding: z.array(z.number()).nullable().optional(),
  importance_score: z.number().min(0).max(1).default(0.5),
  cluster_id: z.string().nullable(),
  transcript_segment_ids: z.array(UuidSchema).default([]),
  created_at: DateTimeSchema,
  updated_at: DateTimeSchema,
});

export type TopicNode = z.infer<typeof TopicNodeSchema>;

export const TopicEdgeSchema = z.object({
  id: UuidSchema,
  video_id: UuidSchema,
  graph_version_id: UuidSchema,
  src_topic_id: UuidSchema,
  dst_topic_id: UuidSchema,
  edge_type: EdgeTypeEnum,
  distance: z.number().nonnegative(),
  weight: z.number().min(0).max(1),
  metadata: z.record(z.unknown()).default({}),
});

export type TopicEdge = z.infer<typeof TopicEdgeSchema>;

export const SnippetSchema = z.object({
  id: UuidSchema,
  topic_id: UuidSchema,
  video_id: UuidSchema,
  start_ts: TimestampSchema,
  end_ts: TimestampSchema,
  storage_path: z.string(),
  thumbnail_path: z.string().nullable(),
  caption_path: z.string().nullable(),
  format: z.enum(['mp4', 'webm']).default('mp4'),
  resolution: z.string().default('720p'),
  created_at: DateTimeSchema,
});

export type Snippet = z.infer<typeof SnippetSchema>;

export const ExportSchema = z.object({
  id: UuidSchema,
  video_id: UuidSchema,
  graph_version_id: UuidSchema.nullable(),
  type: ExportTypeEnum,
  status: ExportStatusEnum,
  storage_path: z.string().nullable(),
  options: z.record(z.unknown()).default({}),
  error: z.string().nullable(),
  created_by: z.string(),
  created_at: DateTimeSchema,
  completed_at: DateTimeSchema.nullable(),
});

export type Export = z.infer<typeof ExportSchema>;

export const GraphVersionSchema = z.object({
  id: UuidSchema,
  video_id: UuidSchema,
  version: z.number().int().positive(),
  parent_version_id: UuidSchema.nullable(),
  created_by: z.string(),
  status: GraphStatusEnum,
  notes: z.string().nullable(),
  config_snapshot: PipelineConfigSchema,
  created_at: DateTimeSchema,
});

export type GraphVersion = z.infer<typeof GraphVersionSchema>;

export const ShareSchema = z.object({
  token: z.string(),
  resource_type: ResourceTypeEnum,
  resource_id: UuidSchema,
  created_by: z.string(),
  scope: ShareScopeEnum,
  expires_at: DateTimeSchema.nullable(),
  password_hash: z.string().nullable(),
  created_at: DateTimeSchema,
});

export type Share = z.infer<typeof ShareSchema>;

export const QuotaPolicySchema = z.object({
  id: z.string(),
  name: z.string(),
  max_videos_per_month: z.number().int().nonnegative(),
  max_storage_gb: z.number().nonnegative(),
  max_public_links: z.number().int().nonnegative(),
  max_versions_per_video: z.number().int().nonnegative(),
  max_video_duration_minutes: z.number().int().nonnegative().default(120),
  allowed_models: z.array(z.string()).default([]),
  created_at: DateTimeSchema,
});

export type QuotaPolicy = z.infer<typeof QuotaPolicySchema>;

export const UserQuotaSchema = z.object({
  user_id: z.string(),
  policy_id: z.string(),
  videos_this_month: z.number().int().nonnegative().default(0),
  storage_bytes: z.number().nonnegative().default(0),
  public_links: z.number().int().nonnegative().default(0),
  month_reset_at: DateTimeSchema,
  updated_at: DateTimeSchema,
});

export type UserQuota = z.infer<typeof UserQuotaSchema>;

// ==================== Job Queue Schemas ====================

export const JobSchema = z.object({
  id: UuidSchema,
  type: JobTypeEnum,
  status: JobStatusEnum,
  payload: z.record(z.unknown()),
  priority: z.number().int().min(0).max(10).default(5),
  attempts: z.number().int().nonnegative().default(0),
  max_attempts: z.number().int().positive().default(3),
  error: z.string().nullable(),
  started_at: DateTimeSchema.nullable(),
  completed_at: DateTimeSchema.nullable(),
  created_at: DateTimeSchema,
  updated_at: DateTimeSchema,
});

export type Job = z.infer<typeof JobSchema>;

// ==================== ACL Schemas ====================

export const AclEntrySchema = z.object({
  id: UuidSchema,
  resource_type: ResourceTypeEnum,
  resource_id: UuidSchema,
  user_id: z.string(),
  role: z.enum(['owner', 'editor', 'viewer']),
  created_by: z.string(),
  created_at: DateTimeSchema,
});

export type AclEntry = z.infer<typeof AclEntrySchema>;

// ==================== Search Schemas ====================

export const SearchQuerySchema = z.object({
  query: z.string().min(1).max(1000),
  video_ids: z.array(UuidSchema).optional(),
  filters: z.object({
    level: z.number().int().optional(),
    min_importance: z.number().min(0).max(1).optional(),
    date_from: DateTimeSchema.optional(),
    date_to: DateTimeSchema.optional(),
  }).optional(),
  options: z.object({
    include_transcripts: z.boolean().default(false),
    include_edges: z.boolean().default(false),
    top_k: z.number().int().min(1).max(100).default(10),
  }).optional(),
});

export type SearchQuery = z.infer<typeof SearchQuerySchema>;

// ==================== API Request Schemas ====================

export const VideoAnalyzeRequestSchema = z.object({
  source_url: UrlSchema,
  source_type: SourceTypeEnum.default('direct'),
  config: PipelineConfigSchema.optional(),
  metadata: z.record(z.unknown()).optional(),
});

export type VideoAnalyzeRequest = z.infer<typeof VideoAnalyzeRequestSchema>;

export const CreateExportRequestSchema = z.object({
  video_id: UuidSchema,
  graph_version_id: UuidSchema.optional(),
  type: ExportTypeEnum,
  options: z.object({
    include_snippets: z.boolean().default(true),
    snippet_embed_mode: z.enum(['embedded', 'linked', 'none']).default('linked'),
    template: z.enum(['default', 'minimal', 'detailed']).default('default'),
    topic_levels: z.array(z.number().int()).optional(),
    include_appendix: z.boolean().default(true),
  }).optional(),
});

export type CreateExportRequest = z.infer<typeof CreateExportRequestSchema>;

export const CreateShareRequestSchema = z.object({
  resource_type: ResourceTypeEnum,
  resource_id: UuidSchema,
  scope: ShareScopeEnum.default('view'),
  expires_at: DateTimeSchema.optional(),
  password: z.string().min(4).max(100).optional(),
});

export type CreateShareRequest = z.infer<typeof CreateShareRequestSchema>;
