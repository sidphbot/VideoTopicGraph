/**
 * Job Processor
 * 
 * Processes different types of jobs using the Pipeline SDK.
 */

import { v4 as uuidv4 } from 'uuid';
import {
  PipelineOrchestrator,
  createPipelineContext,
  createEmptyManifest,
  stepRegistry,
  VideoStep,
  AsrStep,
  TopicStep,
  EmbeddingsGraphStep,
  SnippetStep,
  ExportStep,
} from '@video-graph/pipeline-sdk';
import type { PipelineConfig } from '@video-graph/shared-types';
import { logger } from './logger.js';
import { config } from './config.js';

// Register all steps
stepRegistry.register(
  'video',
  () => new VideoStep(),
  {
    description: 'Download and normalize video',
    version: '1.0.0',
    author: 'Video Topic Graph Platform',
    tags: ['video', 'download', 'normalize'],
    inputs: ['source_url'],
    outputs: ['video_original', 'video_normalized', 'audio_wav'],
  }
);

stepRegistry.register(
  'asr',
  () => new AsrStep(),
  {
    description: 'Speech recognition',
    version: '1.0.0',
    author: 'Video Topic Graph Platform',
    tags: ['asr', 'speech', 'transcription'],
    inputs: ['audio_wav'],
    outputs: ['transcript'],
  }
);

stepRegistry.register(
  'topic',
  () => new TopicStep(),
  {
    description: 'Topic segmentation',
    version: '1.0.0',
    author: 'Video Topic Graph Platform',
    tags: ['topic', 'segmentation', 'llm'],
    inputs: ['transcript'],
    outputs: ['topics'],
  }
);

stepRegistry.register(
  'embeddings-graph',
  () => new EmbeddingsGraphStep(),
  {
    description: 'Generate embeddings and graph',
    version: '1.0.0',
    author: 'Video Topic Graph Platform',
    tags: ['embeddings', 'graph'],
    inputs: ['topics', 'transcript'],
    outputs: ['embeddings', 'graph'],
  }
);

stepRegistry.register(
  'snippet',
  () => new SnippetStep(),
  {
    description: 'Generate video snippets',
    version: '1.0.0',
    author: 'Video Topic Graph Platform',
    tags: ['snippet', 'video'],
    inputs: ['video_normalized', 'topics'],
    outputs: ['snippets'],
  }
);

stepRegistry.register(
  'export',
  () => new ExportStep(),
  {
    description: 'Generate exports',
    version: '1.0.0',
    author: 'Video Topic Graph Platform',
    tags: ['export', 'pptx', 'html', 'pdf'],
    inputs: ['topics', 'graph'],
    outputs: ['exports'],
  }
);

// Create pipeline orchestrator
const orchestrator = new PipelineOrchestrator();

// Register steps with orchestrator
for (const step of stepRegistry.list()) {
  orchestrator.registerStep(step.factory());
}

// Create storage service (placeholder - would use MinIO client)
const storageService = {
  read: async (path: string) => Buffer.from(''),
  write: async (path: string, data: Buffer) => {},
  exists: async (path: string) => false,
  delete: async (path: string) => {},
  getUrl: async (path: string) => `http://localhost:9000/${config.storageBucket}/${path}`,
  list: async (prefix: string) => [],
};

export interface VideoAnalysisJob {
  videoId: string;
  graphVersionId: string;
  sourceUrl: string;
  sourceType: string;
  config: PipelineConfig;
}

export interface ExportJob {
  exportId: string;
  videoId: string;
  graphVersionId: string;
  type: 'pptx' | 'html' | 'pdf';
  options: Record<string, unknown>;
}

export interface SnippetGenerationJob {
  videoId: string;
  topicIds: string[];
  config: PipelineConfig;
}

export class JobProcessor {
  async processVideoAnalysis(job: VideoAnalysisJob): Promise<{
    success: boolean;
    manifest?: unknown;
    error?: string;
  }> {
    const {
      videoId,
      graphVersionId,
      sourceUrl,
      sourceType,
      config: pipelineConfig,
    } = job;

    const jobId = uuidv4();

    logger.info({ videoId, jobId }, 'Starting video analysis pipeline');

    // Create manifest
    const manifest = createEmptyManifest(videoId, graphVersionId, jobId, pipelineConfig);

    // Create pipeline context
    const context = createPipelineContext({
      jobId,
      videoId,
      userId: 'system',
      storage: storageService,
      config: pipelineConfig,
      payload: {
        source_url: sourceUrl,
        source_type: sourceType,
      },
    });

    // Define pipeline steps
    const steps = ['video', 'asr', 'topic', 'embeddings-graph'];
    
    // Add snippet generation if configured
    if (pipelineConfig.snippet_quality !== 'none') {
      steps.push('snippet');
    }

    // Execute pipeline
    const result = await orchestrator.executePipeline(manifest, context, steps);

    if (result.success) {
      logger.info({ videoId, jobId }, 'Video analysis pipeline completed');
      return {
        success: true,
        manifest: result.manifest,
      };
    } else {
      logger.error(
        { videoId, jobId, error: result.results.find((r) => !r.success)?.error },
        'Video analysis pipeline failed'
      );
      return {
        success: false,
        error: result.results.find((r) => !r.success)?.error,
      };
    }
  }

  async processExport(job: ExportJob): Promise<{
    success: boolean;
    path?: string;
    error?: string;
  }> {
    const { exportId, videoId, graphVersionId, type, options } = job;

    logger.info({ exportId, videoId, type }, 'Starting export generation');

    // Create context
    const context = createPipelineContext({
      jobId: exportId,
      videoId,
      userId: 'system',
      storage: storageService,
      config: {} as PipelineConfig,
      payload: {
        export_type: type,
        options,
      },
    });

    // Create minimal manifest
    const manifest = createEmptyManifest(videoId, graphVersionId, exportId, {} as PipelineConfig);

    // Execute export step
    const step = new ExportStep();
    try {
      const result = await step.execute(manifest, context);
      logger.info({ exportId }, 'Export generation completed');
      return {
        success: true,
        path: result.paths.exports?.[0],
      };
    } catch (error) {
      logger.error({ exportId, error }, 'Export generation failed');
      return {
        success: false,
        error: error instanceof Error ? error.message : String(error),
      };
    }
  }

  async processSnippetGeneration(job: SnippetGenerationJob): Promise<{
    success: boolean;
    snippetCount?: number;
    error?: string;
  }> {
    const { videoId, topicIds, config: pipelineConfig } = job;

    logger.info({ videoId, topicCount: topicIds.length }, 'Starting snippet generation');

    // This would generate snippets for specific topics
    // Implementation would fetch topics and generate clips

    return {
      success: true,
      snippetCount: topicIds.length,
    };
  }
}
