/**
 * Unit Tests - Video Pipeline Step
 * 
 * Tests for video download, transcoding, and normalization.
 */

import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { VideoPipelineStep } from './video-step';
import { PipelineStage, type ArtifactManifest } from '@video-graph/shared-types';
import type { StepContext } from '../types';

// Mock dependencies
vi.mock('../utils/storage', () => ({
  StorageManager: vi.fn().mockImplementation(() => ({
    uploadFile: vi.fn().mockResolvedValue({
      key: 'videos/vid-123/test.mp4',
      bucket: 'test-bucket',
      size: 1000,
      contentType: 'video/mp4',
      checksum: 'sha256:test',
    }),
    getSignedUrl: vi.fn().mockResolvedValue('https://example.com/signed-url'),
  })),
}));

vi.mock('../utils/ffmpeg', () => ({
  FFmpegProcessor: vi.fn().mockImplementation(() => ({
    probe: vi.fn().mockResolvedValue({
      duration: 3600,
      width: 1920,
      height: 1080,
      fps: 30,
      codec: 'h264',
      bitrate: 5000000,
    }),
    transcode: vi.fn().mockResolvedValue('/tmp/output.mp4'),
    extractThumbnail: vi.fn().mockResolvedValue('/tmp/thumb.jpg'),
    normalizeAudio: vi.fn().mockResolvedValue('/tmp/audio.wav'),
  })),
}));

describe('VideoPipelineStep', () => {
  let step: VideoPipelineStep;
  let context: StepContext;

  beforeEach(() => {
    step = new VideoPipelineStep();
    context = {
      videoId: 'vid-123',
      jobId: 'job-456',
      manifest: createMockManifest(),
      config: {
        videoUrl: 'https://youtube.com/watch?v=test',
        targetResolution: '1080p',
        extractThumbnail: true,
      },
    };
  });

  afterEach(() => {
    vi.clearAllMocks();
  });

  describe('constructor', () => {
    it('should create step with VIDEO stage', () => {
      expect(step.stage).toBe(PipelineStage.VIDEO);
      expect(step.name).toBe('video-processor');
    });

    it('should have appropriate timeout for video processing', () => {
      expect(step.config.timeoutMs).toBeGreaterThan(300000); // > 5 minutes
    });
  });

  describe('validateContext', () => {
    it('should validate context with video URL', async () => {
      const isValid = await step.validateContext(context);
      expect(isValid).toBe(true);
    });

    it('should reject context without video URL', async () => {
      context.config.videoUrl = undefined;
      const isValid = await step.validateContext(context);
      expect(isValid).toBe(false);
    });

    it('should reject invalid URL format', async () => {
      context.config.videoUrl = 'not-a-valid-url';
      const isValid = await step.validateContext(context);
      expect(isValid).toBe(false);
    });

    it('should accept various video platforms', async () => {
      const urls = [
        'https://youtube.com/watch?v=test',
        'https://youtu.be/test',
        'https://vimeo.com/123456',
        'https://example.com/video.mp4',
      ];

      for (const url of urls) {
        context.config.videoUrl = url;
        const isValid = await step.validateContext(context);
        expect(isValid).toBe(true);
      }
    });
  });

  describe('execute', () => {
    it('should download video from URL', async () => {
      const downloadVideoSpy = vi.spyOn(step as any, 'downloadVideo');
      downloadVideoSpy.mockResolvedValue('/tmp/downloaded.mp4');

      await step.execute(context);

      expect(downloadVideoSpy).toHaveBeenCalledWith('https://youtube.com/watch?v=test');
    });

    it('should probe video metadata', async () => {
      const result = await step.execute(context);

      expect(result.success).toBe(true);
      expect(result.artifacts.video?.metadata).toBeDefined();
    });

    it('should transcode video to target resolution', async () => {
      const transcodeSpy = vi.spyOn(step as any, 'transcodeVideo');
      transcodeSpy.mockResolvedValue('/tmp/transcoded.mp4');

      await step.execute(context);

      expect(transcodeSpy).toHaveBeenCalledWith(
        expect.any(String),
        expect.objectContaining({
          resolution: '1080p',
        })
      );
    });

    it('should extract thumbnail when configured', async () => {
      const extractThumbnailSpy = vi.spyOn(step as any, 'extractThumbnail');
      extractThumbnailSpy.mockResolvedValue('/tmp/thumb.jpg');

      await step.execute(context);

      expect(extractThumbnailSpy).toHaveBeenCalled();
    });

    it('should skip thumbnail extraction when disabled', async () => {
      context.config.extractThumbnail = false;
      const extractThumbnailSpy = vi.spyOn(step as any, 'extractThumbnail');

      await step.execute(context);

      expect(extractThumbnailSpy).not.toHaveBeenCalled();
    });

    it('should upload all artifacts to storage', async () => {
      const result = await step.execute(context);

      expect(result.artifacts.video?.original).toBeDefined();
      expect(result.artifacts.video?.normalized).toBeDefined();
    });

    it('should include processing metrics', async () => {
      const result = await step.execute(context);

      expect(result.metrics).toBeDefined();
      expect(result.metrics?.executionTimeMs).toBeGreaterThan(0);
    });

    it('should handle download failures gracefully', async () => {
      const downloadVideoSpy = vi.spyOn(step as any, 'downloadVideo');
      downloadVideoSpy.mockRejectedValue(new Error('Download failed'));

      await expect(step.execute(context)).rejects.toThrow('Download failed');
    });

    it('should handle transcoding failures', async () => {
      const transcodeSpy = vi.spyOn(step as any, 'transcodeVideo');
      transcodeSpy.mockRejectedValue(new Error('Transcoding failed'));

      await expect(step.execute(context)).rejects.toThrow('Transcoding failed');
    });
  });

  describe('downloadVideo', () => {
    it('should use yt-dlp for YouTube URLs', async () => {
      const execSpy = vi.spyOn(step as any, 'execCommand');
      execSpy.mockResolvedValue({ stdout: '', stderr: '' });

      await (step as any).downloadVideo('https://youtube.com/watch?v=test');

      expect(execSpy).toHaveBeenCalledWith(
        expect.stringContaining('yt-dlp')
      );
    });

    it('should use direct download for MP4 URLs', async () => {
      const fetchSpy = vi.spyOn(global, 'fetch').mockResolvedValue({
        ok: true,
        body: new ReadableStream(),
      } as Response);

      await (step as any).downloadVideo('https://example.com/video.mp4');

      expect(fetchSpy).toHaveBeenCalledWith('https://example.com/video.mp4');
    });

    it('should verify downloaded file integrity', async () => {
      const verifySpy = vi.spyOn(step as any, 'verifyFileIntegrity');
      verifySpy.mockResolvedValue(true);

      await (step as any).downloadVideo('https://example.com/video.mp4');

      expect(verifySpy).toHaveBeenCalled();
    });
  });

  describe('transcodeVideo', () => {
    it('should apply correct codec settings', async () => {
      const ffmpegSpy = vi.spyOn(step as any, 'runFFmpeg');
      ffmpegSpy.mockResolvedValue(undefined);

      await (step as any).transcodeVideo('/tmp/input.mp4', {
        resolution: '1080p',
        codec: 'h264',
      });

      expect(ffmpegSpy).toHaveBeenCalledWith(
        expect.arrayContaining(['-c:v', 'libx264'])
      );
    });

    it('should apply correct resolution settings', async () => {
      const ffmpegSpy = vi.spyOn(step as any, 'runFFmpeg');
      ffmpegSpy.mockResolvedValue(undefined);

      await (step as any).transcodeVideo('/tmp/input.mp4', {
        resolution: '720p',
      });

      expect(ffmpegSpy).toHaveBeenCalledWith(
        expect.arrayContaining(['-vf', 'scale=-1:720'])
      );
    });

    it('should normalize audio track', async () => {
      const ffmpegSpy = vi.spyOn(step as any, 'runFFmpeg');
      ffmpegSpy.mockResolvedValue(undefined);

      await (step as any).transcodeVideo('/tmp/input.mp4', {
        normalizeAudio: true,
      });

      expect(ffmpegSpy).toHaveBeenCalledWith(
        expect.arrayContaining(['-af', 'loudnorm'])
      );
    });
  });

  describe('cleanup', () => {
    it('should remove temporary files', async () => {
      const fsSpy = vi.spyOn(step as any, 'cleanupTempFiles');
      fsSpy.mockResolvedValue(undefined);

      await step.cleanup(context);

      expect(fsSpy).toHaveBeenCalledWith(expect.stringContaining('/tmp'));
    });

    it('should handle cleanup errors gracefully', async () => {
      const fsSpy = vi.spyOn(step as any, 'cleanupTempFiles');
      fsSpy.mockRejectedValue(new Error('Cleanup failed'));

      // Should not throw
      await expect(step.cleanup(context)).resolves.not.toThrow();
    });
  });
});

// Helper function
function createMockManifest(): ArtifactManifest {
  return {
    version: '1.0.0',
    videoId: 'vid-123',
    jobId: 'job-456',
    artifacts: {},
    metadata: {
      createdAt: new Date().toISOString(),
      pipelineVersion: '1.0.0',
    },
  };
}
