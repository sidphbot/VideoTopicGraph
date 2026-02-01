/**
 * Pipeline SDK Utilities
 * 
 * Helper functions and utilities for pipeline operations.
 */

import type { Logger, StorageService } from '@video-graph/shared-types';

/**
 * Create a console-based logger
 */
export function createConsoleLogger(prefix?: string): Logger {
  const p = prefix ? `[${prefix}] ` : '';
  return {
    debug: (msg, meta) => console.debug(`${p}[DEBUG] ${msg}`, meta),
    info: (msg, meta) => console.info(`${p}[INFO] ${msg}`, meta),
    warn: (msg, meta) => console.warn(`${p}[WARN] ${msg}`, meta),
    error: (msg, meta) => console.error(`${p}[ERROR] ${msg}`, meta),
  };
}

/**
 * Create a no-op logger (for testing)
 */
export function createNoopLogger(): Logger {
  return {
    debug: () => {},
    info: () => {},
    warn: () => {},
    error: () => {},
  };
}

/**
 * Create an in-memory storage service (for testing)
 */
export function createMemoryStorage(): StorageService {
  const storage = new Map<string, Buffer>();

  return {
    read: async (path: string) => {
      const data = storage.get(path);
      if (!data) {
        throw new Error(`File not found: ${path}`);
      }
      return data;
    },
    write: async (path: string, data: Buffer) => {
      storage.set(path, data);
    },
    exists: async (path: string) => storage.has(path),
    delete: async (path: string) => {
      storage.delete(path);
    },
    getUrl: async (path: string) => `memory://${path}`,
    list: async (prefix: string) =>
      Array.from(storage.keys()).filter((k) => k.startsWith(prefix)),
  };
}

/**
 * Sleep for a given number of milliseconds
 */
export function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

/**
 * Retry a function with exponential backoff
 */
export async function withRetry<T>(
  fn: () => Promise<T>,
  options: {
    maxAttempts: number;
    delayMs: number;
    backoff: 'fixed' | 'exponential';
    onRetry?: (attempt: number, error: Error) => void;
  }
): Promise<T> {
  let lastError: Error;

  for (let attempt = 1; attempt <= options.maxAttempts; attempt++) {
    try {
      return await fn();
    } catch (error) {
      lastError = error instanceof Error ? error : new Error(String(error));

      if (attempt === options.maxAttempts) {
        throw lastError;
      }

      options.onRetry?.(attempt, lastError);

      const delay =
        options.backoff === 'exponential'
          ? options.delayMs * Math.pow(2, attempt - 1)
          : options.delayMs;

      await sleep(delay);
    }
  }

  throw lastError!;
}

/**
 * Measure execution time of a function
 */
export async function measureTime<T>(
  fn: () => Promise<T>
): Promise<{ result: T; durationMs: number }> {
  const start = Date.now();
  const result = await fn();
  const durationMs = Date.now() - start;
  return { result, durationMs };
}

/**
 * Format bytes to human-readable string
 */
export function formatBytes(bytes: number): string {
  if (bytes === 0) return '0 B';
  const k = 1024;
  const sizes = ['B', 'KB', 'MB', 'GB', 'TB'];
  const i = Math.floor(Math.log(bytes) / Math.log(k));
  return `${parseFloat((bytes / Math.pow(k, i)).toFixed(2))} ${sizes[i]}`;
}

/**
 * Format seconds to human-readable duration
 */
export function formatDuration(seconds: number): string {
  const hrs = Math.floor(seconds / 3600);
  const mins = Math.floor((seconds % 3600) / 60);
  const secs = Math.floor(seconds % 60);

  if (hrs > 0) {
    return `${hrs}h ${mins}m ${secs}s`;
  } else if (mins > 0) {
    return `${mins}m ${secs}s`;
  } else {
    return `${secs}s`;
  }
}

/**
 * Sanitize a string for use as a filename
 */
export function sanitizeFilename(name: string): string {
  return name
    .replace(/[^a-zA-Z0-9_-]/g, '_')
    .replace(/_+/g, '_')
    .slice(0, 100);
}

/**
 * Generate a unique ID
 */
export function generateId(): string {
  return `${Date.now()}-${Math.random().toString(36).slice(2, 11)}`;
}

/**
 * Deep clone an object
 */
export function deepClone<T>(obj: T): T {
  return JSON.parse(JSON.stringify(obj));
}

/**
 * Merge two objects deeply
 */
export function deepMerge<T extends Record<string, unknown>>(
  target: T,
  source: Partial<T>
): T {
  const result = { ...target };

  for (const key in source) {
    if (source[key] && typeof source[key] === 'object' && !Array.isArray(source[key])) {
      result[key] = deepMerge(
        (result[key] as Record<string, unknown>) || {},
        source[key] as Record<string, unknown>
      ) as T[Extract<keyof T, string>];
    } else if (source[key] !== undefined) {
      result[key] = source[key] as T[Extract<keyof T, string>];
    }
  }

  return result;
}

/**
 * Chunk an array into smaller arrays
 */
export function chunk<T>(array: T[], size: number): T[][] {
  const chunks: T[][] = [];
  for (let i = 0; i < array.length; i += size) {
    chunks.push(array.slice(i, i + size));
  }
  return chunks;
}

/**
 * Run promises in parallel with concurrency limit
 */
export async function parallelLimit<T, R>(
  items: T[],
  limit: number,
  fn: (item: T) => Promise<R>
): Promise<R[]> {
  const results: R[] = [];
  const executing: Promise<void>[] = [];

  for (const [index, item] of items.entries()) {
    const promise = fn(item).then((result) => {
      results[index] = result;
    });
    executing.push(promise);

    if (executing.length >= limit) {
      await Promise.race(executing);
      executing.splice(
        executing.findIndex((p) => p === promise),
        1
      );
    }
  }

  await Promise.all(executing);
  return results;
}

/**
 * Context for async local storage (for request tracing)
 */
export const context = {
  getRequestId(): string | undefined {
    return undefined; // Placeholder for async local storage implementation
  },
  setRequestId(id: string): void {
    // Placeholder
  },
};
