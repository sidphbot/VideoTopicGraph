/**
 * Snippet Generation Step
 * 
 * Handles:
 * - Video clip generation for each topic
 * - Thumbnail generation
 * - Caption/subtitle generation (VTT/SRT)
 */

import { BasePipelineStep } from '../core';
import type {
  ArtifactManifest,
  PipelineContext,
  ArtifactPaths,
} from '@video-graph/shared-types';

export interface SnippetStepConfig {
  /** Output video format */
  outputFormat: 'mp4' | 'webm';
  /** Video codec */
  videoCodec: 'libx264' | 'libx265';
  /** Video quality (CRF value, lower = better) */
  videoQuality: number;
  /** Output resolution */
  resolution: '360p' | '480p' | '720p' | '1080p' | 'original';
  /** Frame rate */
  fps: number | 'original';
  /** Generate thumbnails */
  generateThumbnails: boolean;
  /** Thumbnail format */
  thumbnailFormat: 'jpg' | 'png';
  /** Thumbnail size */
  thumbnailSize: { width: number; height: number };
  /** Generate captions */
  generateCaptions: boolean;
  /** Caption format */
  captionFormat: 'vtt' | 'srt';
  /** Include padding around topic boundaries */
  paddingSeconds: number;
  /** Minimum snippet duration */
  minDuration: number;
  /** Maximum snippet duration */
  maxDuration: number;
}

export const defaultSnippetStepConfig: SnippetStepConfig = {
  outputFormat: 'mp4',
  videoCodec: 'libx264',
  videoQuality: 23,
  resolution: '720p',
  fps: 'original',
  generateThumbnails: true,
  thumbnailFormat: 'jpg',
  thumbnailSize: { width: 640, height: 360 },
  generateCaptions: true,
  captionFormat: 'vtt',
  paddingSeconds: 1,
  minDuration: 3,
  maxDuration: 300,
};

/**
 * Generated snippet info
 */
export interface SnippetInfo {
  topicId: string;
  start: number;
  end: number;
  duration: number;
  videoPath: string;
  videoUrl: string;
  thumbnailPath?: string;
  thumbnailUrl?: string;
  captionPath?: string;
  captionUrl?: string;
}

/**
 * Snippet generation pipeline step
 */
export class SnippetStep extends BasePipelineStep {
  readonly name = 'snippet';
  readonly version = '1.0.0';

  private config: SnippetStepConfig;

  constructor(config: Partial<SnippetStepConfig> = {}) {
    super();
    this.config = { ...defaultSnippetStepConfig, ...config };
  }

  getRequiredInputs(): (keyof ArtifactPaths)[] {
    return ['video_normalized', 'topics', 'transcript'];
  }

  getProducedOutputs(): (keyof ArtifactPaths)[] {
    const outputs: (keyof ArtifactPaths)[] = ['snippets'];
    if (this.config.generateThumbnails) {
      outputs.push('thumbnails');
    }
    if (this.config.generateCaptions) {
      outputs.push('captions');
    }
    return outputs;
  }

  async execute(
    manifest: ArtifactManifest,
    context: PipelineContext
  ): Promise<ArtifactManifest> {
    const videoPath = manifest.paths.video_normalized;
    const topicsPath = manifest.paths.topics;
    const transcriptPath = manifest.paths.transcript;

    if (!videoPath || !topicsPath) {
      throw new Error('Video or topics not found in manifest');
    }

    context.logger.info('Starting snippet generation');
    context.onProgress?.(10, 'Loading topics');

    // Load topics
    const topicsData = await context.storage.read(topicsPath);
    const topics = JSON.parse(topicsData.toString()) as Array<{
      id: string;
      start: number;
      end: number;
      title: string;
    }>;

    // Load transcript for captions
    let transcript: Array<{ start: number; end: number; text: string }> = [];
    if (this.config.generateCaptions && transcriptPath) {
      const transcriptData = await context.storage.read(transcriptPath);
      transcript = JSON.parse(transcriptData.toString());
    }

    context.onProgress?.(20, 'Generating video snippets');

    // Generate snippets
    const snippets: SnippetInfo[] = [];
    const snippetPaths: string[] = [];
    const thumbnailPaths: string[] = [];
    const captionPaths: string[] = [];

    for (let i = 0; i < topics.length; i++) {
      const topic = topics[i];

      // Calculate snippet boundaries with padding
      let start = Math.max(0, topic.start - this.config.paddingSeconds);
      let end = topic.end + this.config.paddingSeconds;
      let duration = end - start;

      // Apply min/max duration constraints
      if (duration < this.config.minDuration) {
        end = start + this.config.minDuration;
        duration = this.config.minDuration;
      }
      if (duration > this.config.maxDuration) {
        end = start + this.config.maxDuration;
        duration = this.config.maxDuration;
      }

      context.logger.info(
        `Generating snippet for topic ${topic.id}: ${start}s - ${end}s`
      );

      // Generate video snippet
      const snippetPath = await this.generateVideoSnippet(
        videoPath,
        topic.id,
        start,
        end,
        manifest,
        context
      );
      snippetPaths.push(snippetPath);

      // Generate thumbnail
      let thumbnailPath: string | undefined;
      if (this.config.generateThumbnails) {
        thumbnailPath = await this.generateThumbnail(
          videoPath,
          topic.id,
          start + duration / 2, // Middle of snippet
          manifest,
          context
        );
        if (thumbnailPath) {
          thumbnailPaths.push(thumbnailPath);
        }
      }

      // Generate captions
      let captionPath: string | undefined;
      if (this.config.generateCaptions) {
        captionPath = await this.generateCaptions(
          topic.id,
          start,
          end,
          transcript,
          manifest,
          context
        );
        if (captionPath) {
          captionPaths.push(captionPath);
        }
      }

      snippets.push({
        topicId: topic.id,
        start,
        end,
        duration,
        videoPath: snippetPath,
        videoUrl: await context.storage.getUrl(snippetPath),
        thumbnailPath,
        thumbnailUrl: thumbnailPath
          ? await context.storage.getUrl(thumbnailPath)
          : undefined,
        captionPath,
        captionUrl: captionPath
          ? await context.storage.getUrl(captionPath)
          : undefined,
      });

      // Update progress
      const progress = 20 + Math.floor(((i + 1) / topics.length) * 80);
      context.onProgress?.(progress, `Generated snippet ${i + 1}/${topics.length}`);
    }

    context.onProgress?.(100, 'Snippet generation complete');

    // Save snippet metadata
    const outputDir = `videos/${manifest.video_id}/snippets`;
    const snippetsMetaPath = `${outputDir}/snippets.json`;
    await context.storage.write(
      snippetsMetaPath,
      Buffer.from(JSON.stringify(snippets, null, 2))
    );

    let updatedManifest = this.updateManifest(manifest, {
      snippets: snippetPaths,
    });

    if (thumbnailPaths.length > 0) {
      updatedManifest = this.updateManifest(updatedManifest, {
        thumbnails: thumbnailPaths,
      });
    }

    if (captionPaths.length > 0) {
      updatedManifest = this.updateManifest(updatedManifest, {
        captions: captionPaths,
      });
    }

    // Update metrics
    updatedManifest = this.updateMetrics(updatedManifest, {
      snippet_count: snippets.length,
    });

    return this.markStepCompleted(updatedManifest, this.name);
  }

  private async generateVideoSnippet(
    videoPath: string,
    topicId: string,
    start: number,
    end: number,
    manifest: ArtifactManifest,
    context: PipelineContext
  ): Promise<string> {
    const outputDir = `videos/${manifest.video_id}/snippets`;
    const outputPath = `${outputDir}/${topicId}.${this.config.outputFormat}`;

    context.logger.info(`Generating video snippet: ${start}s - ${end}s`);

    // Implementation would use ffmpeg
    // ffmpeg -ss start -t duration -i input -c:v libx264 -crf 23 -preset fast output

    // Placeholder
    await context.storage.write(outputPath, Buffer.from(''));

    return outputPath;
  }

  private async generateThumbnail(
    videoPath: string,
    topicId: string,
    timestamp: number,
    manifest: ArtifactManifest,
    context: PipelineContext
  ): Promise<string> {
    const outputDir = `videos/${manifest.video_id}/thumbnails`;
    const outputPath = `${outputDir}/${topicId}.${this.config.thumbnailFormat}`;

    context.logger.info(`Generating thumbnail at ${timestamp}s`);

    // Implementation would use ffmpeg
    // ffmpeg -ss timestamp -i input -vframes 1 -s widthxheight output

    // Placeholder
    await context.storage.write(outputPath, Buffer.from(''));

    return outputPath;
  }

  private async generateCaptions(
    topicId: string,
    start: number,
    end: number,
    transcript: Array<{ start: number; end: number; text: string }>,
    manifest: ArtifactManifest,
    context: PipelineContext
  ): Promise<string> {
    const outputDir = `videos/${manifest.video_id}/captions`;
    const outputPath = `${outputDir}/${topicId}.${this.config.captionFormat}`;

    context.logger.info(`Generating captions for ${topicId}`);

    // Filter transcript segments for this topic
    const topicTranscript = transcript.filter(
      (seg) => seg.start >= start && seg.end <= end
    );

    // Generate caption file
    let captionContent: string;
    if (this.config.captionFormat === 'vtt') {
      captionContent = this.generateVTT(topicTranscript, start);
    } else {
      captionContent = this.generateSRT(topicTranscript, start);
    }

    await context.storage.write(outputPath, Buffer.from(captionContent));

    return outputPath;
  }

  private generateVTT(
    segments: Array<{ start: number; end: number; text: string }>,
    offset: number
  ): string {
    const lines = ['WEBVTT', ''];

    for (let i = 0; i < segments.length; i++) {
      const seg = segments[i];
      const start = this.formatTimestamp(seg.start - offset);
      const end = this.formatTimestamp(seg.end - offset);
      lines.push(`${start} --> ${end}`);
      lines.push(seg.text);
      lines.push('');
    }

    return lines.join('\n');
  }

  private generateSRT(
    segments: Array<{ start: number; end: number; text: string }>,
    offset: number
  ): string {
    const lines: string[] = [];

    for (let i = 0; i < segments.length; i++) {
      const seg = segments[i];
      const start = this.formatSRTTimestamp(seg.start - offset);
      const end = this.formatSRTTimestamp(seg.end - offset);
      lines.push(`${i + 1}`);
      lines.push(`${start} --> ${end}`);
      lines.push(seg.text);
      lines.push('');
    }

    return lines.join('\n');
  }

  private formatTimestamp(seconds: number): string {
    const hrs = Math.floor(seconds / 3600);
    const mins = Math.floor((seconds % 3600) / 60);
    const secs = Math.floor(seconds % 60);
    const ms = Math.floor((seconds % 1) * 1000);
    return `${hrs.toString().padStart(2, '0')}:${mins
      .toString()
      .padStart(2, '0')}:${secs.toString().padStart(2, '0')}.${ms
      .toString()
      .padStart(3, '0')}`;
  }

  private formatSRTTimestamp(seconds: number): string {
    const hrs = Math.floor(seconds / 3600);
    const mins = Math.floor((seconds % 3600) / 60);
    const secs = Math.floor(seconds % 60);
    const ms = Math.floor((seconds % 1) * 1000);
    return `${hrs.toString().padStart(2, '0')}:${mins
      .toString()
      .padStart(2, '0')}:${secs.toString().padStart(2, '0')},${ms
      .toString()
      .padStart(3, '0')}`;
  }
}

// Register the step
import { stepRegistry } from '../registry';

stepRegistry.register(
  'snippet',
  () => new SnippetStep(),
  {
    description: 'Generate video snippets, thumbnails, and captions',
    version: '1.0.0',
    author: 'Video Topic Graph Platform',
    tags: ['snippet', 'video', 'thumbnail', 'caption', 'ffmpeg'],
    inputs: ['video_normalized', 'topics', 'transcript'],
    outputs: ['snippets', 'thumbnails', 'captions'],
  }
);
