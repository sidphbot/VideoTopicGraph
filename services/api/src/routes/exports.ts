/**
 * Export Routes
 * 
 * Handles export generation (PPTX, HTML, PDF).
 */

import type { FastifyInstance } from 'fastify';
import { v4 as uuidv4 } from 'uuid';
import { eq, desc } from 'drizzle-orm';
import { db, schema } from '../db/index.js';
import { CreateExportRequestSchema } from '@video-graph/shared-types';

export async function exportRoutes(fastify: FastifyInstance) {
  // POST /exports - Create export
  fastify.post<{
    Body: {
      video_id: string;
      graph_version_id?: string;
      type: 'pptx' | 'html' | 'pdf';
      options?: {
        include_snippets?: boolean;
        snippet_embed_mode?: 'embedded' | 'linked' | 'none';
        template?: 'default' | 'minimal' | 'detailed';
        topic_levels?: number[];
        include_appendix?: boolean;
      };
    };
  }>('/exports', { onRequest: [fastify.authenticate] }, async (request, reply) => {
    const userId = request.user!.sub;

    // Validate request
    const validation = CreateExportRequestSchema.safeParse(request.body);
    if (!validation.success) {
      return reply.status(400).send({
        code: 'VALIDATION_ERROR',
        message: 'Invalid request body',
        details: validation.error.format(),
      });
    }

    const { video_id, graph_version_id, type, options = {} } = validation.data;

    // Check access
    const video = await db.query.videos.findFirst({
      where: eq(schema.videos.id, video_id),
    });

    if (!video) {
      return reply.status(404).send({
        code: 'NOT_FOUND',
        message: 'Video not found',
      });
    }

    if (video.createdBy !== userId) {
      return reply.status(403).send({
        code: 'FORBIDDEN',
        message: 'Access denied',
      });
    }

    // Get graph version
    let graphVersionId = graph_version_id;
    if (!graphVersionId) {
      const versions = await db.query.graphVersions.findMany({
        where: eq(schema.graphVersions.videoId, video_id),
        orderBy: desc(schema.graphVersions.version),
        limit: 1,
      });
      graphVersionId = versions[0]?.id;
    }

    if (!graphVersionId) {
      return reply.status(404).send({
        code: 'NOT_FOUND',
        message: 'No graph version found for this video',
      });
    }

    // Create export record
    const exportId = uuidv4();
    const [exportRecord] = await db
      .insert(schema.exports)
      .values({
        id: exportId,
        videoId: video_id,
        graphVersionId,
        type,
        status: 'pending',
        options,
        createdBy: userId,
      })
      .returning();

    // Create job for worker
    const jobId = uuidv4();
    await db.insert(schema.jobs).values({
      id: jobId,
      type: 'export',
      status: 'pending',
      payload: {
        exportId,
        videoId: video_id,
        graphVersionId,
        type,
        options,
      },
      priority: 5,
    });

    return reply.status(202).send({
      id: exportRecord.id,
      video_id: exportRecord.videoId,
      type: exportRecord.type,
      status: exportRecord.status,
      storage_path: null,
      download_url: null,
      expires_at: null,
      created_at: exportRecord.createdAt.toISOString(),
      completed_at: null,
      error: null,
    });
  });

  // GET /exports/:id - Get export status
  fastify.get<{ Params: { id: string } }>(
    '/exports/:id',
    { onRequest: [fastify.authenticate] },
    async (request, reply) => {
      const userId = request.user!.sub;
      const exportId = request.params.id;

      const exportRecord = await db.query.exports.findFirst({
        where: eq(schema.exports.id, exportId),
      });

      if (!exportRecord) {
        return reply.status(404).send({
          code: 'NOT_FOUND',
          message: 'Export not found',
        });
      }

      // Check access
      if (exportRecord.createdBy !== userId) {
        return reply.status(403).send({
          code: 'FORBIDDEN',
          message: 'Access denied',
        });
      }

      // Generate download URL if complete
      let downloadUrl: string | null = null;
      if (exportRecord.status === 'complete' && exportRecord.storagePath) {
        // Would generate presigned URL from storage service
        downloadUrl = `/api/v1/exports/${exportId}/download`;
      }

      return reply.send({
        id: exportRecord.id,
        video_id: exportRecord.videoId,
        type: exportRecord.type,
        status: exportRecord.status,
        storage_path: exportRecord.storagePath,
        download_url: downloadUrl,
        expires_at: null, // Could set expiration
        created_at: exportRecord.createdAt.toISOString(),
        completed_at: exportRecord.completedAt?.toISOString() || null,
        error: exportRecord.error,
      });
    }
  );

  // GET /exports/:id/download - Download export file
  fastify.get<{ Params: { id: string } }>(
    '/exports/:id/download',
    { onRequest: [fastify.authenticate] },
    async (request, reply) => {
      const userId = request.user!.sub;
      const exportId = request.params.id;

      const exportRecord = await db.query.exports.findFirst({
        where: eq(schema.exports.id, exportId),
      });

      if (!exportRecord) {
        return reply.status(404).send({
          code: 'NOT_FOUND',
          message: 'Export not found',
        });
      }

      // Check access
      if (exportRecord.createdBy !== userId) {
        return reply.status(403).send({
          code: 'FORBIDDEN',
          message: 'Access denied',
        });
      }

      if (exportRecord.status !== 'complete' || !exportRecord.storagePath) {
        return reply.status(404).send({
          code: 'NOT_FOUND',
          message: 'Export file not ready',
        });
      }

      // Would stream file from storage
      // For now, return placeholder
      reply.header('Content-Type', getContentType(exportRecord.type));
      reply.header(
        'Content-Disposition',
        `attachment; filename="export-${exportId}.${exportRecord.type}"`
      );

      return reply.send(Buffer.from('Export file content'));
    }
  );
}

function getContentType(type: string): string {
  switch (type) {
    case 'pptx':
      return 'application/vnd.openxmlformats-officedocument.presentationml.presentation';
    case 'html':
      return 'text/html';
    case 'pdf':
      return 'application/pdf';
    default:
      return 'application/octet-stream';
  }
}
