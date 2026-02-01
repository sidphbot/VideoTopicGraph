/**
 * Quota Routes
 * 
 * Handles user quota and usage information.
 */

import type { FastifyInstance } from 'fastify';
import { eq, sql } from 'drizzle-orm';
import { db, schema } from '../db/index.js';

export async function quotaRoutes(fastify: FastifyInstance) {
  // GET /quota - Get user's quota usage
  fastify.get('/quota', { onRequest: [fastify.authenticate] }, async (request, reply) => {
    const userId = request.user!.sub;

    // Get user quota
    const userQuota = await db.query.userQuotas.findFirst({
      where: eq(schema.userQuotas.userId, userId),
      with: {
        policy: true,
      },
    });

    if (!userQuota) {
      // Create default quota for user
      const defaultPolicy = await db.query.quotaPolicies.findFirst({
        where: eq(schema.quotaPolicies.id, 'default'),
      });

      if (!defaultPolicy) {
        return reply.status(500).send({
          code: 'INTERNAL_ERROR',
          message: 'Default quota policy not found',
        });
      }

      const [newQuota] = await db
        .insert(schema.userQuotas)
        .values({
          userId,
          policyId: defaultPolicy.id,
        })
        .returning();

      return reply.send({
        policy: {
          max_videos_per_month: defaultPolicy.maxVideosPerMonth,
          max_storage_gb: defaultPolicy.maxStorageGb,
          max_public_links: defaultPolicy.maxPublicLinks,
          max_versions_per_video: defaultPolicy.maxVersionsPerVideo,
        },
        usage: {
          videos_this_month: 0,
          storage_gb: 0,
          public_links: 0,
          versions_total: 0,
        },
        reset_date: getNextResetDate().toISOString().split('T')[0],
      });
    }

    // Check if month has reset
    const now = new Date();
    const resetDate = new Date(userQuota.monthResetAt);
    if (now.getMonth() !== resetDate.getMonth() || now.getFullYear() !== resetDate.getFullYear()) {
      // Reset monthly counters
      await db
        .update(schema.userQuotas)
        .set({
          videosThisMonth: 0,
          monthResetAt: now,
          updatedAt: now,
        })
        .where(eq(schema.userQuotas.userId, userId));

      userQuota.videosThisMonth = 0;
    }

    // Get total versions
    const versionCount = await db
      .select({ count: sql<number>`count(*)` })
      .from(schema.graphVersions)
      .where(
        sql`${schema.graphVersions.video_id} IN (
          SELECT id FROM videos WHERE created_by = ${userId}
        )`
      );

    return reply.send({
      policy: {
        max_videos_per_month: userQuota.policy.maxVideosPerMonth,
        max_storage_gb: userQuota.policy.maxStorageGb,
        max_public_links: userQuota.policy.maxPublicLinks,
        max_versions_per_video: userQuota.policy.maxVersionsPerVideo,
      },
      usage: {
        videos_this_month: userQuota.videosThisMonth,
        storage_gb: userQuota.storageBytes / (1024 * 1024 * 1024),
        public_links: userQuota.publicLinks,
        versions_total: versionCount[0]?.count || 0,
      },
      reset_date: getNextResetDate(userQuota.monthResetAt).toISOString().split('T')[0],
    });
  });
}

function getNextResetDate(fromDate?: Date): Date {
  const date = fromDate ? new Date(fromDate) : new Date();
  date.setMonth(date.getMonth() + 1);
  date.setDate(1);
  date.setHours(0, 0, 0, 0);
  return date;
}
