/**
 * Share Routes
 * 
 * Handles sharing and access control.
 */

import type { FastifyInstance } from 'fastify';
import { v4 as uuidv4 } from 'uuid';
import { eq, and, sql, gt } from 'drizzle-orm';
import { db, schema } from '../db/index.js';
import { CreateShareRequestSchema } from '@video-graph/shared-types';
import { createHash } from 'crypto';

export async function shareRoutes(fastify: FastifyInstance) {
  // POST /shares - Create share link
  fastify.post<{
    Body: {
      resource_type: 'video' | 'graph' | 'topic';
      resource_id: string;
      scope?: 'view' | 'comment' | 'edit';
      expires_at?: string;
      password?: string;
    };
  }>('/shares', { onRequest: [fastify.authenticate] }, async (request, reply) => {
    const userId = request.user!.sub;

    // Validate request
    const validation = CreateShareRequestSchema.safeParse(request.body);
    if (!validation.success) {
      return reply.status(400).send({
        code: 'VALIDATION_ERROR',
        message: 'Invalid request body',
        details: validation.error.format(),
      });
    }

    const { resource_type, resource_id, scope = 'view', expires_at, password } = validation.data;

    // Verify resource exists and user has access
    let resourceExists = false;
    switch (resource_type) {
      case 'video':
        const video = await db.query.videos.findFirst({
          where: eq(schema.videos.id, resource_id),
        });
        resourceExists = !!video && video.createdBy === userId;
        break;
      case 'graph':
        const graph = await db.query.graphVersions.findFirst({
          where: eq(schema.graphVersions.id, resource_id),
        });
        if (graph) {
          const video = await db.query.videos.findFirst({
            where: eq(schema.videos.id, graph.videoId),
          });
          resourceExists = video?.createdBy === userId;
        }
        break;
      case 'topic':
        const topic = await db.query.topicNodes.findFirst({
          where: eq(schema.topicNodes.id, resource_id),
        });
        if (topic) {
          const video = await db.query.videos.findFirst({
            where: eq(schema.videos.id, topic.videoId),
          });
          resourceExists = video?.createdBy === userId;
        }
        break;
    }

    if (!resourceExists) {
      return reply.status(404).send({
        code: 'NOT_FOUND',
        message: 'Resource not found or access denied',
      });
    }

    // Check quota for public links
    const userQuota = await db.query.userQuotas.findFirst({
      where: eq(schema.userQuotas.userId, userId),
      with: {
        policy: true,
      },
    });

    if (userQuota && userQuota.publicLinks >= userQuota.policy.maxPublicLinks) {
      return reply.status(429).send({
        code: 'QUOTA_EXCEEDED',
        message: 'Maximum number of public links reached',
      });
    }

    // Generate token
    const token = generateShareToken();

    // Hash password if provided
    let passwordHash: string | null = null;
    if (password) {
      passwordHash = createHash('sha256').update(password).digest('hex');
    }

    // Create share record
    await db.insert(schema.shares).values({
      token,
      resourceType: resource_type,
      resourceId: resource_id,
      createdBy: userId,
      scope,
      expiresAt: expires_at ? new Date(expires_at) : null,
      passwordHash,
    });

    // Update quota
    await db
      .update(schema.userQuotas)
      .set({
        publicLinks: sql`${schema.userQuotas.publicLinks} + 1`,
        updatedAt: new Date(),
      })
      .where(eq(schema.userQuotas.userId, userId));

    // Build share URL
    const baseUrl = `${request.protocol}://${request.hostname}`;
    const shareUrl = `${baseUrl}/s/${token}`;

    return reply.status(201).send({
      token,
      url: shareUrl,
      resource_type,
      resource_id,
      scope,
      expires_at: expires_at || null,
      created_at: new Date().toISOString(),
    });
  });

  // GET /shares/:token - Get shared resource (public endpoint)
  fastify.get<{ Params: { token: string }; Querystring: { password?: string } }>(
    '/shares/:token',
    async (request, reply) => {
      const { token } = request.params;
      const { password } = request.query;

      const share = await db.query.shares.findFirst({
        where: eq(schema.shares.token, token),
      });

      if (!share) {
        return reply.status(404).send({
          code: 'NOT_FOUND',
          message: 'Share link not found',
        });
      }

      // Check expiration
      if (share.expiresAt && share.expiresAt < new Date()) {
        return reply.status(410).send({
          code: 'GONE',
          message: 'Share link has expired',
        });
      }

      // Verify password if required
      if (share.passwordHash) {
        if (!password) {
          return reply.status(401).send({
            code: 'PASSWORD_REQUIRED',
            message: 'Password is required to access this resource',
          });
        }

        const providedHash = createHash('sha256').update(password).digest('hex');
        if (providedHash !== share.passwordHash) {
          return reply.status(401).send({
            code: 'INVALID_PASSWORD',
            message: 'Invalid password',
          });
        }
      }

      // Increment access count
      await db
        .update(schema.shares)
        .set({
          accessCount: sql`${schema.shares.accessCount} + 1`,
        })
        .where(eq(schema.shares.token, token));

      // Get resource based on type
      let resource: unknown;
      switch (share.resourceType) {
        case 'video':
          const video = await db.query.videos.findFirst({
            where: eq(schema.videos.id, share.resourceId),
          });
          if (video) {
            resource = {
              id: video.id,
              source_url: video.sourceUrl,
              source_type: video.sourceType,
              status: video.status,
              duration_s: video.durationSeconds,
              created_at: video.createdAt.toISOString(),
              metadata: video.metadata,
            };
          }
          break;
        case 'graph':
          const graph = await db.query.graphVersions.findFirst({
            where: eq(schema.graphVersions.id, share.resourceId),
          });
          if (graph) {
            const topics = await db.query.topicNodes.findMany({
              where: eq(schema.topicNodes.graphVersionId, graph.id),
            });
            const edges = await db.query.topicEdges.findMany({
              where: eq(schema.topicEdges.graphVersionId, graph.id),
            });
            resource = {
              id: graph.id,
              video_id: graph.videoId,
              version: graph.version,
              status: graph.status,
              nodes: topics.map((t) => ({
                id: t.id,
                level: t.level,
                start_ts: t.startSeconds,
                end_ts: t.endSeconds,
                title: t.title,
                summary: t.summary,
                keywords: t.keywords,
              })),
              edges: edges.map((e) => ({
                id: e.id,
                src_topic_id: e.srcTopicId,
                dst_topic_id: e.dstTopicId,
                edge_type: e.edgeType,
                weight: e.weight,
              })),
            };
          }
          break;
        case 'topic':
          const topic = await db.query.topicNodes.findFirst({
            where: eq(schema.topicNodes.id, share.resourceId),
          });
          if (topic) {
            resource = {
              id: topic.id,
              video_id: topic.videoId,
              level: topic.level,
              start_ts: topic.startSeconds,
              end_ts: topic.endSeconds,
              title: topic.title,
              summary: topic.summary,
              keywords: topic.keywords,
            };
          }
          break;
      }

      if (!resource) {
        return reply.status(404).send({
          code: 'NOT_FOUND',
          message: 'Resource not found',
        });
      }

      return reply.send({
        resource_type: share.resourceType,
        resource,
        scope: share.scope,
      });
    }
  );

  // DELETE /shares/:token - Revoke share link
  fastify.delete<{ Params: { token: string } }>(
    '/shares/:token',
    { onRequest: [fastify.authenticate] },
    async (request, reply) => {
      const userId = request.user!.sub;
      const { token } = request.params;

      const share = await db.query.shares.findFirst({
        where: eq(schema.shares.token, token),
      });

      if (!share) {
        return reply.status(404).send({
          code: 'NOT_FOUND',
          message: 'Share link not found',
        });
      }

      // Only creator can revoke
      if (share.createdBy !== userId) {
        return reply.status(403).send({
          code: 'FORBIDDEN',
          message: 'Only the creator can revoke this share link',
        });
      }

      await db.delete(schema.shares).where(eq(schema.shares.token, token));

      // Update quota
      await db
        .update(schema.userQuotas)
        .set({
          publicLinks: sql`GREATEST(${schema.userQuotas.publicLinks} - 1, 0)`,
          updatedAt: new Date(),
        })
        .where(eq(schema.userQuotas.userId, userId));

      return reply.status(204).send();
    }
  );
}

function generateShareToken(): string {
  // Generate a URL-safe random token
  const bytes = Buffer.from(uuidv4().replace(/-/g, ''), 'hex');
  return bytes.toString('base64url').slice(0, 22);
}
