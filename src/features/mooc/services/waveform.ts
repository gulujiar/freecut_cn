import type { MoocSequenceDocument } from '@/types/mooc';
import { peakEnvelope } from '../domain/wav';

export interface WaveformView {
  peaks: number[];
  /** Seconds on the master timeline where this audio clip starts. */
  audioStart: number;
  audioEnd: number;
  label: string;
  sample: boolean;
  playable: boolean;
}

function emptyWave(label: string, sample: boolean): WaveformView {
  return { peaks: [], audioStart: 0, audioEnd: 0, label, sample, playable: false };
}

export async function loadSequenceWaveform(sequence: MoocSequenceDocument): Promise<WaveformView> {
  const { mediaLookup } = await import('./apply-sequence');
  const { mediaLibraryService } = await import('../deps/media-library-contract');
  const lookup = mediaLookup();
  const audio = sequence.audioMediaId ? lookup[sequence.audioMediaId] : undefined;
  if (!audio || audio.kind !== 'audio') {
    return emptyWave('未接入旁白。没有音轨，所以这里不画波形。', false);
  }

  const last = sequence.cues[sequence.cues.length - 1];
  const lectureEnd = last?.end ?? sequence.packaging.intro.duration;
  const audioStart = sequence.packaging.intro.duration;
  const audioEnd = Math.min(lectureEnd, audioStart + audio.duration);
  try {
    const blob = await mediaLibraryService.getMediaFile(audio.id);
    if (!blob) {
      return emptyWave('旁白素材读不出来，所以没有波形。', sequence.sample.audio);
    }
    const context = new AudioContext();
    try {
      const decoded = await context.decodeAudioData(await blob.arrayBuffer());
      const channel = decoded.getChannelData(0);
      const peaks = peakEnvelope(channel, 360);
      const label = sequence.sample.audio
        ? '示例波形：由程序生成的 PCM 旁白解码得到，不是真实录音。'
        : `波形来自旁白「${audio.fileName}」。`;
      return {
        peaks,
        audioStart,
        audioEnd,
        label,
        sample: sequence.sample.audio,
        playable: true,
      };
    } finally {
      await context.close();
    }
  } catch {
    return emptyWave(
      sequence.sample.audio
        ? '示例旁白已写入素材库，但浏览器没能解码出波形。'
        : '旁白已接入，但浏览器没能解码出波形。这里不画假波形。',
      sequence.sample.audio
    );
  }
}
