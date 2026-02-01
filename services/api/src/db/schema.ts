/**
 * Database Schema
 * 
 * Drizzle ORM schema definitions for all tables.
 */

import {
  pgTable,
  uuid,
  varchar,
  text,
  integer,
  real,
  boolean,
  timestamp,
  jsonb,
  index,
  uniqueIndex,
  primaryKey,
  foreignKey,
} from 'drizzle-orm/pg-core';
import { vector } from 'pgvector/drizzle';
import { sql } from 'drizzle-orm';

// ==================== Videos Table ====================

export const videos = pgTable(
  'videos',
  {
    id: uuid('id').primaryKey().defaultRandom(),
    sourceUrl: text('source_url').notNull(),
    sourceType: varchar('source_type', { length: 50 }).notNull().default('direct'),
    durationSeconds: real('duration_seconds'),
    status: varchar('status', { length: 50 }).notNull().default('pending'),
    metadata: jsonb('metadata').default({}),
    createdBy: varchar('created_by', { length: 255 }).notNull(),
    createdAt: timestamp('created_at', { withTimezone: true }).defaultNow().notNull(),
    updatedAt: timestamp('updated_at', { withTimezone: true }).defaultNow().notNull(),
  },
  (table) => ({
    statusIdx: index('videos_status_idx').on(table.status),
    createdByIdx: index('videos_created_by_idx').on(table.createdBy),
    createdAtIdx: index('videos_created_at_idx').on(table.createdAt),
  })
);

// ==================== Transcript Segments Table ====================

export const transcriptSegments = pgTable(
  'transcript_segments',
  {
    id: uuid('id').primaryKey().defaultRandom(),
    videoId: uuid('video_id')
      .notNull()
      .references(() => videos.id, { onDelete: 'cascade' }),
    startSeconds: real('start_seconds').notNull(),
    endSeconds: real('end_seconds').notNull(),
    speakerId: varchar('speaker_id', { length: 100 }),
    text: text('text').notNull(),
    embedding: vector('embedding', { dimensions: 384 }),
    confidence: real('confidence'),
    words: jsonb('words'), // Array of {word, start, end, confidence}
    createdAt: timestamp('created_at', { withTimezone: true }).defaultNow().notNull(),
  },
  (table) => ({
    videoIdIdx: index('transcript_video_id_idx').on(table.videoId),
    startIdx: index('transcript_start_idx').on(table.startSeconds),
    speakerIdx: index('transcript_speaker_idx').on(table.speakerId),
  })
);

// ==================== Graph Versions Table ====================

export const graphVersions = pgTable(
  'graph_versions',
  {
    id: uuid('id').primaryKey().defaultRandom(),
    videoId: uuid('video_id')
      .notNull()
      .references(() => videos.id, { onDelete: 'cascade' }),
    version: integer('version').notNull(),
    parentVersionId: uuid('parent_version_id'),
    createdBy: varchar('created_by', { length: 255 }).notNull(),
    status: varchar('status', { length: 50 }).notNull().default('processing'),
    notes: text('notes'),
    configSnapshot: jsonb('config_snapshot').notNull(),
    createdAt: timestamp('created_at', { withTimezone: true }).defaultNow().notNull(),
  },
  (table) => ({
    videoIdIdx: index('graph_video_id_idx').on(table.videoId),
    versionIdx: index('graph_version_idx').on(table.videoId, table.version),
    parentIdx: index('graph_parent_idx').on(table.parentVersionId),
  })
);

// ==================== Topic Nodes Table ====================

export const topicNodes = pgTable(
  'topic_nodes',
  {
    id: uuid('id').primaryKey().defaultRandom(),
    videoId: uuid('video_id')
      .notNull()
      .references(() => videos.id, { onDelete: 'cascade' }),
    graphVersionId: uuid('graph_version_id')
      .notNull()
      .references(() => graphVersions.id, { onDelete: 'cascade' }),
    level: integer('level').notNull(),
    startSeconds: real('start_seconds').notNull(),
    endSeconds: real('end_seconds').notNull(),
    title: varchar('title', { length: 200 }).notNull(),
    summary: text('summary').notNull(),
    keywords: jsonb('keywords').notNull().default([]),
    parentIds: jsonb('parent_ids').notNull().default([]),
    childIds: jsonb('child_ids').notNull().default([]),
    embedding: vector('embedding', { dimensions: 384 }),
    importanceScore: real('importance_score').notNull().default(0.5),
    clusterId: varchar('cluster_id', { length: 100 }),
    transcriptSegmentIds: jsonb('transcript_segment_ids').notNull().default([]),
    createdAt: timestamp('created_at', { withTimezone: true }).defaultNow().notNull(),
    updatedAt: timestamp('updated_at', { withTimezone: true }).defaultNow().notNull(),
  },
  (table) => ({
    videoIdIdx: index('topic_video_id_idx').on(table.videoId),
    graphVersionIdx: index('topic_graph_version_idx').on(table.graphVersionId),
    levelIdx: index('topic_level_idx').on(table.level),
    clusterIdx: index('topic_cluster_idx').on(table.clusterId),
    embeddingIdx: index('topic_embedding_idx').using(
      'hnsw',
      table.embedding.op('vector_cosine_ops')
    ),
  })
);

// ==================== Topic Edges Table ====================

export const topicEdges = pgTable(
  'topic_edges',
  {
    id: uuid('id').primaryKey().defaultRandom(),
    videoId: uuid('video_id')
      .notNull()
      .references(() => videos.id, { onDelete: 'cascade' }),
    graphVersionId: uuid('graph_version_id')
      .notNull()
      .references(() => graphVersions.id, { onDelete: 'cascade' }),
    srcTopicId: uuid('src_topic_id')
      .notNull()
      .references(() => topicNodes.id, { onDelete: 'cascade' }),
    dstTopicId: uuid('dst_topic_id')
      .notNull()
      .references(() => topicNodes.id, { onDelete: 'cascade' }),
    edgeType: varchar('edge_type', { length: 50 }).notNull(),
    distance: real('distance').notNull(),
    weight: real('weight').notNull(),
    metadata: jsonb('metadata').default({}),
    createdAt: timestamp('created_at', { withTimezone: true }).defaultNow().notNull(),
  },
  (table) => ({
    videoIdIdx: index('edge_video_id_idx').on(table.videoId),
    graphVersionIdx: index('edge_graph_version_idx').on(table.graphVersionId),
    srcIdx: index('edge_src_idx').on(table.srcTopicId),
    dstIdx: index('edge_dst_idx').on(table.dstTopicId),
    typeIdx: index('edge_type_idx').on(table.edgeType),
  })
);

// ==================== Snippets Table ====================

export const snippets = pgTable(
  'snippets',
  {
    id: uuid('id').primaryKey().defaultRandom(),
    topicId: uuid('topic_id')
      .notNull()
      .references(() => topicNodes.id, { onDelete: 'cascade' }),
    videoId: uuid('video_id')
      .notNull()
      .references(() => videos.id, { onDelete: 'cascade' }),
    startSeconds: real('start_seconds').notNull(),
    endSeconds: real('end_seconds').notNull(),
    storagePath: text('storage_path').notNull(),
    thumbnailPath: text('thumbnail_path'),
    captionPath: text('caption_path'),
    format: varchar('format', { length: 10 }).notNull().default('mp4'),
    resolution: varchar('resolution', { length: 20 }).notNull().default('720p'),
    createdAt: timestamp('created_at', { withTimezone: true }).defaultNow().notNull(),
  },
  (table) => ({
    topicIdIdx: index('snippet_topic_id_idx').on(table.topicId),
    videoIdIdx: index('snippet_video_id_idx').on(table.videoId),
  })
);

// ==================== Exports Table ====================

export const exports = pgTable(
  'exports',
  {
    id: uuid('id').primaryKey().defaultRandom(),
    videoId: uuid('video_id')
      .notNull()
      .references(() => videos.id, { onDelete: 'cascade' }),
    graphVersionId: uuid('graph_version_id').references(() => graphVersions.id, {
      onDelete: 'set null',
    }),
    type: varchar('type', { length: 20 }).notNull(),
    status: varchar('status', { length: 50 }).notNull().default('pending'),
    storagePath: text('storage_path'),
    options: jsonb('options').default({}),
    error: text('error'),
    createdBy: varchar('created_by', { length: 255 }).notNull(),
    createdAt: timestamp('created_at', { withTimezone: true }).defaultNow().notNull(),
    completedAt: timestamp('completed_at', { withTimezone: true }),
  },
  (table) => ({
    videoIdIdx: index('export_video_id_idx').on(table.videoId),
    statusIdx: index('export_status_idx').on(table.status),
  })
);

// ==================== Shares Table ====================

export const shares = pgTable(
  'shares',
  {
    token: varchar('token', { length: 255 }).primaryKey(),
    resourceType: varchar('resource_type', { length: 50 }).notNull(),
    resourceId: uuid('resource_id').notNull(),
    createdBy: varchar('created_by', { length: 255 }).notNull(),
    scope: varchar('scope', { length: 50 }).notNull().default('view'),
    expiresAt: timestamp('expires_at', { withTimezone: true }),
    passwordHash: text('password_hash'),
    accessCount: integer('access_count').notNull().default(0),
    createdAt: timestamp('created_at', { withTimezone: true }).defaultNow().notNull(),
  },
  (table) => ({
    resourceIdx: index('share_resource_idx').on(table.resourceType, table.resourceId),
    expiresIdx: index('share_expires_idx').on(table.expiresAt),
  })
);

// ==================== ACL Table ====================

export const acl = pgTable(
  'acl',
  {
    id: uuid('id').primaryKey().defaultRandom(),
    resourceType: varchar('resource_type', { length: 50 }).notNull(),
    resourceId: uuid('resource_id').notNull(),
    userId: varchar('user_id', { length: 255 }).notNull(),
    role: varchar('role', { length: 50 }).notNull(),
    createdBy: varchar('created_by', { length: 255 }).notNull(),
    createdAt: timestamp('created_at', { withTimezone: true }).defaultNow().notNull(),
  },
  (table) => ({
    resourceIdx: index('acl_resource_idx').on(table.resourceType, table.resourceId),
    userIdx: index('acl_user_idx').on(table.userId),
    uniqueAccess: uniqueIndex('acl_unique_idx').on(
      table.resourceType,
      table.resourceId,
      table.userId
    ),
  })
);

// ==================== Quota Policies Table ====================

export const quotaPolicies = pgTable('quota_policies', {
  id: varchar('id', { length: 100 }).primaryKey(),
  name: varchar('name', { length: 100 }).notNull(),
  maxVideosPerMonth: integer('max_videos_per_month').notNull(),
  maxStorageGb: real('max_storage_gb').notNull(),
  maxPublicLinks: integer('max_public_links').notNull(),
  maxVersionsPerVideo: integer('max_versions_per_video').notNull(),
  maxVideoDurationMinutes: integer('max_video_duration_minutes').notNull().default(120),
  allowedModels: jsonb('allowed_models').notNull().default([]),
  createdAt: timestamp('created_at', { withTimezone: true }).defaultNow().notNull(),
});

// ==================== User Quotas Table ====================

export const userQuotas = pgTable(
  'user_quotas',
  {
    userId: varchar('user_id', { length: 255 }).primaryKey(),
    policyId: varchar('policy_id', { length: 100 })
      .notNull()
      .references(() => quotaPolicies.id),
    videosThisMonth: integer('videos_this_month').notNull().default(0),
    storageBytes: integer('storage_bytes').notNull().default(0),
    publicLinks: integer('public_links').notNull().default(0),
    monthResetAt: timestamp('month_reset_at', { withTimezone: true }).defaultNow().notNull(),
    updatedAt: timestamp('updated_at', { withTimezone: true }).defaultNow().notNull(),
  },
  (table) => ({
    policyIdx: index('quota_policy_idx').on(table.policyId),
  })
);

// ==================== Jobs Table ====================

export const jobs = pgTable(
  'jobs',
  {
    id: uuid('id').primaryKey().defaultRandom(),
    type: varchar('type', { length: 100 }).notNull(),
    status: varchar('status', { length: 50 }).notNull().default('pending'),
    payload: jsonb('payload').notNull(),
    priority: integer('priority').notNull().default(5),
    attempts: integer('attempts').notNull().default(0),
    maxAttempts: integer('max_attempts').notNull().default(3),
    error: text('error'),
    startedAt: timestamp('started_at', { withTimezone: true }),
    completedAt: timestamp('completed_at', { withTimezone: true }),
    createdAt: timestamp('created_at', { withTimezone: true }).defaultNow().notNull(),
    updatedAt: timestamp('updated_at', { withTimezone: true }).defaultNow().notNull(),
  },
  (table) => ({
    statusIdx: index('job_status_idx').on(table.status),
    typeIdx: index('job_type_idx').on(table.type),
    priorityIdx: index('job_priority_idx').on(table.priority),
    createdAtIdx: index('job_created_at_idx').on(table.createdAt),
  })
);

// ==================== Type Exports ====================

export type Video = typeof videos.$inferSelect;
export type NewVideo = typeof videos.$inferInsert;

export type TranscriptSegment = typeof transcriptSegments.$inferSelect;
export type NewTranscriptSegment = typeof transcriptSegments.$inferInsert;

export type GraphVersion = typeof graphVersions.$inferSelect;
export type NewGraphVersion = typeof graphVersions.$inferInsert;

export type TopicNode = typeof topicNodes.$inferSelect;
export type NewTopicNode = typeof topicNodes.$inferInsert;

export type TopicEdge = typeof topicEdges.$inferSelect;
export type NewTopicEdge = typeof topicEdges.$inferInsert;

export type Snippet = typeof snippets.$inferSelect;
export type NewSnippet = typeof snippets.$inferInsert;

export type Export = typeof exports.$inferSelect;
export type NewExport = typeof exports.$inferInsert;

export type Share = typeof shares.$inferSelect;
export type NewShare = typeof shares.$inferInsert;

export type AclEntry = typeof acl.$inferSelect;
export type NewAclEntry = typeof acl.$inferInsert;

export type QuotaPolicy = typeof quotaPolicies.$inferSelect;
export type NewQuotaPolicy = typeof quotaPolicies.$inferInsert;

export type UserQuota = typeof userQuotas.$inferSelect;
export type NewUserQuota = typeof userQuotas.$inferInsert;

export type Job = typeof jobs.$inferSelect;
export type NewJob = typeof jobs.$inferInsert;
