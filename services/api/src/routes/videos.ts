/**
 * Video Routes
 * 
 * Handles video ingestion, status, and management.
 */

import type { FastifyInstance } from 'fastify';
import { v4 as uuidv4 } from 'uuid';
import { eq, desc, and, sql } from 'drizzle-orm';
import { db, schema } from '../db/index.js';
import { config } from '../config.js';
import { VideoAnalyzeRequestSchema } from '@video-graph/shared-types';

export async function videoRoutes(fastify: FastifyInstance) {
  // POST /videos/analyze - Submit video for analysis
  fastify.post<{ Body: { source_url: string; source_type?: string; config?: unknown; metadata?: unknown } }>(
    '/videos/analyze',
    { onRequest: [fastify.authenticate] },
    async (request, reply) => {
      const userId = request.user!.sub;

      // Validate request
      const validation = VideoAnalyzeRequestSchema.safeParse(request.body);
      if (!validation.success) {
        return reply.status(400).send({
          code: 'VALIDATION_ERROR',
          message: 'Invalid request body',
          details: validation.error.format(),
        });
      }

      const { source_url, source_type = 'direct', config: pipelineConfig, metadata = {} } = validation.data;

      // Check quota
      if (config.features.quotaEnforcement) {
        const quota = await db.query.userQuotas.findFirst({
          where: eq(schema.userQuotas.userId, userId),
        });

        if (quota) {
          const policy = await db.query.quotaPolicies.findFirst({
            where: eq(schema.quotaPolicies.id, quota.policyId),
          });

          if (policy && quota.videosThisMonth >= policy.maxVideosPerMonth) {
            return reply.status(429).send({
              code: 'QUOTA_EXCEEDED',
              message: 'Monthly video quota exceeded',
            });
          }
        }
      }

      // Create video record
      const videoId = uuidv4();
      const [video] = await db
        .insert(schema.videos)
        .values({
          id: videoId,
          sourceUrl: source_url,
          sourceType: source_type,
          status: 'pending',
          metadata,
          createdBy: userId,
        })
        .returning();

      // Create initial graph version
      const graphVersionId = uuidv4();
      await db.insert(schema.graphVersions).values({
        id: graphVersionId,
        videoId,
        version: 1,
        createdBy: userId,
        status: 'processing',
        configSnapshot: { ...config.defaultPipeline, ...pipelineConfig },
      });

      // Create job for worker
      const jobId = uuidv4();
      await db.insert(schema.jobs).values({
        id: jobId,
        type: 'video_analysis',
        status: 'pending',
        payload: {
          videoId,
          graphVersionId,
          sourceUrl: source_url,
          sourceType: source_type,
          config: { ...config.defaultPipeline, ...pipelineConfig },
        },
        priority: 5,
      });

      // Update quota
      if (config.features.quotaEnforcement) {
        await db
          .update(schema.userQuotas)
          .set({
            videosThisMonth: sql`${schema.userQuotas.videosThisMonth} + 1`,
            updatedAt: new Date(),
          })
          .where(eq(schema.userQuotas.userId, userId));
      }

      return reply.status(202).send({
        id: video.id,
        source_url: video.sourceUrl,
        source_type: video.sourceType,
        status: video.status,
        duration_s: video.durationSeconds,
        created_at: video.createdAt.toISOString(),
        job_id: jobId,
      });
    }
  );

  // GET /videos - List videos
  fastify.get<{
    Querystring: { page?: number; limit?: number; status?: string };
  }>('/videos', { onRequest: [fastify.authenticate] }, async (request, reply) => {
    const userId = request.user!.sub;
    const page = request.query.page || 1;
    const limit = Math.min(request.query.limit || 20, 100);
    const status = request.query.status;

    const offset = (page - 1) * limit;

    // Build query
    let whereClause = eq(schema.videos.createdBy, userId);
    if (status) {
      whereClause = and(whereClause, eq(schema.videos.status, status))!;
    }

    // Get videos
    const videos = await db.query.videos.findMany({
      where: whereClause,
      orderBy: desc(schema.videos.createdAt),
      limit,
      offset,
    });

    // Get total count
    const countResult = await db
      .select({ count: sql<number>`count(*)` })
      .from(schema.videos)
      .where(whereClause);
    const total = countResult[0]?.count || 0;

    return reply.send({
      items: videos.map((v) => ({
        id: v.id,
        source_url: v.sourceUrl,
        source_type: v.sourceType,
        status: v.status,
        duration_s: v.durationSeconds,
        created_at: v.createdAt.toISOString(),
        job_id: null,
      })),
      pagination: {
        page,
        limit,
        total,
        total_pages: Math.ceil(total / limit),
      },
    });
  });

  // GET /videos/:id - Get video details
  fastify.get<{ Params: { id: string } }>(
    '/videos/:id',
    { onRequest: [fastify.authenticate] },
    async (request, reply) => {
      const userId = request.user!.sub;
      const videoId = request.params.id;

      const video = await db.query.videos.findFirst({
        where: eq(schema.videos.id, videoId),
        with: {
          graphVersions: {
            orderBy: desc(schema.graphVersions.version),
            limit: 1,
          },
        },
      });

      if (!video) {
        return reply.status(404).send({
          code: 'NOT_FOUND',
          message: 'Video not found',
        });
      }

      // Check access
      const hasAccess = await checkAccess(videoId, userId, 'viewer');
      if (!hasAccess) {
        return reply.status(403).send({
          code: 'FORBIDDEN',
          message: 'Access denied',
        });
      }

      // Get counts
      const transcriptCount = await db
        .select({ count: sql<number>`count(*)` })
        .from(schema.transcriptSegments)
        .where(eq(schema.transcriptSegments.videoId, videoId));

      const topicCount = await db
        .select({ count: sql<number>`count(*)` })
        .from(schema.topicNodes)
        .where(eq(schema.topicNodes.videoId, videoId));

      const versionCount = await db
        .select({ count: sql<number>`count(*)` })
        .from(schema.graphVersions)
        .where(eq(schema.graphVersions.videoId, videoId));

      const latestGraph = video.graphVersions[0];

      return reply.send({
        id: video.id,
        source_url: video.sourceUrl,
        source_type: video.sourceType,
        status: video.status,
        duration_s: video.durationSeconds,
        created_at: video.createdAt.toISOString(),
        job_id: null,
        metadata: video.metadata,
        graph: latestGraph
          ? {
              id: latestGraph.id,
              version: latestGraph.version,
              status: latestGraph.status,
              nodes_count: topicCount[0]?.count || 0,
              edges_count: 0, // Would need to query edges
            }
          : null,
        transcript_segments_count: transcriptCount[0]?.count || 0,
        topics_count: topicCount[0]?.count || 0,
        versions_count: versionCount[0]?.count || 0,
      });
    }
  );

  // DELETE /videos/:id - Delete video
  fastify.delete<{ Params: { id: string } }>(
    '/videos/:id',
    { onRequest: [fastify.authenticate] },
    async (request, reply) => {
      const userId = request.user!.sub;
      const videoId = request.params.id;

      const video = await db.query.videos.findFirst({
        where: eq(schema.videos.id, videoId),
      });

      if (!video) {
        return reply.status(404).send({
          code: 'NOT_FOUND',
          message: 'Video not found',
        });
      }

      // Check ownership
      if (video.createdBy !== userId) {
        return reply.status(403).send({
          code: 'FORBIDDEN',
          message: 'Only the owner can delete this video',
        });
      }

      // Delete video (cascades to related records)
      await db.delete(schema.videos).where(eq(schema.videos.id, videoId));

      return reply.status(204).send();
    }
  );

  // GET /videos/:id/status - Get processing status
  fastify.get<{ Params: { id: string } }>(
    '/videos/:id/status',
    { onRequest: [fastify.authenticate] },
    async (request, reply) => {
      const userId = request.user!.sub;
      const videoId = request.params.id;

      const video = await db.query.videos.findFirst({
        where: eq(schema.videos.id, videoId),
      });

      if (!video) {
        return reply.status(404).send({
          code: 'NOT_FOUND',
          message: 'Video not found',
        });
      }

      // Check access
      const hasAccess = await checkAccess(videoId, userId, 'viewer');
      if (!hasAccess) {
        return reply.status(403).send({
          code: 'FORBIDDEN',
          message: 'Access denied',
        });
      }

      // Get job status
      const job = await db.query.jobs.findFirst({
        where: sql`${schema.jobs.payload}->>'videoId' = ${videoId}`,
        orderBy: desc(schema.jobs.createdAt),
      });

      // Calculate progress
      const stages = [
        { name: 'download', status: 'pending', progress: 0 },
        { name: 'asr', status: 'pending', progress: 0 },
        { name: 'topic', status: 'pending', progress: 0 },
        { name: 'embeddings', status: 'pending', progress: 0 },
        { name: 'snippets', status: 'pending', progress: 0 },
      ];

      // Update stages based on video status
      switch (video.status) {
        case 'completed':
          stages.forEach((s) => {
            s.status = 'completed';
            s.progress = 100;
          });
          break;
        case 'downloading':
          stages[0].status = 'running';
          stages[0].progress = 50;
          break;
        case 'processing':
          stages[0].status = 'completed';
          stages[0].progress = 100;
          stages[1].status = 'running';
          stages[1].progress = 50;
          break;
        // Add more cases as needed
      }

      return reply.send({
        video_id: video.id,
        status: video.status,
        progress: job ? calculateProgress(job.status, stages) : 0,
        current_stage: stages.find((s) => s.status === 'running')?.name || '',
        stages,
        error: job?.error || null,
        estimated_completion: null,
      });
    }
  );

  // GET /videos/:id/transcript - Get transcript
  fastify.get<{
    Params: { id: string };
    Querystring: { start_ts?: number; end_ts?: number };
  }>('/videos/:id/transcript', { onRequest: [fastify.authenticate] }, async (request, reply) => {
    const userId = request.user!.sub;
    const videoId = request.params.id;
    const startTs = request.query.start_ts;
    const endTs = request.query.end_ts;

    // Check access
    const hasAccess = await checkAccess(videoId, userId, 'viewer');
    if (!hasAccess) {
      return reply.status(403).send({
        code: 'FORBIDDEN',
        message: 'Access denied',
      });
    }

    // Build query
    let whereClause = eq(schema.transcriptSegments.videoId, videoId);
    if (startTs !== undefined) {
      whereClause = and(whereClause, sql`${schema.transcriptSegments.startSeconds} >= ${startTs}`)!;
    }
    if (endTs !== undefined) {
      whereClause = and(whereClause, sql`${schema.transcriptSegments.endSeconds} <= ${endTs}`)!;
    }

    const segments = await db.query.transcriptSegments.findMany({
      where: whereClause,
      orderBy: schema.transcriptSegments.startSeconds,
    });

    return reply.send({
      video_id: videoId,
      segments: segments.map((s) => ({
        id: s.id,
        start_ts: s.startSeconds,
        end_ts: s.endSeconds,
        speaker_id: s.speakerId,
        text: s.text,
        words: s.words,
      })),
      total: segments.length,
    });
  });
}

// Helper functions
async function checkAccess(
  resourceId: string,
  userId: string,
  requiredRole: 'viewer' | 'editor' | 'owner'
): Promise<boolean> {
  // Check if user is owner
  const video = await db.query.videos.findFirst({
    where: eq(schema.videos.id, resourceId),
  });

  if (video?.createdBy === userId) {
    return true;
  }

  // Check ACL
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

function calculateProgress(
  jobStatus: string,
  stages: Array<{ status: string; progress: number }>
): number {
  if (jobStatus === 'completed') return 100;
  if (jobStatus === 'failed') return 0;

  const totalProgress = stages.reduce((sum, s) => sum + s.progress, 0);
  return Math.floor(totalProgress / stages.length);
}
