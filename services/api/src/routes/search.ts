/**
 * Search Routes
 * 
 * Handles semantic search and deep search with LLM reasoning.
 */

import type { FastifyInstance } from 'fastify';
import { eq, and, sql, inArray } from 'drizzle-orm';
import { db, schema } from '../db/index.js';
import { config } from '../config.js';

export async function searchRoutes(fastify: FastifyInstance) {
  // POST /search - Semantic search
  fastify.post<{
    Body: {
      query: string;
      video_ids?: string[];
      filters?: { level?: number; min_importance?: number; date_from?: string; date_to?: string };
      options?: { include_transcripts?: boolean; include_edges?: boolean; top_k?: number };
    };
  }>('/search', { onRequest: [fastify.authenticate] }, async (request, reply) => {
    const userId = request.user!.sub;
    const { query, video_ids, filters, options } = request.body;
    const topK = options?.top_k || 10;

    // Get accessible video IDs
    let accessibleVideoIds: string[] = [];
    if (video_ids && video_ids.length > 0) {
      // Check access for each video
      for (const videoId of video_ids) {
        const hasAccess = await checkAccess(videoId, userId, 'viewer');
        if (hasAccess) {
          accessibleVideoIds.push(videoId);
        }
      }
    } else {
      // Get all accessible videos
      const videos = await db.query.videos.findMany({
        where: eq(schema.videos.createdBy, userId),
      });
      accessibleVideoIds = videos.map((v) => v.id);
    }

    if (accessibleVideoIds.length === 0) {
      return reply.send({
        query,
        results: [],
        total: 0,
        took_ms: 0,
      });
    }

    const startTime = Date.now();

    // Generate query embedding
    const queryEmbedding = await generateEmbedding(query);

    // Build search query
    let whereClause = inArray(schema.topicNodes.videoId, accessibleVideoIds);

    if (filters?.level !== undefined) {
      whereClause = and(whereClause, eq(schema.topicNodes.level, filters.level))!;
    }

    if (filters?.min_importance !== undefined) {
      whereClause = and(
        whereClause,
        sql`${schema.topicNodes.importanceScore} >= ${filters.min_importance}`
      )!;
    }

    // Perform vector search
    const searchResults = await db.execute(sql`
      SELECT 
        id,
        video_id,
        level,
        start_seconds,
        end_seconds,
        title,
        summary,
        keywords,
        parent_ids,
        child_ids,
        importance_score,
        cluster_id,
        1 - (embedding <=> ${sql.array(queryEmbedding)}::vector) as similarity
      FROM topic_nodes
      WHERE ${whereClause}
      ORDER BY embedding <=> ${sql.array(queryEmbedding)}::vector
      LIMIT ${topK}
    `);

    const topics = searchResults as Array<{
      id: string;
      video_id: string;
      level: number;
      start_seconds: number;
      end_seconds: number;
      title: string;
      summary: string;
      keywords: string[];
      parent_ids: string[];
      child_ids: string[];
      importance_score: number;
      cluster_id: string | null;
      similarity: number;
    }>;

    // Get matched transcripts if requested
    let matchedTranscripts: Map<string, string> = new Map();
    if (options?.include_transcripts) {
      for (const topic of topics) {
        const segments = await db.query.transcriptSegments.findMany({
          where: and(
            eq(schema.transcriptSegments.videoId, topic.video_id),
            sql`${schema.transcriptSegments.startSeconds} >= ${topic.start_seconds}`,
            sql`${schema.transcriptSegments.endSeconds} <= ${topic.end_seconds}`
          ),
        });
        matchedTranscripts.set(
          topic.id,
          segments.map((s) => s.text).join(' ')
        );
      }
    }

    // Get edges if requested
    let topicEdges: Map<string, Array<{ id: string; type: string; weight: number }>> = new Map();
    if (options?.include_edges) {
      for (const topic of topics) {
        const edges = await db.query.topicEdges.findMany({
          where: and(
            eq(schema.topicEdges.srcTopicId, topic.id),
            inArray(schema.topicEdges.dstTopicId, topics.map((t) => t.id))
          ),
        });
        topicEdges.set(
          topic.id,
          edges.map((e) => ({ id: e.id, type: e.edgeType, weight: e.weight }))
        );
      }
    }

    const tookMs = Date.now() - startTime;

    return reply.send({
      query,
      results: topics.map((t) => ({
        topic: {
          id: t.id,
          level: t.level,
          start_ts: t.start_seconds,
          end_ts: t.end_seconds,
          title: t.title,
          summary: t.summary,
          keywords: t.keywords,
          parent_ids: t.parent_ids,
          child_ids: t.child_ids,
          importance_score: t.importance_score,
          cluster_id: t.cluster_id,
        },
        score: t.similarity,
        matched_transcript: matchedTranscripts.get(t.id) || null,
        highlight: generateHighlight(t.title, t.summary, query),
      })),
      total: topics.length,
      took_ms: tookMs,
    });
  });

  // POST /search/deep - Deep search with LLM reasoning
  fastify.post<{
    Body: {
      query: string;
      video_ids?: string[];
      context?: { include_synthesis?: boolean; include_cross_references?: boolean; max_topics_to_analyze?: number };
    };
  }>('/search/deep', { onRequest: [fastify.authenticate] }, async (request, reply) => {
    if (!config.features.deepSearch) {
      return reply.status(503).send({
        code: 'FEATURE_DISABLED',
        message: 'Deep search is disabled',
      });
    }

    const userId = request.user!.sub;
    const { query, video_ids, context } = request.body;
    const maxTopics = context?.max_topics_to_analyze || 20;

    // First, perform semantic search to get relevant topics
    const semanticResults = await performSemanticSearch(
      query,
      video_ids,
      userId,
      maxTopics
    );

    const startTime = Date.now();

    // Use LLM to synthesize answer
    const answer = await synthesizeAnswer(query, semanticResults);

    // Generate cross-references if requested
    let crossReferences: Array<{
      topic_a_id: string;
      topic_b_id: string;
      relationship: string;
    }> = [];

    if (context?.include_cross_references !== false && semanticResults.length > 1) {
      crossReferences = await generateCrossReferences(semanticResults);
    }

    const tookMs = Date.now() - startTime;

    return reply.send({
      query,
      answer,
      sources: semanticResults.map((r) => ({
        topic: r.topic,
        score: r.score,
        matched_transcript: null,
        highlight: null,
      })),
      synthesis: context?.include_synthesis !== false ? generateSynthesis(semanticResults) : null,
      cross_references: crossReferences,
      took_ms: tookMs,
    });
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

async function generateEmbedding(text: string): Promise<number[]> {
  // Implementation would use sentence-transformers or similar
  // Placeholder: return random normalized embedding
  const vec = Array.from({ length: 384 }, () => Math.random() * 2 - 1);
  const norm = Math.sqrt(vec.reduce((sum, x) => sum + x * x, 0));
  return vec.map((x) => x / norm);
}

async function performSemanticSearch(
  query: string,
  videoIds: string[] | undefined,
  userId: string,
  topK: number
): Promise<
  Array<{
    topic: {
      id: string;
      level: number;
      start_ts: number;
      end_ts: number;
      title: string;
      summary: string;
      keywords: string[];
      parent_ids: string[];
      child_ids: string[];
      importance_score: number;
      cluster_id: string | null;
    };
    score: number;
  }>
> {
  // Get accessible videos
  let accessibleVideoIds: string[] = [];
  if (videoIds && videoIds.length > 0) {
    for (const videoId of videoIds) {
      const hasAccess = await checkAccess(videoId, userId, 'viewer');
      if (hasAccess) {
        accessibleVideoIds.push(videoId);
      }
    }
  } else {
    const videos = await db.query.videos.findMany({
      where: eq(schema.videos.createdBy, userId),
    });
    accessibleVideoIds = videos.map((v) => v.id);
  }

  if (accessibleVideoIds.length === 0) {
    return [];
  }

  // Generate query embedding
  const queryEmbedding = await generateEmbedding(query);

  // Perform vector search
  const searchResults = await db.execute(sql`
    SELECT 
      id,
      video_id,
      level,
      start_seconds,
      end_seconds,
      title,
      summary,
      keywords,
      parent_ids,
      child_ids,
      importance_score,
      cluster_id,
      1 - (embedding <=> ${sql.array(queryEmbedding)}::vector) as similarity
    FROM topic_nodes
    WHERE ${inArray(schema.topicNodes.videoId, accessibleVideoIds)}
    ORDER BY embedding <=> ${sql.array(queryEmbedding)}::vector
    LIMIT ${topK}
  `);

  return (searchResults as Array<{
    id: string;
    video_id: string;
    level: number;
    start_seconds: number;
    end_seconds: number;
    title: string;
    summary: string;
    keywords: string[];
    parent_ids: string[];
    child_ids: string[];
    importance_score: number;
    cluster_id: string | null;
    similarity: number;
  }>).map((t) => ({
    topic: {
      id: t.id,
      level: t.level,
      start_ts: t.start_seconds,
      end_ts: t.end_seconds,
      title: t.title,
      summary: t.summary,
      keywords: t.keywords,
      parent_ids: t.parent_ids,
      child_ids: t.child_ids,
      importance_score: t.importance_score,
      cluster_id: t.cluster_id,
    },
    score: t.similarity,
  }));
}

async function synthesizeAnswer(
  query: string,
  topics: Array<{ topic: { title: string; summary: string }; score: number }>
): Promise<string> {
  // Implementation would use LLM
  // Placeholder
  const context = topics
    .slice(0, 5)
    .map((t) => `${t.topic.title}: ${t.topic.summary}`)
    .join('\n\n');

  return `Based on the video content, here's what I found:\n\n${context}\n\nThis information addresses your query: "${query}"`;
}

async function generateCrossReferences(
  topics: Array<{ topic: { id: string; title: string; keywords: string[] }; score: number }>
): Promise<Array<{ topic_a_id: string; topic_b_id: string; relationship: string }>> {
  const crossReferences: Array<{
    topic_a_id: string;
    topic_b_id: string;
    relationship: string;
  }> = [];

  for (let i = 0; i < topics.length; i++) {
    for (let j = i + 1; j < topics.length; j++) {
      const topicA = topics[i].topic;
      const topicB = topics[j].topic;

      // Check for keyword overlap
      const sharedKeywords = topicA.keywords.filter((k) =>
        topicB.keywords.includes(k)
      );

      if (sharedKeywords.length >= 2) {
        crossReferences.push({
          topic_a_id: topicA.id,
          topic_b_id: topicB.id,
          relationship: `Shared keywords: ${sharedKeywords.join(', ')}`,
        });
      }
    }
  }

  return crossReferences;
}

function generateSynthesis(
  topics: Array<{ topic: { title: string; summary: string } }>
): string {
  // Generate a synthesis of the search results
  const mainThemes = topics.slice(0, 3).map((t) => t.topic.title);
  return `The main themes in these results are: ${mainThemes.join(', ')}.`;
}

function generateHighlight(title: string, summary: string, query: string): string {
  // Simple highlighting - in production, use more sophisticated approach
  const queryWords = query.toLowerCase().split(/\s+/);
  const text = `${title} ${summary}`;

  // Find sentences containing query words
  const sentences = text.split(/[.!?]+/);
  for (const sentence of sentences) {
    const lowerSentence = sentence.toLowerCase();
    if (queryWords.some((word) => lowerSentence.includes(word))) {
      return sentence.trim();
    }
  }

  return title;
}
