/**
 * API Service for Video Topic Graph Platform
 * 
 * Fastify-based REST API with:
 * - OIDC authentication via Keycloak
 * - CRUD operations for videos, graphs, topics
 * - Semantic and deep search
 * - Export generation
 * - Quota management
 * - Sharing
 */

import Fastify from 'fastify';
import cors from '@fastify/cors';
import jwt from '@fastify/jwt';
import multipart from '@fastify/multipart';
import rateLimit from '@fastify/rate-limit';
import swagger from '@fastify/swagger';
import swaggerUi from '@fastify/swagger-ui';
import { readFileSync } from 'fs';
import { fileURLToPath } from 'url';
import { dirname, join } from 'path';

import { config } from './config.js';
import { errorHandler } from './middleware/error-handler.js';
import { authPlugin } from './middleware/auth.js';
import { videoRoutes } from './routes/videos.js';
import { graphRoutes } from './routes/graphs.js';
import { topicRoutes } from './routes/topics.js';
import { searchRoutes } from './routes/search.js';
import { exportRoutes } from './routes/exports.js';
import { quotaRoutes } from './routes/quota.js';
import { shareRoutes } from './routes/shares.js';
import { jobRoutes } from './routes/jobs.js';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

async function buildServer() {
  const app = Fastify({
    logger: {
      level: config.logLevel,
      transport: config.env === 'development' ? {
        target: 'pino-pretty',
        options: {
          colorize: true,
        },
      } : undefined,
    },
    requestTimeout: config.requestTimeoutMs,
    bodyLimit: 10 * 1024 * 1024, // 10MB
  });

  // Error handler
  app.setErrorHandler(errorHandler);

  // CORS
  await app.register(cors, {
    origin: config.cors.origins,
    credentials: true,
  });

  // Rate limiting
  if (config.rateLimit.enabled) {
    await app.register(rateLimit, {
      max: config.rateLimit.maxRequests,
      timeWindow: config.rateLimit.windowMs,
    });
  }

  // JWT authentication
  await app.register(jwt, {
    secret: '', // Will use JWKS
    decode: { complete: true },
    verify: {
      algorithms: ['RS256'],
      audience: config.auth.clientId,
      issuer: `${config.auth.issuerUrl}/realms/${config.auth.realm}`,
    },
  });

  // Multipart for file uploads
  await app.register(multipart, {
    limits: {
      fileSize: config.upload.maxFileSize,
    },
  });

  // Swagger documentation
  const openApiSpec = readFileSync(
    join(__dirname, '../../../packages/openapi/openapi.yaml'),
    'utf-8'
  );

  await app.register(swagger, {
    mode: 'static',
    specification: {
      document: openApiSpec,
    },
  });

  await app.register(swaggerUi, {
    routePrefix: '/docs',
    uiConfig: {
      docExpansion: 'list',
      deepLinking: true,
    },
  });

  // Auth plugin
  await app.register(authPlugin);

  // Health check
  app.get('/health', async () => ({ status: 'ok', version: config.version }));

  // API routes
  await app.register(videoRoutes, { prefix: '/api/v1' });
  await app.register(graphRoutes, { prefix: '/api/v1' });
  await app.register(topicRoutes, { prefix: '/api/v1' });
  await app.register(searchRoutes, { prefix: '/api/v1' });
  await app.register(exportRoutes, { prefix: '/api/v1' });
  await app.register(quotaRoutes, { prefix: '/api/v1' });
  await app.register(shareRoutes, { prefix: '/api/v1' });
  await app.register(jobRoutes, { prefix: '/api/v1' });

  return app;
}

async function main() {
  const app = await buildServer();

  try {
    await app.listen({
      port: config.port,
      host: config.host,
    });
    app.log.info(`API server running on http://${config.host}:${config.port}`);
  } catch (err) {
    app.log.error(err);
    process.exit(1);
  }
}

main();

export { buildServer };
