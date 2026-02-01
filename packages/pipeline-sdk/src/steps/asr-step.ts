/**
 * ASR (Automatic Speech Recognition) Step
 * 
 * Handles:
 * - Speech-to-text transcription using Whisper/Faster-Whisper/whisper.cpp
 * - Optional word-level alignment
 * - Optional speaker diarization using pyannote
 * - Language detection
 */

import { BasePipelineStep } from '../core';
import type {
  ArtifactManifest,
  PipelineContext,
  ArtifactPaths,
} from '@video-graph/shared-types';

export interface AsrStepConfig {
  /** ASR model provider */
  provider: 'whisper' | 'faster-whisper' | 'whisper-cpp';
  /** Model size or path */
  model: 'tiny' | 'base' | 'small' | 'medium' | 'large-v1' | 'large-v2' | 'large-v3' | string;
  /** Device for inference */
  device: 'cpu' | 'cuda' | 'mps';
  /** Language code (auto-detect if not specified) */
  language?: string;
  /** Enable word-level alignment */
  enableWordAlignment: boolean;
  /** Enable speaker diarization */
  enableDiarization: boolean;
  /** Diarization model */
  diarizationModel: string;
  /** Number of speakers (0 = unknown) */
  numSpeakers: number;
  /** Beam size for decoding */
  beamSize: number;
  /** Best of N for sampling */
  bestOf: number;
  /** Temperature for sampling */
  temperature: number;
  /** Compute type for faster-whisper */
  computeType: 'int8' | 'int8_float16' | 'int16' | 'float16' | 'float32';
  /** VAD filter */
  vadFilter: boolean;
}

export const defaultAsrStepConfig: AsrStepConfig = {
  provider: 'faster-whisper',
  model: 'base',
  device: 'cpu',
  enableWordAlignment: false,
  enableDiarization: false,
  diarizationModel: 'pyannote/speaker-diarization',
  numSpeakers: 0,
  beamSize: 5,
  bestOf: 5,
  temperature: 0,
  computeType: 'int8',
  vadFilter: true,
};

/**
 * Transcript segment structure
 */
export interface TranscriptSegment {
  id: string;
  start: number;
  end: number;
  text: string;
  speaker?: string;
  confidence?: number;
  words?: Array<{
    word: string;
    start: number;
    end: number;
    confidence?: number;
  }>;
}

/**
 * ASR pipeline step
 */
export class AsrStep extends BasePipelineStep {
  readonly name = 'asr';
  readonly version = '1.0.0';

  private config: AsrStepConfig;

  constructor(config: Partial<AsrStepConfig> = {}) {
    super();
    this.config = { ...defaultAsrStepConfig, ...config };
  }

  getRequiredInputs(): (keyof ArtifactPaths)[] {
    return ['audio_wav'];
  }

  getProducedOutputs(): (keyof ArtifactPaths)[] {
    const outputs: (keyof ArtifactPaths)[] = ['transcript'];
    if (this.config.enableWordAlignment) {
      outputs.push('word_alignment');
    }
    if (this.config.enableDiarization) {
      outputs.push('diarization');
    }
    return outputs;
  }

  async execute(
    manifest: ArtifactManifest,
    context: PipelineContext
  ): Promise<ArtifactManifest> {
    const audioPath = manifest.paths.audio_wav;
    if (!audioPath) {
      throw new Error('Audio file not found in manifest');
    }

    context.logger.info(`Running ASR with ${this.config.provider} model: ${this.config.model}`);
    context.onProgress?.(10, 'Loading ASR model');

    // Load audio
    const audioData = await context.storage.read(audioPath);

    context.onProgress?.(30, 'Transcribing audio');

    // Step 1: Transcribe audio
    const transcript = await this.transcribe(audioData, context);

    context.onProgress?.(70, 'Processing transcript');

    // Step 2: Optional word alignment
    let wordAlignment: TranscriptSegment[] | undefined;
    if (this.config.enableWordAlignment) {
      wordAlignment = await this.alignWords(audioData, transcript, context);
    }

    // Step 3: Optional diarization
    let diarization: Array<{ start: number; end: number; speaker: string }> | undefined;
    if (this.config.enableDiarization) {
      context.onProgress?.(85, 'Running speaker diarization');
      diarization = await this.diarize(audioData, context);
      // Merge diarization with transcript
      this.mergeDiarization(transcript, diarization);
    }

    context.onProgress?.(100, 'ASR complete');

    // Save outputs
    const outputDir = `videos/${manifest.video_id}/transcripts`;
    const transcriptPath = `${outputDir}/transcript.json`;
    await context.storage.write(
      transcriptPath,
      Buffer.from(JSON.stringify(transcript, null, 2))
    );

    let updatedManifest = this.updateManifest(manifest, {
      transcript: transcriptPath,
    });

    // Save word alignment if enabled
    if (wordAlignment) {
      const alignmentPath = `${outputDir}/word_alignment.json`;
      await context.storage.write(
        alignmentPath,
        Buffer.from(JSON.stringify(wordAlignment, null, 2))
      );
      updatedManifest = this.updateManifest(updatedManifest, {
        word_alignment: alignmentPath,
      });
    }

    // Save diarization if enabled
    if (diarization) {
      const diarizationPath = `${outputDir}/diarization.json`;
      await context.storage.write(
        diarizationPath,
        Buffer.from(JSON.stringify(diarization, null, 2))
      );
      updatedManifest = this.updateManifest(updatedManifest, {
        diarization: diarizationPath,
      });
    }

    // Update metrics
    updatedManifest = this.updateMetrics(updatedManifest, {
      transcript_segments: transcript.length,
      speaker_count: this.config.enableDiarization
        ? new Set(diarization?.map((d) => d.speaker)).size
        : undefined,
    });

    return this.markStepCompleted(updatedManifest, this.name);
  }

  private async transcribe(
    audioData: Buffer,
    context: PipelineContext
  ): Promise<TranscriptSegment[]> {
    context.logger.info(`Transcribing with ${this.config.provider}`);

    // Implementation would use the appropriate ASR library
    // For faster-whisper:
    // from faster_whisper import WhisperModel
    // model = WhisperModel(model_size, device=device, compute_type=compute_type)
    // segments, info = model.transcribe(audio, beam_size=beam_size, ...)

    // Placeholder return
    return [
      {
        id: 'seg-1',
        start: 0,
        end: 5.5,
        text: 'Welcome to this presentation about video topic graphs.',
        confidence: 0.95,
      },
      {
        id: 'seg-2',
        start: 5.5,
        end: 12.0,
        text: 'Today we will explore how to automatically extract topics from video content.',
        confidence: 0.92,
      },
    ];
  }

  private async alignWords(
    audioData: Buffer,
    transcript: TranscriptSegment[],
    context: PipelineContext
  ): Promise<TranscriptSegment[]> {
    context.logger.info('Aligning words');

    // Implementation would use whisper's word-level timestamps
    // or a dedicated alignment model like CTC-based aligner

    // Placeholder: add word-level timestamps
    return transcript.map((seg) => ({
      ...seg,
      words: seg.text.split(' ').map((word, i) => ({
        word,
        start: seg.start + i * ((seg.end - seg.start) / seg.text.split(' ').length),
        end: seg.start + (i + 1) * ((seg.end - seg.start) / seg.text.split(' ').length),
        confidence: 0.9,
      })),
    }));
  }

  private async diarize(
    audioData: Buffer,
    context: PipelineContext
  ): Promise<Array<{ start: number; end: number; speaker: string }>> {
    context.logger.info('Running speaker diarization');

    // Implementation would use pyannote.audio
    // from pyannote.audio import Pipeline
    // pipeline = Pipeline.from_pretrained("pyannote/speaker-diarization")
    // diarization = pipeline(audio_file)

    // Placeholder return
    return [
      { start: 0, end: 30, speaker: 'SPEAKER_00' },
      { start: 30, end: 60, speaker: 'SPEAKER_01' },
    ];
  }

  private mergeDiarization(
    transcript: TranscriptSegment[],
    diarization: Array<{ start: number; end: number; speaker: string }>
  ): void {
    // Assign speaker to each transcript segment based on overlap
    for (const segment of transcript) {
      // Find the diarization segment with maximum overlap
      let maxOverlap = 0;
      let bestSpeaker = 'UNKNOWN';

      for (const dia of diarization) {
        const overlapStart = Math.max(segment.start, dia.start);
        const overlapEnd = Math.min(segment.end, dia.end);
        const overlap = Math.max(0, overlapEnd - overlapStart);

        if (overlap > maxOverlap) {
          maxOverlap = overlap;
          bestSpeaker = dia.speaker;
        }
      }

      segment.speaker = bestSpeaker;
    }
  }
}

// Register the step
import { stepRegistry } from '../registry';

stepRegistry.register(
  'asr',
  () => new AsrStep(),
  {
    description: 'Speech recognition with optional diarization',
    version: '1.0.0',
    author: 'Video Topic Graph Platform',
    tags: ['asr', 'speech', 'whisper', 'diarization', 'transcription'],
    inputs: ['audio_wav'],
    outputs: ['transcript', 'word_alignment', 'diarization'],
  }
);
