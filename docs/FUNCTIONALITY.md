# Functionality Documentation

## Core Functions

### Video Processing Pipeline

```
┌─────────────┐   ┌──────────┐   ┌──────────┐   ┌──────────┐   ┌──────────┐
│   Input     │──▶│  Video   │──▶│   ASR    │──▶│  Topic   │──▶│  Graph   │
│   Video     │   │   Step   │   │   Step   │   │   Step   │   │   Step   │
└─────────────┘   └──────────┘   └──────────┘   └──────────┘   └──────────┘
     │                                              │               │
     │                                              ▼               ▼
     │                                         ┌──────────┐   ┌──────────┐
     │                                         │  LLM     │   │ Embeddings│
     │                                         │ Summarize│   │  + Edges  │
     │                                         └──────────┘   └──────────┘
     │
     ▼
┌─────────────┐
│   Output    │
│ Topic Graph │
└─────────────┘
```

### 1. Video Ingestion

**Function**: `submitVideo(url, type, config)`

**Process**:
1. Validate URL format and accessibility
2. Check user quota
3. Create video record in database
4. Create graph version record
5. Queue job for processing
6. Return job ID for status tracking

**Input**:
- Video URL (YouTube, Vimeo, or direct)
- Source type identifier
- Optional pipeline configuration overrides

**Output**:
- Video ID
- Job ID
- Initial status (pending)

### 2. Audio Extraction & Normalization

**Function**: `processVideo(manifest, context)`

**Process**:
1. Download video using yt-dlp or HTTP
2. Extract to normalized format (H.264/AAC)
3. Extract audio to 16kHz mono WAV
4. Optional: Detect scenes
5. Update manifest with paths

**Tools**: ffmpeg, ffprobe, yt-dlp

**Output Files**:
- `video_original` - Raw downloaded video
- `video_normalized` - H.264/AAC MP4
- `audio_wav` - 16kHz mono WAV
- `scenes` - Scene detection results (optional)

### 3. Speech Recognition (ASR)

**Function**: `transcribe(manifest, context)`

**Process**:
1. Load ASR model (Whisper/Faster-Whisper)
2. Transcribe audio
3. Optional: Perform speaker diarization
4. Optional: Generate word-level alignment
5. Save transcript segments

**Models**:
- tiny (39M params) - Fast, less accurate
- base (74M params) - Balanced
- small (244M params) - Good accuracy
- medium (769M params) - Better accuracy
- large-v1/v2/v3 (1550M params) - Best accuracy

**Output**:
- Transcript JSON with segments
- Word alignment JSON (optional)
- Diarization JSON (optional)

### 4. Topic Segmentation

**Function**: `generateTopics(manifest, context)`

**Process**:

**Pass A - Micro-Segmentation**:
1. Compute embeddings for each transcript segment
2. Detect boundaries using:
   - Pause duration (> 2 seconds)
   - Embedding similarity drops
   - Sentence boundaries

**Pass B - Hierarchical Merging**:
1. Group micro-segments into level 0 topics
2. Iteratively merge similar topics upward
3. Generate titles via LLM
4. Generate summaries via LLM
5. Extract keywords
6. Compute importance scores

**LLM Prompts**:

```
Title Generation:
"Generate a concise title (5-10 words) for the following content:
{content}
Title:"

Summary Generation:
"Summarize the following content in 2-3 sentences:
{content}
Summary:"

Keyword Extraction:
"Extract 5-10 relevant keywords from:
{content}
Keywords:"
```

**Output**:
- Topics JSON with hierarchy
- Parent-child relationships
- Importance scores

### 5. Graph Construction

**Function**: `buildGraph(manifest, context)`

**Process**:
1. Generate topic embeddings
2. Build semantic edges (KNN)
3. Build hierarchy edges
4. Build sequence edges
5. Build reference edges (optional)
6. Prune edges based on thresholds
7. Cluster topics (optional)
8. Compute graph metrics

**Edge Types**:

| Type | Created By | Weight |
|------|------------|--------|
| Semantic | KNN similarity | cos(θ) |
| Hierarchy | Parent-child | 1.0 |
| Sequence | Time adjacency | 0.8 |
| Reference | Keyword overlap | shared/total |

**Output**:
- Embeddings JSON
- Graph JSON (nodes + edges)
- Graph metrics

### 6. Snippet Generation

**Function**: `generateSnippets(manifest, context)`

**Process**:
1. For each topic:
   - Extract video segment with padding
   - Generate thumbnail at midpoint
   - Generate captions (VTT/SRT)
2. Store in object storage
3. Update manifest

**Quality Levels**:
- Low: 480p, CRF 28
- Medium: 720p, CRF 23
- High: 1080p, CRF 18

**Output**:
- Video snippets (MP4/WebM)
- Thumbnails (JPG/PNG)
- Captions (VTT/SRT)

### 7. Export Generation

**Function**: `generateExport(manifest, context)`

**Formats**:

**PPTX**:
- Title slide
- Topic slides (title, summary, keywords)
- Embedded or linked video snippets
- Appendix with graph metrics

**HTML (Reveal.js)**:
- Interactive presentation
- Embedded video players
- Navigation controls
- Responsive design

**PDF**:
- Static document
- Topic summaries
- Screenshots of graph
- Metrics appendix

### 8. Semantic Search

**Function**: `searchTopics(query, filters, options)`

**Process**:
1. Generate query embedding
2. Perform vector similarity search
3. Apply filters (level, importance, date)
4. Return ranked results

**Vector Search Query**:
```sql
SELECT *, 1 - (embedding <=> query_embedding) as similarity
FROM topic_nodes
WHERE video_id IN (accessible_videos)
ORDER BY embedding <=> query_embedding
LIMIT top_k
```

### 9. Deep Search

**Function**: `deepSearch(query, context)`

**Process**:
1. Perform semantic search to get candidate topics
2. Use LLM to synthesize answer
3. Generate cross-references
4. Return structured response

**LLM Prompt**:
```
Based on the following topics from a video, answer the user's question.

Topics:
{topic_summaries}

Question: {query}

Answer:
```

## API Functions

### Authentication

```typescript
// Verify JWT token
authenticate(token: string): Promise<User>

// Check resource access
checkAccess(resourceId: string, userId: string, role: Role): Promise<boolean>
```

### Video Management

```typescript
// Submit video for analysis
analyzeVideo(request: VideoAnalyzeRequest): Promise<VideoResponse>

// List user's videos
listVideos(filters: VideoFilters): Promise<PaginatedVideos>

// Get video details
getVideo(videoId: string): Promise<VideoDetailResponse>

// Delete video
deleteVideo(videoId: string): Promise<void>

// Get video status
getVideoStatus(videoId: string): Promise<VideoStatusResponse>

// Get transcript
getTranscript(videoId: string, filters: TranscriptFilters): Promise<TranscriptResponse>
```

### Graph Operations

```typescript
// Get video graph
getVideoGraph(videoId: string, options: GraphOptions): Promise<GraphResponse>

// Get graph by ID
getGraph(graphId: string): Promise<GraphResponse>

// Delete graph
deleteGraph(graphId: string): Promise<void>

// Fork graph
forkGraph(graphId: string, request: ForkRequest): Promise<GraphResponse>

// List graph versions
listGraphVersions(graphId: string): Promise<GraphVersionListResponse>
```

### Topic Operations

```typescript
// Get topic
getTopic(topicId: string): Promise<TopicResponse>

// Update topic
updateTopic(topicId: string, updates: UpdateTopicRequest): Promise<TopicResponse>

// Get topic snippets
getTopicSnippets(topicId: string): Promise<SnippetListResponse>

// Merge topics
mergeTopics(request: MergeTopicsRequest): Promise<TopicResponse>

// Split topic
splitTopic(topicId: string, request: SplitTopicRequest): Promise<TopicResponse[]>
```

### Search

```typescript
// Semantic search
searchTopics(request: SearchRequest): Promise<SearchResponse>

// Deep search
deepSearch(request: DeepSearchRequest): Promise<DeepSearchResponse>
```

### Export

```typescript
// Create export
createExport(request: CreateExportRequest): Promise<ExportResponse>

// Get export
getExport(exportId: string): Promise<ExportResponse>

// Download export
downloadExport(exportId: string): Promise<Stream>
```

### Quota

```typescript
// Get user quota
getQuota(userId: string): Promise<QuotaResponse>

// Check quota before operation
checkQuota(userId: string, operation: Operation): Promise<boolean>
```

### Sharing

```typescript
// Create share
createShare(request: CreateShareRequest): Promise<ShareResponse>

// Get shared resource (public)
getSharedResource(token: string, password?: string): Promise<SharedResourceResponse>

// Revoke share
revokeShare(token: string): Promise<void>
```

### Jobs

```typescript
// Get job status
getJobStatus(jobId: string): Promise<JobStatusResponse>

// Cancel job
cancelJob(jobId: string): Promise<void>
```

## Database Functions

### Vector Operations

```sql
-- Insert topic with embedding
INSERT INTO topic_nodes (id, video_id, embedding, ...)
VALUES ($1, $2, $3::vector, ...)

-- Vector similarity search
SELECT *, 1 - (embedding <=> $1::vector) as similarity
FROM topic_nodes
ORDER BY embedding <=> $1::vector
LIMIT $2

-- Find nearest neighbors
SELECT * FROM topic_nodes
ORDER BY embedding <-> $1::vector
LIMIT $2
```

### Graph Queries

```sql
-- Get topic with edges
SELECT t.*, 
  json_agg(e.*) as edges
FROM topic_nodes t
LEFT JOIN topic_edges e ON t.id = e.src_topic_id
WHERE t.graph_version_id = $1
GROUP BY t.id

-- Get graph metrics
SELECT 
  COUNT(*) as node_count,
  (SELECT COUNT(*) FROM topic_edges WHERE graph_version_id = $1) as edge_count
FROM topic_nodes
WHERE graph_version_id = $1
```

## Worker Functions

### Job Processing

```typescript
// Process video analysis job
processVideoAnalysis(job: VideoAnalysisJob): Promise<PipelineResult>

// Process export job
processExport(job: ExportJob): Promise<ExportResult>

// Process snippet generation job
processSnippetGeneration(job: SnippetJob): Promise<SnippetResult>
```

### Pipeline Execution

```typescript
// Execute pipeline with steps
executePipeline(
  manifest: ArtifactManifest,
  context: PipelineContext,
  steps: string[]
): Promise<PipelineResult>

// Execute single step
executeStep(
  step: PipelineStep,
  manifest: ArtifactManifest,
  context: PipelineContext
): Promise<ArtifactManifest>
```

## Utility Functions

### Date/Time

```typescript
// Format timestamp to HH:MM:SS
formatTimestamp(seconds: number): string

// Format duration
duration(seconds: number): string  // "1h 23m 45s"
```

### Storage

```typescript
// Generate presigned URL
getPresignedUrl(path: string, expiresIn: number): Promise<string>

// Stream file from storage
streamFile(path: string): ReadableStream
```

### Validation

```typescript
// Validate UUID
isValidUUID(id: string): boolean

// Validate URL
isValidURL(url: string): boolean

// Validate video URL
isValidVideoURL(url: string): boolean
```
