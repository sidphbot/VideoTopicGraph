/**
 * Pipeline Step Registry
 * 
 * Provides a registry for swappable pipeline step implementations.
 * Steps can be registered and retrieved by name.
 */

import type { PipelineStep } from './core';

/**
 * Step factory function type
 */
export type StepFactory = () => PipelineStep;

/**
 * Registered step entry
 */
export interface RegisteredStep {
  name: string;
  factory: StepFactory;
  metadata: StepMetadata;
}

/**
 * Step metadata
 */
export interface StepMetadata {
  description: string;
  version: string;
  author: string;
  tags: string[];
  inputs: string[];
  outputs: string[];
  configSchema?: Record<string, unknown>;
}

/**
 * Global step registry
 */
class StepRegistry {
  private steps: Map<string, RegisteredStep> = new Map();

  /**
   * Register a pipeline step
   */
  register(
    name: string,
    factory: StepFactory,
    metadata: StepMetadata
  ): void {
    if (this.steps.has(name)) {
      console.warn(`Step "${name}" is being overwritten`);
    }
    this.steps.set(name, { name, factory, metadata });
  }

  /**
   * Unregister a pipeline step
   */
  unregister(name: string): boolean {
    return this.steps.delete(name);
  }

  /**
   * Create an instance of a registered step
   */
  create(name: string): PipelineStep | undefined {
    const entry = this.steps.get(name);
    if (!entry) {
      return undefined;
    }
    return entry.factory();
  }

  /**
   * Check if a step is registered
   */
  has(name: string): boolean {
    return this.steps.has(name);
  }

  /**
   * Get step metadata
   */
  getMetadata(name: string): StepMetadata | undefined {
    return this.steps.get(name)?.metadata;
  }

  /**
   * List all registered steps
   */
  list(): RegisteredStep[] {
    return Array.from(this.steps.values());
  }

  /**
   * Find steps by tag
   */
  findByTag(tag: string): RegisteredStep[] {
    return this.list().filter((step) => step.metadata.tags.includes(tag));
  }

  /**
   * Find steps by input type
   */
  findByInput(input: string): RegisteredStep[] {
    return this.list().filter((step) => step.metadata.inputs.includes(input));
  }

  /**
   * Find steps by output type
   */
  findByOutput(output: string): RegisteredStep[] {
    return this.list().filter((step) => step.metadata.outputs.includes(output));
  }

  /**
   * Clear all registrations
   */
  clear(): void {
    this.steps.clear();
  }
}

// Export singleton instance
export const stepRegistry = new StepRegistry();

/**
 * Decorator to auto-register a step class
 */
export function RegisterStep(metadata: StepMetadata) {
  return function <T extends new (...args: any[]) => PipelineStep>(
    constructor: T
  ) {
    const name = constructor.prototype.name || constructor.name;
    stepRegistry.register(name, () => new constructor(), metadata);
    return constructor;
  };
}

/**
 * Plugin interface for external step packages
 */
export interface StepPlugin {
  name: string;
  version: string;
  register(registry: StepRegistry): void;
}

/**
 * Load a step plugin
 */
export function loadPlugin(plugin: StepPlugin): void {
  plugin.register(stepRegistry);
}
