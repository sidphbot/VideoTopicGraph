/**
 * Job Routes
 * 
 * Handles job status and management.
 */

import type { FastifyInstance } from 'fastify';
import { eq, and } from 'drizzle-orm';
import { db, schema } from '../db/index.js';

export async function jobRoutes(fastify: FastifyInstance) {
  // GET /jobs/:id - Get job status
  fastify.get<{ Params: { id: string } }>(
    '/jobs/:id',
    { onRequest: [fastify.authenticate] },
    async (request, reply) => {
      const userId = request.user!.sub;
      const jobId = request.params.id;

      const job = await db.query.jobs.findFirst({
        where: eq(schema.jobs.id, jobId),
      });

      if (!job) {
        return reply.status(404).send({
          code: 'NOT_FOUND',
          message: 'Job not found',
        });
      }

      // Check access based on job type
      const payload = job.payload as { videoId?: string; userId?: string };
      if (payload.videoId) {
        const hasAccess = await checkAccess(payload.videoId, userId, 'viewer');
        if (!hasAccess) {
          return reply.status(403).send({
            code: 'FORBIDDEN',
            message: 'Access denied',
          });
        }
      }

      // Build steps from job status
      const steps = [
        {
          name: 'video',
          status: getStepStatus(job.status, 0),
          started_at: job.startedAt?.toISOString() || null,
          completed_at: null,
          error: null,
        },
        {
          name: 'asr',
          status: getStepStatus(job.status, 1),
          started_at: null,
          completed_at: null,
          error: null,
        },
        {
          name: 'topic',
          status: getStepStatus(job.status, 2),
          started_at: null,
          completed_at: null,
          error: null,
        },
        {
          name: 'embeddings-graph',
          status: getStepStatus(job.status, 3),
          started_at: null,
          completed_at: null,
          error: null,
        },
        {
          name: 'snippet',
          status: getStepStatus(job.status, 4),
          started_at: null,
          completed_at: null,
          error: null,
        },
      ];

      // Calculate progress
      const progress = calculateJobProgress(job.status, steps);

      return reply.send({
        id: job.id,
        type: job.type,
        status: job.status,
        progress,
        current_step: steps.find((s) => s.status === 'running')?.name || null,
        steps,
        created_at: job.createdAt.toISOString(),
        started_at: job.startedAt?.toISOString() || null,
        completed_at: job.completedAt?.toISOString() || null,
        error: job.error,
        manifest: null, // Would include artifact manifest if available
      });
    }
  );

  // POST /jobs/:id/cancel - Cancel job
  fastify.post<{ Params: { id: string } }>(
    '/jobs/:id/cancel',
    { onRequest: [fastify.authenticate] },
    async (request, reply) => {
      const userId = request.user!.sub;
      const jobId = request.params.id;

      const job = await db.query.jobs.findFirst({
        where: eq(schema.jobs.id, jobId),
      });

      if (!job) {
        return reply.status(404).send({
          code: 'NOT_FOUND',
          message: 'Job not found',
        });
      }

      // Check access
      const payload = job.payload as { videoId?: string };
      if (payload.videoId) {
        const video = await db.query.videos.findFirst({
          where: eq(schema.videos.id, payload.videoId),
        });
        if (video?.createdBy !== userId) {
          return reply.status(403).send({
            code: 'FORBIDDEN',
            message: 'Only the owner can cancel this job',
          });
        }
      }

      // Can only cancel pending or running jobs
      if (job.status !== 'pending' && job.status !== 'running') {
        return reply.status(409).send({
          code: 'INVALID_STATE',
          message: `Cannot cancel job in ${job.status} state`,
        });
      }

      // Update job status
      await db
        .update(schema.jobs)
        .set({
          status: 'cancelled',
          completedAt: new Date(),
        })
        .where(eq(schema.jobs.id, jobId));

      // Update video status if applicable
      if (payload.videoId) {
        await db
          .update(schema.videos)
          .set({
            status: 'cancelled',
            updatedAt: new Date(),
          })
          .where(eq(schema.videos.id, payload.videoId));
      }

      return reply.send({
        id: job.id,
        type: job.type,
        status: 'cancelled',
        progress: 0,
        current_step: null,
        steps: [],
        created_at: job.createdAt.toISOString(),
        started_at: job.startedAt?.toISOString() || null,
        completed_at: new Date().toISOString(),
        error: null,
        manifest: null,
      });
    }
  );
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

function getStepStatus(
  jobStatus: string,
  stepIndex: number
): 'pending' | 'running' | 'completed' | 'failed' {
  const stepOrder = ['video', 'asr', 'topic', 'embeddings-graph', 'snippet'];

  if (jobStatus === 'completed') {
    return 'completed';
  }
  if (jobStatus === 'failed') {
    return stepIndex === 0 ? 'failed' : 'completed';
  }
  if (jobStatus === 'cancelled') {
    return 'pending';
  }

  // For running jobs, estimate step based on typical progression
  if (jobStatus === 'running') {
    // This is a simplified estimation
    // In production, this would come from actual step tracking
    return stepIndex === 0 ? 'running' : 'pending';
  }

  return 'pending';
}

function calculateJobProgress(
  jobStatus: string,
  steps: Array<{ status: string }>
): number {
  if (jobStatus === 'completed') return 100;
  if (jobStatus === 'failed') return 0;
  if (jobStatus === 'cancelled') return 0;

  const completedSteps = steps.filter((s) => s.status === 'completed').length;
  const runningSteps = steps.filter((s) => s.status === 'running').length;

  return Math.floor(((completedSteps + runningSteps * 0.5) / steps.length) * 100);
}
