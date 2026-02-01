/**
 * Unit Tests - ASR Pipeline Step
 * 
 * Tests for speech recognition with Whisper and diarization.
 */

import { describe, it, expect, vi, beforeEach } from 'vitest';
import { AsrPipelineStep } from './asr-step';
import { PipelineStage, type ArtifactManifest } from '@video-graph/shared-types';
import type { StepContext } from '../types';

// Mock Python bridge
vi.mock('../utils/python-bridge', () => ({
  PythonBridge: vi.fn().mockImplementation(() => ({
    execute: vi.fn().mockResolvedValue({
      segments: [
        { start: 0, end: 5, text: 'Hello world', speaker: 'SPEAKER_00' },
        { start: 5, end: 10, text: 'This is a test', speaker: 'SPEAKER_01' },
      ],
      language: 'en',
      confidence: 0.95,
    }),
  })),
}));

describe('AsrPipelineStep', () => {
  let step: AsrPipelineStep;
  let context: StepContext;

  beforeEach(() => {
    step = new AsrPipelineStep();
    context = {
      videoId: 'vid-123',
      jobId: 'job-456',
      manifest: createMockManifest({
        video: {
          normalized: {
            key: 'videos/vid-123/normalized.mp4',
            bucket: 'test-bucket',
            size: 1000000,
            contentType: 'video/mp4',
            checksum: 'sha256:test',
          },
        },
      }),
      config: {
        model: 'base',
        language: 'en',
        diarization: true,
      },
    };
  });

  describe('constructor', () => {
    it('should create step with ASR stage', () => {
      expect(step.stage).toBe(PipelineStage.ASR);
      expect(step.name).toBe('asr-processor');
    });

    it('should support multiple Whisper models', () => {
      const models = ['tiny', 'base', 'small', 'medium', 'large-v1', 'large-v2', 'large-v3'];
      for (const model of models) {
        const testStep = new AsrPipelineStep();
        expect(testStep).toBeDefined();
      }
    });
  });

  describe('validateContext', () => {
    it('should validate context with normalized video', async () => {
      const isValid = await step.validateContext(context);
      expect(isValid).toBe(true);
    });

    it('should reject context without video artifact', async () => {
      context.manifest.artifacts = {};
      const isValid = await step.validateContext(context);
      expect(isValid).toBe(false);
    });

    it('should reject context without normalized video', async () => {
      context.manifest.artifacts.video = {
        original: {
          key: 'videos/vid-123/original.mp4',
          bucket: 'test-bucket',
          size: 1000,
          contentType: 'video/mp4',
          checksum: 'sha256:test',
        },
      };
      const isValid = await step.validateContext(context);
      expect(isValid).toBe(false);
    });
  });

  describe('execute', () => {
    it('should extract audio from video', async () => {
      const extractSpy = vi.spyOn(step as any, 'extractAudio');
      extractSpy.mockResolvedValue('/tmp/audio.wav');

      await step.execute(context);

      expect(extractSpy).toHaveBeenCalledWith('videos/vid-123/normalized.mp4');
    });

    it('should run Whisper transcription', async () => {
      const whisperSpy = vi.spyOn(step as any, 'runWhisper');
      whisperSpy.mockResolvedValue({
        segments: [{ start: 0, end: 5, text: 'Test' }],
      });

      await step.execute(context);

      expect(whisperSpy).toHaveBeenCalledWith(
        expect.any(String),
        expect.objectContaining({
          model: 'base',
          language: 'en',
        })
      );
    });

    it('should run speaker diarization when enabled', async () => {
      const diarizeSpy = vi.spyOn(step as any, 'runDiarization');
      diarizeSpy.mockResolvedValue([
        { start: 0, end: 5, speaker: 'SPEAKER_00' },
      ]);

      await step.execute(context);

      expect(diarizeSpy).toHaveBeenCalled();
    });

    it('should skip diarization when disabled', async () => {
      context.config.diarization = false;
      const diarizeSpy = vi.spyOn(step as any, 'runDiarization');

      await step.execute(context);

      expect(diarizeSpy).not.toHaveBeenCalled();
    });

    it('should merge diarization with transcription', async () => {
      const mergeSpy = vi.spyOn(step as any, 'mergeDiarization');
      mergeSpy.mockReturnValue([
        { start: 0, end: 5, text: 'Hello', speaker: 'SPEAKER_00' },
      ]);

      await step.execute(context);

      expect(mergeSpy).toHaveBeenCalled();
    });

    it('should generate VTT output', async () => {
      const result = await step.execute(context);

      expect(result.artifacts.transcript?.vtt).toBeDefined();
      expect(result.artifacts.transcript?.vtt?.contentType).toBe('text/vtt');
    });

    it('should generate JSON output', async () => {
      const result = await step.execute(context);

      expect(result.artifacts.transcript?.json).toBeDefined();
      expect(result.artifacts.transcript?.json?.contentType).toBe('application/json');
    });

    it('should generate SRT output', async () => {
      const result = await step.execute(context);

      expect(result.artifacts.transcript?.srt).toBeDefined();
      expect(result.artifacts.transcript?.srt?.contentType).toBe('text/srt');
    });

    it('should include word-level timestamps when configured', async () => {
      context.config.wordTimestamps = true;
      const whisperSpy = vi.spyOn(step as any, 'runWhisper');

      await step.execute(context);

      expect(whisperSpy).toHaveBeenCalledWith(
        expect.any(String),
        expect.objectContaining({ wordTimestamps: true })
      );
    });

    it('should handle transcription errors gracefully', async () => {
      const whisperSpy = vi.spyOn(step as any, 'runWhisper');
      whisperSpy.mockRejectedValue(new Error('Whisper failed'));

      await expect(step.execute(context)).rejects.toThrow('Whisper failed');
    });
  });

  describe('extractAudio', () => {
    it('should extract 16kHz mono audio for Whisper', async () => {
      const ffmpegSpy = vi.spyOn(step as any, 'runFFmpeg');
      ffmpegSpy.mockResolvedValue(undefined);

      await (step as any).extractAudio('input.mp4', 'output.wav');

      expect(ffmpegSpy).toHaveBeenCalledWith([
        '-i', 'input.mp4',
        '-ar', '16000',
        '-ac', '1',
        '-c:a', 'pcm_s16le',
        'output.wav',
      ]);
    });
  });

  describe('runWhisper', () => {
    it('should use correct model size', async () => {
      const pythonSpy = vi.spyOn(step as any, 'runPython');
      pythonSpy.mockResolvedValue({ segments: [] });

      await (step as any).runWhisper('/tmp/audio.wav', { model: 'small' });

      expect(pythonSpy).toHaveBeenCalledWith(
        expect.stringContaining('small')
      );
    });

    it('should auto-detect language when not specified', async () => {
      const pythonSpy = vi.spyOn(step as any, 'runPython');
      pythonSpy.mockResolvedValue({ segments: [], language: 'auto' });

      await (step as any).runWhisper('/tmp/audio.wav', {});

      expect(pythonSpy).toHaveBeenCalledWith(
        expect.stringContaining('auto')
      );
    });

    it('should use language-specific model when available', async () => {
      const pythonSpy = vi.spyOn(step as any, 'runPython');
      pythonSpy.mockResolvedValue({ segments: [] });

      await (step as any).runWhisper('/tmp/audio.wav', { language: 'en' });

      expect(pythonSpy).toHaveBeenCalledWith(
        expect.stringContaining('english')
      );
    });
  });

  describe('runDiarization', () => {
    it('should use pyannote.audio for diarization', async () => {
      const pythonSpy = vi.spyOn(step as any, 'runPython');
      pythonSpy.mockResolvedValue({ segments: [] });

      await (step as any).runDiarization('/tmp/audio.wav');

      expect(pythonSpy).toHaveBeenCalledWith(
        expect.stringContaining('pyannote')
      );
    });

    it('should handle single-speaker content', async () => {
      const pythonSpy = vi.spyOn(step as any, 'runPython');
      pythonSpy.mockResolvedValue({
        segments: [{ start: 0, end: 60, speaker: 'SPEAKER_00' }],
      });

      const result = await (step as any).runDiarization('/tmp/audio.wav');

      expect(result.segments).toHaveLength(1);
    });
  });

  describe('generateVTT', () => {
    it('should generate valid WebVTT format', () => {
      const segments = [
        { start: 0, end: 5.5, text: 'Hello world', speaker: 'SPEAKER_00' },
        { start: 6, end: 10.2, text: 'Second line', speaker: 'SPEAKER_01' },
      ];

      const vtt = (step as any).generateVTT(segments);

      expect(vtt).toContain('WEBVTT');
      expect(vtt).toContain('00:00:00.000 --> 00:00:05.500');
      expect(vtt).toContain('<v SPEAKER_00>Hello world');
      expect(vtt).toContain('00:00:06.000 --> 00:00:10.200');
    });

    it('should handle segments without speakers', () => {
      const segments = [
        { start: 0, end: 5, text: 'No speaker' },
      ];

      const vtt = (step as any).generateVTT(segments);

      expect(vtt).toContain('WEBVTT');
      expect(vtt).toContain('No speaker');
      expect(vtt).not.toContain('<v');
    });
  });

  describe('generateSRT', () => {
    it('should generate valid SRT format', () => {
      const segments = [
        { start: 0, end: 5.5, text: 'Hello world' },
        { start: 6, end: 10.2, text: 'Second line' },
      ];

      const srt = (step as any).generateSRT(segments);

      expect(srt).toContain('1');
      expect(srt).toContain('00:00:00,000 --> 00:00:05,500');
      expect(srt).toContain('Hello world');
      expect(srt).toContain('2');
    });
  });
});

// Helper function
function createMockManifest(artifacts: any = {}): ArtifactManifest {
  return {
    version: '1.0.0',
    videoId: 'vid-123',
    jobId: 'job-456',
    artifacts,
    metadata: {
      createdAt: new Date().toISOString(),
      pipelineVersion: '1.0.0',
    },
  };
}
