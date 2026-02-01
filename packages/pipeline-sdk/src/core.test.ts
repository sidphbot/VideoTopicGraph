/**
 * Unit Tests - Pipeline SDK Core
 * 
 * Tests for PipelineStep base class and PipelineOrchestrator.
 */

import { describe, it, expect, vi, beforeEach } from 'vitest';
import { BasePipelineStep, PipelineOrchestrator } from './core';
import { PipelineStage, PipelineStatus, type ArtifactManifest } from '@video-graph/shared-types';
import type { StepContext, StepResult } from './types';

// Mock step implementation for testing
class MockPipelineStep extends BasePipelineStep {
  private shouldFail: boolean;
  private executionTime: number;

  constructor(config: { shouldFail?: boolean; executionTime?: number } = {}) {
    super(PipelineStage.VIDEO, 'mock-step', {
      maxRetries: 2,
      timeoutMs: 5000,
    });
    this.shouldFail = config.shouldFail ?? false;
    this.executionTime = config.executionTime ?? 10;
  }

  async execute(context: StepContext): Promise<StepResult> {
    // Simulate work
    await new Promise(resolve => setTimeout(resolve, this.executionTime));

    if (this.shouldFail) {
      throw new Error('Mock execution failed');
    }

    return {
      success: true,
      artifacts: {
        test: {
          output: {
            key: `test/${context.videoId}/output.txt`,
            bucket: 'test-bucket',
            size: 100,
            contentType: 'text/plain',
            checksum: 'sha256:test',
          },
        },
      },
      metrics: {
        executionTimeMs: this.executionTime,
        memoryPeakMb: 50,
      },
    };
  }

  async validateContext(context: StepContext): Promise<boolean> {
    return !!context.videoId && !!context.jobId;
  }

  async cleanup(context: StepContext): Promise<void> {
    // Mock cleanup
    console.log(`Cleaning up for ${context.videoId}`);
  }
}

describe('BasePipelineStep', () => {
  describe('constructor', () => {
    it('should create step with correct configuration', () => {
      const step = new MockPipelineStep();
      expect(step.stage).toBe(PipelineStage.VIDEO);
      expect(step.name).toBe('mock-step');
    });

    it('should use default config when not provided', () => {
      const step = new MockPipelineStep();
      expect(step.config.maxRetries).toBe(2);
      expect(step.config.timeoutMs).toBe(5000);
    });
  });

  describe('executeWithRetry', () => {
    it('should execute successfully on first attempt', async () => {
      const step = new MockPipelineStep();
      const context: StepContext = {
        videoId: 'vid-123',
        jobId: 'job-456',
        manifest: createMockManifest(),
        config: {},
      };

      const result = await step.executeWithRetry(context);

      expect(result.success).toBe(true);
      expect(result.artifacts).toBeDefined();
      expect(result.metrics?.executionTimeMs).toBe(10);
    });

    it('should retry on failure and eventually succeed', async () => {
      let attempts = 0;
      const step = new MockPipelineStep({ shouldFail: true });
      
      // Override execute to fail first 2 times then succeed
      const originalExecute = step.execute.bind(step);
      step.execute = async (ctx: StepContext): Promise<StepResult> => {
        attempts++;
        if (attempts < 3) {
          throw new Error(`Attempt ${attempts} failed`);
        }
        return originalExecute(ctx);
      };

      const context: StepContext = {
        videoId: 'vid-123',
        jobId: 'job-456',
        manifest: createMockManifest(),
        config: {},
      };

      const result = await step.executeWithRetry(context);

      expect(result.success).toBe(true);
      expect(attempts).toBe(3);
    });

    it('should fail after max retries exceeded', async () => {
      const step = new MockPipelineStep({ shouldFail: true });
      const context: StepContext = {
        videoId: 'vid-123',
        jobId: 'job-456',
        manifest: createMockManifest(),
        config: {},
      };

      await expect(step.executeWithRetry(context)).rejects.toThrow('Mock execution failed');
    });

    it('should respect timeout', async () => {
      const step = new MockPipelineStep({ executionTime: 10000 });
      step.config.timeoutMs = 50; // Very short timeout

      const context: StepContext = {
        videoId: 'vid-123',
        jobId: 'job-456',
        manifest: createMockManifest(),
        config: {},
      };

      await expect(step.executeWithRetry(context)).rejects.toThrow('timeout');
    });
  });

  describe('validateContext', () => {
    it('should return true for valid context', async () => {
      const step = new MockPipelineStep();
      const context: StepContext = {
        videoId: 'vid-123',
        jobId: 'job-456',
        manifest: createMockManifest(),
        config: {},
      };

      const isValid = await step.validateContext(context);
      expect(isValid).toBe(true);
    });

    it('should return false for invalid context', async () => {
      const step = new MockPipelineStep();
      const context: StepContext = {
        videoId: '',
        jobId: 'job-456',
        manifest: createMockManifest(),
        config: {},
      };

      const isValid = await step.validateContext(context);
      expect(isValid).toBe(false);
    });
  });

  describe('onSuccess', () => {
    it('should update manifest with artifacts', async () => {
      const step = new MockPipelineStep();
      const manifest = createMockManifest();
      const result: StepResult = {
        success: true,
        artifacts: {
          video: {
            processed: {
              key: 'videos/vid-123/processed.mp4',
              bucket: 'test-bucket',
              size: 1000,
              contentType: 'video/mp4',
              checksum: 'sha256:xyz',
            },
          },
        },
      };

      await step.onSuccess(manifest, result);

      expect(manifest.artifacts.video?.processed).toBeDefined();
      expect(manifest.artifacts.video?.processed?.key).toBe('videos/vid-123/processed.mp4');
    });
  });

  describe('onFailure', () => {
    it('should handle failure with error info', async () => {
      const step = new MockPipelineStep();
      const manifest = createMockManifest();
      const error = new Error('Test error');

      await step.onFailure(manifest, error);

      expect(manifest.metadata.error).toBeDefined();
      expect(manifest.metadata.error?.message).toBe('Test error');
    });
  });
});

describe('PipelineOrchestrator', () => {
  let orchestrator: PipelineOrchestrator;

  beforeEach(() => {
    orchestrator = new PipelineOrchestrator();
  });

  describe('registerStep', () => {
    it('should register a step for a stage', () => {
      const step = new MockPipelineStep();
      orchestrator.registerStep(PipelineStage.VIDEO, step);

      const registeredStep = orchestrator.getStep(PipelineStage.VIDEO);
      expect(registeredStep).toBe(step);
    });

    it('should throw error for duplicate stage registration', () => {
      const step1 = new MockPipelineStep();
      const step2 = new MockPipelineStep();

      orchestrator.registerStep(PipelineStage.VIDEO, step1);
      expect(() => orchestrator.registerStep(PipelineStage.VIDEO, step2)).toThrow();
    });
  });

  describe('executeStage', () => {
    it('should execute registered step', async () => {
      const step = new MockPipelineStep();
      orchestrator.registerStep(PipelineStage.VIDEO, step);

      const context: StepContext = {
        videoId: 'vid-123',
        jobId: 'job-456',
        manifest: createMockManifest(),
        config: {},
      };

      const result = await orchestrator.executeStage(PipelineStage.VIDEO, context);

      expect(result.success).toBe(true);
    });

    it('should throw error for unregistered stage', async () => {
      const context: StepContext = {
        videoId: 'vid-123',
        jobId: 'job-456',
        manifest: createMockManifest(),
        config: {},
      };

      await expect(orchestrator.executeStage(PipelineStage.ASR, context)).rejects.toThrow();
    });
  });

  describe('executePipeline', () => {
    it('should execute full pipeline in order', async () => {
      const executionOrder: string[] = [];

      // Create steps for each stage that track execution order
      const stages = [
        PipelineStage.VIDEO,
        PipelineStage.ASR,
        PipelineStage.TOPICS,
      ];

      for (const stage of stages) {
        const step = new MockPipelineStep();
        const originalExecute = step.execute.bind(step);
        step.execute = async (ctx: StepContext): Promise<StepResult> => {
          executionOrder.push(stage);
          return originalExecute(ctx);
        };
        step.stage = stage;
        orchestrator.registerStep(stage, step);
      }

      const manifest = createMockManifest();
      const result = await orchestrator.executePipeline('vid-123', 'job-456', manifest);

      expect(result.success).toBe(true);
      expect(executionOrder).toEqual([PipelineStage.VIDEO, PipelineStage.ASR, PipelineStage.TOPICS]);
    });

    it('should stop on first failure', async () => {
      const failingStep = new MockPipelineStep({ shouldFail: true });
      orchestrator.registerStep(PipelineStage.VIDEO, failingStep);

      const manifest = createMockManifest();
      const result = await orchestrator.executePipeline('vid-123', 'job-456', manifest);

      expect(result.success).toBe(false);
      expect(result.failedStage).toBe(PipelineStage.VIDEO);
      expect(result.error).toBeDefined();
    });

    it('should update manifest after each stage', async () => {
      const step = new MockPipelineStep();
      orchestrator.registerStep(PipelineStage.VIDEO, step);

      const manifest = createMockManifest();
      await orchestrator.executePipeline('vid-123', 'job-456', manifest);

      expect(Object.keys(manifest.artifacts).length).toBeGreaterThan(0);
    });
  });

  describe('getRegisteredStages', () => {
    it('should return all registered stages', () => {
      orchestrator.registerStep(PipelineStage.VIDEO, new MockPipelineStep());
      orchestrator.registerStep(PipelineStage.ASR, new MockPipelineStep());

      const stages = orchestrator.getRegisteredStages();
      expect(stages).toContain(PipelineStage.VIDEO);
      expect(stages).toContain(PipelineStage.ASR);
      expect(stages).toHaveLength(2);
    });
  });
});

// Helper function to create mock manifest
function createMockManifest(): ArtifactManifest {
  return {
    version: '1.0.0',
    videoId: 'vid-123',
    jobId: 'job-456',
    artifacts: {},
    metadata: {
      createdAt: new Date().toISOString(),
      pipelineVersion: '1.0.0',
    },
  };
}
