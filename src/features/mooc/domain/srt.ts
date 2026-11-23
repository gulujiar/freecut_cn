import type { MoocCue, MoocSequenceDocument } from '@/types/mooc';
import type { PreservingImport } from './xml';
import { canonSeconds } from './time';
import { validateMoocSequence } from './validate';

interface SrtCueDraft {
  start: number;
  end: number;
  text: string;
}

function fail(current: MoocSequenceDocument, errors: string[]): PreservingImport {
  return { ok: false, sequence: current, errors };
}

function timestampToSeconds(token: string): number | null {
  const match = /^(\d+):(\d{2}):(\d{2})[,.](\d{1,3})$/.exec(token);
  if (!match) return null;
  const hours = Number(match[1]);
  const minutes = Number(match[2]);
  const seconds = Number(match[3]);
  const fraction = match[4] ?? '';
  if (minutes > 59 || seconds > 59) return null;
  const millis = Number(fraction.padEnd(3, '0'));
  if (!Number.isFinite(hours + minutes + seconds + millis)) return null;
  return canonSeconds(hours * 3600 + minutes * 60 + seconds + millis / 1000);
}

function parseBlock(block: string, index: number): { ok: true; cue: SrtCueDraft } | { ok: false; error: string } {
  const lines = block.split('\n').map((line) => line.trim()).filter((line) => line.length > 0);
  if (lines.length === 0) return { ok: false, error: `第 ${index} 段字幕是空的。` };
  let cursor = 0;
  const first = lines[0] ?? '';
  if (/^\d+$/.test(first)) cursor = 1;
  const timing = lines[cursor];
  if (!timing || !timing.includes('-->')) {
    return { ok: false, error: `第 ${index} 段字幕缺少时间轴。` };
  }
  const parts = timing.split('-->').map((part) => part.trim().split(/\s+/)[0] ?? '');
  const startToken = parts[0] ?? '';
  const endToken = parts[1] ?? '';
  const start = timestampToSeconds(startToken);
  const end = timestampToSeconds(endToken);
  if (start === null || end === null) {
    return { ok: false, error: `第 ${index} 段字幕时间格式无法解析。` };
  }
  if (start < 0 || end < 0) {
    return { ok: false, error: `第 ${index} 段字幕时间不能为负数。` };
  }
  if (end <= start) {
    return { ok: false, error: `第 ${index} 段字幕结束时间必须晚于开始时间。` };
  }
  const text = lines.slice(cursor + 1).join('\n').trim();
  return { ok: true, cue: { start, end, text } };
}

/**
 * SRT times are lecture-relative. This parser does not add the intro offset.
 * Overlaps, reversed ranges, and malformed blocks reject the whole file.
 */
export function parseSrtCues(srt: string): { ok: true; cues: SrtCueDraft[] } | { ok: false; errors: string[] } {
  if (typeof srt !== 'string' || srt.trim().length === 0) {
    return { ok: false, errors: ['SRT 是空的。'] };
  }
  const stripped = srt.replace(/^\uFEFF/, '').replace(/\r\n/g, '\n').replace(/\r/g, '\n').trim();
  if (/^WEBVTT\b/.test(stripped)) {
    return { ok: false, errors: ['这是 WebVTT，不是 SRT。'] };
  }
  const blocks = stripped.split(/\n\s*\n/);
  const cues: SrtCueDraft[] = [];
  const errors: string[] = [];
  blocks.forEach((block, index) => {
    const parsed = parseBlock(block, index + 1);
    if (!parsed.ok) errors.push(parsed.error);
    else cues.push(parsed.cue);
  });
  if (errors.length > 0) return { ok: false, errors };
  if (cues.length === 0) return { ok: false, errors: ['SRT 里没有字幕块。'] };

  const ordered = [...cues].sort((a, b) => a.start - b.start || a.end - b.end);
  for (let index = 1; index < ordered.length; index += 1) {
    const previous = ordered[index - 1];
    const current = ordered[index];
    if (previous && current && current.start < previous.end) {
      return { ok: false, errors: ['SRT 字幕时间重叠，整份文件已拒绝。'] };
    }
  }
  return { ok: true, cues: ordered };
}

/**
 * Replace cues from an SRT file. Lecture times are shifted by the intro duration.
 * Gaps are preserved. Every imported cue starts on the pure-PPT camera.
 * Failure returns the previous sequence by reference.
 */
export function acceptSrtImport(current: MoocSequenceDocument, srt: string): PreservingImport {
  const parsed = parseSrtCues(srt);
  if (!parsed.ok) return fail(current, parsed.errors);

  const intro = current.packaging.intro.duration;
  const cues: MoocCue[] = parsed.cues.map((cue, index) => ({
    id: `srt-${index + 1}`,
    start: canonSeconds(cue.start + intro),
    end: canonSeconds(cue.end + intro),
    camera: 'ppt',
    slide: current.slides.length > 0 ? index % current.slides.length : 0,
    text: cue.text,
  }));

  const validated = validateMoocSequence({ ...current, cues });
  if (!validated.ok) return fail(current, validated.errors);
  return validated;
}
