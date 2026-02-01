/**
 * Integration Tests - Pipeline Execution
 * 
 * Tests for full pipeline execution with real services.
 */

import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import { PipelineOrchestrator } from '../../packages/pipeline-sdk/src/core';
import { VideoPipelineStep } from '../../packages/pipeline-sdk/src/steps/video-step';
import { AsrPipelineStep } from '../../packages/pipeline-sdk/src/steps/asr-step';
import { TopicPipelineStep } from '../../packages/pipeline-sdk/src/steps/topic-step';
import { EmbeddingsGraphPipelineStep } from '../../packages/pipeline-sdk/src/steps/embeddings-graph-step';
import { setupTestInfrastructure, teardownTestInfrastructure } from './helpers/infrastructure';
import type { ArtifactManifest } from '@video-graph/shared-types';

describe('Pipeline Integration Tests', () => {
  let orchestrator: PipelineOrchestrator;
  let infrastructure: any;

  beforeAll(async () => {
    infrastructure = await setupTestInfrastructure();

    // Setup pipeline orchestrator with real steps
    orchestrator = new PipelineOrchestrator();
    orchestrator.registerStep('video', new VideoPipelineStep());
    orchestrator.registerStep('asr', new AsrPipelineStep());
    orchestrator.registerStep('topics', new TopicPipelineStep());
    orchestrator.registerStep('embeddings-graph', new EmbeddingsGraphPipelineStep());
  });

  afterAll(async () => {
    await teardownTestInfrastructure(infrastructure);
  });

  describe('Full Pipeline Execution', () => {
    it('should execute complete pipeline for a video', async () => {
      const videoId = 'test-video-001';
      const jobId = 'test-job-001';
      const manifest: ArtifactManifest = {
        version: '1.0.0',
        videoId,
        jobId,
        artifacts: {},
        metadata: {
          createdAt: new Date().toISOString(),
          pipelineVersion: '1.0.0',
        },
      };

      const result = await orchestrator.executePipeline(videoId, jobId, manifest, {
        videoUrl: 'https://example.com/test-video.mp4',
      });

      expect(result.success).toBe(true);
      expect(result.completedStages).toContain('video');
      expect(result.completedStages).toContain('asr');
      expect(result.completedStages).toContain('topics');
      expect(result.completedStages).toContain('embeddings-graph');
    }, 300000); // 5 minute timeout

    it('should handle pipeline failures gracefully', async () => {
      const videoId = 'test-video-002';
      const jobId = 'test-job-002';
      const manifest: ArtifactManifest = {
        version: '1.0.0',
        videoId,
        jobId,
        artifacts: {},
        metadata: {
          createdAt: new Date().toISOString(),
          pipelineVersion: '1.0.0',
        },
      };

      // Pass invalid URL to trigger failure
      const result = await orchestrator.executePipeline(videoId, jobId, manifest, {
        videoUrl: 'invalid-url',
      });

      expect(result.success).toBe(false);
      expect(result.failedStage).toBeDefined();
      expect(result.error).toBeDefined();
    });

    it('should resume pipeline from intermediate stage', async () => {
      const videoId = 'test-video-003';
      const jobId = 'test-job-003';

      // Start with a manifest that has video already processed
      const manifest: ArtifactManifest = {
        version: '1.0.0',
        videoId,
        jobId,
        artifacts: {
          video: {
            normalized: {
              key: `videos/${videoId}/normalized.mp4`,
              bucket: 'test-bucket',
              size: 1000000,
              contentType: 'video/mp4',
              checksum: 'sha256:test',
            },
          },
        },
        metadata: {
          createdAt: new Date().toISOString(),
          pipelineVersion: '1.0.0',
          completedStages: ['video'],
        },
      };

      const result = await orchestrator.executePipeline(videoId, jobId, manifest);

      expect(result.success).toBe(true);
      // Should skip video stage and start from ASR
      expect(result.completedStages).toContain('asr');
    });
  });

  describe('Individual Stage Execution', () => {
    it('should execute video stage independently', async () => {
      const step = new VideoPipelineStep();
      const context = {
        videoId: 'test-video-004',
        jobId: 'test-job-004',
        manifest: createEmptyManifest('test-video-004', 'test-job-004'),
        config: {
          videoUrl: 'https://example.com/test.mp4',
        },
      };

      const result = await step.executeWithRetry(context);

      expect(result.success).toBe(true);
      expect(result.artifacts.video).toBeDefined();
    }, 120000);

    it('should execute ASR stage with pre-processed video', async () => {
      const step = new AsrPipelineStep();
      const context = {
        videoId: 'test-video-005',
        jobId: 'test-job-005',
        manifest: createManifestWithVideo('test-video-005', 'test-job-005'),
        config: {
          model: 'tiny',
          language: 'en',
        },
      };

      const result = await step.executeWithRetry(context);

      expect(result.success).toBe(true);
      expect(result.artifacts.transcript).toBeDefined();
      expect(result.artifacts.transcript?.vtt).toBeDefined();
      expect(result.artifacts.transcript?.json).toBeDefined();
    }, 180000);

    it('should execute topic segmentation stage', async () => {
      const step = new TopicPipelineStep();
      const context = {
        videoId: 'test-video-006',
        jobId: 'test-job-006',
        manifest: createManifestWithTranscript('test-video-006', 'test-job-006'),
        config: {
          segmentationMethod: 'window',
          windowSize: 60,
        },
      };

      const result = await step.executeWithRetry(context);

      expect(result.success).toBe(true);
      expect(result.artifacts.topics).toBeDefined();
    }, 120000);

    it('should execute embeddings and graph stage', async () => {
      const step = new EmbeddingsGraphPipelineStep();
      const context = {
        videoId: 'test-video-007',
        jobId: 'test-job-007',
        manifest: createManifestWithTopics('test-video-007', 'test-job-007'),
        config: {
          model: 'sentence-transformers/all-MiniLM-L6-v2',
        },
      };

      const result = await step.executeWithRetry(context);

      expect(result.success).toBe(true);
      expect(result.artifacts.embeddings).toBeDefined();
      expect(result.artifacts.graph).toBeDefined();
    }, 120000);
  });

  describe('Manifest Management', () => {
    it('should persist manifest after each stage', async () => {
      const videoId = 'test-video-008';
      const jobId = 'test-job-008';
      const manifest = createEmptyManifest(videoId, jobId);

      // Execute video stage
      const videoStep = new VideoPipelineStep();
      const videoResult = await videoStep.executeWithRetry({
        videoId,
        jobId,
        manifest,
        config: { videoUrl: 'https://example.com/test.mp4' },
      });

      expect(videoResult.success).toBe(true);
      expect(manifest.artifacts.video).toBeDefined();

      // Execute ASR stage
      const asrStep = new AsrPipelineStep();
      const asrResult = await asrStep.executeWithRetry({
        videoId,
        jobId,
        manifest,
        config: { model: 'tiny' },
      });

      expect(asrResult.success).toBe(true);
      expect(manifest.artifacts.transcript).toBeDefined();
      expect(manifest.artifacts.video).toBeDefined(); // Still there
    }, 180000);

    it('should handle manifest versioning', async () => {
      const manifest: ArtifactManifest = {
        version: '1.0.0',
        videoId: 'test-video-009',
        jobId: 'test-job-009',
        artifacts: {},
        metadata: {
          createdAt: new Date().toISOString(),
          pipelineVersion: '1.0.0',
        },
      };

      // Execute pipeline
      const result = await orchestrator.executePipeline(
        manifest.videoId,
        manifest.jobId,
        manifest,
        { videoUrl: 'https://example.com/test.mp4' }
      );

      expect(result.success).toBe(true);
      expect(manifest.metadata.completedStages).toBeDefined();
      expect(manifest.metadata.completedStages!.length).toBeGreaterThan(0);
    }, 300000);
  });

  describe('Error Handling', () => {
    it('should retry failed stages', async () => {
      const step = new VideoPipelineStep();
      let attempts = 0;

      // Override execute to fail twice then succeed
      const originalExecute = step.execute.bind(step);
      step.execute = async (ctx: any) => {
        attempts++;
        if (attempts < 3) {
          throw new Error(`Attempt ${attempts} failed`);
        }
        return originalExecute(ctx);
      };

      const context = {
        videoId: 'test-video-010',
        jobId: 'test-job-010',
        manifest: createEmptyManifest('test-video-010', 'test-job-010'),
        config: { videoUrl: 'https://example.com/test.mp4' },
      };

      const result = await step.executeWithRetry(context);

      expect(result.success).toBe(true);
      expect(attempts).toBe(3);
    });

    it('should clean up resources on failure', async () => {
      const step = new VideoPipelineStep();
      const cleanupSpy = vi.spyOn(step, 'cleanup');

      // Force failure
      step.execute = async () => {
        throw new Error('Forced failure');
      };

      const context = {
        videoId: 'test-video-011',
        jobId: 'test-job-011',
        manifest: createEmptyManifest('test-video-011', 'test-job-011'),
        config: { videoUrl: 'https://example.com/test.mp4' },
      };

      try {
        await step.executeWithRetry(context);
      } catch (error) {
        // Expected
      }

      expect(cleanupSpy).toHaveBeenCalled();
    });
  });
});

// Helper functions
function createEmptyManifest(videoId: string, jobId: string): ArtifactManifest {
  return {
    version: '1.0.0',
    videoId,
    jobId,
    artifacts: {},
    metadata: {
      createdAt: new Date().toISOString(),
      pipelineVersion: '1.0.0',
    },
  };
}

function createManifestWithVideo(videoId: string, jobId: string): ArtifactManifest {
  return {
    version: '1.0.0',
    videoId,
    jobId,
    artifacts: {
      video: {
        normalized: {
          key: `videos/${videoId}/normalized.mp4`,
          bucket: 'test-bucket',
          size: 1000000,
          contentType: 'video/mp4',
          checksum: 'sha256:test',
        },
      },
    },
    metadata: {
      createdAt: new Date().toISOString(),
      pipelineVersion: '1.0.0',
    },
  };
}

function createManifestWithTranscript(videoId: string, jobId: string): ArtifactManifest {
  return {
    version: '1.0.0',
    videoId,
    jobId,
    artifacts: {
      video: {
        normalized: {
          key: `videos/${videoId}/normalized.mp4`,
          bucket: 'test-bucket',
          size: 1000000,
          contentType: 'video/mp4',
          checksum: 'sha256:test',
        },
      },
      transcript: {
        json: {
          key: `transcripts/${videoId}/transcript.json`,
          bucket: 'test-bucket',
          size: 50000,
          contentType: 'application/json',
          checksum: 'sha256:transcript',
        },
      },
    },
    metadata: {
      createdAt: new Date().toISOString(),
      pipelineVersion: '1.0.0',
    },
  };
}

function createManifestWithTopics(videoId: string, jobId: string): ArtifactManifest {
  return {
    version: '1.0.0',
    videoId,
    jobId,
    artifacts: {
      video: {
        normalized: {
          key: `videos/${videoId}/normalized.mp4`,
          bucket: 'test-bucket',
          size: 1000000,
          contentType: 'video/mp4',
          checksum: 'sha256:test',
        },
      },
      transcript: {
        json: {
          key: `transcripts/${videoId}/transcript.json`,
          bucket: 'test-bucket',
          size: 50000,
          contentType: 'application/json',
          checksum: 'sha256:transcript',
        },
      },
      topics: {
        json: {
          key: `topics/${videoId}/topics.json`,
          bucket: 'test-bucket',
          size: 10000,
          contentType: 'application/json',
          checksum: 'sha256:topics',
        },
      },
    },
    metadata: {
      createdAt: new Date().toISOString(),
      pipelineVersion: '1.0.0',
    },
  };
}
