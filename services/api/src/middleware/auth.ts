/**
 * Authentication Plugin
 * 
 * Provides JWT verification and user context.
 */

import fp from 'fastify-plugin';
import type { FastifyInstance, FastifyRequest, FastifyReply } from 'fastify';
import { createPublicKey } from 'crypto';
import { getSigningKey } from 'jwks-rsa';
import { config } from '../config.js';

// Extend Fastify types
declare module 'fastify' {
  interface FastifyRequest {
    user?: {
      sub: string;
      email: string;
      name?: string;
      roles: string[];
    };
  }
}

interface JWTPayload {
  sub: string;
  email: string;
  name?: string;
  realm_access?: { roles: string[] };
  resource_access?: Record<string, { roles: string[] }>;
}

async function verifyToken(token: string): Promise<JWTPayload> {
  // Fetch JWKS from Keycloak
  const jwksUrl = `${config.auth.issuerUrl}/realms/${config.auth.realm}/protocol/openid-connect/certs`;
  
  // Decode token header to get kid
  const header = JSON.parse(
    Buffer.from(token.split('.')[0], 'base64').toString()
  ) as { kid: string };

  // Get signing key
  const key = await getSigningKey(jwksUrl, header.kid);
  const publicKey = createPublicKey({
    key: key.getPublicKey(),
    format: 'pem',
    type: 'spki',
  });

  // Verify token
  const { default: jwt } = await import('jsonwebtoken');
  return jwt.verify(token, publicKey, {
    algorithms: ['RS256'],
    audience: config.auth.clientId,
    issuer: `${config.auth.issuerUrl}/realms/${config.auth.realm}`,
  }) as JWTPayload;
}

export async function authenticateRequest(
  request: FastifyRequest,
  reply: FastifyReply
): Promise<void> {
  try {
    const authHeader = request.headers.authorization;
    if (!authHeader?.startsWith('Bearer ')) {
      reply.status(401).send({
        code: 'UNAUTHORIZED',
        message: 'Missing or invalid authorization header',
      });
      return;
    }

    const token = authHeader.slice(7);
    const payload = await verifyToken(token);

    // Extract roles from Keycloak token
    const roles: string[] = [
      ...(payload.realm_access?.roles || []),
      ...(payload.resource_access?.[config.auth.clientId]?.roles || []),
    ];

    request.user = {
      sub: payload.sub,
      email: payload.email,
      name: payload.name,
      roles,
    };
  } catch (error) {
    request.log.warn({ error }, 'Token verification failed');
    reply.status(401).send({
      code: 'UNAUTHORIZED',
      message: 'Invalid or expired token',
    });
  }
}

export const authPlugin = fp(async function (fastify: FastifyInstance) {
  // Add authenticate decorator
  fastify.decorate('authenticate', authenticateRequest);

  // Add optional auth decorator (doesn't fail if no token)
  fastify.decorate(
    'optionalAuth',
    async function (request: FastifyRequest, reply: FastifyReply) {
      try {
        await authenticateRequest(request, reply);
      } catch {
        // Ignore errors for optional auth
      }
    }
  );
});

// Type augmentation for FastifyInstance
declare module 'fastify' {
  interface FastifyInstance {
    authenticate: (
      request: FastifyRequest,
      reply: FastifyReply
    ) => Promise<void>;
    optionalAuth: (
      request: FastifyRequest,
      reply: FastifyReply
    ) => Promise<void>;
  }
}
