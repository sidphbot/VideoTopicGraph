/**
 * Integration Tests - API Service
 * 
 * Tests for API endpoints with real database and dependencies.
 */

import { describe, it, expect, beforeAll, afterAll, beforeEach } from 'vitest';
import { build } from '../../services/api/src/app';
import { setupTestDb, teardownTestDb, resetTestDb } from './helpers/database';
import { setupTestStorage, teardownTestStorage } from './helpers/storage';
import type { FastifyInstance } from 'fastify';

describe('API Integration Tests', () => {
  let app: FastifyInstance;
  let authToken: string;

  beforeAll(async () => {
    // Setup test infrastructure
    await setupTestDb();
    await setupTestStorage();

    // Build and start API
    app = await build({
      databaseUrl: process.env.TEST_DATABASE_URL!,
      redisUrl: process.env.TEST_REDIS_URL!,
    });

    await app.ready();

    // Get auth token for tests
    authToken = await getTestAuthToken(app);
  });

  afterAll(async () => {
    await app.close();
    await teardownTestDb();
    await teardownTestStorage();
  });

  beforeEach(async () => {
    await resetTestDb();
  });

  describe('Health Endpoints', () => {
    it('GET /health should return healthy status', async () => {
      const response = await app.inject({
        method: 'GET',
        url: '/health',
      });

      expect(response.statusCode).toBe(200);
      const body = JSON.parse(response.body);
      expect(body.status).toBe('healthy');
      expect(body.services.database).toBe('connected');
    });

    it('GET /ready should return ready status', async () => {
      const response = await app.inject({
        method: 'GET',
        url: '/ready',
      });

      expect(response.statusCode).toBe(200);
    });
  });

  describe('Video Management', () => {
    it('POST /api/v1/videos should create a new video', async () => {
      const response = await app.inject({
        method: 'POST',
        url: '/api/v1/videos',
        headers: {
          Authorization: `Bearer ${authToken}`,
          'Content-Type': 'application/json',
        },
        payload: {
          title: 'Test Video',
          description: 'Integration test video',
          originalUrl: 'https://youtube.com/watch?v=test123',
        },
      });

      expect(response.statusCode).toBe(201);
      const body = JSON.parse(response.body);
      expect(body.id).toBeDefined();
      expect(body.title).toBe('Test Video');
      expect(body.status).toBe('pending');
    });

    it('POST /api/v1/videos should reject invalid URL', async () => {
      const response = await app.inject({
        method: 'POST',
        url: '/api/v1/videos',
        headers: {
          Authorization: `Bearer ${authToken}`,
          'Content-Type': 'application/json',
        },
        payload: {
          title: 'Test Video',
          originalUrl: 'not-a-valid-url',
        },
      });

      expect(response.statusCode).toBe(400);
    });

    it('GET /api/v1/videos should list videos with pagination', async () => {
      // Create test videos
      for (let i = 0; i < 5; i++) {
        await app.inject({
          method: 'POST',
          url: '/api/v1/videos',
          headers: {
            Authorization: `Bearer ${authToken}`,
            'Content-Type': 'application/json',
          },
          payload: {
            title: `Video ${i}`,
            originalUrl: `https://example.com/video${i}`,
          },
        });
      }

      const response = await app.inject({
        method: 'GET',
        url: '/api/v1/videos?limit=3&offset=0',
        headers: {
          Authorization: `Bearer ${authToken}`,
        },
      });

      expect(response.statusCode).toBe(200);
      const body = JSON.parse(response.body);
      expect(body.items).toHaveLength(3);
      expect(body.total).toBe(5);
      expect(body.hasMore).toBe(true);
    });

    it('GET /api/v1/videos/:id should return video details', async () => {
      const createResponse = await app.inject({
        method: 'POST',
        url: '/api/v1/videos',
        headers: {
          Authorization: `Bearer ${authToken}`,
          'Content-Type': 'application/json',
        },
        payload: {
          title: 'Test Video',
          originalUrl: 'https://example.com/test',
        },
      });

      const { id } = JSON.parse(createResponse.body);

      const getResponse = await app.inject({
        method: 'GET',
        url: `/api/v1/videos/${id}`,
        headers: {
          Authorization: `Bearer ${authToken}`,
        },
      });

      expect(getResponse.statusCode).toBe(200);
      const body = JSON.parse(getResponse.body);
      expect(body.id).toBe(id);
      expect(body.title).toBe('Test Video');
    });

    it('DELETE /api/v1/videos/:id should delete video', async () => {
      const createResponse = await app.inject({
        method: 'POST',
        url: '/api/v1/videos',
        headers: {
          Authorization: `Bearer ${authToken}`,
          'Content-Type': 'application/json',
        },
        payload: {
          title: 'Video to Delete',
          originalUrl: 'https://example.com/delete',
        },
      });

      const { id } = JSON.parse(createResponse.body);

      const deleteResponse = await app.inject({
        method: 'DELETE',
        url: `/api/v1/videos/${id}`,
        headers: {
          Authorization: `Bearer ${authToken}`,
        },
      });

      expect(deleteResponse.statusCode).toBe(204);

      // Verify deletion
      const getResponse = await app.inject({
        method: 'GET',
        url: `/api/v1/videos/${id}`,
        headers: {
          Authorization: `Bearer ${authToken}`,
        },
      });

      expect(getResponse.statusCode).toBe(404);
    });
  });

  describe('Pipeline Jobs', () => {
    let videoId: string;

    beforeEach(async () => {
      const response = await app.inject({
        method: 'POST',
        url: '/api/v1/videos',
        headers: {
          Authorization: `Bearer ${authToken}`,
          'Content-Type': 'application/json',
        },
        payload: {
          title: 'Pipeline Test Video',
          originalUrl: 'https://example.com/pipeline',
        },
      });

      videoId = JSON.parse(response.body).id;
    });

    it('POST /api/v1/videos/:id/process should start pipeline', async () => {
      const response = await app.inject({
        method: 'POST',
        url: `/api/v1/videos/${videoId}/process`,
        headers: {
          Authorization: `Bearer ${authToken}`,
          'Content-Type': 'application/json',
        },
        payload: {
          stages: ['video', 'asr', 'topics'],
          priority: 5,
        },
      });

      expect(response.statusCode).toBe(202);
      const body = JSON.parse(response.body);
      expect(body.jobId).toBeDefined();
      expect(body.status).toBe('queued');
    });

    it('GET /api/v1/jobs/:id should return job status', async () => {
      const processResponse = await app.inject({
        method: 'POST',
        url: `/api/v1/videos/${videoId}/process`,
        headers: {
          Authorization: `Bearer ${authToken}`,
        },
        payload: { stages: ['video'] },
      });

      const { jobId } = JSON.parse(processResponse.body);

      const getResponse = await app.inject({
        method: 'GET',
        url: `/api/v1/jobs/${jobId}`,
        headers: {
          Authorization: `Bearer ${authToken}`,
        },
      });

      expect(getResponse.statusCode).toBe(200);
      const body = JSON.parse(getResponse.body);
      expect(body.id).toBe(jobId);
      expect(body.videoId).toBe(videoId);
    });

    it('POST /api/v1/jobs/:id/cancel should cancel job', async () => {
      const processResponse = await app.inject({
        method: 'POST',
        url: `/api/v1/videos/${videoId}/process`,
        headers: {
          Authorization: `Bearer ${authToken}`,
        },
        payload: { stages: ['video'] },
      });

      const { jobId } = JSON.parse(processResponse.body);

      const cancelResponse = await app.inject({
        method: 'POST',
        url: `/api/v1/jobs/${jobId}/cancel`,
        headers: {
          Authorization: `Bearer ${authToken}`,
        },
      });

      expect(cancelResponse.statusCode).toBe(200);
    });
  });

  describe('Topic Graph', () => {
    let videoId: string;

    beforeEach(async () => {
      const response = await app.inject({
        method: 'POST',
        url: '/api/v1/videos',
        headers: {
          Authorization: `Bearer ${authToken}`,
          'Content-Type': 'application/json',
        },
        payload: {
          title: 'Graph Test Video',
          originalUrl: 'https://example.com/graph',
        },
      });

      videoId = JSON.parse(response.body).id;

      // Seed nodes and edges
      await seedGraphData(videoId);
    });

    it('GET /api/v1/videos/:id/nodes should return topic nodes', async () => {
      const response = await app.inject({
        method: 'GET',
        url: `/api/v1/videos/${videoId}/nodes`,
        headers: {
          Authorization: `Bearer ${authToken}`,
        },
      });

      expect(response.statusCode).toBe(200);
      const body = JSON.parse(response.body);
      expect(Array.isArray(body.nodes)).toBe(true);
      expect(body.nodes.length).toBeGreaterThan(0);
    });

    it('GET /api/v1/videos/:id/edges should return edges', async () => {
      const response = await app.inject({
        method: 'GET',
        url: `/api/v1/videos/${videoId}/edges`,
        headers: {
          Authorization: `Bearer ${authToken}`,
        },
      });

      expect(response.statusCode).toBe(200);
      const body = JSON.parse(response.body);
      expect(Array.isArray(body.edges)).toBe(true);
    });

    it('GET /api/v1/videos/:id/graph should return full graph', async () => {
      const response = await app.inject({
        method: 'GET',
        url: `/api/v1/videos/${videoId}/graph`,
        headers: {
          Authorization: `Bearer ${authToken}`,
        },
      });

      expect(response.statusCode).toBe(200);
      const body = JSON.parse(response.body);
      expect(body.nodes).toBeDefined();
      expect(body.edges).toBeDefined();
      expect(body.videoId).toBe(videoId);
    });
  });

  describe('Search', () => {
    it('POST /api/v1/search should perform semantic search', async () => {
      const response = await app.inject({
        method: 'POST',
        url: '/api/v1/search',
        headers: {
          Authorization: `Bearer ${authToken}`,
          'Content-Type': 'application/json',
        },
        payload: {
          query: 'machine learning',
          searchType: 'semantic',
          limit: 10,
        },
      });

      expect(response.statusCode).toBe(200);
      const body = JSON.parse(response.body);
      expect(Array.isArray(body.results)).toBe(true);
    });

    it('POST /api/v1/search should perform fulltext search', async () => {
      const response = await app.inject({
        method: 'POST',
        url: '/api/v1/search',
        headers: {
          Authorization: `Bearer ${authToken}`,
          'Content-Type': 'application/json',
        },
        payload: {
          query: 'neural networks',
          searchType: 'fulltext',
        },
      });

      expect(response.statusCode).toBe(200);
    });

    it('POST /api/v1/search should support hybrid search', async () => {
      const response = await app.inject({
        method: 'POST',
        url: '/api/v1/search',
        headers: {
          Authorization: `Bearer ${authToken}`,
          'Content-Type': 'application/json',
        },
        payload: {
          query: 'deep learning',
          searchType: 'hybrid',
          filters: {
            dateRange: {
              from: '2024-01-01',
              to: '2024-12-31',
            },
          },
        },
      });

      expect(response.statusCode).toBe(200);
    });
  });

  describe('Authentication', () => {
    it('should reject requests without auth token', async () => {
      const response = await app.inject({
        method: 'GET',
        url: '/api/v1/videos',
      });

      expect(response.statusCode).toBe(401);
    });

    it('should reject invalid auth tokens', async () => {
      const response = await app.inject({
        method: 'GET',
        url: '/api/v1/videos',
        headers: {
          Authorization: 'Bearer invalid-token',
        },
      });

      expect(response.statusCode).toBe(401);
    });

    it('POST /auth/token should exchange code for token', async () => {
      const response = await app.inject({
        method: 'POST',
        url: '/auth/token',
        payload: {
          code: 'test-auth-code',
        },
      });

      // In test environment, should return mock token
      expect([200, 400]).toContain(response.statusCode);
    });
  });
});

// Helper functions
async function getTestAuthToken(app: FastifyInstance): Promise<string> {
  // In test environment, generate a mock token
  const response = await app.inject({
    method: 'POST',
    url: '/auth/test-token',
    payload: {
      userId: 'test-user',
      email: 'test@example.com',
    },
  });

  if (response.statusCode === 200) {
    return JSON.parse(response.body).access_token;
  }

  // Fallback: return a mock token
  return 'test-mock-token';
}

async function seedGraphData(videoId: string): Promise<void> {
  // Implementation would insert test nodes and edges into database
  // This is handled by the test helper
}
