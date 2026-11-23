import { describe, expect, it } from 'vitest';
import { HOTKEY_OPTIONS } from '@/config/hotkeys';
import { createDemoSequence } from './demo';
import { removeSlide, setCueCamera, withIntroDuration } from './edit';
import { compileMoocSequence, type MoocCompileMedia } from './compile';
import { editorPlayPauseIgnoresTextEntry, isTextEntryTarget } from './keyboard';
import { acceptSrtImport } from './srt';
import { locateAt, packFrameRanges, sequenceEnd } from './time';
import { validateMoocSequence } from './validate';
import { acceptXmlImport, parseMoocXml, serializeMoocXml } from './xml';
import { buildSampleNarration, encodePcm16Wav, peakEnvelope, wavDurationSeconds } from './wav';
import { backgroundTransform } from './layout';

const media = (id: string, kind: MoocCompileMedia['kind'], duration = 0): MoocCompileMedia => ({
  id,
  kind,
  duration,
  width: kind === 'audio' ? 0 : 1920,
  height: kind === 'audio' ? 0 : 1080,
  fps: kind === 'video' ? 30 : 0,
  fileName: `${id}.${kind === 'audio' ? 'wav' : kind === 'video' ? 'mp4' : 'png'}`,
});

describe('cue camera exclusivity', () => {
  it('keeps exactly one camera on the edited cue and leaves the others unchanged', () => {
    const sequence = createDemoSequence();
    const next = setCueCamera(sequence, 'b2', 'half');
    expect(next).not.toBe(sequence);
    expect(next.cues.find((cue) => cue.id === 'b2')?.camera).toBe('half');
    for (const cue of next.cues) {
      expect(['ppt', 'pip', 'half']).toContain(cue.camera);
      expect(Object.keys(cue).filter((key) => key === 'camera')).toHaveLength(1);
    }
    expect(next.cues.filter((cue) => cue.id !== 'b2')).toEqual(
      sequence.cues.filter((cue) => cue.id !== 'b2')
    );
    expect(setCueCamera(sequence, 'missing', 'ppt')).toBe(sequence);
  });

  it('compiles one slide and one subtitle for the frame inside a cue', () => {
    const sequence = createDemoSequence();
    const compiled = compileMoocSequence({
      sequence,
      fps: 30,
      canvasWidth: 1920,
      canvasHeight: 1080,
      mediaById: {},
    });
    const frame = Math.round(10 * 30);
    const activeSlides = compiled.items.filter((item) =>
      item.trackId === 'mooc-track-slides'
      && frame >= item.from
      && frame < item.from + item.durationInFrames
    );
    const activeTitles = compiled.items.filter((item) =>
      item.id.startsWith('mooc-sub-')
      && frame >= item.from
      && frame < item.from + item.durationInFrames
    );
    expect(activeSlides).toHaveLength(1);
    expect(activeTitles).toHaveLength(1);
  });
});

describe('cue boundaries, gaps, and intro offset', () => {
  it('places SRT cues after the intro and preserves the gap', () => {
    const current = createDemoSequence();
    const srt = [
      '1',
      '00:00:00,000 --> 00:00:02,000',
      '第一句',
      '',
      '2',
      '00:00:03,500 --> 00:00:05,000',
      '第二句',
      '',
    ].join('\n');
    const imported = acceptSrtImport(current, srt);
    expect(imported.ok).toBe(true);
    if (!imported.ok) return;
    expect(imported.sequence.cues.map((cue) => [cue.start, cue.end, cue.camera])).toEqual([
      [8, 10, 'ppt'],
      [11.5, 13, 'ppt'],
    ]);
    expect(locateAt(imported.sequence, 1).kind).toBe('intro');
    expect(locateAt(imported.sequence, 9).kind).toBe('cue');
    expect(locateAt(imported.sequence, 10.5)).toEqual({ kind: 'gap', start: 10, end: 11.5 });
    expect(locateAt(imported.sequence, 13.2).kind).toBe('outro');
    expect(sequenceEnd(imported.sequence)).toBe(19);
  });

  it('shifts every cue when the intro duration changes', () => {
    const shifted = withIntroDuration(createDemoSequence(), 10);
    expect(shifted.cues[0]?.start).toBe(10);
    expect(shifted.cues[0]?.end).toBe(17.2);
    expect(shifted.cues[1]?.start).toBe(17.2);
    expect(validateMoocSequence(shifted).ok).toBe(true);
  });

  it('rejects overlapping, reversed, and malformed SRT without changing the sequence', () => {
    const current = createDemoSequence();
    const overlap = acceptSrtImport(current, '1\n00:00:00,000 --> 00:00:02,000\n甲\n\n2\n00:00:01,000 --> 00:00:03,000\n乙\n');
    const reversed = acceptSrtImport(current, '1\n00:00:04,000 --> 00:00:01,000\n甲\n');
    const broken = acceptSrtImport(current, '1\nnot a timestamp\n甲\n');
    expect(overlap.ok).toBe(false);
    expect(reversed.ok).toBe(false);
    expect(broken.ok).toBe(false);
    if (!overlap.ok) expect(overlap.sequence).toBe(current);
    if (!reversed.ok) expect(reversed.sequence).toBe(current);
    if (!broken.ok) expect(broken.sequence).toBe(current);
    expect(current.cues).toHaveLength(8);
  });

  it('expands sub-frame cues so compiled ranges do not overlap', () => {
    const packed = packFrameRanges([
      { id: 'a', start: 0, end: 0.001 },
      { id: 'b', start: 0.001, end: 0.002 },
    ], 30, 0);
    expect(packed.pushed).toBe(true);
    expect(packed.ranges[0]?.from).toBe(0);
    expect(packed.ranges[1]?.from).toBeGreaterThanOrEqual(
      (packed.ranges[0]?.from ?? 0) + (packed.ranges[0]?.duration ?? 0)
    );
  });
});

describe('MOOC XML', () => {
  it('roundtrips title, timing, packaging, cues, and media refs', () => {
    const sequence = createDemoSequence();
    sequence.title = `A & B <C> "Q" 'z'`;
    sequence.audioMediaId = 'audio-1';
    sequence.lecturerMediaId = 'lecturer-1';
    sequence.lecturerKind = 'video';
    sequence.backgroundMediaId = 'bg-1';
    sequence.packaging.intro.mediaId = 'intro-1';
    sequence.slides[0] = { label: '第一张', mediaId: 'slide-&-1', sample: true };
    sequence.cues[0] = { ...sequence.cues[0]!, text: `5 > 3 & 2` };
    const xml = serializeMoocXml(sequence);
    expect(xml).toContain('不是 Final Cut Pro XML');
    expect(xml).toContain('不是 Premiere Pro XMEML');
    expect(xml).toContain('A &amp; B &lt;C&gt; &quot;Q&quot; &apos;z&apos;');
    expect(xml).toContain('5 &gt; 3 &amp; 2');
    expect(xml).toContain('slide-&amp;-1');
    const parsed = parseMoocXml(xml);
    expect(parsed.ok).toBe(true);
    if (!parsed.ok) return;
    expect(parsed.sequence.title).toBe(sequence.title);
    expect(parsed.sequence.cues[0]?.text).toBe(`5 > 3 & 2`);
    expect(parsed.sequence.cues.map((cue) => [cue.start, cue.end, cue.camera, cue.slide])).toEqual(
      sequence.cues.map((cue) => [cue.start, cue.end, cue.camera, cue.slide])
    );
    expect(parsed.sequence.packaging.intro.duration).toBe(8);
    expect(parsed.sequence.packaging.outro.duration).toBe(6);
    expect(parsed.sequence.packaging.intro.mediaId).toBe('intro-1');
    expect(parsed.sequence.audioMediaId).toBe('audio-1');
    expect(parsed.sequence.lecturerMediaId).toBe('lecturer-1');
    expect(parsed.sequence.lecturerKind).toBe('video');
    expect(parsed.sequence.backgroundMediaId).toBe('bg-1');
    expect(parsed.sequence.slides[0]?.mediaId).toBe('slide-&-1');
  });

  it('rejects malformed XML and timing without replacing the previous sequence', () => {
    const current = createDemoSequence();
    const cases = [
      '<mooc>',
      '<sequence></sequence>',
      serializeMoocXml(current).replace('version="1.0"', 'version="9.0"'),
      serializeMoocXml(current).replace('camera="half"', 'camera="wide"'),
      serializeMoocXml(current).replace('start="8.000"', 'start="NaN"'),
      serializeMoocXml(current).replace('start="8.000"', 'start="-1.000"'),
      serializeMoocXml(current).replace('end="15.200"', 'end="8.000"'),
      serializeMoocXml(current).replace('id="b2"', 'id="b1"'),
      serializeMoocXml(current).replace('start="15.200"', 'start="10.000"'),
      serializeMoocXml(current).replace('<mooc ', '<mooc extra="1" '),
    ];
    for (const xml of cases) {
      const result = acceptXmlImport(current, xml);
      expect(result.ok).toBe(false);
      if (!result.ok) expect(result.sequence).toBe(current);
    }
    expect(current.cues[0]?.camera).toBe('half');
  });
});

describe('compiled timeline', () => {
  it('keeps one shared background and one continuous audio clip across cameras', () => {
    const ppt = createDemoSequence();
    ppt.cues = ppt.cues.map((cue) => ({ ...cue, camera: 'ppt' as const }));
    const half = createDemoSequence();
    half.cues = half.cues.map((cue) => ({ ...cue, camera: 'half' as const }));
    const mediaById = {
      'bg-1': media('bg-1', 'image'),
      'audio-1': media('audio-1', 'audio', 66),
      'lecturer-1': media('lecturer-1', 'video', 80),
      'slide-1': media('slide-1', 'image'),
    };
    for (const sequence of [ppt, half]) {
      sequence.backgroundMediaId = 'bg-1';
      sequence.audioMediaId = 'audio-1';
      sequence.lecturerMediaId = 'lecturer-1';
      sequence.lecturerKind = 'video';
      sequence.sample.audio = false;
      sequence.slides = sequence.slides.map((slide) => ({ ...slide, mediaId: 'slide-1', sample: false }));
    }
    const compiledPpt = compileMoocSequence({ sequence: ppt, fps: 30, canvasWidth: 1920, canvasHeight: 1080, mediaById });
    const compiledHalf = compileMoocSequence({ sequence: half, fps: 30, canvasWidth: 1280, canvasHeight: 720, mediaById });
    const bgPpt = compiledPpt.items.filter((item) => item.id === 'mooc-bg-shape' || item.id === 'mooc-bg-image');
    const bgHalf = compiledHalf.items.filter((item) => item.id === 'mooc-bg-shape' || item.id === 'mooc-bg-image');
    expect(bgPpt.map((item) => item.transform)).toEqual([
      backgroundTransform(1920, 1080),
      backgroundTransform(1920, 1080),
    ]);
    expect(bgHalf.map((item) => item.transform)).toEqual([
      backgroundTransform(1280, 720),
      backgroundTransform(1280, 720),
    ]);
    expect(bgPpt[0]?.transform).toEqual(bgPpt[1]?.transform);

    const audio = compiledPpt.items.filter((item) => item.type === 'audio');
    expect(audio).toHaveLength(1);
    expect(audio[0]?.from).toBe(240);
    expect(audio[0]?.id).toBe('mooc-audio');
    const lecturers = compiledPpt.items.filter((item) => item.id === 'mooc-lecturer');
    expect(lecturers).toHaveLength(1);
    expect(lecturers[0]?.from).toBe(240);
    expect(compiledPpt.keyframes.find((entry) => entry.itemId === 'mooc-lecturer')).toBeTruthy();

    const slides = compiledPpt.items
      .filter((item) => item.trackId === 'mooc-track-slides')
      .sort((a, b) => a.from - b.from);
    for (let index = 1; index < slides.length; index += 1) {
      const previous = slides[index - 1];
      const current = slides[index];
      expect(current && previous && current.from).toBeGreaterThanOrEqual(
        (previous?.from ?? 0) + (previous?.durationInFrames ?? 0)
      );
    }
  });

  it('removes a slide without leaving a dangling index', () => {
    const next = removeSlide(createDemoSequence(), 1);
    expect(validateMoocSequence(next).ok).toBe(true);
    expect(next.slides).toHaveLength(3);
    expect(next.cues.find((cue) => cue.id === 'b3')?.slide).toBe(0);
    expect(next.cues.find((cue) => cue.id === 'b4')?.slide).toBe(1);
  });
});

describe('sample audio and keyboard guard', () => {
  it('encodes audible PCM instead of an empty waveform', () => {
    const samples = buildSampleNarration(1, 8000);
    const wav = encodePcm16Wav(samples, 8000);
    expect(String.fromCharCode(...wav.slice(0, 4))).toBe('RIFF');
    expect(wavDurationSeconds(wav)).toBeCloseTo(1, 5);
    const peaks = peakEnvelope(samples, 16);
    expect(Math.max(...peaks)).toBeGreaterThan(0.05);
  });

  it('does not treat text entry as a camera or playback shortcut', () => {
    expect(editorPlayPauseIgnoresTextEntry()).toBe(true);
    expect(HOTKEY_OPTIONS.enableOnFormTags).toBe(false);
    const input = document.createElement('input');
    const area = document.createElement('textarea');
    const div = document.createElement('div');
    div.contentEditable = 'true';
    expect(isTextEntryTarget(input)).toBe(true);
    expect(isTextEntryTarget(area)).toBe(true);
    expect(isTextEntryTarget(div)).toBe(true);
    expect(isTextEntryTarget(document.body)).toBe(false);
  });
});

