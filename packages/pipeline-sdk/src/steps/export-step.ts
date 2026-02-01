/**
 * Export Generation Step
 * 
 * Handles:
 * - PPTX generation with embedded or linked video snippets
 * - HTML (Reveal.js) deck generation
 * - PDF summary generation
 */

import { BasePipelineStep } from '../core';
import type {
  ArtifactManifest,
  PipelineContext,
  ArtifactPaths,
} from '@video-graph/shared-types';

export interface ExportStepConfig {
  /** PPTX template */
  pptxTemplate: 'default' | 'minimal' | 'detailed';
  /** HTML theme */
  htmlTheme: 'default' | 'dark' | 'light';
  /** Include video snippets */
  includeSnippets: boolean;
  /** Snippet embed mode */
  snippetEmbedMode: 'embedded' | 'linked' | 'none';
  /** Include appendix slides */
  includeAppendix: boolean;
  /** Maximum topics per export */
  maxTopics: number;
  /** Include transcript */
  includeTranscript: boolean;
  /** Include graph visualization */
  includeGraphViz: boolean;
}

export const defaultExportStepConfig: ExportStepConfig = {
  pptxTemplate: 'default',
  htmlTheme: 'default',
  includeSnippets: true,
  snippetEmbedMode: 'linked',
  includeAppendix: true,
  maxTopics: 50,
  includeTranscript: false,
  includeGraphViz: true,
};

/**
 * Export info
 */
export interface ExportInfo {
  type: 'pptx' | 'html' | 'pdf';
  path: string;
  url: string;
  size: number;
  pages?: number;
}

/**
 * Export generation pipeline step
 */
export class ExportStep extends BasePipelineStep {
  readonly name = 'export';
  readonly version = '1.0.0';

  private config: ExportStepConfig;

  constructor(config: Partial<ExportStepConfig> = {}) {
    super();
    this.config = { ...defaultExportStepConfig, ...config };
  }

  getRequiredInputs(): (keyof ArtifactPaths)[] {
    return ['topics', 'graph'];
  }

  getProducedOutputs(): (keyof ArtifactPaths)[] {
    return ['exports'];
  }

  async execute(
    manifest: ArtifactManifest,
    context: PipelineContext
  ): Promise<ArtifactManifest> {
    const { export_type, options } = context.payload as {
      export_type: 'pptx' | 'html' | 'pdf';
      options?: Partial<ExportStepConfig>;
    };

    const topicsPath = manifest.paths.topics;
    const graphPath = manifest.paths.graph;

    if (!topicsPath || !graphPath) {
      throw new Error('Topics or graph not found in manifest');
    }

    context.logger.info(`Starting ${export_type} export generation`);
    context.onProgress?.(10, 'Loading graph data');

    // Load topics and graph
    const topicsData = await context.storage.read(topicsPath);
    const topics = JSON.parse(topicsData.toString()) as Array<{
      id: string;
      level: number;
      start: number;
      end: number;
      title: string;
      summary: string;
      keywords: string[];
      importanceScore: number;
    }>;

    const graphData = await context.storage.read(graphPath);
    const graph = JSON.parse(graphData.toString()) as {
      nodes: unknown[];
      edges: unknown[];
      metrics: unknown;
    };

    // Load snippets if needed
    let snippets: Array<{
      topicId: string;
      videoUrl: string;
      thumbnailUrl?: string;
    }> = [];
    if (this.config.includeSnippets && manifest.paths.snippets) {
      const snippetsData = await context.storage.read(
        `videos/${manifest.video_id}/snippets/snippets.json`
      );
      snippets = JSON.parse(snippetsData.toString());
    }

    context.onProgress?.(30, 'Generating export');

    // Generate export based on type
    let exportInfo: ExportInfo;
    switch (export_type) {
      case 'pptx':
        exportInfo = await this.generatePPTX(
          topics,
          graph,
          snippets,
          manifest,
          context
        );
        break;
      case 'html':
        exportInfo = await this.generateHTML(
          topics,
          graph,
          snippets,
          manifest,
          context
        );
        break;
      case 'pdf':
        exportInfo = await this.generatePDF(
          topics,
          graph,
          snippets,
          manifest,
          context
        );
        break;
      default:
        throw new Error(`Unsupported export type: ${export_type}`);
    }

    context.onProgress?.(100, 'Export generation complete');

    // Update manifest
    const updatedManifest = this.updateManifest(manifest, {
      exports: [exportInfo.path],
    });

    return this.markStepCompleted(updatedManifest, this.name);
  }

  private async generatePPTX(
    topics: Array<{
      id: string;
      level: number;
      title: string;
      summary: string;
      keywords: string[];
      importanceScore: number;
    }>,
    graph: { nodes: unknown[]; edges: unknown[]; metrics: unknown },
    snippets: Array<{
      topicId: string;
      videoUrl: string;
      thumbnailUrl?: string;
    }>,
    manifest: ArtifactManifest,
    context: PipelineContext
  ): Promise<ExportInfo> {
    const outputDir = `videos/${manifest.video_id}/exports`;
    const outputPath = `${outputDir}/export-${Date.now()}.pptx`;

    context.logger.info('Generating PPTX export');

    // Sort topics by importance and level
    const sortedTopics = topics
      .filter((t) => t.level > 0) // Skip micro-segments
      .sort((a, b) => b.importanceScore - a.importanceScore)
      .slice(0, this.config.maxTopics);

    // Group by level for hierarchical structure
    const topicsByLevel = new Map<number, typeof sortedTopics>();
    for (const topic of sortedTopics) {
      const levelTopics = topicsByLevel.get(topic.level) || [];
      levelTopics.push(topic);
      topicsByLevel.set(topic.level, levelTopics);
    }

    // Generate PPTX content
    // Implementation would use pptxgenjs or python-pptx
    // This is a placeholder for the actual implementation

    const pptxContent = this.generatePPTXContent(
      sortedTopics,
      topicsByLevel,
      snippets
    );

    await context.storage.write(outputPath, Buffer.from(pptxContent));

    return {
      type: 'pptx',
      path: outputPath,
      url: await context.storage.getUrl(outputPath),
      size: pptxContent.length,
      pages: sortedTopics.length + (this.config.includeAppendix ? 2 : 0),
    };
  }

  private generatePPTXContent(
    topics: Array<{
      id: string;
      level: number;
      title: string;
      summary: string;
      keywords: string[];
    }>,
    topicsByLevel: Map<number, typeof topics>,
    snippets: Array<{
      topicId: string;
      videoUrl: string;
      thumbnailUrl?: string;
    }>
  ): Buffer {
    // Placeholder: In real implementation, use pptxgenjs or call Python script
    // This would generate an actual PPTX file

    const slides = topics.map((topic) => ({
      title: topic.title,
      content: topic.summary,
      keywords: topic.keywords,
      snippet: snippets.find((s) => s.topicId === topic.id),
    }));

    // Return placeholder buffer
    return Buffer.from(JSON.stringify({ slides, format: 'pptx' }));
  }

  private async generateHTML(
    topics: Array<{
      id: string;
      level: number;
      start: number;
      end: number;
      title: string;
      summary: string;
      keywords: string[];
      importanceScore: number;
    }>,
    graph: { nodes: unknown[]; edges: unknown[]; metrics: unknown },
    snippets: Array<{
      topicId: string;
      videoUrl: string;
      thumbnailUrl?: string;
    }>,
    manifest: ArtifactManifest,
    context: PipelineContext
  ): Promise<ExportInfo> {
    const outputDir = `videos/${manifest.video_id}/exports`;
    const outputPath = `${outputDir}/export-${Date.now()}.html`;

    context.logger.info('Generating HTML export');

    // Sort topics by start time
    const sortedTopics = topics
      .filter((t) => t.level > 0)
      .sort((a, b) => a.start - b.start);

    // Generate Reveal.js HTML
    const htmlContent = this.generateRevealJSHTML(
      sortedTopics,
      graph,
      snippets
    );

    await context.storage.write(outputPath, Buffer.from(htmlContent));

    return {
      type: 'html',
      path: outputPath,
      url: await context.storage.getUrl(outputPath),
      size: htmlContent.length,
      pages: sortedTopics.length,
    };
  }

  private generateRevealJSHTML(
    topics: Array<{
      id: string;
      title: string;
      summary: string;
      keywords: string[];
      start: number;
      end: number;
    }>,
    graph: { nodes: unknown[]; edges: unknown[]; metrics: unknown },
    snippets: Array<{
      topicId: string;
      videoUrl: string;
      thumbnailUrl?: string;
    }>
  ): string {
    const slides = topics
      .map((topic) => {
        const snippet = snippets.find((s) => s.topicId === topic.id);
        return `
        <section>
          <h2>${topic.title}</h2>
          <p>${topic.summary}</p>
          <p><strong>Keywords:</strong> ${topic.keywords.join(', ')}</p>
          ${snippet ? `<video controls src="${snippet.videoUrl}" poster="${snippet.thumbnailUrl || ''}"></video>` : ''}
        </section>
      `;
      })
      .join('\n');

    return `<!DOCTYPE html>
<html>
<head>
  <meta charset="utf-8">
  <title>Video Topic Graph Export</title>
  <link rel="stylesheet" href="https://cdn.jsdelivr.net/npm/reveal.js@4.5.0/dist/reveal.css">
  <link rel="stylesheet" href="https://cdn.jsdelivr.net/npm/reveal.js@4.5.0/dist/theme/${this.config.htmlTheme}.css">
</head>
<body>
  <div class="reveal">
    <div class="slides">
      <section>
        <h1>Video Topic Graph</h1>
        <p>Generated by Video Topic Graph Platform</p>
      </section>
      ${slides}
      ${this.config.includeAppendix ? `
      <section>
        <h2>Appendix: Graph Metrics</h2>
        <pre>${JSON.stringify(graph.metrics, null, 2)}</pre>
      </section>
      ` : ''}
    </div>
  </div>
  <script src="https://cdn.jsdelivr.net/npm/reveal.js@4.5.0/dist/reveal.js"></script>
  <script>Reveal.initialize();</script>
</body>
</html>`;
  }

  private async generatePDF(
    topics: Array<{
      id: string;
      level: number;
      title: string;
      summary: string;
      keywords: string[];
      importanceScore: number;
    }>,
    graph: { nodes: unknown[]; edges: unknown[]; metrics: unknown },
    snippets: Array<{
      topicId: string;
      videoUrl: string;
      thumbnailUrl?: string;
    }>,
    manifest: ArtifactManifest,
    context: PipelineContext
  ): Promise<ExportInfo> {
    const outputDir = `videos/${manifest.video_id}/exports`;
    const outputPath = `${outputDir}/export-${Date.now()}.pdf`;

    context.logger.info('Generating PDF export');

    // Sort topics by importance
    const sortedTopics = topics
      .filter((t) => t.level > 0)
      .sort((a, b) => b.importanceScore - a.importanceScore)
      .slice(0, this.config.maxTopics);

    // Generate PDF content
    // Implementation would use puppeteer or call Python script

    const pdfContent = this.generatePDFContent(sortedTopics, graph);

    await context.storage.write(outputPath, Buffer.from(pdfContent));

    return {
      type: 'pdf',
      path: outputPath,
      url: await context.storage.getUrl(outputPath),
      size: pdfContent.length,
      pages: sortedTopics.length + 1,
    };
  }

  private generatePDFContent(
    topics: Array<{
      id: string;
      title: string;
      summary: string;
      keywords: string[];
    }>,
    graph: { nodes: unknown[]; edges: unknown[]; metrics: unknown }
  ): Buffer {
    // Placeholder: In real implementation, use puppeteer or call Python script
    // This would generate an actual PDF file

    const content = {
      title: 'Video Topic Graph Summary',
      topics: topics.map((t) => ({
        title: t.title,
        summary: t.summary,
        keywords: t.keywords,
      })),
      metrics: graph.metrics,
    };

    return Buffer.from(JSON.stringify(content));
  }
}

// Register the step
import { stepRegistry } from '../registry';

stepRegistry.register(
  'export',
  () => new ExportStep(),
  {
    description: 'Generate PPTX, HTML, or PDF exports',
    version: '1.0.0',
    author: 'Video Topic Graph Platform',
    tags: ['export', 'pptx', 'html', 'pdf', 'reveal.js'],
    inputs: ['topics', 'graph', 'snippets'],
    outputs: ['exports'],
  }
);
