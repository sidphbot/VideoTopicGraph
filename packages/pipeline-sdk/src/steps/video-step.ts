/**
 * Video Download and Normalization Step
 * 
 * Handles:
 * - Downloading videos from various sources (YouTube, Vimeo, direct URL)
 * - Normalizing to H.264/AAC format
 * - Extracting audio to WAV
 * - Computing duration and metadata
 * - Optional scene detection
 */

import { BasePipelineStep } from '../core';
import type {
  ArtifactManifest,
  PipelineContext,
  ArtifactPaths,
} from '@video-graph/shared-types';

export interface VideoStepConfig {
  /** Output format for normalized video */
  outputFormat: 'mp4' | 'webm';
  /** Video codec */
  videoCodec: 'libx264' | 'libx265' | 'vp9';
  /** Audio codec */
  audioCodec: 'aac' | 'opus' | 'mp3';
  /** Video resolution */
  resolution: '480p' | '720p' | '1080p' | 'original';
  /** Frame rate */
  fps: number | 'original';
  /** Audio sample rate */
  audioSampleRate: number;
  /** Enable scene detection */
  enableSceneDetection: boolean;
  /** Scene detection threshold */
  sceneThreshold: number;
}

export const defaultVideoStepConfig: VideoStepConfig = {
  outputFormat: 'mp4',
  videoCodec: 'libx264',
  audioCodec: 'aac',
  resolution: '720p',
  fps: 'original',
  audioSampleRate: 16000,
  enableSceneDetection: false,
  sceneThreshold: 0.3,
};

/**
 * Video download and normalization step
 */
export class VideoStep extends BasePipelineStep {
  readonly name = 'video';
  readonly version = '1.0.0';

  private config: VideoStepConfig;

  constructor(config: Partial<VideoStepConfig> = {}) {
    super();
    this.config = { ...defaultVideoStepConfig, ...config };
  }

  getRequiredInputs(): (keyof ArtifactPaths)[] {
    // This step requires the source URL from the job payload, not the manifest
    return [];
  }

  getProducedOutputs(): (keyof ArtifactPaths)[] {
    const outputs: (keyof ArtifactPaths)[] = [
      'video_original',
      'video_normalized',
      'audio_wav',
    ];
    if (this.config.enableSceneDetection) {
      outputs.push('scenes');
    }
    return outputs;
  }

  async execute(
    manifest: ArtifactManifest,
    context: PipelineContext
  ): Promise<ArtifactManifest> {
    const { source_url, source_type } = context.payload as {
      source_url: string;
      source_type: string;
    };

    context.logger.info(`Processing video from ${source_type}: ${source_url}`);
    context.onProgress?.(10, 'Downloading video');

    // Step 1: Download video
    const videoOriginalPath = await this.downloadVideo(
      source_url,
      source_type,
      manifest,
      context
    );

    context.onProgress?.(40, 'Normalizing video');

    // Step 2: Normalize video
    const videoNormalizedPath = await this.normalizeVideo(
      videoOriginalPath,
      manifest,
      context
    );

    context.onProgress?.(70, 'Extracting audio');

    // Step 3: Extract audio
    const audioWavPath = await this.extractAudio(
      videoNormalizedPath,
      manifest,
      context
    );

    // Step 4: Optional scene detection
    let scenesPath: string | undefined;
    if (this.config.enableSceneDetection) {
      context.onProgress?.(90, 'Detecting scenes');
      scenesPath = await this.detectScenes(videoNormalizedPath, manifest, context);
    }

    context.onProgress?.(100, 'Video processing complete');

    // Update manifest
    let updatedManifest = this.updateManifest(manifest, {
      video_original: videoOriginalPath,
      video_normalized: videoNormalizedPath,
      audio_wav: audioWavPath,
    });

    if (scenesPath) {
      updatedManifest = this.updateManifest(updatedManifest, {
        scenes: scenesPath,
      });
    }

    // Get video duration
    const duration = await this.getVideoDuration(videoNormalizedPath, context);
    updatedManifest = this.updateMetrics(updatedManifest, { duration_s: duration });

    return this.markStepCompleted(updatedManifest, this.name);
  }

  private async downloadVideo(
    sourceUrl: string,
    sourceType: string,
    manifest: ArtifactManifest,
    context: PipelineContext
  ): Promise<string> {
    const outputDir = `videos/${manifest.video_id}/raw`;
    const outputPath = `${outputDir}/original`;

    context.logger.info(`Downloading from ${sourceType}: ${sourceUrl}`);

    // Implementation would use yt-dlp for YouTube, direct download for others
    // This is a placeholder for the actual implementation
    switch (sourceType) {
      case 'youtube':
        // await downloadWithYtDlp(sourceUrl, outputPath);
        break;
      case 'vimeo':
        // await downloadWithYtDlp(sourceUrl, outputPath);
        break;
      case 'direct':
      case 'file':
        // await downloadWithHttp(sourceUrl, outputPath);
        break;
      default:
        throw new Error(`Unsupported source type: ${sourceType}`);
    }

    // Placeholder: In real implementation, write to storage
    await context.storage.write(outputPath, Buffer.from(''));

    return outputPath;
  }

  private async normalizeVideo(
    inputPath: string,
    manifest: ArtifactManifest,
    context: PipelineContext
  ): Promise<string> {
    const outputDir = `videos/${manifest.video_id}/processed`;
    const outputPath = `${outputDir}/normalized.${this.config.outputFormat}`;

    context.logger.info(`Normalizing video to ${this.config.resolution}`);

    // Implementation would use ffmpeg
    // ffmpeg -i input -c:v libx264 -c:a aac -movflags +faststart output.mp4

    // Placeholder
    await context.storage.write(outputPath, Buffer.from(''));

    return outputPath;
  }

  private async extractAudio(
    videoPath: string,
    manifest: ArtifactManifest,
    context: PipelineContext
  ): Promise<string> {
    const outputDir = `videos/${manifest.video_id}/audio`;
    const outputPath = `${outputDir}/audio.wav`;

    context.logger.info('Extracting audio to WAV');

    // Implementation would use ffmpeg
    // ffmpeg -i input -vn -acodec pcm_s16le -ar 16000 -ac 1 output.wav

    // Placeholder
    await context.storage.write(outputPath, Buffer.from(''));

    return outputPath;
  }

  private async detectScenes(
    videoPath: string,
    manifest: ArtifactManifest,
    context: PipelineContext
  ): Promise<string> {
    const outputDir = `videos/${manifest.video_id}/scenes`;
    const outputPath = `${outputDir}/scenes.json`;

    context.logger.info('Detecting scenes');

    // Implementation would use scenedetect or ffmpeg

    const scenes = {
      scenes: [
        { start: 0, end: 30, type: 'intro' },
        { start: 30, end: 120, type: 'content' },
      ],
    };

    await context.storage.write(
      outputPath,
      Buffer.from(JSON.stringify(scenes))
    );

    return outputPath;
  }

  private async getVideoDuration(
    videoPath: string,
    context: PipelineContext
  ): Promise<number> {
    // Implementation would use ffprobe
    // ffprobe -v error -show_entries format=duration -of json input

    // Placeholder
    return 300; // 5 minutes
  }
}

// Register the step
import { stepRegistry } from '../registry';

stepRegistry.register(
  'video',
  () => new VideoStep(),
  {
    description: 'Download and normalize video files',
    version: '1.0.0',
    author: 'Video Topic Graph Platform',
    tags: ['video', 'download', 'normalize', 'ffmpeg'],
    inputs: ['source_url'],
    outputs: ['video_original', 'video_normalized', 'audio_wav', 'scenes'],
  }
);
