/**
 * Topic Segmentation Step
 * 
 * Handles:
 * - Micro-segmentation (Pass A): sentence embeddings + pause detection
 * - Hierarchical topic generation (Pass B): merging and overlapping topics
 * - Topic summarization using LLM
 * - Keyword extraction
 */

import { BasePipelineStep } from '../core';
import type {
  ArtifactManifest,
  PipelineContext,
  ArtifactPaths,
} from '@video-graph/shared-types';

export interface TopicStepConfig {
  /** LLM provider for summarization */
  llmProvider: 'llama-cpp' | 'vllm' | 'ollama' | 'transformers';
  /** LLM model name */
  llmModel: string;
  /** Embedding model for segmentation */
  embeddingModel: string;
  /** Number of hierarchy levels */
  topicLevels: number;
  /** Similarity threshold for merging (0-1) */
  mergeThreshold: number;
  /** Minimum segment duration in seconds */
  minSegmentDuration: number;
  /** Maximum segment duration in seconds */
  maxSegmentDuration: number;
  /** Allow overlapping topics */
  allowOverlap: boolean;
  /** Allow multi-parent topics */
  multiParent: boolean;
  /** Importance weights */
  importanceWeights: {
    centrality: number;
    duration: number;
    novelty: number;
  };
}

export const defaultTopicStepConfig: TopicStepConfig = {
  llmProvider: 'ollama',
  llmModel: 'mistral',
  embeddingModel: 'all-MiniLM-L6-v2',
  topicLevels: 3,
  mergeThreshold: 0.85,
  minSegmentDuration: 5,
  maxSegmentDuration: 300,
  allowOverlap: true,
  multiParent: true,
  importanceWeights: {
    centrality: 0.3,
    duration: 0.3,
    novelty: 0.4,
  },
};

/**
 * Topic node structure
 */
export interface Topic {
  id: string;
  level: number;
  start: number;
  end: number;
  title: string;
  summary: string;
  keywords: string[];
  parentIds: string[];
  childIds: string[];
  transcriptSegmentIds: string[];
  importanceScore: number;
  clusterId?: string;
}

/**
 * Micro-segment from Pass A
 */
export interface MicroSegment {
  id: string;
  start: number;
  end: number;
  text: string;
  embedding: number[];
  pauseAfter: number;
}

/**
 * Topic segmentation pipeline step
 */
export class TopicStep extends BasePipelineStep {
  readonly name = 'topic';
  readonly version = '1.0.0';

  private config: TopicStepConfig;

  constructor(config: Partial<TopicStepConfig> = {}) {
    super();
    this.config = { ...defaultTopicStepConfig, ...config };
  }

  getRequiredInputs(): (keyof ArtifactPaths)[] {
    return ['transcript'];
  }

  getProducedOutputs(): (keyof ArtifactPaths)[] {
    return ['topics'];
  }

  async execute(
    manifest: ArtifactManifest,
    context: PipelineContext
  ): Promise<ArtifactManifest> {
    const transcriptPath = manifest.paths.transcript;
    if (!transcriptPath) {
      throw new Error('Transcript not found in manifest');
    }

    context.logger.info('Starting topic segmentation');
    context.onProgress?.(5, 'Loading transcript');

    // Load transcript
    const transcriptData = await context.storage.read(transcriptPath);
    const segments = JSON.parse(transcriptData.toString()) as Array<{
      id: string;
      start: number;
      end: number;
      text: string;
    }>;

    context.onProgress?.(15, 'Pass A: Creating micro-segments');

    // Pass A: Create micro-segments
    const microSegments = await this.createMicroSegments(segments, context);

    context.onProgress?.(40, 'Pass B: Generating hierarchical topics');

    // Pass B: Generate hierarchical topics
    const topics = await this.generateHierarchicalTopics(
      microSegments,
      context
    );

    context.onProgress?.(70, 'Summarizing topics');

    // Summarize topics
    const summarizedTopics = await this.summarizeTopics(topics, context);

    context.onProgress?.(85, 'Extracting keywords');

    // Extract keywords
    const topicsWithKeywords = await this.extractKeywords(
      summarizedTopics,
      context
    );

    context.onProgress?.(95, 'Computing importance scores');

    // Compute importance scores
    const finalTopics = this.computeImportance(topicsWithKeywords);

    context.onProgress?.(100, 'Topic segmentation complete');

    // Save topics
    const outputDir = `videos/${manifest.video_id}/topics`;
    const topicsPath = `${outputDir}/topics.json`;
    await context.storage.write(
      topicsPath,
      Buffer.from(JSON.stringify(finalTopics, null, 2))
    );

    let updatedManifest = this.updateManifest(manifest, {
      topics: topicsPath,
    });

    // Update metrics
    updatedManifest = this.updateMetrics(updatedManifest, {
      topic_count: finalTopics.length,
      hierarchy_levels: this.config.topicLevels,
    });

    return this.markStepCompleted(updatedManifest, this.name);
  }

  private async createMicroSegments(
    segments: Array<{ id: string; start: number; end: number; text: string }>,
    context: PipelineContext
  ): Promise<MicroSegment[]> {
    context.logger.info('Creating micro-segments');

    // Step 1: Compute embeddings for each segment
    const embeddings = await this.computeEmbeddings(
      segments.map((s) => s.text),
      context
    );

    // Step 2: Detect boundaries using embedding similarity and pauses
    const microSegments: MicroSegment[] = [];

    for (let i = 0; i < segments.length; i++) {
      const segment = segments[i];
      const nextSegment = segments[i + 1];

      // Calculate pause after this segment
      const pauseAfter = nextSegment
        ? nextSegment.start - segment.end
        : 0;

      // Calculate similarity with next segment
      let similarity = 0;
      if (nextSegment && embeddings[i] && embeddings[i + 1]) {
        similarity = this.cosineSimilarity(embeddings[i], embeddings[i + 1]);
      }

      // Determine if this is a boundary
      const isBoundary =
        pauseAfter > 2 || // Pause > 2 seconds
        similarity < 0.7 || // Low similarity
        !nextSegment; // Last segment

      microSegments.push({
        id: segment.id,
        start: segment.start,
        end: segment.end,
        text: segment.text,
        embedding: embeddings[i],
        pauseAfter,
      });

      if (isBoundary && nextSegment) {
        // Start a new micro-segment group
      }
    }

    return microSegments;
  }

  private async generateHierarchicalTopics(
    microSegments: MicroSegment[],
    context: PipelineContext
  ): Promise<Topic[]> {
    context.logger.info(
      `Generating hierarchical topics with ${this.config.topicLevels} levels`
    );

    const topics: Topic[] = [];

    // Level 0: Micro-segments as base topics
    for (const seg of microSegments) {
      topics.push({
        id: `topic-l0-${seg.id}`,
        level: 0,
        start: seg.start,
        end: seg.end,
        title: '', // Will be filled by summarization
        summary: seg.text,
        keywords: [],
        parentIds: [],
        childIds: [],
        transcriptSegmentIds: [seg.id],
        importanceScore: 0.5,
      });
    }

    // Generate higher-level topics by merging
    for (let level = 1; level < this.config.topicLevels; level++) {
      const previousLevelTopics = topics.filter((t) => t.level === level - 1);
      const newTopics = await this.mergeTopicsAtLevel(
        previousLevelTopics,
        level,
        context
      );
      topics.push(...newTopics);
    }

    // Establish parent-child relationships
    this.establishRelationships(topics);

    return topics;
  }

  private async mergeTopicsAtLevel(
    topics: Topic[],
    level: number,
    context: PipelineContext
  ): Promise<Topic[]> {
    context.logger.info(`Merging topics for level ${level}`);

    const merged: Topic[] = [];
    const visited = new Set<string>();

    for (let i = 0; i < topics.length; i++) {
      if (visited.has(topics[i].id)) continue;

      const group: Topic[] = [topics[i]];
      visited.add(topics[i].id);

      // Find similar adjacent topics to merge
      for (let j = i + 1; j < topics.length; j++) {
        if (visited.has(topics[j].id)) continue;

        // Check temporal adjacency
        const gap = topics[j].start - group[group.length - 1].end;
        if (gap > 5) break; // Too far apart

        // Check similarity
        const similarity = await this.computeTopicSimilarity(
          group[group.length - 1],
          topics[j],
          context
        );

        if (similarity > this.config.mergeThreshold) {
          group.push(topics[j]);
          visited.add(topics[j].id);
        }
      }

      // Create merged topic
      const mergedTopic: Topic = {
        id: `topic-l${level}-${i}`,
        level,
        start: Math.min(...group.map((t) => t.start)),
        end: Math.max(...group.map((t) => t.end)),
        title: '',
        summary: group.map((t) => t.summary).join(' '),
        keywords: [],
        parentIds: [],
        childIds: group.map((t) => t.id),
        transcriptSegmentIds: group.flatMap((t) => t.transcriptSegmentIds),
        importanceScore: 0.5,
      };

      // Update children to point to parent
      for (const child of group) {
        child.parentIds.push(mergedTopic.id);
      }

      merged.push(mergedTopic);
    }

    return merged;
  }

  private async summarizeTopics(
    topics: Topic[],
    context: PipelineContext
  ): Promise<Topic[]> {
    context.logger.info('Summarizing topics with LLM');

    // Process in batches to avoid overwhelming the LLM
    const batchSize = 5;
    const summarized: Topic[] = [];

    for (let i = 0; i < topics.length; i += batchSize) {
      const batch = topics.slice(i, i + batchSize);
      const batchResults = await Promise.all(
        batch.map((topic) => this.summarizeSingleTopic(topic, context))
      );
      summarized.push(...batchResults);
      context.onProgress?.(
        70 + Math.floor((i / topics.length) * 15),
        `Summarized ${i + batch.length}/${topics.length} topics`
      );
    }

    return summarized;
  }

  private async summarizeSingleTopic(
    topic: Topic,
    context: PipelineContext
  ): Promise<Topic> {
    // Implementation would call LLM for summarization
    // const prompt = `Summarize the following content in a title and brief summary:
    // Content: ${topic.summary}
    // Output format: {"title": "...", "summary": "..."}`;

    // Placeholder
    return {
      ...topic,
      title: `Topic: ${topic.summary.slice(0, 30)}...`,
      summary: topic.summary.slice(0, 200),
    };
  }

  private async extractKeywords(
    topics: Topic[],
    context: PipelineContext
  ): Promise<Topic[]> {
    context.logger.info('Extracting keywords');

    return topics.map((topic) => {
      // Simple keyword extraction (TF-IDF or RAKE would be better)
      const words = topic.summary
        .toLowerCase()
        .split(/\s+/)
        .filter((w) => w.length > 4)
        .filter((w) => !['about', 'would', 'could', 'should'].includes(w));

      const frequency: Record<string, number> = {};
      for (const word of words) {
        frequency[word] = (frequency[word] || 0) + 1;
      }

      const keywords = Object.entries(frequency)
        .sort((a, b) => b[1] - a[1])
        .slice(0, 5)
        .map(([word]) => word);

      return { ...topic, keywords };
    });
  }

  private computeImportance(topics: Topic[]): Topic[] {
    context.logger.info('Computing importance scores');

    return topics.map((topic) => {
      // Duration score (normalized)
      const duration = topic.end - topic.start;
      const durationScore = Math.min(duration / 60, 1); // Cap at 60 seconds

      // Centrality score (based on parent/child count)
      const connectionCount =
        topic.parentIds.length + topic.childIds.length;
      const centralityScore = Math.min(connectionCount / 5, 1);

      // Novelty score (based on unique keywords)
      const noveltyScore = Math.min(topic.keywords.length / 10, 1);

      // Weighted combination
      const importanceScore =
        this.config.importanceWeights.duration * durationScore +
        this.config.importanceWeights.centrality * centralityScore +
        this.config.importanceWeights.novelty * noveltyScore;

      return { ...topic, importanceScore };
    });
  }

  private establishRelationships(topics: Topic[]): void {
    // Ensure bidirectional relationships
    for (const topic of topics) {
      for (const childId of topic.childIds) {
        const child = topics.find((t) => t.id === childId);
        if (child && !child.parentIds.includes(topic.id)) {
          child.parentIds.push(topic.id);
        }
      }

      for (const parentId of topic.parentIds) {
        const parent = topics.find((t) => t.id === parentId);
        if (parent && !parent.childIds.includes(topic.id)) {
          parent.childIds.push(topic.id);
        }
      }
    }
  }

  private async computeEmbeddings(
    texts: string[],
    context: PipelineContext
  ): Promise<number[][]> {
    // Implementation would use sentence-transformers or similar
    // Placeholder: return random embeddings
    return texts.map(() =>
      Array.from({ length: 384 }, () => Math.random() * 2 - 1)
    );
  }

  private async computeTopicSimilarity(
    topicA: Topic,
    topicB: Topic,
    context: PipelineContext
  ): Promise<number> {
    // Compute embedding similarity
    const embeddingA = await this.computeEmbeddings([topicA.summary], context);
    const embeddingB = await this.computeEmbeddings([topicB.summary], context);
    return this.cosineSimilarity(embeddingA[0], embeddingB[0]);
  }

  private cosineSimilarity(a: number[], b: number[]): number {
    if (a.length !== b.length) {
      throw new Error('Vectors must have same length');
    }

    let dotProduct = 0;
    let normA = 0;
    let normB = 0;

    for (let i = 0; i < a.length; i++) {
      dotProduct += a[i] * b[i];
      normA += a[i] * a[i];
      normB += b[i] * b[i];
    }

    return dotProduct / (Math.sqrt(normA) * Math.sqrt(normB));
  }
}

// Register the step
import { stepRegistry } from '../registry';

// Need to import context for logging
import { context } from '../utils';

stepRegistry.register(
  'topic',
  () => new TopicStep(),
  {
    description: 'Hierarchical topic segmentation and summarization',
    version: '1.0.0',
    author: 'Video Topic Graph Platform',
    tags: ['topic', 'segmentation', 'llm', 'summarization', 'hierarchy'],
    inputs: ['transcript'],
    outputs: ['topics'],
  }
);
