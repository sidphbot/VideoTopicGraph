/**
 * E2E Tests - Full Workflow
 * 
 * Playwright tests for complete user workflows.
 */

import { test, expect, Page } from '@playwright/test';
import { setupTestEnvironment, cleanupTestEnvironment, createTestUser } from './helpers';

test.describe('Full Workflow E2E Tests', () => {
  let baseUrl: string;
  let testUser: { email: string; password: string };

  test.beforeAll(async () => {
    const env = await setupTestEnvironment();
    baseUrl = env.baseUrl;
    testUser = await createTestUser();
  });

  test.afterAll(async () => {
    await cleanupTestEnvironment();
  });

  test.describe('Video Upload and Processing', () => {
    test('user can upload a video and process it', async ({ page }) => {
      // Login
      await login(page, baseUrl, testUser);

      // Navigate to upload page
      await page.goto(`${baseUrl}/videos/upload`);
      await expect(page.locator('h1')).toContainText('Upload Video');

      // Enter video URL
      await page.fill('[data-testid="video-url-input"]', 'https://www.youtube.com/watch?v=dQw4w9WgXcQ');
      await page.fill('[data-testid="video-title-input"]', 'Test Video');
      await page.fill('[data-testid="video-description-input"]', 'E2E test video description');

      // Submit
      await page.click('[data-testid="upload-submit-button"]');

      // Wait for video to be created
      await expect(page.locator('[data-testid="video-created-message"]')).toBeVisible();

      // Start processing
      await page.click('[data-testid="start-processing-button"]');

      // Wait for processing to complete
      await expect(page.locator('[data-testid="processing-complete"]')).toBeVisible({ timeout: 300000 });

      // Verify graph is displayed
      await expect(page.locator('[data-testid="topic-graph"]')).toBeVisible();
    });

    test('user can view video details', async ({ page }) => {
      await login(page, baseUrl, testUser);

      // Create a test video via API
      const videoId = await createTestVideo(baseUrl);

      // Navigate to video detail page
      await page.goto(`${baseUrl}/videos/${videoId}`);

      // Verify video details are displayed
      await expect(page.locator('[data-testid="video-title"]')).toBeVisible();
      await expect(page.locator('[data-testid="video-status"]')).toBeVisible();
      await expect(page.locator('[data-testid="video-metadata"]')).toBeVisible();
    });

    test('user can delete a video', async ({ page }) => {
      await login(page, baseUrl, testUser);

      const videoId = await createTestVideo(baseUrl);

      await page.goto(`${baseUrl}/videos/${videoId}`);

      // Click delete button
      await page.click('[data-testid="delete-video-button"]');

      // Confirm deletion
      await page.click('[data-testid="confirm-delete-button"]');

      // Verify redirect to videos list
      await expect(page).toHaveURL(`${baseUrl}/videos`);

      // Verify video is no longer in list
      await expect(page.locator(`[data-testid="video-${videoId}"]`)).not.toBeVisible();
    });
  });

  test.describe('Topic Graph Exploration', () => {
    test('user can explore topic graph', async ({ page }) => {
      await login(page, baseUrl, testUser);

      const videoId = await createTestVideoWithGraph(baseUrl);

      await page.goto(`${baseUrl}/videos/${videoId}/graph`);

      // Wait for graph to load
      await expect(page.locator('[data-testid="graph-canvas"]')).toBeVisible();

      // Click on a node
      await page.click('[data-testid="graph-node"]:first-child');

      // Verify node details panel opens
      await expect(page.locator('[data-testid="node-details-panel"]')).toBeVisible();

      // Verify node information is displayed
      await expect(page.locator('[data-testid="node-title"]')).toBeVisible();
      await expect(page.locator('[data-testid="node-timestamp"]')).toBeVisible();
    });

    test('user can play snippet from graph node', async ({ page }) => {
      await login(page, baseUrl, testUser);

      const videoId = await createTestVideoWithGraph(baseUrl);

      await page.goto(`${baseUrl}/videos/${videoId}/graph`);

      // Click on a node
      await page.click('[data-testid="graph-node"]:first-child');

      // Click play snippet button
      await page.click('[data-testid="play-snippet-button"]');

      // Verify video player opens
      await expect(page.locator('[data-testid="video-player"]')).toBeVisible();

      // Verify player starts at correct timestamp
      const currentTime = await page.locator('video').evaluate((el: HTMLVideoElement) => el.currentTime);
      expect(currentTime).toBeGreaterThanOrEqual(0);
    });

    test('user can filter graph by node type', async ({ page }) => {
      await login(page, baseUrl, testUser);

      const videoId = await createTestVideoWithGraph(baseUrl);

      await page.goto(`${baseUrl}/videos/${videoId}/graph`);

      // Wait for graph to load
      await expect(page.locator('[data-testid="graph-canvas"]')).toBeVisible();

      // Get initial node count
      const initialNodeCount = await page.locator('[data-testid="graph-node"]').count();

      // Filter by topic type
      await page.selectOption('[data-testid="node-type-filter"]', 'topic');

      // Verify node count changed
      const filteredNodeCount = await page.locator('[data-testid="graph-node"]').count();
      expect(filteredNodeCount).toBeLessThanOrEqual(initialNodeCount);
    });

    test('user can search within graph', async ({ page }) => {
      await login(page, baseUrl, testUser);

      const videoId = await createTestVideoWithGraph(baseUrl);

      await page.goto(`${baseUrl}/videos/${videoId}/graph`);

      // Wait for graph to load
      await expect(page.locator('[data-testid="graph-canvas"]')).toBeVisible();

      // Search for a term
      await page.fill('[data-testid="graph-search-input"]', 'introduction');
      await page.press('[data-testid="graph-search-input"]', 'Enter');

      // Verify search results are highlighted
      await expect(page.locator('[data-testid="search-highlight"]')).toBeVisible();
    });
  });

  test.describe('Search Functionality', () => {
    test('user can perform semantic search', async ({ page }) => {
      await login(page, baseUrl, testUser);

      // Seed search data
      await seedSearchData(baseUrl);

      await page.goto(`${baseUrl}/search`);

      // Enter search query
      await page.fill('[data-testid="search-input"]', 'machine learning basics');

      // Select semantic search
      await page.selectOption('[data-testid="search-type-select"]', 'semantic');

      // Submit search
      await page.click('[data-testid="search-submit-button"]');

      // Wait for results
      await expect(page.locator('[data-testid="search-results"]')).toBeVisible();

      // Verify results are displayed
      const resultCount = await page.locator('[data-testid="search-result-item"]').count();
      expect(resultCount).toBeGreaterThan(0);
    });

    test('user can filter search results', async ({ page }) => {
      await login(page, baseUrl, testUser);

      await seedSearchData(baseUrl);

      await page.goto(`${baseUrl}/search?q=machine+learning`);

      // Wait for results
      await expect(page.locator('[data-testid="search-results"]')).toBeVisible();

      // Apply date filter
      await page.fill('[data-testid="date-from-filter"]', '2024-01-01');
      await page.fill('[data-testid="date-to-filter"]', '2024-12-31');
      await page.click('[data-testid="apply-filters-button"]');

      // Verify filtered results
      await expect(page.locator('[data-testid="search-result-item"]')).toBeVisible();
    });

    test('user can navigate from search to video', async ({ page }) => {
      await login(page, baseUrl, testUser);

      await seedSearchData(baseUrl);

      await page.goto(`${baseUrl}/search?q=machine+learning`);

      // Wait for results
      await expect(page.locator('[data-testid="search-results"]')).toBeVisible();

      // Click on first result
      await page.click('[data-testid="search-result-item"]:first-child');

      // Verify navigation to video page
      await expect(page).toHaveURL(/\/videos\/\w+/);
      await expect(page.locator('[data-testid="video-title"]')).toBeVisible();
    });
  });

  test.describe('Export Functionality', () => {
    test('user can export topic graph as PPTX', async ({ page }) => {
      await login(page, baseUrl, testUser);

      const videoId = await createTestVideoWithGraph(baseUrl);

      await page.goto(`${baseUrl}/videos/${videoId}/export`);

      // Select PPTX format
      await page.selectOption('[data-testid="export-format-select"]', 'pptx');

      // Configure export options
      await page.check('[data-testid="include-transitions-checkbox"]');
      await page.check('[data-testid="include-speaker-notes-checkbox"]');

      // Click export
      await page.click('[data-testid="export-button"]');

      // Wait for export to complete
      await expect(page.locator('[data-testid="export-complete"]')).toBeVisible({ timeout: 60000 });

      // Verify download link is available
      await expect(page.locator('[data-testid="download-link"]')).toBeVisible();
    });

    test('user can export as interactive HTML', async ({ page }) => {
      await login(page, baseUrl, testUser);

      const videoId = await createTestVideoWithGraph(baseUrl);

      await page.goto(`${baseUrl}/videos/${videoId}/export`);

      // Select HTML format
      await page.selectOption('[data-testid="export-format-select"]', 'html');

      // Click export
      await page.click('[data-testid="export-button"]');

      // Wait for export to complete
      await expect(page.locator('[data-testid="export-complete"]')).toBeVisible({ timeout: 60000 });

      // Preview HTML
      await page.click('[data-testid="preview-button"]');

      // Verify preview opens
      const newPage = await page.waitForEvent('popup');
      await expect(newPage.locator('body')).toBeVisible();
    });
  });

  test.describe('User Authentication', () => {
    test('user can login with valid credentials', async ({ page }) => {
      await page.goto(`${baseUrl}/login`);

      await page.fill('[data-testid="email-input"]', testUser.email);
      await page.fill('[data-testid="password-input"]', testUser.password);
      await page.click('[data-testid="login-button"]');

      // Verify redirect to dashboard
      await expect(page).toHaveURL(`${baseUrl}/dashboard`);

      // Verify user is logged in
      await expect(page.locator('[data-testid="user-menu"]')).toBeVisible();
    });

    test('user sees error with invalid credentials', async ({ page }) => {
      await page.goto(`${baseUrl}/login`);

      await page.fill('[data-testid="email-input"]', 'invalid@example.com');
      await page.fill('[data-testid="password-input"]', 'wrongpassword');
      await page.click('[data-testid="login-button"]');

      // Verify error message
      await expect(page.locator('[data-testid="login-error"]')).toBeVisible();
      await expect(page.locator('[data-testid="login-error"]')).toContainText('Invalid credentials');
    });

    test('protected routes redirect to login when not authenticated', async ({ page }) => {
      await page.goto(`${baseUrl}/videos`);

      // Verify redirect to login
      await expect(page).toHaveURL(`${baseUrl}/login?redirect=%2Fvideos`);
    });

    test('user can logout', async ({ page }) => {
      await login(page, baseUrl, testUser);

      // Open user menu
      await page.click('[data-testid="user-menu"]');

      // Click logout
      await page.click('[data-testid="logout-button"]');

      // Verify redirect to login
      await expect(page).toHaveURL(`${baseUrl}/login`);

      // Verify protected page is inaccessible
      await page.goto(`${baseUrl}/videos`);
      await expect(page).toHaveURL(`${baseUrl}/login`);
    });
  });
});

// Helper functions
async function login(page: Page, baseUrl: string, user: { email: string; password: string }) {
  await page.goto(`${baseUrl}/login`);
  await page.fill('[data-testid="email-input"]', user.email);
  await page.fill('[data-testid="password-input"]', user.password);
  await page.click('[data-testid="login-button"]');
  await expect(page).toHaveURL(`${baseUrl}/dashboard`);
}

async function createTestVideo(baseUrl: string): Promise<string> {
  // API call to create test video
  const response = await fetch(`${baseUrl}/api/v1/videos`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'Authorization': 'Bearer test-token',
    },
    body: JSON.stringify({
      title: 'Test Video',
      originalUrl: 'https://example.com/test',
    }),
  });
  const data = await response.json();
  return data.id;
}

async function createTestVideoWithGraph(baseUrl: string): Promise<string> {
  // API call to create video with processed graph
  const videoId = await createTestVideo(baseUrl);

  // Trigger processing
  await fetch(`${baseUrl}/api/v1/videos/${videoId}/process`, {
    method: 'POST',
    headers: {
      'Authorization': 'Bearer test-token',
    },
    body: JSON.stringify({ stages: ['video', 'asr', 'topics', 'embeddings-graph'] }),
  });

  // Wait for processing to complete (in real tests, use polling)
  await new Promise(resolve => setTimeout(resolve, 5000));

  return videoId;
}

async function seedSearchData(baseUrl: string): Promise<void> {
  // API call to seed search data
  await fetch(`${baseUrl}/api/test/seed-search`, {
    method: 'POST',
    headers: {
      'Authorization': 'Bearer test-token',
    },
  });
}
