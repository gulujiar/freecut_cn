/**
 * Deterministic PCM narration used when a project has no lecture audio.
 * The samples are real audio data, written as a WAV file into the media library.
 */

function mulberry32(seed: number): () => number {
  let state = seed >>> 0;
  return () => {
    state = (state + 0x6d2b79f5) >>> 0;
    let t = Math.imul(state ^ (state >>> 15), 1 | state);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

export function buildSampleNarration(durationSeconds: number, sampleRate = 16000): Float32Array {
  const safeDuration = Number.isFinite(durationSeconds) && durationSeconds > 0 ? durationSeconds : 1;
  const rate = Number.isFinite(sampleRate) && sampleRate > 0 ? Math.round(sampleRate) : 16000;
  const length = Math.max(1, Math.round(safeDuration * rate));
  const samples = new Float32Array(length);
  const random = mulberry32(0x51a0c);
  const syllable = Math.max(1, Math.round(rate * 0.18));

  for (let index = 0; index < length; index += 1) {
    const phase = (index % syllable) / syllable;
    const envelope = Math.sin(Math.PI * phase) * (0.35 + 0.65 * ((index / syllable) % 7) / 7);
    const noise = random() * 2 - 1;
    const tone = Math.sin((2 * Math.PI * 180 * index) / rate) * 0.15;
    samples[index] = (noise * 0.55 + tone) * envelope * 0.45;
  }

  return samples;
}

export function peakEnvelope(samples: Float32Array, buckets: number): number[] {
  const count = Math.max(1, Math.round(buckets));
  if (samples.length === 0) return Array.from({ length: count }, () => 0);
  const peaks: number[] = [];
  for (let bucket = 0; bucket < count; bucket += 1) {
    const start = Math.floor((bucket * samples.length) / count);
    const end = Math.max(start + 1, Math.floor(((bucket + 1) * samples.length) / count));
    let peak = 0;
    for (let index = start; index < end && index < samples.length; index += 1) {
      const value = Math.abs(samples[index] ?? 0);
      if (value > peak) peak = value;
    }
    peaks.push(peak);
  }
  return peaks;
}

export function encodePcm16Wav(samples: Float32Array, sampleRate: number): Uint8Array {
  const rate = Math.max(1, Math.round(sampleRate));
  const dataBytes = samples.length * 2;
  const buffer = new ArrayBuffer(44 + dataBytes);
  const view = new DataView(buffer);
  const writeText = (offset: number, text: string) => {
    for (let index = 0; index < text.length; index += 1) {
      view.setUint8(offset + index, text.charCodeAt(index));
    }
  };

  writeText(0, 'RIFF');
  view.setUint32(4, 36 + dataBytes, true);
  writeText(8, 'WAVE');
  writeText(12, 'fmt ');
  view.setUint32(16, 16, true);
  view.setUint16(20, 1, true);
  view.setUint16(22, 1, true);
  view.setUint32(24, rate, true);
  view.setUint32(28, rate * 2, true);
  view.setUint16(32, 2, true);
  view.setUint16(34, 16, true);
  writeText(36, 'data');
  view.setUint32(40, dataBytes, true);

  for (let index = 0; index < samples.length; index += 1) {
    const sample = Math.max(-1, Math.min(1, samples[index] ?? 0));
    view.setInt16(44 + index * 2, Math.round(sample * 32767), true);
  }

  return new Uint8Array(buffer);
}

export function wavDurationSeconds(bytes: Uint8Array): number | null {
  if (bytes.length < 44) return null;
  const view = new DataView(bytes.buffer, bytes.byteOffset, bytes.byteLength);
  const riff = String.fromCharCode(view.getUint8(0), view.getUint8(1), view.getUint8(2), view.getUint8(3));
  const wave = String.fromCharCode(view.getUint8(8), view.getUint8(9), view.getUint8(10), view.getUint8(11));
  if (riff !== 'RIFF' || wave !== 'WAVE') return null;
  const rate = view.getUint32(24, true);
  const dataBytes = view.getUint32(40, true);
  if (rate <= 0) return null;
  return dataBytes / 2 / rate;
}
