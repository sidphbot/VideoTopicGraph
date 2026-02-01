/**
 * Core Pipeline SDK Classes and Interfaces
 * 
 * Defines the base classes that all pipeline steps must extend.
 */

import type {
  PipelineStep,
  PipelineContext,
  ArtifactManifest,
  ValidationResult,
  ArtifactPaths,
  Logger,
} from '@video-graph/shared-types';

export type {
  PipelineStep,
  PipelineContext,
  ArtifactManifest,
  ValidationResult,
  ArtifactPaths,
  Logger,
};

/**
 * Abstract base class for all pipeline steps.
 * All pipeline steps must extend this class.
 */
export abstract class BasePipelineStep implements PipelineStep {
  abstract readonly name: string;
  abstract readonly version: string;

  /**
   * Execute the pipeline step
   * @param manifest - Input artifact manifest
   * @param context - Execution context
   * @returns Updated manifest with new artifacts
   */
  abstract execute(
    manifest: ArtifactManifest,
    context: PipelineContext
  ): Promise<ArtifactManifest>;

  /**
   * Validate that required inputs exist
   * @param manifest - Input manifest to validate
   * @returns Validation result
   */
  validateInput(manifest: ArtifactManifest): ValidationResult {
    const required = this.getRequiredInputs();
    const errors: string[] = [];
    const warnings: string[] = [];

    for (const key of required) {
      const value = manifest.paths[key];
      if (value === undefined || value === null) {
        errors.push(`Missing required input: ${key}`);
      } else if (Array.isArray(value) && value.length === 0) {
        warnings.push(`Empty array for input: ${key}`);
      }
    }

    return {
      valid: errors.length === 0,
      errors,
      warnings,
    };
  }

  /**
   * Get list of required input paths
   */
  abstract getRequiredInputs(): (keyof ArtifactPaths)[];

  /**
   * Get list of produced output paths
   */
  abstract getProducedOutputs(): (keyof ArtifactPaths)[];

  /**
   * Update manifest with new paths and timestamp
   */
  protected updateManifest(
    manifest: ArtifactManifest,
    updates: Partial<ArtifactPaths>
  ): ArtifactManifest {
    return {
      ...manifest,
      paths: {
        ...manifest.paths,
        ...updates,
      },
      updated_at: new Date().toISOString(),
    };
  }

  /**
   * Update manifest metrics
   */
  protected updateMetrics(
    manifest: ArtifactManifest,
    updates: Partial<ArtifactManifest['metrics']>
  ): ArtifactManifest {
    return {
      ...manifest,
      metrics: {
        ...manifest.metrics,
        ...updates,
      },
      updated_at: new Date().toISOString(),
    };
  }

  /**
   * Mark step as completed
   */
  protected markStepCompleted(
    manifest: ArtifactManifest,
    stepName: string
  ): ArtifactManifest {
    return {
      ...manifest,
      completed_steps: [...(manifest.completed_steps || []), stepName],
      updated_at: new Date().toISOString(),
    };
  }

  /**
   * Record step error
   */
  protected recordError(
    manifest: ArtifactManifest,
    stepName: string,
    error: string
  ): ArtifactManifest {
    return {
      ...manifest,
      step_errors: {
        ...(manifest.step_errors || {}),
        [stepName]: error,
      },
      updated_at: new Date().toISOString(),
    };
  }
}

/**
 * Pipeline step decorator for metadata
 */
export function StepMetadata(metadata: {
  name: string;
  version: string;
  description?: string;
  author?: string;
}) {
  return function <T extends new (...args: any[]) => BasePipelineStep>(
    constructor: T
  ) {
    return class extends constructor {
      readonly name = metadata.name;
      readonly version = metadata.version;
      readonly description = metadata.description;
      readonly author = metadata.author;
    };
  };
}

/**
 * Pipeline orchestrator that executes steps in sequence
 */
export class PipelineOrchestrator {
  private steps: Map<string, PipelineStep> = new Map();

  /**
   * Register a pipeline step
   */
  registerStep(step: PipelineStep): void {
    this.steps.set(step.name, step);
  }

  /**
   * Get a registered step
   */
  getStep(name: string): PipelineStep | undefined {
    return this.steps.get(name);
  }

  /**
   * Check if a step is registered
   */
  hasStep(name: string): boolean {
    return this.steps.has(name);
  }

  /**
   * Execute a pipeline with the given steps
   */
  async executePipeline(
    manifest: ArtifactManifest,
    context: PipelineContext,
    stepNames: string[]
  ): Promise<{
    success: boolean;
    manifest: ArtifactManifest;
    results: Array<{
      stepName: string;
      success: boolean;
      durationMs: number;
      error?: string;
    }>;
  }> {
    const results: Array<{
      stepName: string;
      success: boolean;
      durationMs: number;
      error?: string;
    }> = [];

    let currentManifest = manifest;

    for (const stepName of stepNames) {
      const step = this.steps.get(stepName);
      if (!step) {
        const error = `Step not found: ${stepName}`;
        context.logger.error(error);
        results.push({
          stepName,
          success: false,
          durationMs: 0,
          error,
        });
        return { success: false, manifest: currentManifest, results };
      }

      // Check for abort signal
      if (context.abortSignal?.aborted) {
        const error = 'Pipeline aborted';
        context.logger.warn(error);
        results.push({
          stepName,
          success: false,
          durationMs: 0,
          error,
        });
        return { success: false, manifest: currentManifest, results };
      }

      // Validate inputs
      const validation = step.validateInput(currentManifest);
      if (!validation.valid) {
        const error = `Input validation failed for ${stepName}: ${validation.errors.join(', ')}`;
        context.logger.error(error);
        results.push({
          stepName,
          success: false,
          durationMs: 0,
          error,
        });
        return { success: false, manifest: currentManifest, results };
      }

      // Execute step
      const startTime = Date.now();
      context.logger.info(`Starting step: ${stepName}`);
      context.onProgress?.(0, `Starting ${stepName}`);

      try {
        currentManifest = await step.execute(currentManifest, context);
        const durationMs = Date.now() - startTime;

        context.logger.info(`Completed step: ${stepName} in ${durationMs}ms`);
        context.onProgress?.(100, `Completed ${stepName}`);

        results.push({
          stepName,
          success: true,
          durationMs,
        });
      } catch (error) {
        const durationMs = Date.now() - startTime;
        const errorMessage = error instanceof Error ? error.message : String(error);

        context.logger.error(`Step ${stepName} failed: ${errorMessage}`);

        results.push({
          stepName,
          success: false,
          durationMs,
          error: errorMessage,
        });

        return { success: false, manifest: currentManifest, results };
      }
    }

    return { success: true, manifest: currentManifest, results };
  }

  /**
   * Get all registered step names
   */
  getRegisteredSteps(): string[] {
    return Array.from(this.steps.keys());
  }
}

/**
 * Create a default pipeline context
 */
export function createPipelineContext(
  options: Partial<PipelineContext> &
    Pick<PipelineContext, 'jobId' | 'videoId' | 'userId' | 'storage' | 'config'>
): PipelineContext {
  const defaultLogger: Logger = {
    debug: (msg, meta) => console.debug(`[DEBUG] ${msg}`, meta),
    info: (msg, meta) => console.info(`[INFO] ${msg}`, meta),
    warn: (msg, meta) => console.warn(`[WARN] ${msg}`, meta),
    error: (msg, meta) => console.error(`[ERROR] ${msg}`, meta),
  };

  return {
    logger: defaultLogger,
    onProgress: () => {},
    ...options,
  };
}

/**
 * Create an empty artifact manifest
 */
export function createEmptyManifest(
  videoId: string,
  graphVersionId: string,
  jobId: string,
  config: ArtifactManifest['config_snapshot']
): ArtifactManifest {
  const now = new Date().toISOString();
  return {
    video_id: videoId,
    graph_version_id: graphVersionId,
    job_id: jobId,
    paths: {},
    metrics: {},
    config_snapshot: config,
    created_at: now,
    updated_at: now,
    completed_steps: [],
    step_errors: {},
  };
}
