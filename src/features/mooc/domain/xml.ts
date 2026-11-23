import {
  MOOC_SEQUENCE_VERSION,
  type MoocCamera,
  type MoocSequenceDocument,
} from '@/types/mooc';
import { validateMoocSequence, type MoocResult } from './validate';

export type PreservingImport =
  | { ok: true; sequence: MoocSequenceDocument }
  | { ok: false; sequence: MoocSequenceDocument; errors: string[] };

const DECIMAL = /^(?:\d+)(?:\.\d+)?$/;

export function escapeXml(value: string): string {
  return value
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&apos;');
}

function formatSeconds(value: number): string {
  return value.toFixed(3);
}

function attr(name: string, value: string | number | boolean | undefined): string {
  if (value === undefined) return '';
  return ` ${name}="${escapeXml(String(value))}"`;
}

/**
 * FreeCut MOOC Sequence XML 1.0.
 * Not Final Cut Pro XML. Not Premiere Pro XMEML.
 */
export function serializeMoocXml(sequence: MoocSequenceDocument): string {
  const intro = sequence.packaging.intro;
  const outro = sequence.packaging.outro;
  const slides = sequence.slides.map((slide, index) => {
    return `    <slide${attr('index', index)}${attr('label', slide.label)}${attr('mediaRef', slide.mediaId)}${attr('sample', slide.sample)}/>`;
  }).join('\n');
  const cues = sequence.cues.map((cue) => {
    return `    <cue${attr('id', cue.id)}${attr('start', formatSeconds(cue.start))}${attr('end', formatSeconds(cue.end))}${attr('camera', cue.camera)}${attr('slide', cue.slide)}>\n      <subtitle>${escapeXml(cue.text)}</subtitle>\n    </cue>`;
  }).join('\n');

  return `<?xml version="1.0" encoding="UTF-8"?>
<!-- FreeCut 慕课序列 XML ${MOOC_SEQUENCE_VERSION}。不是 Final Cut Pro XML，也不是 Premiere Pro XMEML。 -->
<mooc version="${MOOC_SEQUENCE_VERSION}"${attr('title', sequence.title)}>
  <packaging>
    <intro${attr('duration', formatSeconds(intro.duration))}${attr('title', intro.title)}${attr('subtitle', intro.subtitle)}${attr('mediaRef', intro.mediaId)}${attr('sample', intro.sample)}/>
    <outro${attr('duration', formatSeconds(outro.duration))}${attr('title', outro.title)}${attr('subtitle', outro.subtitle)}${attr('mediaRef', outro.mediaId)}${attr('sample', outro.sample)}/>
  </packaging>
  <assets>
    <audio${attr('mediaRef', sequence.audioMediaId)}${attr('sample', sequence.sample.audio)}/>
    <lecturer${attr('mediaRef', sequence.lecturerMediaId)}${attr('kind', sequence.lecturerKind)}${attr('sample', sequence.sample.lecturer)}/>
    <background${attr('mediaRef', sequence.backgroundMediaId)}${attr('sample', sequence.sample.background)}/>
${slides}
  </assets>
  <sequence>
${cues}
  </sequence>
</mooc>
`;
}

function fail(errors: string[], message: string): { ok: false; errors: string[] } {
  errors.push(message);
  return { ok: false, errors };
}

function childElements(element: Element): Element[] {
  return [...element.children];
}

function requireElement(parent: Element, name: string, errors: string[]): Element | null {
  const matches = childElements(parent).filter((child) => child.tagName === name);
  if (matches.length !== 1) {
    errors.push(`必须有且仅有一个 <${name}>。`);
    return null;
  }
  return matches[0] ?? null;
}

function plainSeconds(raw: string | null, label: string, errors: string[]): number {
  if (raw === null) {
    errors.push(`${label} 缺少。`);
    return 0;
  }
  const text = raw.trim();
  if (text.startsWith('-')) {
    errors.push(`${label} 不能为负数。`);
    return 0;
  }
  if (!DECIMAL.test(text)) {
    errors.push(`${label} 不是有限的十进制秒数。`);
    return 0;
  }
  const value = Number(text);
  if (!Number.isFinite(value)) {
    errors.push(`${label} 不是有限数字。`);
    return 0;
  }
  return value;
}

function requiredAttr(element: Element, name: string, label: string, errors: string[]): string {
  if (!element.hasAttribute(name)) {
    errors.push(`${label} 缺少 ${name}。`);
    return '';
  }
  return element.getAttribute(name) ?? '';
}

function optionalAttr(element: Element, name: string): string | undefined {
  if (!element.hasAttribute(name)) return undefined;
  const value = element.getAttribute(name) ?? '';
  return value.length > 0 ? value : undefined;
}

function booleanAttr(element: Element, name: string, label: string, errors: string[]): boolean {
  if (!element.hasAttribute(name)) return false;
  const value = element.getAttribute(name);
  if (value === 'true') return true;
  if (value === 'false') return false;
  errors.push(`${label} 的 ${name} 只能是 true 或 false。`);
  return false;
}

function rejectUnknownAttrs(element: Element, allowed: string[], errors: string[]): void {
  for (const attribute of [...element.attributes]) {
    if (!allowed.includes(attribute.name)) {
      errors.push(`<${element.tagName}> 含有未支持的属性 ${attribute.name}。`);
    }
  }
}

function rejectUnknownChildren(element: Element, allowed: string[], errors: string[]): void {
  for (const child of childElements(element)) {
    if (!allowed.includes(child.tagName)) {
      errors.push(`<${element.tagName}> 含有未支持的子元素 <${child.tagName}>。`);
    }
  }
}

function sideFrom(element: Element, label: string, errors: string[]): Record<string, unknown> {
  rejectUnknownAttrs(element, ['duration', 'title', 'subtitle', 'mediaRef', 'sample'], errors);
  rejectUnknownChildren(element, [], errors);
  const side: Record<string, unknown> = {
    duration: plainSeconds(element.getAttribute('duration'), `${label}时长`, errors),
    title: requiredAttr(element, 'title', label, errors),
    subtitle: requiredAttr(element, 'subtitle', label, errors),
    sample: booleanAttr(element, 'sample', label, errors),
  };
  const mediaId = optionalAttr(element, 'mediaRef');
  if (mediaId) side.mediaId = mediaId;
  return side;
}

/**
 * Parse and validate. Malformed input returns errors and no sequence,
 * so callers can keep the previous document by reference.
 */
export function parseMoocXml(xml: string): MoocResult<MoocSequenceDocument> {
  const errors: string[] = [];
  if (typeof xml !== 'string' || xml.trim().length === 0) {
    return { ok: false, errors: ['XML 是空的。'] };
  }

  const doc = new DOMParser().parseFromString(xml, 'application/xml');
  if (doc.getElementsByTagName('parsererror').length > 0) {
    return fail(errors, 'XML 无法解析。');
  }

  const root = doc.documentElement;
  if (!root || root.tagName !== 'mooc') {
    return fail(errors, '根元素必须是 <mooc>。');
  }
  rejectUnknownAttrs(root, ['version', 'title'], errors);
  rejectUnknownChildren(root, ['packaging', 'assets', 'sequence'], errors);
  if (root.getAttribute('version') !== MOOC_SEQUENCE_VERSION) {
    errors.push(`只支持 version="${MOOC_SEQUENCE_VERSION}"。`);
  }
  const title = requiredAttr(root, 'title', '课程', errors);

  const packaging = requireElement(root, 'packaging', errors);
  const sequenceEl = requireElement(root, 'sequence', errors);
  const assetsList = childElements(root).filter((child) => child.tagName === 'assets');
  if (assetsList.length > 1) errors.push('只能有一个 <assets>。');
  const assets = assetsList[0] ?? null;

  let intro: Record<string, unknown> = { duration: 0, title: '', subtitle: '', sample: false };
  let outro: Record<string, unknown> = { duration: 0, title: '', subtitle: '', sample: false };
  if (packaging) {
    rejectUnknownChildren(packaging, ['intro', 'outro'], errors);
    const introEl = requireElement(packaging, 'intro', errors);
    const outroEl = requireElement(packaging, 'outro', errors);
    if (introEl) intro = sideFrom(introEl, '片头', errors);
    if (outroEl) outro = sideFrom(outroEl, '片尾', errors);
  }

  const slides: Array<Record<string, unknown>> = [];
  let audioSample = false;
  let lecturerSample = false;
  let backgroundSample = false;
  let audioMediaId: string | undefined;
  let lecturerMediaId: string | undefined;
  let lecturerKind: string | undefined;
  let backgroundMediaId: string | undefined;

  if (assets) {
    rejectUnknownChildren(assets, ['audio', 'lecturer', 'background', 'slide'], errors);
    const audioEls = childElements(assets).filter((child) => child.tagName === 'audio');
    const lecturerEls = childElements(assets).filter((child) => child.tagName === 'lecturer');
    const backgroundEls = childElements(assets).filter((child) => child.tagName === 'background');
    if (audioEls.length > 1) errors.push('只能有一个 <audio>。');
    if (lecturerEls.length > 1) errors.push('只能有一个 <lecturer>。');
    if (backgroundEls.length > 1) errors.push('只能有一个 <background>。');

    const audioEl = audioEls[0];
    if (audioEl) {
      rejectUnknownAttrs(audioEl, ['mediaRef', 'sample'], errors);
      rejectUnknownChildren(audioEl, [], errors);
      audioMediaId = optionalAttr(audioEl, 'mediaRef');
      audioSample = booleanAttr(audioEl, 'sample', '旁白', errors);
    }
    const lecturerEl = lecturerEls[0];
    if (lecturerEl) {
      rejectUnknownAttrs(lecturerEl, ['mediaRef', 'kind', 'sample'], errors);
      rejectUnknownChildren(lecturerEl, [], errors);
      lecturerMediaId = optionalAttr(lecturerEl, 'mediaRef');
      lecturerKind = optionalAttr(lecturerEl, 'kind');
      lecturerSample = booleanAttr(lecturerEl, 'sample', '讲师', errors);
    }
    const backgroundEl = backgroundEls[0];
    if (backgroundEl) {
      rejectUnknownAttrs(backgroundEl, ['mediaRef', 'sample'], errors);
      rejectUnknownChildren(backgroundEl, [], errors);
      backgroundMediaId = optionalAttr(backgroundEl, 'mediaRef');
      backgroundSample = booleanAttr(backgroundEl, 'sample', '背景', errors);
    }

    const slideEls = childElements(assets).filter((child) => child.tagName === 'slide');
    slideEls.forEach((slideEl, index) => {
      rejectUnknownAttrs(slideEl, ['index', 'label', 'mediaRef', 'sample'], errors);
      rejectUnknownChildren(slideEl, [], errors);
      const rawIndex = requiredAttr(slideEl, 'index', `课件 ${index}`, errors);
      if (!/^\d+$/.test(rawIndex) || Number(rawIndex) !== index) {
        errors.push(`课件 index 必须从 0 连续编号，第 ${index} 个写成了 ${rawIndex || '空'}。`);
      }
      const slide: Record<string, unknown> = {
        label: requiredAttr(slideEl, 'label', `课件 ${index}`, errors),
        sample: booleanAttr(slideEl, 'sample', `课件 ${index}`, errors),
      };
      const mediaId = optionalAttr(slideEl, 'mediaRef');
      if (mediaId) slide.mediaId = mediaId;
      slides.push(slide);
    });
  }

  const cues: Array<Record<string, unknown>> = [];
  if (sequenceEl) {
    rejectUnknownChildren(sequenceEl, ['cue'], errors);
    const cueEls = childElements(sequenceEl).filter((child) => child.tagName === 'cue');
    if (cueEls.length === 0) errors.push('sequence 里没有 cue。');
    for (const cueEl of cueEls) {
      rejectUnknownAttrs(cueEl, ['id', 'start', 'end', 'camera', 'slide'], errors);
      rejectUnknownChildren(cueEl, ['subtitle'], errors);
      const subtitles = childElements(cueEl).filter((child) => child.tagName === 'subtitle');
      if (subtitles.length !== 1) {
        errors.push(`字幕块 ${cueEl.getAttribute('id') ?? ''} 必须有且仅有一个 <subtitle>。`);
      }
      const subtitle = subtitles[0];
      if (subtitle && childElements(subtitle).length > 0) {
        errors.push('subtitle 只能包含文本。');
      }
      const slideRaw = requiredAttr(cueEl, 'slide', '字幕块', errors);
      const slide = /^\d+$/.test(slideRaw) ? Number(slideRaw) : Number.NaN;
      if (!Number.isInteger(slide)) errors.push('cue slide 必须是非负整数。');
      const camera = requiredAttr(cueEl, 'camera', '字幕块', errors);
      cues.push({
        id: requiredAttr(cueEl, 'id', '字幕块', errors),
        start: plainSeconds(cueEl.getAttribute('start'), 'cue start', errors),
        end: plainSeconds(cueEl.getAttribute('end'), 'cue end', errors),
        camera: camera as MoocCamera,
        slide,
        text: subtitle?.textContent ?? '',
      });
    }
  }

  if (errors.length > 0) return { ok: false, errors };

  const draft: Record<string, unknown> = {
    version: MOOC_SEQUENCE_VERSION,
    title,
    packaging: { intro, outro },
    cues,
    slides,
    sample: {
      audio: audioSample,
      lecturer: lecturerSample,
      slides: slides.some((slide) => slide.sample === true),
      background: backgroundSample,
    },
  };
  if (audioMediaId) draft.audioMediaId = audioMediaId;
  if (lecturerMediaId) draft.lecturerMediaId = lecturerMediaId;
  if (lecturerKind) draft.lecturerKind = lecturerKind;
  if (backgroundMediaId) draft.backgroundMediaId = backgroundMediaId;

  return validateMoocSequence(draft);
}

export function acceptXmlImport(
  current: MoocSequenceDocument,
  xml: string
): PreservingImport {
  const parsed = parseMoocXml(xml);
  if (!parsed.ok) return { ok: false, sequence: current, errors: parsed.errors };
  return parsed;
}
