/**
 * Performance Tests - API Load Testing
 * 
 * k6 load tests for API endpoints.
 */

import http from 'k6/http';
import { check, sleep, group } from 'k6';
import { Rate, Trend } from 'k6/metrics';

// Custom metrics
const errorRate = new Rate('errors');
const responseTime = new Trend('response_time');

// Test configuration
export const options = {
  stages: [
    { duration: '2m', target: 10 },   // Ramp up to 10 users
    { duration: '5m', target: 10 },   // Stay at 10 users
    { duration: '2m', target: 50 },   // Ramp up to 50 users
    { duration: '5m', target: 50 },   // Stay at 50 users
    { duration: '2m', target: 0 },    // Ramp down
  ],
  thresholds: {
    http_req_duration: ['p(95)<500'],  // 95% of requests under 500ms
    http_req_failed: ['rate<0.01'],    // Less than 1% errors
    errors: ['rate<0.05'],             // Custom error rate
  },
};

const BASE_URL = __ENV.BASE_URL || 'http://localhost:3000';
const AUTH_TOKEN = __ENV.AUTH_TOKEN || 'test-token';

const headers = {
  'Content-Type': 'application/json',
  'Authorization': `Bearer ${AUTH_TOKEN}`,
};

export default function () {
  group('Health Endpoints', () => {
    const healthRes = http.get(`${BASE_URL}/health`);
    
    check(healthRes, {
      'health status is 200': (r) => r.status === 200,
      'health response time < 100ms': (r) => r.timings.duration < 100,
    });
    
    errorRate.add(healthRes.status !== 200);
    responseTime.add(healthRes.timings.duration);
  });

  group('Video List', () => {
    const listRes = http.get(`${BASE_URL}/api/v1/videos?limit=20`, { headers });
    
    check(listRes, {
      'list status is 200': (r) => r.status === 200,
      'list response has items': (r) => {
        try {
          const body = JSON.parse(r.body);
          return Array.isArray(body.items);
        } catch {
          return false;
        }
      },
    });
    
    errorRate.add(listRes.status !== 200);
    responseTime.add(listRes.timings.duration);
  });

  group('Video Detail', () => {
    // First create a video to get an ID
    const createRes = http.post(
      `${BASE_URL}/api/v1/videos`,
      JSON.stringify({
        title: `Load Test Video ${Date.now()}`,
        originalUrl: 'https://example.com/test',
      }),
      { headers }
    );

    if (createRes.status === 201) {
      const videoId = JSON.parse(createRes.body).id;

      const detailRes = http.get(`${BASE_URL}/api/v1/videos/${videoId}`, { headers });
      
      check(detailRes, {
        'detail status is 200': (r) => r.status === 200,
        'detail has correct ID': (r) => {
          try {
            const body = JSON.parse(r.body);
            return body.id === videoId;
          } catch {
            return false;
          }
        },
      });
      
      errorRate.add(detailRes.status !== 200);
      responseTime.add(detailRes.timings.duration);

      // Cleanup
      http.del(`${BASE_URL}/api/v1/videos/${videoId}`, null, { headers });
    }
  });

  group('Search', () => {
    const searchRes = http.post(
      `${BASE_URL}/api/v1/search`,
      JSON.stringify({
        query: 'machine learning',
        searchType: 'semantic',
        limit: 10,
      }),
      { headers }
    );
    
    check(searchRes, {
      'search status is 200': (r) => r.status === 200,
      'search returns results': (r) => {
        try {
          const body = JSON.parse(r.body);
          return Array.isArray(body.results);
        } catch {
          return false;
        }
      },
    });
    
    errorRate.add(searchRes.status !== 200);
    responseTime.add(searchRes.timings.duration);
  });

  group('Graph Data', () => {
    // Use a known video ID for graph tests
    const videoId = 'test-video-graph';
    
    const graphRes = http.get(`${BASE_URL}/api/v1/videos/${videoId}/graph`, { headers });
    
    check(graphRes, {
      'graph status is 200 or 404': (r) => r.status === 200 || r.status === 404,
    });
    
    if (graphRes.status === 200) {
      check(graphRes, {
        'graph has nodes': (r) => {
          try {
            const body = JSON.parse(r.body);
            return Array.isArray(body.nodes);
          } catch {
            return false;
          }
        },
        'graph has edges': (r) => {
          try {
            const body = JSON.parse(r.body);
            return Array.isArray(body.edges);
          } catch {
            return false;
          }
        },
      });
    }
    
    errorRate.add(graphRes.status !== 200 && graphRes.status !== 404);
    responseTime.add(graphRes.timings.duration);
  });

  sleep(1);
}

// Setup function - runs once at the beginning
export function setup() {
  console.log(`Starting load test against ${BASE_URL}`);
  
  // Verify API is accessible
  const healthRes = http.get(`${BASE_URL}/health`);
  if (healthRes.status !== 200) {
    throw new Error(`API is not healthy: ${healthRes.status}`);
  }
  
  return { baseUrl: BASE_URL };
}

// Teardown function - runs once at the end
export function teardown(data) {
  console.log('Load test completed');
  console.log(`Base URL: ${data.baseUrl}`);
}
