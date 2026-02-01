/**
 * Embeddings and Graph Construction Step
 * 
 * Handles:
 * - Topic embedding generation
 * - Edge construction (semantic, hierarchy, sequence, reference)
 * - Edge pruning
 * - Graph metrics computation
 * - Clustering
 */

import { BasePipelineStep } from '../core';
import type {
  ArtifactManifest,
  PipelineContext,
  ArtifactPaths,
} from '@video-graph/shared-types';

export interface EmbeddingsGraphStepConfig {
  /** Embedding model provider */
  embeddingProvider: 'sentence-transformers' | 'ollama' | 'openai';
  /** Embedding model name */
  embeddingModel: string;
  /** Device for inference */
  device: 'cpu' | 'cuda' | 'mps';
  /** K for KNN semantic edges */
  knnK: number;
  /** Similarity threshold for semantic edges */
  similarityThreshold: number;
  /** Maximum semantic edges per node */
  maxSemanticEdges: number;
  /** Create sequence edges */
  createSequenceEdges: boolean;
  /** Create hierarchy edges */
  createHierarchyEdges: boolean;
  /** Create reference edges */
  createReferenceEdges: boolean;
  /** Enable clustering */
  enableClustering: boolean;
  /** Number of clusters (0 = auto) */
  numClusters: number;
  /** Clustering algorithm */
  clusteringAlgorithm: 'kmeans' | 'hdbscan' | 'spectral';
}

export const defaultEmbeddingsGraphStepConfig: EmbeddingsGraphStepConfig = {
  embeddingProvider: 'sentence-transformers',
  embeddingModel: 'all-MiniLM-L6-v2',
  device: 'cpu',
  knnK: 5,
  similarityThreshold: 0.75,
  maxSemanticEdges: 10,
  createSequenceEdges: true,
  createHierarchyEdges: true,
  createReferenceEdges: true,
  enableClustering: true,
  numClusters: 0,
  clusteringAlgorithm: 'hdbscan',
};

/**
 * Graph edge structure
 */
export interface GraphEdge {
  id: string;
  sourceId: string;
  targetId: string;
  type: 'semantic' | 'hierarchy' | 'sequence' | 'reference';
  weight: number;
  distance: number;
  metadata?: Record<string, unknown>;
}

/**
 * Topic with embedding
 */
export interface TopicWithEmbedding {
  id: string;
  level: number;
  start: number;
  end: number;
  title: string;
  summary: string;
  keywords: string[];
  parentIds: string[];
  childIds: string[];
  embedding: number[];
  importanceScore: number;
  clusterId?: string;
}

/**
 * Graph metrics
 */
export interface GraphMetrics {
  nodeCount: number;
  edgeCount: number;
  density: number;
  avgClustering: number;
  connectedComponents: number;
  levels: Array<{
    level: number;
    nodeCount: number;
  }>;
}

/**
 * Embeddings and graph construction pipeline step
 */
export class EmbeddingsGraphStep extends BasePipelineStep {
  readonly name = 'embeddings-graph';
  readonly version = '1.0.0';

  private config: EmbeddingsGraphStepConfig;

  constructor(config: Partial<EmbeddingsGraphStepConfig> = {}) {
    super();
    this.config = { ...defaultEmbeddingsGraphStepConfig, ...config };
  }

  getRequiredInputs(): (keyof ArtifactPaths)[] {
    return ['topics', 'transcript'];
  }

  getProducedOutputs(): (keyof ArtifactPaths)[] {
    return ['embeddings', 'graph'];
  }

  async execute(
    manifest: ArtifactManifest,
    context: PipelineContext
  ): Promise<ArtifactManifest> {
    const topicsPath = manifest.paths.topics;
    const transcriptPath = manifest.paths.transcript;

    if (!topicsPath || !transcriptPath) {
      throw new Error('Topics or transcript not found in manifest');
    }

    context.logger.info('Starting embeddings and graph construction');
    context.onProgress?.(10, 'Loading topics');

    // Load topics
    const topicsData = await context.storage.read(topicsPath);
    const topics = JSON.parse(topicsData.toString()) as Array<{
      id: string;
      level: number;
      start: number;
      end: number;
      title: string;
      summary: string;
      keywords: string[];
      parentIds: string[];
      childIds: string[];
      importanceScore: number;
    }>;

    context.onProgress?.(20, 'Generating embeddings');

    // Generate embeddings for topics
    const topicsWithEmbeddings = await this.generateEmbeddings(topics, context);

    context.onProgress?.(45, 'Building semantic edges');

    // Build semantic edges (KNN)
    const semanticEdges = this.buildSemanticEdges(topicsWithEmbeddings);

    context.onProgress?.(60, 'Building structural edges');

    // Build structural edges
    let edges = [...semanticEdges];

    if (this.config.createHierarchyEdges) {
      const hierarchyEdges = this.buildHierarchyEdges(topicsWithEmbeddings);
      edges = [...edges, ...hierarchyEdges];
    }

    if (this.config.createSequenceEdges) {
      const sequenceEdges = this.buildSequenceEdges(topicsWithEmbeddings);
      edges = [...edges, ...sequenceEdges];
    }

    if (this.config.createReferenceEdges) {
      const referenceEdges = await this.buildReferenceEdges(
        topicsWithEmbeddings,
        context
      );
      edges = [...edges, ...referenceEdges];
    }

    context.onProgress?.(75, 'Pruning edges');

    // Prune edges
    edges = this.pruneEdges(edges);

    context.onProgress?.(85, 'Clustering topics');

    // Cluster topics
    let clusteredTopics = topicsWithEmbeddings;
    if (this.config.enableClustering) {
      clusteredTopics = this.clusterTopics(topicsWithEmbeddings);
    }

    context.onProgress?.(95, 'Computing graph metrics');

    // Compute graph metrics
    const metrics = this.computeMetrics(clusteredTopics, edges);

    context.onProgress?.(100, 'Embeddings and graph construction complete');

    // Save embeddings
    const outputDir = `videos/${manifest.video_id}/embeddings`;
    const embeddingsPath = `${outputDir}/embeddings.json`;
    await context.storage.write(
      embeddingsPath,
      Buffer.from(
        JSON.stringify(
          clusteredTopics.map((t) => ({ id: t.id, embedding: t.embedding })),
          null,
          2
        )
      )
    );

    // Save graph
    const graphDir = `videos/${manifest.video_id}/graph`;
    const graphPath = `${graphDir}/graph.json`;
    await context.storage.write(
      graphPath,
      Buffer.from(
        JSON.stringify(
          {
            nodes: clusteredTopics.map((t) => ({
              id: t.id,
              level: t.level,
              start: t.start,
              end: t.end,
              title: t.title,
              summary: t.summary,
              keywords: t.keywords,
              parentIds: t.parentIds,
              childIds: t.childIds,
              importanceScore: t.importanceScore,
              clusterId: t.clusterId,
            })),
            edges,
            metrics,
          },
          null,
          2
        )
      )
    );

    let updatedManifest = this.updateManifest(manifest, {
      embeddings: embeddingsPath,
      graph: graphPath,
    });

    // Update metrics
    updatedManifest = this.updateMetrics(updatedManifest, {
      edge_count: edges.length,
    });

    return this.markStepCompleted(updatedManifest, this.name);
  }

  private async generateEmbeddings(
    topics: Array<{
      id: string;
      title: string;
      summary: string;
      keywords: string[];
    }>,
    context: PipelineContext
  ): Promise<TopicWithEmbedding[]> {
    context.logger.info(
      `Generating embeddings with ${this.config.embeddingModel}`
    );

    // Create text representation for each topic
    const texts = topics.map(
      (t) => `${t.title}. ${t.summary}. Keywords: ${t.keywords.join(', ')}`
    );

    // Generate embeddings
    const embeddings = await this.computeEmbeddings(texts, context);

    return topics.map((topic, i) => ({
      ...topic,
      embedding: embeddings[i],
      level: 0,
      start: 0,
      end: 0,
      parentIds: [],
      childIds: [],
      importanceScore: 0.5,
    }));
  }

  private async computeEmbeddings(
    texts: string[],
    context: PipelineContext
  ): Promise<number[][]> {
    // Implementation would use sentence-transformers or similar
    // from sentence_transformers import SentenceTransformer
    // model = SentenceTransformer(model_name)
    // embeddings = model.encode(texts)

    // Placeholder: return random normalized embeddings
    return texts.map(() => {
      const vec = Array.from({ length: 384 }, () => Math.random() * 2 - 1);
      const norm = Math.sqrt(vec.reduce((sum, x) => sum + x * x, 0));
      return vec.map((x) => x / norm);
    });
  }

  private buildSemanticEdges(topics: TopicWithEmbedding[]): GraphEdge[] {
    const edges: GraphEdge[] = [];

    for (let i = 0; i < topics.length; i++) {
      const topicA = topics[i];
      const similarities: Array<{ index: number; similarity: number }> = [];

      // Compute similarity with all other topics
      for (let j = 0; j < topics.length; j++) {
        if (i === j) continue;

        const topicB = topics[j];
        const similarity = this.cosineSimilarity(
          topicA.embedding,
          topicB.embedding
        );

        if (similarity >= this.config.similarityThreshold) {
          similarities.push({ index: j, similarity });
        }
      }

      // Sort by similarity and take top K
      similarities.sort((a, b) => b.similarity - a.similarity);
      const topK = similarities.slice(0, this.config.knnK);

      // Create edges
      for (const { index, similarity } of topK) {
        const topicB = topics[index];
        edges.push({
          id: `edge-${topicA.id}-${topicB.id}-semantic`,
          sourceId: topicA.id,
          targetId: topicB.id,
          type: 'semantic',
          weight: similarity,
          distance: 1 - similarity,
        });
      }
    }

    return edges;
  }

  private buildHierarchyEdges(topics: TopicWithEmbedding[]): GraphEdge[] {
    const edges: GraphEdge[] = [];

    for (const topic of topics) {
      // Create edges from parent to child
      for (const childId of topic.childIds) {
        edges.push({
          id: `edge-${topic.id}-${childId}-hierarchy`,
          sourceId: topic.id,
          targetId: childId,
          type: 'hierarchy',
          weight: 1.0,
          distance: 0,
        });
      }
    }

    return edges;
  }

  private buildSequenceEdges(topics: TopicWithEmbedding[]): GraphEdge[] {
    const edges: GraphEdge[] = [];

    // Group topics by level
    const topicsByLevel: Map<number, TopicWithEmbedding[]> = new Map();
    for (const topic of topics) {
      const levelTopics = topicsByLevel.get(topic.level) || [];
      levelTopics.push(topic);
      topicsByLevel.set(topic.level, levelTopics);
    }

    // Create sequence edges within each level
    for (const [, levelTopics] of topicsByLevel) {
      // Sort by start time
      levelTopics.sort((a, b) => a.start - b.start);

      // Create edges between consecutive topics
      for (let i = 0; i < levelTopics.length - 1; i++) {
        const topicA = levelTopics[i];
        const topicB = levelTopics[i + 1];

        edges.push({
          id: `edge-${topicA.id}-${topicB.id}-sequence`,
          sourceId: topicA.id,
          targetId: topicB.id,
          type: 'sequence',
          weight: 0.8,
          distance: 0.2,
        });
      }
    }

    return edges;
  }

  private async buildReferenceEdges(
    topics: TopicWithEmbedding[],
    context: PipelineContext
  ): Promise<GraphEdge[]> {
    const edges: GraphEdge[] = [];

    // Detect cross-references between topics at different levels
    // This could use keyword matching or LLM-based analysis

    for (const topicA of topics) {
      for (const topicB of topics) {
        if (topicA.id === topicB.id) continue;
        if (topicA.level === topicB.level) continue;

        // Check for keyword overlap
        const sharedKeywords = topicA.keywords.filter((k) =>
          topicB.keywords.includes(k)
        );

        if (sharedKeywords.length >= 2) {
          edges.push({
            id: `edge-${topicA.id}-${topicB.id}-reference`,
            sourceId: topicA.id,
            targetId: topicB.id,
            type: 'reference',
            weight: sharedKeywords.length / Math.max(topicA.keywords.length, topicB.keywords.length),
            distance: 1 - sharedKeywords.length / Math.max(topicA.keywords.length, topicB.keywords.length),
            metadata: { sharedKeywords },
          });
        }
      }
    }

    return edges;
  }

  private pruneEdges(edges: GraphEdge[]): GraphEdge[] {
    // Remove duplicate edges (keep the one with highest weight)
    const edgeMap = new Map<string, GraphEdge>();

    for (const edge of edges) {
      const key = `${edge.sourceId}-${edge.targetId}-${edge.type}`;
      const existing = edgeMap.get(key);

      if (!existing || edge.weight > existing.weight) {
        edgeMap.set(key, edge);
      }
    }

    // Limit semantic edges per node
    const semanticEdgesByNode = new Map<string, GraphEdge[]>();
    for (const edge of edgeMap.values()) {
      if (edge.type === 'semantic') {
        const nodeEdges = semanticEdgesByNode.get(edge.sourceId) || [];
        nodeEdges.push(edge);
        semanticEdgesByNode.set(edge.sourceId, nodeEdges);
      }
    }

    const prunedEdges: GraphEdge[] = [];

    // Add non-semantic edges
    for (const edge of edgeMap.values()) {
      if (edge.type !== 'semantic') {
        prunedEdges.push(edge);
      }
    }

    // Add pruned semantic edges
    for (const [, nodeEdges] of semanticEdgesByNode) {
      nodeEdges.sort((a, b) => b.weight - a.weight);
      prunedEdges.push(...nodeEdges.slice(0, this.config.maxSemanticEdges));
    }

    return prunedEdges;
  }

  private clusterTopics(topics: TopicWithEmbedding[]): TopicWithEmbedding[] {
    context.logger.info(
      `Clustering topics using ${this.config.clusteringAlgorithm}`
    );

    // Implementation would use clustering algorithm
    // For now, assign clusters based on level and similarity

    const embeddings = topics.map((t) => t.embedding);
    const clusterIds = this.performClustering(embeddings);

    return topics.map((topic, i) => ({
      ...topic,
      clusterId: `cluster-${clusterIds[i]}`,
    }));
  }

  private performClustering(embeddings: number[][]): number[] {
    // Placeholder: simple greedy clustering
    const clusters: number[][] = [];
    const assignments: number[] = [];

    for (let i = 0; i < embeddings.length; i++) {
      let bestCluster = -1;
      let bestSimilarity = 0;

      for (let c = 0; c < clusters.length; c++) {
        const centroid = this.computeCentroid(clusters[c].map((idx) => embeddings[idx]));
        const similarity = this.cosineSimilarity(embeddings[i], centroid);

        if (similarity > 0.7 && similarity > bestSimilarity) {
          bestCluster = c;
          bestSimilarity = similarity;
        }
      }

      if (bestCluster === -1) {
        bestCluster = clusters.length;
        clusters.push([]);
      }

      clusters[bestCluster].push(i);
      assignments.push(bestCluster);
    }

    return assignments;
  }

  private computeCentroid(vectors: number[][]): number[] {
    if (vectors.length === 0) {
      return Array(384).fill(0);
    }

    const dim = vectors[0].length;
    const centroid = Array(dim).fill(0);

    for (const vec of vectors) {
      for (let i = 0; i < dim; i++) {
        centroid[i] += vec[i];
      }
    }

    for (let i = 0; i < dim; i++) {
      centroid[i] /= vectors.length;
    }

    return centroid;
  }

  private computeMetrics(
    topics: TopicWithEmbedding[],
    edges: GraphEdge[]
  ): GraphMetrics {
    const nodeCount = topics.length;
    const edgeCount = edges.length;

    // Compute density
    const maxEdges = (nodeCount * (nodeCount - 1)) / 2;
    const density = maxEdges > 0 ? edgeCount / maxEdges : 0;

    // Compute level counts
    const levelCounts = new Map<number, number>();
    for (const topic of topics) {
      levelCounts.set(topic.level, (levelCounts.get(topic.level) || 0) + 1);
    }

    const levels = Array.from(levelCounts.entries())
      .sort((a, b) => a[0] - b[0])
      .map(([level, count]) => ({ level, nodeCount: count }));

    // Placeholder for clustering coefficient and connected components
    // These would require graph analysis libraries

    return {
      nodeCount,
      edgeCount,
      density,
      avgClustering: 0, // Would compute from graph
      connectedComponents: 1, // Would compute from graph
      levels,
    };
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

stepRegistry.register(
  'embeddings-graph',
  () => new EmbeddingsGraphStep(),
  {
    description: 'Generate embeddings and construct topic graph',
    version: '1.0.0',
    author: 'Video Topic Graph Platform',
    tags: ['embeddings', 'graph', 'clustering', 'semantic', 'edges'],
    inputs: ['topics', 'transcript'],
    outputs: ['embeddings', 'graph'],
  }
);
