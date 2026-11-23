import type { MoocCue, MoocSequenceDocument } from '@/types/mooc';

export function canonSeconds(value: number): number {
  if (!Number.isFinite(value)) return value;
  return Math.round(value * 1000) / 1000;
}

export function formatMoocTime(seconds: number): string {
  const safe = Number.isFinite(seconds) ? Math.max(0, seconds) : 0;
  const minutes = Math.floor(safe / 60);
  const rest = safe - minutes * 60;
  return `${String(minutes).padStart(2, '0')}:${rest.toFixed(1).padStart(4, '0')}`;
}

export function sequenceEnd(sequence: MoocSequenceDocument): number {
  const last = sequence.cues[sequence.cues.length - 1];
  if (!last) {
    return canonSeconds(sequence.packaging.intro.duration + sequence.packaging.outro.duration);
  }
  return canonSeconds(last.end + sequence.packaging.outro.duration);
}

export type MoocPlace =
  | { kind: 'intro' }
  | { kind: 'outro' }
  | { kind: 'gap'; start: number; end: number }
  | { kind: 'cue'; cue: MoocCue };

/**
 * Half-open cue intervals: a cue owns [start, end).
 * The intro owns [0, intro.duration). The outro owns [lastCue.end, sequenceEnd).
 * Time past the end stays on the outro so the playhead does not invent a camera.
 */
export function locateAt(sequence: MoocSequenceDocument, time: number): MoocPlace {
  const t = Number.isFinite(time) ? time : 0;
  const intro = sequence.packaging.intro.duration;
  if (t < intro) return { kind: 'intro' };

  const cues = sequence.cues;
  const last = cues[cues.length - 1];
  if (!last || t >= last.end) return { kind: 'outro' };

  for (let index = 0; index < cues.length; index += 1) {
    const cue = cues[index]!;
    if (t >= cue.start && t < cue.end) return { kind: 'cue', cue };
    if (t < cue.start) {
      const previous = index === 0 ? undefined : cues[index - 1];
      const gapStart = previous ? previous.end : intro;
      return { kind: 'gap', start: gapStart, end: cue.start };
    }
  }

  return { kind: 'outro' };
}

export interface PackedRange {
  id: string;
  from: number;
  duration: number;
}

/**
 * Convert second ranges to non-overlapping frame ranges.
 * Sub-frame cues grow to one frame. Later ranges move forward when rounding would overlap.
 */
export function packFrameRanges(
  ranges: Array<{ id: string; start: number; end: number }>,
  fps: number,
  minFrom: number
): { ranges: PackedRange[]; pushed: boolean } {
  const safeFps = Number.isFinite(fps) && fps > 0 ? fps : 30;
  let cursor = Math.max(0, Math.round(minFrom));
  let pushed = false;
  const packed = ranges.map((range) => {
    let from = Math.round(range.start * safeFps);
    let end = Math.round(range.end * safeFps);
    if (from < cursor) {
      from = cursor;
      pushed = true;
    }
    if (end <= from) {
      end = from + 1;
      pushed = true;
    }
    cursor = end;
    return { id: range.id, from, duration: end - from };
  });
  return { ranges: packed, pushed };
}
