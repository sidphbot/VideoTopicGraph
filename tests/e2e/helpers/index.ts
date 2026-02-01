/**
 * E2E Test Helpers
 */

import { request } from '@playwright/test';

export interface TestEnvironment {
  baseUrl: string;
  apiUrl: string;
}

export async function setupTestEnvironment(): Promise<TestEnvironment> {
  const baseUrl = process.env.E2E_BASE_URL || 'http://localhost:80';
  const apiUrl = process.env.E2E_API_URL || 'http://localhost:3000';

  return {
    baseUrl,
    apiUrl,
  };
}

export async function cleanupTestEnvironment(): Promise<void> {
  // Cleanup logic if needed
}

export async function createTestUser(): Promise<{ email: string; password: string }> {
  const timestamp = Date.now();
  return {
    email: `test-${timestamp}@example.com`,
    password: 'TestPassword123!',
  };
}

export async function createTestVideo(apiUrl: string, authToken: string): Promise<string> {
  const context = await request.newContext({
    baseURL: apiUrl,
    extraHTTPHeaders: {
      'Authorization': `Bearer ${authToken}`,
    },
  });

  const response = await context.post('/api/v1/videos', {
    data: {
      title: 'E2E Test Video',
      originalUrl: 'https://example.com/e2e-test',
    },
  });

  const data = await response.json();
  await context.dispose();

  return data.id;
}

export async function seedSearchData(apiUrl: string): Promise<void> {
  // Implementation would seed search data via API
}
