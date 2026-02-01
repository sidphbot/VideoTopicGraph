/**
 * TypeScript types generated from OpenAPI specification
 * Video Topic Graph Platform API v1.0.0
 */

// ==================== Enums ====================

export type VideoStatus = 
  | 'pending'
  | 'downloading'
  | 'processing'
  | 'analyzing'
  | 'generating_graph'
  | 'completed'
  | 'failed'
  | 'cancelled';

export type SourceType = 'youtube' | 'vimeo' | 'direct' | 'file';

export type AsrModel = 'whisper' | 'faster-whisper' | 'whisper-cpp';

export type EmbeddingModel = 'all-MiniLM-L6-v2' | 'all-mpnet-base-v2' | 'ollama-nomic';

export type LlmModel = 'llama2' | 'mistral' | 'mixtral' | 'ollama-phi';

export type SnippetQuality = 'low' | 'medium' | 'high';

export type EdgeType = 'semantic' | 'hierarchy' | 'sequence' | 'reference';

export type ExportType = 'pptx' | 'html' | 'pdf';

export type ExportStatus = 'pending' | 'processing' | 'complete' | 'error';

export type JobType = 'video_analysis' | 'export' | 'snippet_generation';

export type JobStatus = 'pending' | 'running' | 'paused' | 'completed' | 'failed' | 'cancelled';

export type ShareScope = 'view' | 'comment' | 'edit';

export type ResourceType = 'video' | 'graph' | 'topic';

export type GraphStatus = 'processing' | 'complete' | 'error';

// ==================== Request Types ====================

export interface VideoAnalyzeRequest {
  source_url: string;
  source_type?: SourceType;
  config?: PipelineConfig;
  metadata?: Record<string, unknown>;
}

export interface PipelineConfig {
  asr_model?: AsrModel;
  asr_language?: string;
  enable_diarization?: boolean;
  enable_scene_detection?: boolean;
  topic_levels?: number;
  embedding_model?: EmbeddingModel;
  llm_model?: LlmModel;
  snippet_quality?: SnippetQuality;
}

export interface ForkGraphRequest {
  notes?: string;
  topic_modifications?: TopicModification[];
}

export interface TopicModification {
  topic_id: string;
  action: 'update' | 'delete' | 'merge_source' | 'merge_target';
  updates?: UpdateTopicRequest;
}

export interface UpdateTopicRequest {
  title?: string;
  summary?: string;
  keywords?: string[];
  importance_score?: number;
}

export interface MergeTopicsRequest {
  topic_ids: string[];
  new_title?: string;
}

export interface SplitTopicRequest {
  split_at_ts: number;
  new_titles?: [string, string];
}

export interface SearchFilters {
  level?: number;
  min_importance?: number;
  date_from?: string;
  date_to?: string;
}

export interface SearchOptions {
  include_transcripts?: boolean;
  include_edges?: boolean;
  top_k?: number;
}

export interface SearchRequest {
  query: string;
  video_ids?: string[];
  filters?: SearchFilters;
  options?: SearchOptions;
}

export interface DeepSearchContext {
  include_synthesis?: boolean;
  include_cross_references?: boolean;
  max_topics_to_analyze?: number;
}

export interface DeepSearchRequest {
  query: string;
  video_ids?: string[];
  context?: DeepSearchContext;
}

export interface ExportOptions {
  include_snippets?: boolean;
  snippet_embed_mode?: 'embedded' | 'linked' | 'none';
  template?: 'default' | 'minimal' | 'detailed';
  topic_levels?: number[];
  include_appendix?: boolean;
}

export interface CreateExportRequest {
  video_id: string;
  graph_version_id?: string;
  type: ExportType;
  options?: ExportOptions;
}

export interface CreateShareRequest {
  resource_type: ResourceType;
  resource_id: string;
  scope?: ShareScope;
  expires_at?: string;
  password?: string;
}

// ==================== Response Types ====================

export interface VideoResponse {
  id: string;
  source_url: string;
  source_type: SourceType;
  status: VideoStatus;
  duration_s: number | null;
  created_at: string;
  job_id: string | null;
}

export interface GraphSummary {
  id: string;
  version: number;
  status: GraphStatus;
  nodes_count: number;
  edges_count: number;
}

export interface VideoMetadata {
  title?: string;
  description?: string;
  thumbnail_url?: string;
}

export interface VideoDetailResponse extends VideoResponse {
  metadata: VideoMetadata;
  graph: GraphSummary;
  transcript_segments_count: number;
  topics_count: number;
  versions_count: number;
}

export interface Pagination {
  page: number;
  limit: number;
  total: number;
  total_pages: number;
}

export interface VideoListResponse {
  items: VideoResponse[];
  pagination: Pagination;
}

export interface TopicNode {
  id: string;
  level: number;
  start_ts: number;
  end_ts: number;
  title: string;
  summary: string;
  keywords: string[];
  parent_ids: string[];
  child_ids: string[];
  importance_score: number;
  cluster_id: string | null;
}

export interface TopicEdge {
  id: string;
  src_topic_id: string;
  dst_topic_id: string;
  edge_type: EdgeType;
  distance: number;
  weight: number;
  metadata?: Record<string, unknown>;
}

export interface LevelMetrics {
  level: number;
  node_count: number;
}

export interface GraphMetrics {
  node_count: number;
  edge_count: number;
  density: number;
  avg_clustering: number;
  connected_components: number;
  levels: LevelMetrics[];
}

export interface GraphResponse {
  id: string;
  video_id: string;
  version: number;
  parent_version_id: string | null;
  status: GraphStatus;
  nodes: TopicNode[];
  edges: TopicEdge[];
  metrics: GraphMetrics;
  created_at: string;
  updated_at: string;
}

export interface GraphVersionItem {
  id: string;
  version: number;
  parent_version_id: string | null;
  status: GraphStatus;
  nodes_count: number;
  created_by: string;
  created_at: string;
  notes: string | null;
}

export interface GraphVersionListResponse {
  items: GraphVersionItem[];
}

export interface Snippet {
  id: string;
  topic_id: string;
  start_ts: number;
  end_ts: number;
  duration_s: number;
  video_url: string;
  thumbnail_url: string | null;
  caption_url: string | null;
  created_at: string;
}

export interface TopicResponse {
  id: string;
  video_id: string;
  level: number;
  start_ts: number;
  end_ts: number;
  title: string;
  summary: string;
  keywords: string[];
  parent_ids: string[];
  child_ids: string[];
  importance_score: number;
  cluster_id: string | null;
  snippets: Snippet[];
  created_at: string;
  updated_at: string;
}

export interface SnippetListResponse {
  items: Snippet[];
}

export interface SearchResult {
  topic: TopicNode;
  score: number;
  matched_transcript: string | null;
  highlight: string | null;
}

export interface SearchResponse {
  query: string;
  results: SearchResult[];
  total: number;
  took_ms: number;
}

export interface CrossReference {
  topic_a_id: string;
  topic_b_id: string;
  relationship: string;
}

export interface DeepSearchResponse {
  query: string;
  answer: string;
  sources: SearchResult[];
  synthesis: string | null;
  cross_references: CrossReference[];
  took_ms: number;
}

export interface ExportResponse {
  id: string;
  video_id: string;
  type: ExportType;
  status: ExportStatus;
  storage_path: string | null;
  download_url: string | null;
  expires_at: string | null;
  created_at: string;
  completed_at: string | null;
  error: string | null;
}

export interface QuotaPolicy {
  max_videos_per_month: number;
  max_storage_gb: number;
  max_public_links: number;
  max_versions_per_video: number;
}

export interface QuotaUsage {
  videos_this_month: number;
  storage_gb: number;
  public_links: number;
  versions_total: number;
}

export interface QuotaResponse {
  policy: QuotaPolicy;
  usage: QuotaUsage;
  reset_date: string;
}

export interface ShareResponse {
  token: string;
  url: string;
  resource_type: ResourceType;
  resource_id: string;
  scope: ShareScope;
  expires_at: string | null;
  created_at: string;
}

export interface SharedResourceResponse {
  resource_type: ResourceType;
  resource: VideoDetailResponse | GraphResponse | TopicResponse;
  scope: ShareScope;
}

export interface WordAlignment {
  word: string;
  start_ts: number;
  end_ts: number;
  confidence: number | null;
}

export interface TranscriptSegment {
  id: string;
  start_ts: number;
  end_ts: number;
  speaker_id: string | null;
  text: string;
  words: WordAlignment[] | null;
}

export interface TranscriptResponse {
  video_id: string;
  segments: TranscriptSegment[];
  total: number;
}

export interface VideoStage {
  name: string;
  status: JobStatus;
  progress: number;
}

export interface VideoStatusResponse {
  video_id: string;
  status: VideoStatus;
  progress: number;
  current_stage: string;
  stages: VideoStage[];
  error: string | null;
  estimated_completion: string | null;
}

export interface JobStep {
  name: string;
  status: JobStatus;
  started_at: string | null;
  completed_at: string | null;
  error: string | null;
}

export interface ManifestPaths {
  video_original?: string;
  video_normalized?: string;
  audio_wav?: string;
  transcript?: string;
  topics?: string;
  embeddings?: string;
  graph?: string;
  snippets?: string[];
  exports?: string[];
}

export interface ManifestMetrics {
  duration_s?: number;
  transcript_segments?: number;
  topic_count?: number;
  edge_count?: number;
  processing_time_ms?: number;
}

export interface ArtifactManifest {
  video_id: string;
  graph_version_id: string;
  job_id: string;
  paths: ManifestPaths;
  metrics: ManifestMetrics;
  config_snapshot: PipelineConfig;
  created_at: string;
  updated_at: string;
}

export interface JobStatusResponse {
  id: string;
  type: JobType;
  status: JobStatus;
  progress: number;
  current_step: string | null;
  steps: JobStep[];
  created_at: string;
  started_at: string | null;
  completed_at: string | null;
  error: string | null;
  manifest: ArtifactManifest | null;
}

// ==================== Error Types ====================

export interface ApiError {
  code: string;
  message: string;
  details?: Record<string, unknown>;
  request_id?: string;
}

// ==================== Utility Types ====================

export type PaginatedResponse<T> = {
  items: T[];
  pagination: Pagination;
};
