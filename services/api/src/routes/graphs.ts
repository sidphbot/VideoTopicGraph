/**
 * Graph Routes
 * 
 * Handles graph operations including forking and versioning.
 */

import type { FastifyInstance } from 'fastify';
import { v4 as uuidv4 } from 'uuid';
import { eq, desc, and } from 'drizzle-orm';
import { db, schema } from '../db/index.js';

export async function graphRoutes(fastify: FastifyInstance) {
  // GET /videos/:id/graph - Get video graph
  fastify.get<{
    Params: { id: string };
    Querystring: { version?: string; level?: number };
  }>('/videos/:id/graph', { onRequest: [fastify.authenticate] }, async (request, reply) => {
    const userId = request.user!.sub;
    const videoId = request.params.id;
    const versionId = request.query.version;
    const level = request.query.level;

    // Check access
    const hasAccess = await checkAccess(videoId, userId, 'viewer');
    if (!hasAccess) {
      return reply.status(403).send({
        code: 'FORBIDDEN',
        message: 'Access denied',
      });
    }

    // Get graph version
    let graphVersion;
    if (versionId) {
      graphVersion = await db.query.graphVersions.findFirst({
        where: eq(schema.graphVersions.id, versionId),
      });
    } else {
      const versions = await db.query.graphVersions.findMany({
        where: eq(schema.graphVersions.videoId, videoId),
        orderBy: desc(schema.graphVersions.version),
        limit: 1,
      });
      graphVersion = versions[0];
    }

    if (!graphVersion) {
      return reply.status(404).send({
        code: 'NOT_FOUND',
        message: 'Graph not found',
      });
    }

    // Get topics
    let topicsQuery = db.query.topicNodes.findMany({
      where: eq(schema.topicNodes.graphVersionId, graphVersion.id),
    });

    if (level !== undefined) {
      topicsQuery = db.query.topicNodes.findMany({
        where: and(
          eq(schema.topicNodes.graphVersionId, graphVersion.id),
          eq(schema.topicNodes.level, level)
        ),
      });
    }

    const topics = await topicsQuery;

    // Get edges
    const edges = await db.query.topicEdges.findMany({
      where: eq(schema.topicEdges.graphVersionId, graphVersion.id),
    });

    // Calculate metrics
    const metrics = {
      node_count: topics.length,
      edge_count: edges.length,
      density: topics.length > 1 ? edges.length / (topics.length * (topics.length - 1) / 2) : 0,
      avg_clustering: 0, // Would need graph analysis
      connected_components: 1,
      levels: calculateLevelMetrics(topics),
    };

    return reply.send({
      id: graphVersion.id,
      video_id: videoId,
      version: graphVersion.version,
      parent_version_id: graphVersion.parentVersionId,
      status: graphVersion.status,
      nodes: topics.map((t) => ({
        id: t.id,
        level: t.level,
        start_ts: t.startSeconds,
        end_ts: t.endSeconds,
        title: t.title,
        summary: t.summary,
        keywords: t.keywords,
        parent_ids: t.parentIds,
        child_ids: t.childIds,
        importance_score: t.importanceScore,
        cluster_id: t.clusterId,
      })),
      edges: edges.map((e) => ({
        id: e.id,
        src_topic_id: e.srcTopicId,
        dst_topic_id: e.dstTopicId,
        edge_type: e.edgeType,
        distance: e.distance,
        weight: e.weight,
        metadata: e.metadata,
      })),
      metrics,
      created_at: graphVersion.createdAt.toISOString(),
      updated_at: graphVersion.createdAt.toISOString(),
    });
  });

  // GET /graphs/:id - Get graph by ID
  fastify.get<{ Params: { id: string } }>(
    '/graphs/:id',
    { onRequest: [fastify.authenticate] },
    async (request, reply) => {
      const userId = request.user!.sub;
      const graphId = request.params.id;

      const graphVersion = await db.query.graphVersions.findFirst({
        where: eq(schema.graphVersions.id, graphId),
      });

      if (!graphVersion) {
        return reply.status(404).send({
          code: 'NOT_FOUND',
          message: 'Graph not found',
        });
      }

      // Check access
      const hasAccess = await checkAccess(graphVersion.videoId, userId, 'viewer');
      if (!hasAccess) {
        return reply.status(403).send({
          code: 'FORBIDDEN',
          message: 'Access denied',
        });
      }

      // Get topics and edges
      const topics = await db.query.topicNodes.findMany({
        where: eq(schema.topicNodes.graphVersionId, graphId),
      });

      const edges = await db.query.topicEdges.findMany({
        where: eq(schema.topicEdges.graphVersionId, graphId),
      });

      const metrics = {
        node_count: topics.length,
        edge_count: edges.length,
        density: topics.length > 1 ? edges.length / (topics.length * (topics.length - 1) / 2) : 0,
        avg_clustering: 0,
        connected_components: 1,
        levels: calculateLevelMetrics(topics),
      };

      return reply.send({
        id: graphVersion.id,
        video_id: graphVersion.videoId,
        version: graphVersion.version,
        parent_version_id: graphVersion.parentVersionId,
        status: graphVersion.status,
        nodes: topics.map((t) => ({
          id: t.id,
          level: t.level,
          start_ts: t.startSeconds,
          end_ts: t.endSeconds,
          title: t.title,
          summary: t.summary,
          keywords: t.keywords,
          parent_ids: t.parentIds,
          child_ids: t.childIds,
          importance_score: t.importanceScore,
          cluster_id: t.clusterId,
        })),
        edges: edges.map((e) => ({
          id: e.id,
          src_topic_id: e.srcTopicId,
          dst_topic_id: e.dstTopicId,
          edge_type: e.edgeType,
          distance: e.distance,
          weight: e.weight,
          metadata: e.metadata,
        })),
        metrics,
        created_at: graphVersion.createdAt.toISOString(),
        updated_at: graphVersion.createdAt.toISOString(),
      });
    }
  );

  // DELETE /graphs/:id - Delete graph version
  fastify.delete<{ Params: { id: string } }>(
    '/graphs/:id',
    { onRequest: [fastify.authenticate] },
    async (request, reply) => {
      const userId = request.user!.sub;
      const graphId = request.params.id;

      const graphVersion = await db.query.graphVersions.findFirst({
        where: eq(schema.graphVersions.id, graphId),
      });

      if (!graphVersion) {
        return reply.status(404).send({
          code: 'NOT_FOUND',
          message: 'Graph not found',
        });
      }

      // Check ownership
      const video = await db.query.videos.findFirst({
        where: eq(schema.videos.id, graphVersion.videoId),
      });

      if (video?.createdBy !== userId) {
        return reply.status(403).send({
          code: 'FORBIDDEN',
          message: 'Only the owner can delete graph versions',
        });
      }

      await db.delete(schema.graphVersions).where(eq(schema.graphVersions.id, graphId));

      return reply.status(204).send();
    }
  );

  // POST /graphs/:id/fork - Fork graph
  fastify.post<{
    Params: { id: string };
    Body: { notes?: string; topic_modifications?: unknown[] };
  }>('/graphs/:id/fork', { onRequest: [fastify.authenticate] }, async (request, reply) => {
    const userId = request.user!.sub;
    const graphId = request.params.id;
    const { notes, topic_modifications } = request.body;

    const graphVersion = await db.query.graphVersions.findFirst({
      where: eq(schema.graphVersions.id, graphId),
    });

    if (!graphVersion) {
      return reply.status(404).send({
        code: 'NOT_FOUND',
        message: 'Graph not found',
      });
    }

    // Check access
    const hasAccess = await checkAccess(graphVersion.videoId, userId, 'editor');
    if (!hasAccess) {
      return reply.status(403).send({
        code: 'FORBIDDEN',
        message: 'Access denied',
      });
    }

    // Get next version number
    const versions = await db.query.graphVersions.findMany({
      where: eq(schema.graphVersions.videoId, graphVersion.videoId),
      orderBy: desc(schema.graphVersions.version),
      limit: 1,
    });
    const nextVersion = (versions[0]?.version || 0) + 1;

    // Create new graph version
    const newGraphId = uuidv4();
    const [newGraph] = await db
      .insert(schema.graphVersions)
      .values({
        id: newGraphId,
        videoId: graphVersion.videoId,
        version: nextVersion,
        parentVersionId: graphId,
        createdBy: userId,
        status: 'processing',
        notes,
        configSnapshot: graphVersion.configSnapshot,
      })
      .returning();

    // Copy topics (with modifications if provided)
    const topics = await db.query.topicNodes.findMany({
      where: eq(schema.topicNodes.graphVersionId, graphId),
    });

    const topicIdMap = new Map<string, string>();

    for (const topic of topics) {
      const newTopicId = uuidv4();
      topicIdMap.set(topic.id, newTopicId);

      // Check if topic should be modified
      const modification = topic_modifications?.find(
        (m: { topic_id: string }) => m.topic_id === topic.id
      );

      if (modification?.action === 'delete') {
        continue;
      }

      await db.insert(schema.topicNodes).values({
        id: newTopicId,
        videoId: topic.videoId,
        graphVersionId: newGraphId,
        level: topic.level,
        startSeconds: topic.startSeconds,
        endSeconds: topic.endSeconds,
        title: modification?.updates?.title || topic.title,
        summary: modification?.updates?.summary || topic.summary,
        keywords: modification?.updates?.keywords || topic.keywords,
        parentIds: [], // Will be updated after all topics are created
        childIds: [],
        importanceScore: modification?.updates?.importance_score || topic.importanceScore,
        clusterId: topic.clusterId,
        transcriptSegmentIds: topic.transcriptSegmentIds,
      });
    }

    // Update parent/child relationships with new IDs
    for (const topic of topics) {
      const newTopicId = topicIdMap.get(topic.id);
      if (!newTopicId) continue;

      const newParentIds = topic.parentIds
        .map((id) => topicIdMap.get(id))
        .filter((id): id is string => id !== undefined);

      const newChildIds = topic.childIds
        .map((id) => topicIdMap.get(id))
        .filter((id): id is string => id !== undefined);

      await db
        .update(schema.topicNodes)
        .set({
          parentIds: newParentIds,
          childIds: newChildIds,
        })
        .where(eq(schema.topicNodes.id, newTopicId));
    }

    // Copy edges with new topic IDs
    const edges = await db.query.topicEdges.findMany({
      where: eq(schema.topicEdges.graphVersionId, graphId),
    });

    for (const edge of edges) {
      const newSrcId = topicIdMap.get(edge.srcTopicId);
      const newDstId = topicIdMap.get(edge.dstTopicId);

      if (newSrcId && newDstId) {
        await db.insert(schema.topicEdges).values({
          id: uuidv4(),
          videoId: edge.videoId,
          graphVersionId: newGraphId,
          srcTopicId: newSrcId,
          dstTopicId: newDstId,
          edgeType: edge.edgeType,
          distance: edge.distance,
          weight: edge.weight,
          metadata: edge.metadata,
        });
      }
    }

    // Update status to complete
    await db
      .update(schema.graphVersions)
      .set({ status: 'complete' })
      .where(eq(schema.graphVersions.id, newGraphId));

    return reply.status(201).send({
      id: newGraph.id,
      video_id: newGraph.videoId,
      version: newGraph.version,
      parent_version_id: newGraph.parentVersionId,
      status: 'complete',
      nodes: [],
      edges: [],
      metrics: {
        node_count: topics.length,
        edge_count: edges.length,
        density: 0,
        avg_clustering: 0,
        connected_components: 1,
        levels: [],
      },
      created_at: newGraph.createdAt.toISOString(),
      updated_at: newGraph.createdAt.toISOString(),
    });
  });

  // GET /graphs/:id/versions - List graph versions
  fastify.get<{ Params: { id: string } }>(
    '/graphs/:id/versions',
    { onRequest: [fastify.authenticate] },
    async (request, reply) => {
      const userId = request.user!.sub;
      const graphId = request.params.id;

      const graphVersion = await db.query.graphVersions.findFirst({
        where: eq(schema.graphVersions.id, graphId),
      });

      if (!graphVersion) {
        return reply.status(404).send({
          code: 'NOT_FOUND',
          message: 'Graph not found',
        });
      }

      // Check access
      const hasAccess = await checkAccess(graphVersion.videoId, userId, 'viewer');
      if (!hasAccess) {
        return reply.status(403).send({
          code: 'FORBIDDEN',
          message: 'Access denied',
        });
      }

      const versions = await db.query.graphVersions.findMany({
        where: eq(schema.graphVersions.videoId, graphVersion.videoId),
        orderBy: desc(schema.graphVersions.version),
      });

      return reply.send({
        items: versions.map((v) => ({
          id: v.id,
          version: v.version,
          parent_version_id: v.parentVersionId,
          status: v.status,
          nodes_count: 0, // Would need to query
          created_by: v.createdBy,
          created_at: v.createdAt.toISOString(),
          notes: v.notes,
        })),
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

function calculateLevelMetrics(topics: Array<{ level: number }>): Array<{
  level: number;
  node_count: number;
}> {
  const counts = new Map<number, number>();
  for (const topic of topics) {
    counts.set(topic.level, (counts.get(topic.level) || 0) + 1);
  }
  return Array.from(counts.entries())
    .sort((a, b) => a[0] - b[0])
    .map(([level, count]) => ({ level, node_count: count }));
}
