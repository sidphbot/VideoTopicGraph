/**
 * Infrastructure Test Helpers
 */

import { setupTestDb, teardownTestDb } from './database';
import { setupTestStorage, teardownTestStorage } from './storage';

export interface TestInfrastructure {
  baseUrl: string;
}

export async function setupTestInfrastructure(): Promise<TestInfrastructure> {
  await setupTestDb();
  await setupTestStorage();

  return {
    baseUrl: process.env.TEST_API_URL || 'http://localhost:3000',
  };
}

export async function teardownTestInfrastructure(infra: TestInfrastructure): Promise<void> {
  await teardownTestDb();
  await teardownTestStorage();
}
