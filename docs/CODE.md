# Code Documentation

Complete code-level documentation for the Video Topic Graph Platform.

## Table of Contents

1. [Architecture Overview](#architecture-overview)
2. [Package Structure](#package-structure)
3. [Service Architecture](#service-architecture)
4. [Pipeline SDK Deep Dive](#pipeline-sdk-deep-dive)
5. [Database Schema](#database-schema)
6. [API Implementation](#api-implementation)
7. [Worker Architecture](#worker-architecture)
8. [Frontend Architecture](#frontend-architecture)
9. [Key Algorithms](#key-algorithms)
10. [Error Handling](#error-handling)

---

## Architecture Overview

### System Architecture Diagram

```
┌─────────────────────────────────────────────────────────────────────────────┐
│                              CLIENT LAYER                                    │
├─────────────────────────────────────────────────────────────────────────────┤
│  ┌──────────────┐  ┌──────────────┐  ┌──────────────┐  ┌──────────────┐    │
│  │   Web UI     │  │ Android UI   │  │   iOS UI     │  │  CLI Tool    │    │
│  │   (React)    │  │  (Flutter)   │  │  (SwiftUI)   │  │   (Node)     │    │
│  └──────┬───────┘  └──────┬───────┘  └──────┬───────┘  └──────┬───────┘    │
└─────────┼─────────────────┼─────────────────┼─────────────────┼────────────┘
          │                 │                 │                 │
          └─────────────────┴─────────┬───────┴─────────────────┘
                                      │
                              ┌───────▼───────┐
                              │  API Gateway  │
                              │   (Fastify)   │
                              └───────┬───────┘
                                      │
┌─────────────────────────────────────┼──────────────────────────────────────┐
│                           SERVICE LAYER                                      │
├─────────────────────────────────────┼──────────────────────────────────────┤
│                                     │                                        │
│  ┌──────────────────────────────────┼──────────────────────────────────┐   │
│  │           REST API Service       │                                  │   │
│  │  ┌────────────┐ ┌────────────┐  │  ┌────────────┐ ┌────────────┐  │   │
│  │  │   Auth     │ │   Videos   │  │  │   Graph    │ │   Search   │  │   │
│  │  │  Handler   │ │  Handler   │  │  │  Handler   │ │  Handler   │  │   │
│  │  └────────────┘ └────────────┘  │  └────────────┘ └────────────┘  │   │
│  │  ┌────────────┐ ┌────────────┐  │  ┌────────────┐ ┌────────────┐  │   │
│  │  │   Jobs     │ │   Export   │  │  │   Admin    │ │  Health    │  │   │
│  │  │  Handler   │ │  Handler   │  │  │  Handler   │ │  Handler   │  │   │
│  │  └────────────┘ └────────────┘  │  └────────────┘ └────────────┘  │   │
│  └──────────────────────────────────┼──────────────────────────────────┘   │
│                                     │                                        │
│  ┌──────────────────────────────────┼──────────────────────────────────┐   │
│  │      Worker Orchestrator         │                                  │   │
│  │  ┌────────────┐ ┌────────────┐  │  ┌────────────┐ ┌────────────┐  │   │
│  │  │   Queue    │ │ Processor  │  │  │   Worker   │ │  Worker    │  │   │
│  │  │  Manager   │ │   Core     │  │  │  Pool #1   │ │  Pool #2   │  │   │
│  │  └────────────┘ └────────────┘  │  └────────────┘ └────────────┘  │   │
│  └──────────────────────────────────┼──────────────────────────────────┘   │
└─────────────────────────────────────┼──────────────────────────────────────┘
                                      │
┌─────────────────────────────────────┼──────────────────────────────────────┐
│                         PIPELINE SDK LAYER                                   │
├─────────────────────────────────────┼──────────────────────────────────────┤
│                                     │                                        │
│  ┌──────────────────────────────────┼──────────────────────────────────┐   │
│  │        Pipeline Orchestrator     │                                  │   │
│  │  ┌─────────┐ ┌─────────┐ ┌──────┴───┐ ┌─────────┐ ┌─────────┐     │   │
│  │  │  VIDEO  │ │   ASR   │ │  TOPICS  │ │ EMB/GR  │ │ SNIPPETS│     │   │
│  │  │  Step   │ │  Step   │ │   Step   │ │  Step   │ │  Step   │     │   │
│  │  └─────────┘ └─────────┘ └──────────┘ └─────────┘ └─────────┘     │   │
│  │  ┌─────────┐ ┌─────────┐ ┌──────────┐                             │   │
│  │  │  EXPORT │ │  Custom │ │  Custom  │  (Extensible Steps)         │   │
│  │  │  Step   │ │  Step A │ │  Step B  │                             │   │
│  │  └─────────┘ └─────────┘ └──────────┘                             │   │
│  └──────────────────────────────────┼──────────────────────────────────┘   │
└─────────────────────────────────────┼──────────────────────────────────────┘
                                      │
┌─────────────────────────────────────┼──────────────────────────────────────┐
│                      INFRASTRUCTURE LAYER                                    │
├─────────────────────────────────────┼──────────────────────────────────────┤
│                                     │                                        │
│  ┌──────────────┐  ┌──────────────┐ │ ┌──────────────┐  ┌──────────────┐   │
│  │  PostgreSQL  │  │    Redis     │ │ │    MinIO     │  │   Keycloak   │   │
│  │  + pgvector  │  │   (BullMQ)   │ │ │   (S3 API)   │  │    (OIDC)    │   │
│  └──────────────┘  └──────────────┘ │ └──────────────┘  └──────────────┘   │
│                                     │                                        │
│  ┌──────────────┐  ┌──────────────┐ │ ┌──────────────┐                     │
│  │   Ollama     │  │   Whisper    │ │ │  FFmpeg      │  (ML/Processing)   │
│  │   (LLM)      │  │   (ASR)      │ │ │  (Video)     │                     │
│  └──────────────┘  └──────────────┘ │ └──────────────┘                     │
└─────────────────────────────────────┴──────────────────────────────────────┘
```

---

## Package Structure

### `@video-graph/shared-types`

Core type definitions and Zod schemas used across all packages.

```typescript
// Key exports from schemas.ts

// Enums
export enum VideoStatus {
  PENDING = 'pending',
  PROCESSING = 'processing',
  COMPLETED = 'completed',
  FAILED = 'failed',
}

export enum PipelineStage {
  VIDEO = 'video',
  ASR = 'asr',
  TOPICS = 'topics',
  EMBEDDINGS = 'embeddings',
  GRAPH = 'graph',
  SNIPPETS = 'snippets',
  EXPORT = 'export',
}

// Core interfaces
export interface VideoSource {
  id: string;
  title: string;
  description?: string;
  originalUrl: string;
  status: VideoStatus;
  metadata?: VideoMetadata;
  createdAt: string;
  updatedAt: string;
}

export interface ArtifactManifest {
  version: string;  // Semantic version
  videoId: string;
  jobId: string;
  artifacts: Record<string, Record<string, ArtifactReference>>;
  metadata: ManifestMetadata;
}
```

### `@video-graph/pipeline-sdk`

The Pipeline SDK provides a framework for building modular, swappable pipeline steps.

#### Core Classes

**BasePipelineStep**

```typescript
abstract class BasePipelineStep {
  abstract readonly stage: PipelineStage;
  abstract readonly name: string;
  config: StepConfig;

  // Core lifecycle methods
  abstract execute(context: StepContext): Promise<StepResult>;
  abstract validateContext(context: StepContext): Promise<boolean>;
  
  // Retry logic with exponential backoff
  async executeWithRetry(context: StepContext): Promise<StepResult>;
  
  // Cleanup resources
  async cleanup(context: StepContext): Promise<void>;
  
  // Result handlers
  async onSuccess(manifest: ArtifactManifest, result: StepResult): Promise<void>;
  async onFailure(manifest: ArtifactManifest, error: Error): Promise<void>;
}
```

**PipelineOrchestrator**

```typescript
class PipelineOrchestrator {
  private steps: Map<PipelineStage, BasePipelineStep>;
  
  registerStep(stage: PipelineStage, step: BasePipelineStep): void;
  getStep(stage: PipelineStage): BasePipelineStep | undefined;
  
  // Execute single stage
  async executeStage(
    stage: PipelineStage, 
    context: StepContext
  ): Promise<StepResult>;
  
  // Execute full pipeline
  async executePipeline(
    videoId: string,
    jobId: string,
    manifest: ArtifactManifest,
    config?: Record<string, any>
  ): Promise<PipelineResult>;
  
  // Resume from partial completion
  async resumePipeline(
    manifest: ArtifactManifest
  ): Promise<PipelineResult>;
}
```

---

## Service Architecture

### API Service (`services/api`)

#### Route Handlers

**Video Routes** (`src/routes/videos.ts`)

```typescript
// POST /api/v1/videos - Create video
async function createVideo(request: FastifyRequest, reply: FastifyReply) {
  const body = request.body as CreateVideoBody;
  
  // Validate URL format
  // Check for duplicates
  // Insert into database
  // Return created video
}

// GET /api/v1/videos - List videos with pagination
async function listVideos(request: FastifyRequest, reply: FastifyReply) {
  const { limit, offset, status, search } = request.query;
  
  // Build query with filters
  // Apply pagination
  // Return paginated results
}

// POST /api/v1/videos/:id/process - Start processing
async function processVideo(request: FastifyRequest, reply: FastifyReply) {
  const { id } = request.params;
  const { stages, priority } = request.body;
  
  // Validate video exists
  // Create pipeline job
  // Queue job in BullMQ
  // Return job ID
}
```

**Graph Routes** (`src/routes/graph.ts`)

```typescript
// GET /api/v1/videos/:id/graph - Get full graph
async function getGraph(request: FastifyRequest, reply: FastifyReply) {
  const { id } = request.params;
  
  // Fetch nodes from database
  // Fetch edges from database
  // Build graph structure
  // Return graph JSON
}

// POST /api/v1/videos/:id/nodes - Create node
async function createNode(request: FastifyRequest, reply: FastifyReply) {
  const { id } = request.params;
  const nodeData = request.body;
  
  // Validate video exists
  // Generate embedding if content provided
  // Insert node
  // Return created node
}
```

**Search Routes** (`src/routes/search.ts`)

```typescript
// POST /api/v1/search - Semantic/fulltext search
async function search(request: FastifyRequest, reply: FastifyReply) {
  const { query, searchType, filters, limit } = request.body;
  
  switch (searchType) {
    case 'semantic':
      return await semanticSearch(query, filters, limit);
    case 'fulltext':
      return await fulltextSearch(query, filters, limit);
    case 'hybrid':
      return await hybridSearch(query, filters, limit);
  }
}

async function semanticSearch(query: string, filters: Filters, limit: number) {
  // Generate query embedding
  // Perform vector similarity search with pgvector
  // Apply filters
  // Return ranked results
}
```

### Database Schema (`services/api/src/db/schema.ts`)

```typescript
// Videos table
export const videos = pgTable('videos', {
  id: uuid('id').primaryKey().defaultRandom(),
  title: varchar('title', { length: 255 }).notNull(),
  description: text('description'),
  originalUrl: text('original_url').notNull(),
  status: videoStatusEnum('status').notNull().default('pending'),
  metadata: jsonb('metadata'),
  createdAt: timestamp('created_at').defaultNow(),
  updatedAt: timestamp('updated_at').defaultNow(),
});

// Topic nodes table with vector embedding
export const topicNodes = pgTable('topic_nodes', {
  id: uuid('id').primaryKey().defaultRandom(),
  videoId: uuid('video_id').references(() => videos.id).notNull(),
  type: nodeTypeEnum('type').notNull(),
  label: varchar('label', { length: 255 }).notNull(),
  content: text('content'),
  startTime: integer('start_time').notNull(),
  endTime: integer('end_time').notNull(),
  confidence: real('confidence'),
  // pgvector embedding column
  embedding: vector('embedding', { dimensions: 384 }),
  createdAt: timestamp('created_at').defaultNow(),
});

// Edges table
export const edges = pgTable('edges', {
  id: uuid('id').primaryKey().defaultRandom(),
  sourceId: uuid('source_id').references(() => topicNodes.id).notNull(),
  targetId: uuid('target_id').references(() => topicNodes.id).notNull(),
  type: edgeTypeEnum('type').notNull(),
  weight: real('weight').notNull(),
  videoId: uuid('video_id').references(() => videos.id).notNull(),
  createdAt: timestamp('created_at').defaultNow(),
});
```

---

## Pipeline SDK Deep Dive

### Step Implementations

#### Video Step (`src/steps/video-step.ts`)

```typescript
export class VideoPipelineStep extends BasePipelineStep {
  readonly stage = PipelineStage.VIDEO;
  readonly name = 'video-processor';

  async execute(context: StepContext): Promise<StepResult> {
    const { videoUrl, targetResolution } = context.config;
    
    // 1. Download video
    const downloadedPath = await this.downloadVideo(videoUrl);
    
    // 2. Probe video metadata
    const metadata = await this.probeVideo(downloadedPath);
    
    // 3. Transcode to target format
    const transcodedPath = await this.transcodeVideo(downloadedPath, {
      resolution: targetResolution || '1080p',
      codec: 'h264',
    });
    
    // 4. Extract thumbnail
    const thumbnailPath = await this.extractThumbnail(transcodedPath);
    
    // 5. Upload artifacts
    const artifacts = await this.uploadArtifacts({
      original: downloadedPath,
      normalized: transcodedPath,
      thumbnail: thumbnailPath,
    });
    
    return {
      success: true,
      artifacts,
      metrics: { executionTimeMs, memoryPeakMb },
    };
  }

  private async downloadVideo(url: string): Promise<string> {
    // Use yt-dlp for YouTube URLs
    if (this.isYouTubeUrl(url)) {
      return await this.downloadWithYtDlp(url);
    }
    // Use direct download for other URLs
    return await this.downloadDirect(url);
  }

  private async transcodeVideo(
    inputPath: string, 
    options: TranscodeOptions
  ): Promise<string> {
    const outputPath = this.getTempPath('normalized.mp4');
    
    await ffmpeg(inputPath)
      .videoCodec('libx264')
      .size(options.resolution)
      .audioCodec('aac')
      .audioFilters('loudnorm')
      .output(outputPath)
      .run();
    
    return outputPath;
  }
}
```

#### ASR Step (`src/steps/asr-step.ts`)

```typescript
export class AsrPipelineStep extends BasePipelineStep {
  readonly stage = PipelineStage.ASR;
  readonly name = 'asr-processor';

  async execute(context: StepContext): Promise<StepResult> {
    const videoArtifact = context.manifest.artifacts.video?.normalized;
    if (!videoArtifact) {
      throw new Error('Normalized video not found in manifest');
    }

    // 1. Extract audio
    const audioPath = await this.extractAudio(videoArtifact);
    
    // 2. Run Whisper transcription
    const transcript = await this.runWhisper(audioPath, {
      model: context.config.model || 'base',
      language: context.config.language,
      wordTimestamps: context.config.wordTimestamps,
    });
    
    // 3. Run speaker diarization (optional)
    let diarization;
    if (context.config.diarization) {
      diarization = await this.runDiarization(audioPath);
    }
    
    // 4. Merge diarization with transcript
    const mergedSegments = this.mergeDiarization(transcript, diarization);
    
    // 5. Generate output formats
    const vtt = this.generateVTT(mergedSegments);
    const srt = this.generateSRT(mergedSegments);
    const json = this.generateJSON(mergedSegments);
    
    // 6. Upload artifacts
    const artifacts = await this.uploadTranscripts({ vtt, srt, json });
    
    return { success: true, artifacts };
  }

  private async runWhisper(
    audioPath: string, 
    options: WhisperOptions
  ): Promise<TranscriptResult> {
    // Call Python Whisper via child process or gRPC
    const pythonScript = `
      from faster_whisper import WhisperModel
      model = WhisperModel("${options.model}")
      segments, info = model.transcribe("${audioPath}")
      # ... process and output JSON
    `;
    
    return await this.runPython(pythonScript);
  }
}
```

#### Topic Step (`src/steps/topic-step.ts`)

```typescript
export class TopicPipelineStep extends BasePipelineStep {
  readonly stage = PipelineStage.TOPICS;
  readonly name = 'topic-processor';

  async execute(context: StepContext): Promise<StepResult> {
    const transcript = await this.loadTranscript(context.manifest);
    
    // Choose segmentation method
    const method = context.config.segmentationMethod || 'window';
    
    let segments: TopicSegment[];
    switch (method) {
      case 'window':
        segments = await this.segmentByWindow(transcript, context.config);
        break;
      case 'sliding':
        segments = await this.segmentBySlidingWindow(transcript, context.config);
        break;
      case 'llm':
        segments = await this.segmentByLLM(transcript, context.config);
        break;
      default:
        throw new Error(`Unknown segmentation method: ${method}`);
    }
    
    // Generate summaries for each segment
    const topics = await Promise.all(
      segments.map(async (seg) => ({
        ...seg,
        summary: await this.generateSummary(seg.transcript),
      }))
    );
    
    // Upload artifacts
    const artifacts = await this.uploadTopics(topics);
    
    return { success: true, artifacts };
  }

  private async segmentByLLM(
    transcript: Transcript, 
    config: TopicConfig
  ): Promise<TopicSegment[]> {
    // Use LLM to identify topic boundaries
    const prompt = `
      Analyze the following transcript and identify topic boundaries.
      Return a JSON array with start_time, end_time, and topic_label for each segment.
      
      Transcript:
      ${transcript.segments.map(s => `[${s.start}-${s.end}] ${s.text}`).join('\n')}
    `;
    
    const response = await this.callLLM(prompt);
    return JSON.parse(response);
  }
}
```

---

## Key Algorithms

### Semantic Search with pgvector

```typescript
// Vector similarity search using cosine distance
async function semanticSearch(
  query: string, 
  limit: number = 10
): Promise<SearchResult[]> {
  // 1. Generate query embedding
  const queryEmbedding = await generateEmbedding(query);
  
  // 2. Perform vector search
  const results = await db
    .select({
      node: topicNodes,
      similarity: sql<number>`1 - (${cosineDistance(
        topicNodes.embedding,
        queryEmbedding
      )})`,
    })
    .from(topicNodes)
    .where(
      sql`${cosineDistance(topicNodes.embedding, queryEmbedding)} < 0.3`
    )
    .orderBy(
      sql`${cosineDistance(topicNodes.embedding, queryEmbedding)}`
    )
    .limit(limit);
  
  return results.map(r => ({
    ...r.node,
    similarity: r.similarity,
  }));
}
```

### Graph Building Algorithm

```typescript
// Build topic graph from segments
async function buildTopicGraph(
  videoId: string, 
  segments: TopicSegment[],
  embeddings: number[][]
): Promise<Graph> {
  const nodes: Node[] = [];
  const edges: Edge[] = [];
  
  // Create nodes
  for (let i = 0; i < segments.length; i++) {
    nodes.push({
      id: `node-${i}`,
      videoId,
      type: 'topic',
      label: segments[i].label,
      startTime: segments[i].start,
      endTime: segments[i].end,
      embedding: embeddings[i],
    });
  }
  
  // Create sequential edges
  for (let i = 0; i < nodes.length - 1; i++) {
    edges.push({
      id: `edge-seq-${i}`,
      sourceId: nodes[i].id,
      targetId: nodes[i + 1].id,
      type: 'sequential',
      weight: 1.0,
      videoId,
    });
  }
  
  // Create semantic edges based on embedding similarity
  for (let i = 0; i < nodes.length; i++) {
    for (let j = i + 2; j < nodes.length; j++) {
      const similarity = cosineSimilarity(embeddings[i], embeddings[j]);
      if (similarity > 0.8) {
        edges.push({
          id: `edge-sem-${i}-${j}`,
          sourceId: nodes[i].id,
          targetId: nodes[j].id,
          type: 'semantic',
          weight: similarity,
          videoId,
        });
      }
    }
  }
  
  return { nodes, edges };
}
```

---

## Error Handling

### Error Hierarchy

```typescript
// Base error class
export class PipelineError extends Error {
  constructor(
    message: string,
    public readonly stage: PipelineStage,
    public readonly code: string,
    public readonly recoverable: boolean = false
  ) {
    super(message);
    this.name = 'PipelineError';
  }
}

// Specific error types
export class VideoDownloadError extends PipelineError {
  constructor(message: string, public readonly url: string) {
    super(message, PipelineStage.VIDEO, 'VIDEO_DOWNLOAD_ERROR', true);
  }
}

export class TranscriptionError extends PipelineError {
  constructor(message: string, public readonly audioPath: string) {
    super(message, PipelineStage.ASR, 'TRANSCRIPTION_ERROR', true);
  }
}

export class EmbeddingError extends PipelineError {
  constructor(message: string) {
    super(message, PipelineStage.EMBEDDINGS, 'EMBEDDING_ERROR', false);
  }
}
```

### Retry Logic

```typescript
async function executeWithRetry<T>(
  operation: () => Promise<T>,
  config: RetryConfig
): Promise<T> {
  const { maxRetries, backoffMs, maxBackoffMs } = config;
  
  let lastError: Error;
  let delay = backoffMs;
  
  for (let attempt = 0; attempt <= maxRetries; attempt++) {
    try {
      return await operation();
    } catch (error) {
      lastError = error as Error;
      
      if (attempt === maxRetries) {
        throw lastError;
      }
      
      // Check if error is recoverable
      if (error instanceof PipelineError && !error.recoverable) {
        throw error;
      }
      
      // Exponential backoff with jitter
      await sleep(delay + Math.random() * 1000);
      delay = Math.min(delay * 2, maxBackoffMs);
    }
  }
  
  throw lastError!;
}
```

---

## Configuration System

### Environment Variables

```typescript
// services/api/src/config/index.ts
export const config = {
  // Database
  database: {
    url: process.env.DATABASE_URL!,
    maxConnections: parseInt(process.env.DB_MAX_CONNECTIONS || '20'),
  },
  
  // Redis
  redis: {
    url: process.env.REDIS_URL!,
  },
  
  // MinIO/S3
  storage: {
    endpoint: process.env.MINIO_ENDPOINT!,
    port: parseInt(process.env.MINIO_PORT || '9000'),
    useSsl: process.env.MINIO_USE_SSL === 'true',
    accessKey: process.env.MINIO_ACCESS_KEY!,
    secretKey: process.env.MINIO_SECRET_KEY!,
    bucket: process.env.MINIO_BUCKET!,
  },
  
  // Authentication
  auth: {
    jwtSecret: process.env.JWT_SECRET!,
    keycloakUrl: process.env.KEYCLOAK_URL!,
    keycloakRealm: process.env.KEYCLOAK_REALM!,
  },
  
  // ML Models
  models: {
    whisper: {
      model: process.env.WHISPER_MODEL || 'base',
      device: process.env.WHISPER_DEVICE || 'cpu',
    },
    embedding: {
      model: process.env.EMBEDDING_MODEL || 'sentence-transformers/all-MiniLM-L6-v2',
    },
    llm: {
      provider: process.env.LLM_PROVIDER || 'ollama',
      model: process.env.LLM_MODEL || 'llama2',
      url: process.env.OLLAMA_URL || 'http://localhost:11434',
    },
  },
};
```

---

## Testing Strategy

### Unit Tests

```typescript
// Example unit test for VideoPipelineStep
describe('VideoPipelineStep', () => {
  it('should download and transcode video', async () => {
    const step = new VideoPipelineStep();
    const context = createMockContext({
      videoUrl: 'https://example.com/test.mp4',
    });
    
    const result = await step.execute(context);
    
    expect(result.success).toBe(true);
    expect(result.artifacts.video).toBeDefined();
    expect(result.artifacts.video.normalized).toBeDefined();
  });
});
```

### Integration Tests

```typescript
// Example integration test
describe('Video API', () => {
  it('should create and retrieve video', async () => {
    const createRes = await request(app)
      .post('/api/v1/videos')
      .send({
        title: 'Test',
        originalUrl: 'https://example.com/test',
      });
    
    expect(createRes.status).toBe(201);
    
    const getRes = await request(app)
      .get(`/api/v1/videos/${createRes.body.id}`);
    
    expect(getRes.status).toBe(200);
    expect(getRes.body.title).toBe('Test');
  });
});
```

### E2E Tests

```typescript
// Example Playwright E2E test
test('user can upload and process video', async ({ page }) => {
  await page.goto('/videos/upload');
  await page.fill('[data-testid="video-url"]', 'https://youtube.com/watch?v=test');
  await page.click('[data-testid="upload-button"]');
  
  await expect(page.locator('[data-testid="success-message"]')).toBeVisible();
  
  await page.click('[data-testid="process-button"]');
  
  await expect(page.locator('[data-testid="graph"]')).toBeVisible({ timeout: 300000 });
});
```

---

## Deployment

### Docker Compose

```yaml
version: '3.8'

services:
  api:
    build:
      context: .
      dockerfile: services/api/Dockerfile
    ports:
      - "3000:3000"
    environment:
      - DATABASE_URL=postgresql://postgres:postgres@postgres:5432/video_graph
      - REDIS_URL=redis://redis:6379
    depends_on:
      - postgres
      - redis
      - minio

  worker:
    build:
      context: .
      dockerfile: services/worker-orchestrator/Dockerfile
    environment:
      - DATABASE_URL=postgresql://postgres:postgres@postgres:5432/video_graph
      - REDIS_URL=redis://redis:6379
    depends_on:
      - postgres
      - redis
      - minio

  web-ui:
    build:
      context: .
      dockerfile: apps/web-ui/Dockerfile
    ports:
      - "80:80"
    environment:
      - API_URL=http://api:3000
```

---

## Performance Considerations

1. **Database**: Use connection pooling, proper indexing on embedding columns
2. **Vector Search**: Use pgvector's IVFFlat or HNSW indexes for large datasets
3. **Caching**: Redis for job state, MinIO for artifacts
4. **Queue**: BullMQ with proper concurrency limits
5. **Video Processing**: FFmpeg with hardware acceleration when available
6. **ML Models**: Batch embeddings, use quantized models for inference

---

## Security

1. **Authentication**: OIDC via Keycloak, JWT tokens
2. **Authorization**: Role-based access control (RBAC)
3. **Input Validation**: Zod schemas for all inputs
4. **SQL Injection**: Parameterized queries via Drizzle ORM
5. **File Upload**: Validate file types, size limits, virus scanning
6. **Secrets**: Use environment variables, never commit secrets
