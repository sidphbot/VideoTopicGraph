/**
 * Topic Routes
 * 
 * Handles topic CRUD operations, merging, and splitting.
 */

import type { FastifyInstance } from 'fastify';
import { v4 as uuidv4 } from 'uuid';
import { eq, and, inArray } from 'drizzle-orm';
import { db, schema } from '../db/index.js';

export async function topicRoutes(fastify: FastifyInstance) {
  // GET /topics/:id - Get topic details
  fastify.get<{ Params: { id: string } }>(
    '/topics/:id',
    { onRequest: [fastify.authenticate] },
    async (request, reply) => {
      const userId = request.user!.sub;
      const topicId = request.params.id;

      const topic = await db.query.topicNodes.findFirst({
        where: eq(schema.topicNodes.id, topicId),
        with: {
          snippets: true,
        },
      });

      if (!topic) {
        return reply.status(404).send({
          code: 'NOT_FOUND',
          message: 'Topic not found',
        });
      }

      // Check access
      const hasAccess = await checkAccess(topic.videoId, userId, 'viewer');
      if (!hasAccess) {
        return reply.status(403).send({
          code: 'FORBIDDEN',
          message: 'Access denied',
        });
      }

      return reply.send({
        id: topic.id,
        video_id: topic.videoId,
        level: topic.level,
        start_ts: topic.startSeconds,
        end_ts: topic.endSeconds,
        title: topic.title,
        summary: topic.summary,
        keywords: topic.keywords,
        parent_ids: topic.parentIds,
        child_ids: topic.childIds,
        importance_score: topic.importanceScore,
        cluster_id: topic.clusterId,
        snippets: topic.snippets.map((s) => ({
          id: s.id,
          topic_id: s.topicId,
          start_ts: s.startSeconds,
          end_ts: s.endSeconds,
          duration_s: s.endSeconds - s.startSeconds,
          video_url: '', // Would generate presigned URL
          thumbnail_url: s.thumbnailPath || null,
          caption_url: s.captionPath || null,
          created_at: s.createdAt.toISOString(),
        })),
        created_at: topic.createdAt.toISOString(),
        updated_at: topic.updatedAt.toISOString(),
      });
    }
  );

  // PATCH /topics/:id - Update topic
  fastify.patch<{
    Params: { id: string };
    Body: { title?: string; summary?: string; keywords?: string[]; importance_score?: number };
  }>('/topics/:id', { onRequest: [fastify.authenticate] }, async (request, reply) => {
    const userId = request.user!.sub;
    const topicId = request.params.id;
    const updates = request.body;

    const topic = await db.query.topicNodes.findFirst({
      where: eq(schema.topicNodes.id, topicId),
    });

    if (!topic) {
      return reply.status(404).send({
        code: 'NOT_FOUND',
        message: 'Topic not found',
      });
    }

    // Check access
    const hasAccess = await checkAccess(topic.videoId, userId, 'editor');
    if (!hasAccess) {
      return reply.status(403).send({
        code: 'FORBIDDEN',
        message: 'Access denied',
      });
    }

    // Update topic
    const [updated] = await db
      .update(schema.topicNodes)
      .set({
        title: updates.title ?? topic.title,
        summary: updates.summary ?? topic.summary,
        keywords: updates.keywords ?? topic.keywords,
        importanceScore: updates.importance_score ?? topic.importanceScore,
        updatedAt: new Date(),
      })
      .where(eq(schema.topicNodes.id, topicId))
      .returning();

    return reply.send({
      id: updated.id,
      video_id: updated.videoId,
      level: updated.level,
      start_ts: updated.startSeconds,
      end_ts: updated.endSeconds,
      title: updated.title,
      summary: updated.summary,
      keywords: updated.keywords,
      parent_ids: updated.parentIds,
      child_ids: updated.childIds,
      importance_score: updated.importanceScore,
      cluster_id: updated.clusterId,
      created_at: updated.createdAt.toISOString(),
      updated_at: updated.updatedAt.toISOString(),
    });
  });

  // GET /topics/:id/snippets - Get topic snippets
  fastify.get<{ Params: { id: string } }>(
    '/topics/:id/snippets',
    { onRequest: [fastify.authenticate] },
    async (request, reply) => {
      const userId = request.user!.sub;
      const topicId = request.params.id;

      const topic = await db.query.topicNodes.findFirst({
        where: eq(schema.topicNodes.id, topicId),
      });

      if (!topic) {
        return reply.status(404).send({
          code: 'NOT_FOUND',
          message: 'Topic not found',
        });
      }

      // Check access
      const hasAccess = await checkAccess(topic.videoId, userId, 'viewer');
      if (!hasAccess) {
        return reply.status(403).send({
          code: 'FORBIDDEN',
          message: 'Access denied',
        });
      }

      const snippets = await db.query.snippets.findMany({
        where: eq(schema.snippets.topicId, topicId),
      });

      return reply.send({
        items: snippets.map((s) => ({
          id: s.id,
          topic_id: s.topicId,
          start_ts: s.startSeconds,
          end_ts: s.endSeconds,
          duration_s: s.endSeconds - s.startSeconds,
          video_url: '', // Would generate presigned URL
          thumbnail_url: s.thumbnailPath || null,
          caption_url: s.captionPath || null,
          created_at: s.createdAt.toISOString(),
        })),
      });
    }
  );

  // POST /topics/merge - Merge topics
  fastify.post<{
    Body: { topic_ids: string[]; new_title?: string };
  }>('/topics/merge', { onRequest: [fastify.authenticate] }, async (request, reply) => {
    const userId = request.user!.sub;
    const { topic_ids, new_title } = request.body;

    if (topic_ids.length < 2) {
      return reply.status(400).send({
        code: 'VALIDATION_ERROR',
        message: 'At least 2 topics are required for merging',
      });
    }

    // Get all topics
    const topics = await db.query.topicNodes.findMany({
      where: inArray(schema.topicNodes.id, topic_ids),
    });

    if (topics.length !== topic_ids.length) {
      return reply.status(404).send({
        code: 'NOT_FOUND',
        message: 'One or more topics not found',
      });
    }

    // Verify all topics belong to same video
    const videoId = topics[0].videoId;
    if (!topics.every((t) => t.videoId === videoId)) {
      return reply.status(400).send({
        code: 'VALIDATION_ERROR',
        message: 'All topics must belong to the same video',
      });
    }

    // Check access
    const hasAccess = await checkAccess(videoId, userId, 'editor');
    if (!hasAccess) {
      return reply.status(403).send({
        code: 'FORBIDDEN',
        message: 'Access denied',
      });
    }

    // Create merged topic
    const mergedId = uuidv4();
    const startTime = Math.min(...topics.map((t) => t.startSeconds));
    const endTime = Math.max(...topics.map((t) => t.endSeconds));
    const allKeywords = Array.from(new Set(topics.flatMap((t) => t.keywords)));

    const [merged] = await db
      .insert(schema.topicNodes)
      .values({
        id: mergedId,
        videoId,
        graphVersionId: topics[0].graphVersionId,
        level: Math.min(...topics.map((t) => t.level)),
        startSeconds: startTime,
        endSeconds: endTime,
        title: new_title || `Merged: ${topics[0].title}`,
        summary: topics.map((t) => t.summary).join(' '), // Could use LLM for better summary
        keywords: allKeywords.slice(0, 20),
        parentIds: [],
        childIds: topic_ids,
        importanceScore: Math.max(...topics.map((t) => t.importanceScore)),
        transcriptSegmentIds: Array.from(
          new Set(topics.flatMap((t) => t.transcriptSegmentIds))
        ),
      })
      .returning();

    // Update child topics to point to merged parent
    for (const topic of topics) {
      await db
        .update(schema.topicNodes)
        .set({
          parentIds: [...topic.parentIds, mergedId],
          updatedAt: new Date(),
        })
        .where(eq(schema.topicNodes.id, topic.id));
    }

    return reply.send({
      id: merged.id,
      video_id: merged.videoId,
      level: merged.level,
      start_ts: merged.startSeconds,
      end_ts: merged.endSeconds,
      title: merged.title,
      summary: merged.summary,
      keywords: merged.keywords,
      parent_ids: merged.parentIds,
      child_ids: merged.childIds,
      importance_score: merged.importanceScore,
      cluster_id: merged.clusterId,
      created_at: merged.createdAt.toISOString(),
      updated_at: merged.updatedAt.toISOString(),
    });
  });

  // POST /topics/:id/split - Split topic
  fastify.post<{
    Params: { id: string };
    Body: { split_at_ts: number; new_titles?: [string, string] };
  }>('/topics/:id/split', { onRequest: [fastify.authenticate] }, async (request, reply) => {
    const userId = request.user!.sub;
    const topicId = request.params.id;
    const { split_at_ts, new_titles } = request.body;

    const topic = await db.query.topicNodes.findFirst({
      where: eq(schema.topicNodes.id, topicId),
    });

    if (!topic) {
      return reply.status(404).send({
        code: 'NOT_FOUND',
        message: 'Topic not found',
      });
    }

    // Validate split point
    if (split_at_ts <= topic.startSeconds || split_at_ts >= topic.endSeconds) {
      return reply.status(400).send({
        code: 'VALIDATION_ERROR',
        message: 'Split point must be within topic boundaries',
      });
    }

    // Check access
    const hasAccess = await checkAccess(topic.videoId, userId, 'editor');
    if (!hasAccess) {
      return reply.status(403).send({
        code: 'FORBIDDEN',
        message: 'Access denied',
      });
    }

    // Create two new topics
    const topic1Id = uuidv4();
    const topic2Id = uuidv4();

    const [topic1] = await db
      .insert(schema.topicNodes)
      .values({
        id: topic1Id,
        videoId: topic.videoId,
        graphVersionId: topic.graphVersionId,
        level: topic.level,
        startSeconds: topic.startSeconds,
        endSeconds: split_at_ts,
        title: new_titles?.[0] || `${topic.title} (Part 1)`,
        summary: topic.summary.slice(0, topic.summary.length / 2),
        keywords: topic.keywords.slice(0, 10),
        parentIds: topic.parentIds,
        childIds: [],
        importanceScore: topic.importanceScore,
        transcriptSegmentIds: topic.transcriptSegmentIds,
      })
      .returning();

    const [topic2] = await db
      .insert(schema.topicNodes)
      .values({
        id: topic2Id,
        videoId: topic.videoId,
        graphVersionId: topic.graphVersionId,
        level: topic.level,
        startSeconds: split_at_ts,
        endSeconds: topic.endSeconds,
        title: new_titles?.[1] || `${topic.title} (Part 2)`,
        summary: topic.summary.slice(topic.summary.length / 2),
        keywords: topic.keywords.slice(10),
        parentIds: topic.parentIds,
        childIds: [],
        importanceScore: topic.importanceScore,
        transcriptSegmentIds: topic.transcriptSegmentIds,
      })
      .returning();

    // Update original topic's children to point to new topics
    for (const childId of topic.childIds) {
      const child = await db.query.topicNodes.findFirst({
        where: eq(schema.topicNodes.id, childId),
      });
      if (child) {
        const newParents = child.parentIds.filter((id) => id !== topicId);
        if (child.startSeconds < split_at_ts) {
          newParents.push(topic1Id);
        } else {
          newParents.push(topic2Id);
        }
        await db
          .update(schema.topicNodes)
          .set({ parentIds: newParents })
          .where(eq(schema.topicNodes.id, childId));
      }
    }

    // Mark original topic as split (or delete it)
    await db.delete(schema.topicNodes).where(eq(schema.topicNodes.id, topicId));

    return reply.send([
      {
        id: topic1.id,
        video_id: topic1.videoId,
        level: topic1.level,
        start_ts: topic1.startSeconds,
        end_ts: topic1.endSeconds,
        title: topic1.title,
        summary: topic1.summary,
        keywords: topic1.keywords,
        parent_ids: topic1.parentIds,
        child_ids: topic1.childIds,
        importance_score: topic1.importanceScore,
        cluster_id: topic1.clusterId,
        created_at: topic1.createdAt.toISOString(),
        updated_at: topic1.updatedAt.toISOString(),
      },
      {
        id: topic2.id,
        video_id: topic2.videoId,
        level: topic2.level,
        start_ts: topic2.startSeconds,
        end_ts: topic2.endSeconds,
        title: topic2.title,
        summary: topic2.summary,
        keywords: topic2.keywords,
        parent_ids: topic2.parentIds,
        child_ids: topic2.childIds,
        importance_score: topic2.importanceScore,
        cluster_id: topic2.clusterId,
        created_at: topic2.createdAt.toISOString(),
        updated_at: topic2.updatedAt.toISOString(),
      },
    ]);
  });
}

// Helper functions
async function checkAccess(
  resourceId: string,
  userId: string,
  requiredRole: 'viewer' | 'editor' | 'owner'
): Promise<boolean> {
  const video = await db.query.videos.findFirst({
    where: eq(schema.videos.id, resourceId),
  });

  if (video?.createdBy === userId) {
    return true;
  }

  const aclEntry = await db.query.acl.findFirst({
    where: and(
      eq(schema.acl.resourceType, 'video'),
      eq(schema.acl.resourceId, resourceId),
      eq(schema.acl.userId, userId)
    ),
  });

  if (!aclEntry) {
    return false;
  }

  const roleHierarchy = { viewer: 0, editor: 1, owner: 2 };
  return roleHierarchy[aclEntry.role] >= roleHierarchy[requiredRole];
}
