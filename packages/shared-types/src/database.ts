/**
 * Database Types and Table Definitions
 * 
 * TypeScript types corresponding to database tables
 */

import type {
  Video,
  TranscriptSegment,
  TopicNode,
  TopicEdge,
  Snippet,
  Export,
  GraphVersion,
  Share,
  QuotaPolicy,
  UserQuota,
  Job,
  AclEntry,
} from './schemas';

// Re-export entity types as database types
export type {
  Video as DbVideo,
  TranscriptSegment as DbTranscriptSegment,
  TopicNode as DbTopicNode,
  TopicEdge as DbTopicEdge,
  Snippet as DbSnippet,
  Export as DbExport,
  GraphVersion as DbGraphVersion,
  Share as DbShare,
  QuotaPolicy as DbQuotaPolicy,
  UserQuota as DbUserQuota,
  Job as DbJob,
  AclEntry as DbAclEntry,
};

// ==================== Database Connection Config ====================

export interface DatabaseConfig {
  host: string;
  port: number;
  database: string;
  user: string;
  password: string;
  ssl?: boolean | { rejectUnauthorized: boolean };
  poolSize?: number;
}

// ==================== Migration Types ====================

export interface Migration {
  id: number;
  name: string;
  applied_at: Date;
}

// ==================== Query Helpers ====================

export interface PaginationParams {
  page: number;
  limit: number;
}

export interface PaginatedResult<T> {
  items: T[];
  total: number;
  page: number;
  limit: number;
  totalPages: number;
}

// ==================== Vector Search Types ====================

export interface VectorSearchParams {
  embedding: number[];
  topK: number;
  filter?: Record<string, unknown>;
}

export interface VectorSearchResult<T> {
  item: T;
  distance: number;
  score: number;
}

// ==================== Transaction Types ====================

export type TransactionCallback<T> = (trx: unknown) => Promise<T>;

export interface TransactionManager {
  withTransaction: <T>(callback: TransactionCallback<T>) => Promise<T>;
}
