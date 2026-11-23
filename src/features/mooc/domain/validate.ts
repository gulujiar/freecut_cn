import {
  MOOC_CAMERAS,
  MOOC_MAX_SECONDS,
  MOOC_SEQUENCE_VERSION,
  type MoocCamera,
  type MoocCue,
  type MoocPackagingSide,
  type MoocSampleFlags,
  type MoocSequenceDocument,
  type MoocSlideAsset,
} from '@/types/mooc';
import { canonSeconds } from './time';

export type MoocResult<T> =
  | { ok: true; sequence: T }
  | { ok: false; errors: string[] };

const ID_MAX = 80;

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}

function push(errors: string[], message: string): void {
  if (errors.length < 24) errors.push(message);
}

function readBoolean(value: unknown, label: string, errors: string[]): boolean {
  if (typeof value !== 'boolean') {
    push(errors, `${label} 必须是布尔值。`);
    return false;
  }
  return value;
}

function hasDisallowedControl(value: string): boolean {
  for (let index = 0; index < value.length; index += 1) {
    const code = value.charCodeAt(index);
    if (code <= 8 || code === 11 || code === 12 || (code >= 14 && code <= 31)) return true;
  }
  return false;
}

function readText(value: unknown, label: string, errors: string[], allowEmpty: boolean): string {
  if (typeof value !== 'string') {
    push(errors, `${label} 必须是字符串。`);
    return '';
  }
  if (hasDisallowedControl(value)) {
    push(errors, `${label} 含有非法控制字符。`);
    return '';
  }
  const trimmed = value.trim();
  if (!allowEmpty && trimmed.length === 0) {
    push(errors, `${label} 不能为空。`);
  }
  return allowEmpty ? value.trim() : trimmed;
}

function readSeconds(value: unknown, label: string, errors: string[], allowZero: boolean): number {
  if (typeof value !== 'number' || !Number.isFinite(value)) {
    push(errors, `${label} 必须是有限数字。`);
    return 0;
  }
  if (value < 0) {
    push(errors, `${label} 不能为负数。`);
    return 0;
  }
  if (!allowZero && value === 0) {
    push(errors, `${label} 必须大于 0。`);
    return 0;
  }
  if (value > MOOC_MAX_SECONDS) {
    push(errors, `${label} 超过 6 小时上限。`);
    return 0;
  }
  return canonSeconds(value);
}

function readId(value: unknown, label: string, errors: string[]): string {
  const text = readText(value, label, errors, false);
  if (text.length > ID_MAX) {
    push(errors, `${label} 超过 ${ID_MAX} 个字符。`);
  }
  if (/\s/.test(text)) {
    push(errors, `${label} 不能包含空白。`);
  }
  return text;
}

function readOptionalId(value: unknown, label: string, errors: string[]): string | undefined {
  if (value === undefined || value === null || value === '') return undefined;
  return readId(value, label, errors);
}

function readCamera(value: unknown, label: string, errors: string[]): MoocCamera {
  if (typeof value !== 'string' || !MOOC_CAMERAS.includes(value as MoocCamera)) {
    push(errors, `${label} 必须是 ppt、pip 或 half。`);
    return 'ppt';
  }
  return value as MoocCamera;
}

function readSlideIndex(value: unknown, label: string, errors: string[]): number {
  if (typeof value !== 'number' || !Number.isInteger(value)) {
    push(errors, `${label} 必须是整数。`);
    return 0;
  }
  if (value < 0) {
    push(errors, `${label} 不能为负数。`);
    return 0;
  }
  return value;
}

function readSide(value: unknown, label: string, errors: string[]): MoocPackagingSide {
  if (!isRecord(value)) {
    push(errors, `${label} 必须是对象。`);
    return { duration: 0, title: '', subtitle: '', sample: false };
  }
  const side: MoocPackagingSide = {
    duration: readSeconds(value.duration, `${label}时长`, errors, true),
    title: readText(value.title, `${label}标题`, errors, true),
    subtitle: readText(value.subtitle, `${label}副标题`, errors, true),
    sample: readBoolean(value.sample, `${label}示例标记`, errors),
  };
  const mediaId = readOptionalId(value.mediaId, `${label}素材`, errors);
  if (mediaId) side.mediaId = mediaId;
  return side;
}

function readSlide(value: unknown, index: number, errors: string[]): MoocSlideAsset {
  if (!isRecord(value)) {
    push(errors, `课件 ${index} 必须是对象。`);
    return { label: '', sample: false };
  }
  const slide: MoocSlideAsset = {
    label: readText(value.label, `课件 ${index} 名称`, errors, true),
    sample: readBoolean(value.sample, `课件 ${index} 示例标记`, errors),
  };
  const mediaId = readOptionalId(value.mediaId, `课件 ${index} 素材`, errors);
  if (mediaId) slide.mediaId = mediaId;
  return slide;
}

function readSample(value: unknown, errors: string[]): MoocSampleFlags {
  if (!isRecord(value)) {
    push(errors, 'sample 必须是对象。');
    return { audio: false, lecturer: false, slides: false, background: false };
  }
  return {
    audio: readBoolean(value.audio, '示例旁白标记', errors),
    lecturer: readBoolean(value.lecturer, '示例讲师标记', errors),
    slides: readBoolean(value.slides, '示例课件标记', errors),
    background: readBoolean(value.background, '示例背景标记', errors),
  };
}

function readCue(value: unknown, index: number, errors: string[]): MoocCue {
  if (!isRecord(value)) {
    push(errors, `字幕块 ${index} 必须是对象。`);
    return { id: `invalid-${index}`, start: 0, end: 0, camera: 'ppt', slide: 0, text: '' };
  }
  return {
    id: readId(value.id, `字幕块 ${index} id`, errors),
    start: readSeconds(value.start, `字幕块 ${index} 开始`, errors, true),
    end: readSeconds(value.end, `字幕块 ${index} 结束`, errors, false),
    camera: readCamera(value.camera, `字幕块 ${index} 机位`, errors),
    slide: readSlideIndex(value.slide, `字幕块 ${index} 课件`, errors),
    text: readText(value.text, `字幕块 ${index} 字幕`, errors, true),
  };
}

/**
 * Atomic validation. On failure the caller must keep the previous document.
 * A successful result is a canonical copy (times rounded to milliseconds).
 */
export function validateMoocSequence(input: unknown): MoocResult<MoocSequenceDocument> {
  const errors: string[] = [];
  if (!isRecord(input)) {
    return { ok: false, errors: ['慕课序列必须是对象。'] };
  }

  if (input.version !== MOOC_SEQUENCE_VERSION) {
    push(errors, `只支持慕课序列版本 ${MOOC_SEQUENCE_VERSION}。`);
  }

  const title = readText(input.title, '课程标题', errors, false);
  const packaging = isRecord(input.packaging) ? input.packaging : null;
  if (!packaging) push(errors, '缺少 packaging。');
  const intro = readSide(packaging?.intro, '片头', errors);
  const outro = readSide(packaging?.outro, '片尾', errors);

  const slidesInput = input.slides;
  const slides: MoocSlideAsset[] = [];
  if (!Array.isArray(slidesInput)) {
    push(errors, 'slides 必须是数组。');
  } else {
    slidesInput.forEach((slide, index) => {
      slides.push(readSlide(slide, index, errors));
    });
  }

  const cuesInput = input.cues;
  const cues: MoocCue[] = [];
  if (!Array.isArray(cuesInput) || cuesInput.length === 0) {
    push(errors, '至少需要一个字幕块。');
  } else {
    cuesInput.forEach((cue, index) => {
      cues.push(readCue(cue, index + 1, errors));
    });
  }

  const seen = new Set<string>();
  for (const cue of cues) {
    if (seen.has(cue.id)) push(errors, `字幕块 id 重复：${cue.id}。`);
    seen.add(cue.id);
    if (cue.end <= cue.start) {
      push(errors, `字幕块 ${cue.id} 的结束时间必须晚于开始时间。`);
    }
    if (cue.start < intro.duration) {
      push(errors, `字幕块 ${cue.id} 与片头重叠。片头结束于 ${intro.duration}s，字幕开始于 ${cue.start}s。`);
    }
    if (slides.length > 0 && cue.slide >= slides.length) {
      push(errors, `字幕块 ${cue.id} 的课件序号 ${cue.slide} 超出课件列表。`);
    }
  }

  const ordered = [...cues].sort((a, b) => a.start - b.start || a.end - b.end);
  for (let index = 0; index < ordered.length; index += 1) {
    const cue = cues[index];
    const sorted = ordered[index];
    if (!cue || !sorted || cue.id !== sorted.id) {
      push(errors, '字幕块必须按开始时间排序，且不能重叠。');
      break;
    }
  }
  for (let index = 1; index < cues.length; index += 1) {
    const previous = cues[index - 1];
    const current = cues[index];
    if (!previous || !current) continue;
    if (current.start < previous.end) {
      push(errors, `字幕块 ${previous.id} 与 ${current.id} 时间重叠。`);
    }
  }

  let audioMediaId: string | undefined;
  let lecturerMediaId: string | undefined;
  let lecturerKind: 'video' | 'image' | undefined;
  let backgroundMediaId: string | undefined;

  if (input.audioMediaId !== undefined) {
    audioMediaId = readOptionalId(input.audioMediaId, '旁白素材', errors);
  }
  if (input.lecturerMediaId !== undefined) {
    lecturerMediaId = readOptionalId(input.lecturerMediaId, '讲师素材', errors);
  }
  if (input.lecturerKind !== undefined && input.lecturerKind !== null) {
    if (input.lecturerKind !== 'video' && input.lecturerKind !== 'image') {
      push(errors, '讲师素材类型必须是 video 或 image。');
    } else {
      lecturerKind = input.lecturerKind;
    }
  }
  if (lecturerMediaId && !lecturerKind) {
    push(errors, '指定了讲师素材时必须标明 video 或 image。');
  }
  if (!lecturerMediaId && lecturerKind) {
    push(errors, '没有讲师素材时不能标明素材类型。');
  }
  if (input.backgroundMediaId !== undefined) {
    backgroundMediaId = readOptionalId(input.backgroundMediaId, '背景素材', errors);
  }

  const sample = readSample(input.sample, errors);
  if (errors.length > 0) return { ok: false, errors };

  const sequence: MoocSequenceDocument = {
    version: MOOC_SEQUENCE_VERSION,
    title,
    packaging: { intro, outro },
    cues,
    slides,
    sample,
  };
  if (audioMediaId) sequence.audioMediaId = audioMediaId;
  if (lecturerMediaId) sequence.lecturerMediaId = lecturerMediaId;
  if (lecturerKind) sequence.lecturerKind = lecturerKind;
  if (backgroundMediaId) sequence.backgroundMediaId = backgroundMediaId;
  return { ok: true, sequence };
}
