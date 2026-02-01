/**
 * Unit Tests - Shared Types Schemas
 * 
 * Tests for Zod schema validation ensuring type safety across the platform.
 */

import { describe, it, expect } from 'vitest';
import {
  VideoSourceSchema,
  PipelineJobSchema,
  TopicNodeSchema,
  EdgeSchema,
  ArtifactManifestSchema,
  SearchQuerySchema,
  VideoStatus,
  PipelineStage,
  PipelineStatus,
  NodeType,
  EdgeType,
  ExportFormat,
} from './schemas';

describe('VideoSourceSchema', () => {
  const validVideoSource = {
    id: 'vid-123',
    title: 'Test Video',
    description: 'A test video',
    originalUrl: 'https://youtube.com/watch?v=test',
    status: VideoStatus.PENDING,
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
  };

  it('should validate a valid video source', () => {
    const result = VideoSourceSchema.safeParse(validVideoSource);
    expect(result.success).toBe(true);
  });

  it('should reject missing required fields', () => {
    const invalid = { ...validVideoSource };
    delete (invalid as any).title;
    const result = VideoSourceSchema.safeParse(invalid);
    expect(result.success).toBe(false);
  });

  it('should reject invalid URL format', () => {
    const invalid = { ...validVideoSource, originalUrl: 'not-a-url' };
    const result = VideoSourceSchema.safeParse(invalid);
    expect(result.success).toBe(false);
  });

  it('should accept optional metadata fields', () => {
    const withMetadata = {
      ...validVideoSource,
      metadata: {
        duration: 3600,
        resolution: '1920x1080',
        fps: 30,
        codec: 'h264',
      },
    };
    const result = VideoSourceSchema.safeParse(withMetadata);
    expect(result.success).toBe(true);
  });

  it('should accept all valid statuses', () => {
    const statuses = Object.values(VideoStatus);
    for (const status of statuses) {
      const video = { ...validVideoSource, status };
      const result = VideoSourceSchema.safeParse(video);
      expect(result.success).toBe(true);
    }
  });
});

describe('PipelineJobSchema', () => {
  const validJob = {
    id: 'job-456',
    videoId: 'vid-123',
    stage: PipelineStage.VIDEO,
    status: PipelineStatus.PENDING,
    priority: 1,
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
  };

  it('should validate a valid pipeline job', () => {
    const result = PipelineJobSchema.safeParse(validJob);
    expect(result.success).toBe(true);
  });

  it('should reject invalid priority values', () => {
    const invalid = { ...validJob, priority: 11 };
    const result = PipelineJobSchema.safeParse(invalid);
    expect(result.success).toBe(false);
  });

  it('should accept all valid stages', () => {
    const stages = Object.values(PipelineStage);
    for (const stage of stages) {
      const job = { ...validJob, stage };
      const result = PipelineJobSchema.safeParse(job);
      expect(result.success).toBe(true);
    }
  });

  it('should accept manifest reference', () => {
    const withManifest = {
      ...validJob,
      manifestId: 'manifest-789',
    };
    const result = PipelineJobSchema.safeParse(withManifest);
    expect(result.success).toBe(true);
  });

  it('should accept retry count', () => {
    const withRetry = {
      ...validJob,
      retryCount: 2,
    };
    const result = PipelineJobSchema.safeParse(withRetry);
    expect(result.success).toBe(true);
  });
});

describe('TopicNodeSchema', () => {
  const validNode = {
    id: 'node-789',
    videoId: 'vid-123',
    type: NodeType.TOPIC,
    label: 'Introduction',
    startTime: 0,
    endTime: 120,
    confidence: 0.95,
    createdAt: new Date().toISOString(),
  };

  it('should validate a valid topic node', () => {
    const result = TopicNodeSchema.safeParse(validNode);
    expect(result.success).toBe(true);
  });

  it('should reject negative timestamps', () => {
    const invalid = { ...validNode, startTime: -1 };
    const result = TopicNodeSchema.safeParse(invalid);
    expect(result.success).toBe(false);
  });

  it('should reject endTime before startTime', () => {
    const invalid = { ...validNode, startTime: 100, endTime: 50 };
    const result = TopicNodeSchema.safeParse(invalid);
    expect(result.success).toBe(false);
  });

  it('should reject confidence outside 0-1 range', () => {
    const invalidHigh = { ...validNode, confidence: 1.5 };
    expect(TopicNodeSchema.safeParse(invalidHigh).success).toBe(false);

    const invalidLow = { ...validNode, confidence: -0.5 };
    expect(TopicNodeSchema.safeParse(invalidLow).success).toBe(false);
  });

  it('should accept all valid node types', () => {
    const types = Object.values(NodeType);
    for (const type of types) {
      const node = { ...validNode, type };
      const result = TopicNodeSchema.safeParse(node);
      expect(result.success).toBe(true);
    }
  });

  it('should accept embedding vector', () => {
    const withEmbedding = {
      ...validNode,
      embedding: new Array(384).fill(0.1),
    };
    const result = TopicNodeSchema.safeParse(withEmbedding);
    expect(result.success).toBe(true);
  });
});

describe('EdgeSchema', () => {
  const validEdge = {
    id: 'edge-001',
    sourceId: 'node-001',
    targetId: 'node-002',
    type: EdgeType.SEQUENTIAL,
    weight: 0.8,
    videoId: 'vid-123',
    createdAt: new Date().toISOString(),
  };

  it('should validate a valid edge', () => {
    const result = EdgeSchema.safeParse(validEdge);
    expect(result.success).toBe(true);
  });

  it('should reject self-referencing edges', () => {
    const invalid = { ...validEdge, targetId: 'node-001' };
    const result = EdgeSchema.safeParse(invalid);
    expect(result.success).toBe(false);
  });

  it('should reject negative weight', () => {
    const invalid = { ...validEdge, weight: -0.5 };
    const result = EdgeSchema.safeParse(invalid);
    expect(result.success).toBe(false);
  });

  it('should accept all valid edge types', () => {
    const types = Object.values(EdgeType);
    for (const type of types) {
      const edge = { ...validEdge, type };
      const result = EdgeSchema.safeParse(edge);
      expect(result.success).toBe(true);
    }
  });
});

describe('ArtifactManifestSchema', () => {
  const validManifest = {
    version: '1.0.0',
    videoId: 'vid-123',
    jobId: 'job-456',
    artifacts: {
      video: {
        original: {
          key: 'videos/vid-123/original.mp4',
          bucket: 'video-graph',
          size: 104857600,
          contentType: 'video/mp4',
          checksum: 'sha256:abc123',
        },
      },
      transcript: {
        vtt: {
          key: 'transcripts/vid-123/transcript.vtt',
          bucket: 'video-graph',
          size: 10240,
          contentType: 'text/vtt',
          checksum: 'sha256:def456',
        },
      },
    },
    metadata: {
      createdAt: new Date().toISOString(),
      pipelineVersion: '1.0.0',
    },
  };

  it('should validate a valid manifest', () => {
    const result = ArtifactManifestSchema.safeParse(validManifest);
    expect(result.success).toBe(true);
  });

  it('should reject invalid semantic version', () => {
    const invalid = { ...validManifest, version: 'not-a-version' };
    const result = ArtifactManifestSchema.safeParse(invalid);
    expect(result.success).toBe(false);
  });

  it('should require at least one artifact', () => {
    const invalid = { ...validManifest, artifacts: {} };
    const result = ArtifactManifestSchema.safeParse(invalid);
    expect(result.success).toBe(false);
  });

  it('should validate artifact reference structure', () => {
    const invalidArtifact = {
      ...validManifest,
      artifacts: {
        video: {
          original: {
            key: 'videos/vid-123/original.mp4',
            // Missing required fields
          },
        },
      },
    };
    const result = ArtifactManifestSchema.safeParse(invalidArtifact);
    expect(result.success).toBe(false);
  });
});

describe('SearchQuerySchema', () => {
  it('should validate semantic search query', () => {
    const query = {
      query: 'machine learning introduction',
      searchType: 'semantic',
    };
    const result = SearchQuerySchema.safeParse(query);
    expect(result.success).toBe(true);
  });

  it('should validate fulltext search query', () => {
    const query = {
      query: 'neural networks',
      searchType: 'fulltext',
    };
    const result = SearchQuerySchema.safeParse(query);
    expect(result.success).toBe(true);
  });

  it('should validate hybrid search with filters', () => {
    const query = {
      query: 'deep learning',
      searchType: 'hybrid',
      filters: {
        videoIds: ['vid-123'],
        dateRange: {
          from: '2024-01-01',
          to: '2024-12-31',
        },
      },
      limit: 10,
    };
    const result = SearchQuerySchema.safeParse(query);
    expect(result.success).toBe(true);
  });

  it('should reject empty query', () => {
    const query = { query: '', searchType: 'semantic' };
    const result = SearchQuerySchema.safeParse(query);
    expect(result.success).toBe(false);
  });

  it('should reject limit exceeding maximum', () => {
    const query = {
      query: 'test',
      searchType: 'semantic',
      limit: 101,
    };
    const result = SearchQuerySchema.safeParse(query);
    expect(result.success).toBe(false);
  });

  it('should reject invalid date range', () => {
    const query = {
      query: 'test',
      searchType: 'semantic',
      filters: {
        dateRange: {
          from: '2024-12-31',
          to: '2024-01-01',
        },
      },
    };
    const result = SearchQuerySchema.safeParse(query);
    expect(result.success).toBe(false);
  });
});

describe('Enum Validation', () => {
  it('should have correct VideoStatus values', () => {
    expect(VideoStatus.PENDING).toBe('pending');
    expect(VideoStatus.PROCESSING).toBe('processing');
    expect(VideoStatus.COMPLETED).toBe('completed');
    expect(VideoStatus.FAILED).toBe('failed');
  });

  it('should have correct PipelineStage values', () => {
    expect(PipelineStage.VIDEO).toBe('video');
    expect(PipelineStage.ASR).toBe('asr');
    expect(PipelineStage.TOPICS).toBe('topics');
    expect(PipelineStage.EMBEDDINGS).toBe('embeddings');
    expect(PipelineStage.GRAPH).toBe('graph');
    expect(PipelineStage.SNIPPETS).toBe('snippets');
    expect(PipelineStage.EXPORT).toBe('export');
  });

  it('should have correct ExportFormat values', () => {
    expect(ExportFormat.PPTX).toBe('pptx');
    expect(ExportFormat.HTML).toBe('html');
    expect(ExportFormat.PDF).toBe('pdf');
    expect(ExportFormat.JSON).toBe('json');
  });
});
