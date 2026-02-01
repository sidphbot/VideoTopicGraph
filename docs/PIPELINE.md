# Pipeline SDK Documentation

The Pipeline SDK provides a framework for building swappable, composable video processing pipelines.

## Core Concepts

### ArtifactManifest

The central data structure passed between pipeline steps:

```typescript
interface ArtifactManifest {
  video_id: string;
  graph_version_id: string;
  job_id: string;
  paths: ArtifactPaths;
  metrics: ArtifactMetrics;
  config_snapshot: PipelineConfig;
  created_at: string;
  updated_at: string;
  current_step?: string;
  completed_steps?: string[];
  step_errors?: Record<string, string>;
}
```

### PipelineStep Interface

All pipeline steps must implement this interface:

```typescript
interface PipelineStep {
  readonly name: string;
  readonly version: string;
  
  execute(manifest: ArtifactManifest, context: PipelineContext): Promise<ArtifactManifest>;
  validateInput(manifest: ArtifactManifest): ValidationResult;
  getRequiredInputs(): (keyof ArtifactPaths)[];
  getProducedOutputs(): (keyof ArtifactPaths)[];
}
```

## Built-in Steps

### VideoStep

Downloads and normalizes video files.

**Required Inputs:** `source_url` (from context payload)

**Produces:** `video_original`, `video_normalized`, `audio_wav`

**Configuration:**
```typescript
{
  outputFormat: 'mp4',
  videoCodec: 'libx264',
  resolution: '720p',
  enableSceneDetection: false,
  sceneThreshold: 0.3
}
```

### AsrStep

Performs speech recognition with optional diarization.

**Required Inputs:** `audio_wav`

**Produces:** `transcript`, `word_alignment` (optional), `diarization` (optional)

**Configuration:**
```typescript
{
  provider: 'faster-whisper',
  model: 'base',
  device: 'cpu',
  enableWordAlignment: false,
  enableDiarization: false,
  language?: string,  // auto-detect if not specified
  beamSize: 5,
  temperature: 0
}
```

### TopicStep

Generates hierarchical, overlapping topics.

**Required Inputs:** `transcript`

**Produces:** `topics`

**Configuration:**
```typescript
{
  llmProvider: 'ollama',
  llmModel: 'mistral',
  embeddingModel: 'all-MiniLM-L6-v2',
  topicLevels: 3,
  mergeThreshold: 0.85,
  minSegmentDuration: 5,
  maxSegmentDuration: 300,
  allowOverlap: true,
  multiParent: true,
  importanceWeights: {
    centrality: 0.3,
    duration: 0.3,
    novelty: 0.4
  }
}
```

### EmbeddingsGraphStep

Generates embeddings and constructs the topic graph.

**Required Inputs:** `topics`, `transcript`

**Produces:** `embeddings`, `graph`

**Configuration:**
```typescript
{
  embeddingProvider: 'sentence-transformers',
  embeddingModel: 'all-MiniLM-L6-v2',
  knnK: 5,
  similarityThreshold: 0.75,
  maxSemanticEdges: 10,
  createSequenceEdges: true,
  createHierarchyEdges: true,
  createReferenceEdges: true,
  enableClustering: true,
  clusteringAlgorithm: 'hdbscan'
}
```

### SnippetStep

Generates video snippets, thumbnails, and captions.

**Required Inputs:** `video_normalized`, `topics`

**Produces:** `snippets`, `thumbnails` (optional), `captions` (optional)

**Configuration:**
```typescript
{
  outputFormat: 'mp4',
  resolution: '720p',
  generateThumbnails: true,
  generateCaptions: true,
  captionFormat: 'vtt',
  paddingSeconds: 1,
  minDuration: 3,
  maxDuration: 300
}
```

### ExportStep

Generates PPTX, HTML, or PDF exports.

**Required Inputs:** `topics`, `graph`

**Produces:** `exports`

**Configuration:**
```typescript
{
  pptxTemplate: 'default',
  htmlTheme: 'default',
  includeSnippets: true,
  snippetEmbedMode: 'linked',
  includeAppendix: true,
  maxTopics: 50
}
```

## Creating Custom Steps

Extend `BasePipelineStep`:

```typescript
import { BasePipelineStep, createPipelineContext } from '@video-graph/pipeline-sdk';

class CustomStep extends BasePipelineStep {
  readonly name = 'custom';
  readonly version = '1.0.0';

  getRequiredInputs(): (keyof ArtifactPaths)[] {
    return ['transcript'];
  }

  getProducedOutputs(): (keyof ArtifactPaths)[] {
    return ['custom_output'];
  }

  async execute(manifest: ArtifactManifest, context: PipelineContext): Promise<ArtifactManifest> {
    // Validate inputs
    const validation = this.validateInput(manifest);
    if (!validation.valid) {
      throw new Error(`Invalid input: ${validation.errors.join(', ')}`);
    }

    // Read input
    const transcriptData = await context.storage.read(manifest.paths.transcript!);
    const transcript = JSON.parse(transcriptData.toString());

    // Process
    context.logger.info('Processing custom step');
    const result = await this.process(transcript);

    // Write output
    const outputPath = `videos/${manifest.video_id}/custom/output.json`;
    await context.storage.write(outputPath, Buffer.from(JSON.stringify(result)));

    // Update manifest
    let updatedManifest = this.updateManifest(manifest, {
      custom_output: outputPath
    });

    // Update metrics
    updatedManifest = this.updateMetrics(updatedManifest, {
      custom_metric: result.length
    });

    return this.markStepCompleted(updatedManifest, this.name);
  }

  private async process(transcript: unknown): Promise<unknown> {
    // Custom processing logic
    return transcript;
  }
}
```

## Registering Custom Steps

```typescript
import { stepRegistry } from '@video-graph/pipeline-sdk';

stepRegistry.register('custom', () => new CustomStep(), {
  description: 'Custom processing step',
  version: '1.0.0',
  author: 'Your Name',
  tags: ['custom', 'processing'],
  inputs: ['transcript'],
  outputs: ['custom_output']
});
```

## Pipeline Orchestration

```typescript
import { PipelineOrchestrator, createEmptyManifest, createPipelineContext } from '@video-graph/pipeline-sdk';

const orchestrator = new PipelineOrchestrator();

// Register steps
for (const step of stepRegistry.list()) {
  orchestrator.registerStep(step.factory());
}

// Create manifest
const manifest = createEmptyManifest(videoId, graphVersionId, jobId, config);

// Create context
const context = createPipelineContext({
  jobId,
  videoId,
  userId,
  storage: storageService,
  config,
  onProgress: (progress, message) => {
    console.log(`${progress}%: ${message}`);
  }
});

// Execute pipeline
const result = await orchestrator.executePipeline(
  manifest,
  context,
  ['video', 'asr', 'topic', 'embeddings-graph', 'snippet']
);

if (result.success) {
  console.log('Pipeline completed successfully');
} else {
  console.error('Pipeline failed:', result.results.find(r => !r.success)?.error);
}
```

## Model Configuration

All model choices are configurable via environment variables:

### ASR Models

| Provider | Models | Device |
|----------|--------|--------|
| `whisper` | tiny, base, small, medium, large-v1/2/3 | cpu, cuda |
| `faster-whisper` | tiny, base, small, medium, large-v1/2/3 | cpu, cuda |
| `whisper-cpp` | Model path | cpu |

### Embedding Models

| Provider | Models | Dimension |
|----------|--------|-----------|
| `sentence-transformers` | all-MiniLM-L6-v2, all-mpnet-base-v2 | 384, 768 |
| `ollama` | nomic-embed-text | 768 |

### LLM Models

| Provider | Models | Context |
|----------|--------|---------|
| `llama-cpp` | llama2, mistral, mixtral | 4096+ |
| `ollama` | mistral, llama2, phi | 4096+ |
| `vllm` | Any HuggingFace model | Model-specific |

## Error Handling

Steps should handle errors gracefully:

```typescript
async execute(manifest: ArtifactManifest, context: PipelineContext): Promise<ArtifactManifest> {
  try {
    // Processing logic
    return this.markStepCompleted(updatedManifest, this.name);
  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : String(error);
    context.logger.error(`Step failed: ${errorMessage}`);
    
    // Record error in manifest
    return this.recordError(manifest, this.name, errorMessage);
  }
}
```

## Testing

Use the in-memory storage for testing:

```typescript
import { createMemoryStorage, createNoopLogger } from '@video-graph/pipeline-sdk';

const storage = createMemoryStorage();
const context = createPipelineContext({
  jobId: 'test-job',
  videoId: 'test-video',
  userId: 'test-user',
  storage,
  config: {},
  logger: createNoopLogger()
});

const step = new CustomStep();
const result = await step.execute(manifest, context);
```
