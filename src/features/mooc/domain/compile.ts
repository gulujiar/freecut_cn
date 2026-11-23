import type { ItemKeyframes, Keyframe } from '@/types/keyframe';
import type { MoocCamera, MoocSequenceDocument } from '@/types/mooc';
import type {
  AudioItem,
  ImageItem,
  ShapeItem,
  TextItem,
  TimelineItem,
  TimelineTrack,
  VideoItem,
} from '@/types/timeline';
import type { TransformProperties } from '@/types/transform';
import { DEMO_SLIDES } from './demo';
import {
  backgroundTransform,
  lecturerTransform,
  slideTransform,
} from './layout';
import { packFrameRanges, type PackedRange } from './time';

export interface MoocCompileMedia {
  id: string;
  kind: 'video' | 'audio' | 'image';
  duration: number;
  width: number;
  height: number;
  fps: number;
  fileName: string;
}

export interface MoocCompileRequest {
  sequence: MoocSequenceDocument;
  fps: number;
  canvasWidth: number;
  canvasHeight: number;
  mediaById: Record<string, MoocCompileMedia>;
}

export interface MoocCompilation {
  tracks: TimelineTrack[];
  items: TimelineItem[];
  keyframes: ItemKeyframes[];
  warnings: string[];
}

interface VisualBase {
  id: string;
  trackId: string;
  from: number;
  durationInFrames: number;
  label: string;
  transform: TransformProperties;
}

function track(id: string, name: string, order: number, kind: 'video' | 'audio'): TimelineTrack {
  return {
    id,
    name,
    kind,
    height: kind === 'audio' ? 52 : 64,
    locked: false,
    visible: true,
    muted: false,
    solo: false,
    order,
    items: [],
  };
}

function base(fields: VisualBase) {
  return {
    id: fields.id,
    trackId: fields.trackId,
    from: fields.from,
    durationInFrames: Math.max(1, fields.durationInFrames),
    label: fields.label,
    originId: fields.id,
    transform: fields.transform,
  };
}

function textItem(
  fields: VisualBase & {
    text: string;
    fontSize: number;
    color: string;
    backgroundColor?: string;
    fontWeight?: TextItem['fontWeight'];
  }
): TextItem {
  return {
    ...base(fields),
    type: 'text',
    text: fields.text,
    color: fields.color,
    fontSize: fields.fontSize,
    fontWeight: fields.fontWeight ?? 'normal',
    textAlign: 'center',
    verticalAlign: 'middle',
    ...(fields.backgroundColor ? { backgroundColor: fields.backgroundColor } : {}),
  };
}

function shapeItem(fields: VisualBase & { fill: string; radius?: number }): ShapeItem {
  return {
    ...base(fields),
    type: 'shape',
    shapeType: 'rectangle',
    fillColor: fields.fill,
    cornerRadius: fields.radius ?? 0,
  };
}

function sourceSpan(media: MoocCompileMedia, timelineFps: number, timelineFrames: number) {
  const sourceFps = media.fps > 0 ? media.fps : timelineFps;
  const sourceDuration = Math.max(0, Math.round(media.duration * sourceFps));
  const consumed = Math.min(
    sourceDuration,
    Math.max(0, Math.round((timelineFrames * sourceFps) / timelineFps))
  );
  return { sourceFps, sourceDuration, consumed };
}

function imageItem(
  fields: VisualBase & { media: MoocCompileMedia }
): ImageItem {
  return {
    ...base(fields),
    type: 'image',
    mediaId: fields.media.id,
    src: '',
    sourceWidth: fields.media.width || undefined,
    sourceHeight: fields.media.height || undefined,
    sourceStart: 0,
    sourceEnd: fields.durationInFrames,
    sourceDuration: fields.durationInFrames,
    sourceFps: 30,
  };
}

function holdKeyframes(
  itemId: string,
  property: Keyframe['value'] extends number ? 'x' | 'y' | 'width' | 'height' | 'opacity' | 'rotation' | 'cornerRadius' : never,
  points: Array<{ frame: number; value: number }>
): Keyframe[] {
  const sorted = [...points].sort((a, b) => a.frame - b.frame);
  const deduped: Array<{ frame: number; value: number }> = [];
  for (const point of sorted) {
    const last = deduped[deduped.length - 1];
    if (last && last.frame === point.frame) {
      last.value = point.value;
    } else {
      deduped.push({ ...point });
    }
  }
  return deduped.map((point) => ({
    id: `${itemId}-${property}-${point.frame}`,
    frame: point.frame,
    value: point.value,
    easing: 'linear' as const,
  }));
}

interface LayoutSegment {
  from: number;
  to: number;
  camera: MoocCamera | 'hidden';
}

function lecturerLayout(
  camera: MoocCamera | 'hidden',
  width: number,
  height: number
): TransformProperties {
  if (camera === 'half') return lecturerTransform('half', width, height);
  return { ...lecturerTransform('pip', width, height), opacity: camera === 'pip' ? 1 : 0 };
}

export function compileMoocSequence(request: MoocCompileRequest): MoocCompilation {
  const warnings: string[] = [];
  const fps = request.fps > 0 ? request.fps : 30;
  const width = request.canvasWidth > 0 ? request.canvasWidth : 1920;
  const height = request.canvasHeight > 0 ? request.canvasHeight : 1080;
  const sequence = request.sequence;
  const introFrames = Math.round(sequence.packaging.intro.duration * fps);
  const outroFrames = Math.round(sequence.packaging.outro.duration * fps);
  const packed = packFrameRanges(
    sequence.cues.map((cue) => ({ id: cue.id, start: cue.start, end: cue.end })),
    fps,
    introFrames
  );
  if (packed.pushed) {
    warnings.push('有字幕短于一帧或四舍五入后重叠，编译时已拉长到至少一帧并且后移，避免同一轨重叠。');
  }

  const packedById = new Map<string, PackedRange>(packed.ranges.map((range) => [range.id, range]));
  const lastPacked = packed.ranges[packed.ranges.length - 1];
  const lectureEnd = lastPacked ? lastPacked.from + lastPacked.duration : introFrames;
  const totalEnd = lectureEnd + Math.max(0, outroFrames);
  const duration = Math.max(1, totalEnd);
  const bg = backgroundTransform(width, height);

  const tracks: TimelineTrack[] = [
    track('mooc-track-subtitles', '慕课字幕', 0, 'video'),
    track('mooc-track-titles', '慕课标题', 1, 'video'),
    track('mooc-track-lecturer', '慕课讲师', 2, 'video'),
    track('mooc-track-slides', '慕课课件', 3, 'video'),
    track('mooc-track-packaging', '慕课包装', 4, 'video'),
    track('mooc-track-background', '慕课背景', 5, 'video'),
    track('mooc-track-audio', '慕课旁白', 6, 'audio'),
  ];

  const items: TimelineItem[] = [];
  const keyframes: ItemKeyframes[] = [];

  items.push(shapeItem({
    id: 'mooc-bg-shape',
    trackId: 'mooc-track-background',
    from: 0,
    durationInFrames: duration,
    label: '共享背景',
    transform: bg,
    fill: '#e7f0ff',
  }));

  const backgroundMedia = sequence.backgroundMediaId
    ? request.mediaById[sequence.backgroundMediaId]
    : undefined;
  if (backgroundMedia && backgroundMedia.kind === 'image') {
    items.push(imageItem({
      id: 'mooc-bg-image',
      trackId: 'mooc-track-background',
      from: 0,
      durationInFrames: duration,
      label: sequence.sample.background ? '示例背景' : backgroundMedia.fileName,
      transform: bg,
      media: backgroundMedia,
    }));
  } else if (sequence.backgroundMediaId) {
    warnings.push('背景素材不存在或不是图片，预览只用固定的纯色共享背景。');
  } else if (sequence.sample.background) {
    warnings.push('示例背景图还没写入素材库，当前是固定纯色背景，机位切换不会移动它。');
  }

  const addTitles = (
    prefix: string,
    from: number,
    frames: number,
    title: string,
    subtitle: string,
    badge: string | null
  ) => {
    if (frames <= 0) return;
    items.push(textItem({
      id: `${prefix}-title`,
      trackId: 'mooc-track-titles',
      from,
      durationInFrames: frames,
      label: title || '包装标题',
      text: title,
      fontSize: Math.round(height * 0.052),
      color: '#0f172a',
      fontWeight: 'bold',
      transform: { x: 0, y: -height * 0.04, width: width * 0.78, height: height * 0.2, rotation: 0, opacity: 1 },
    }));
    items.push(textItem({
      id: `${prefix}-subtitle`,
      trackId: 'mooc-track-titles',
      from,
      durationInFrames: frames,
      label: '包装副标题',
      text: subtitle,
      fontSize: Math.round(height * 0.02),
      color: '#475569',
      transform: { x: 0, y: height * 0.1, width: width * 0.7, height: height * 0.08, rotation: 0, opacity: 1 },
    }));
    if (badge) {
      items.push(textItem({
        id: `${prefix}-badge`,
        trackId: 'mooc-track-titles',
        from,
        durationInFrames: frames,
        label: badge,
        text: badge,
        fontSize: Math.round(height * 0.02),
        color: '#0f172a',
        backgroundColor: '#fbbf24',
        transform: {
          x: -width / 2 + width * 0.12,
          y: -height / 2 + height * 0.055,
          width: width * 0.2,
          height: height * 0.055,
          rotation: 0,
          opacity: 1,
        },
      }));
    }
  };

  const placePackagingMedia = (
    id: string,
    mediaId: string | undefined,
    from: number,
    frames: number,
    label: string
  ): boolean => {
    if (!mediaId || frames <= 0) return false;
    const media = request.mediaById[mediaId];
    if (!media || (media.kind !== 'image' && media.kind !== 'video')) {
      warnings.push(`${label}素材找不到，改用标题文字。`);
      return false;
    }
    const span = sourceSpan(media, fps, frames);
    if (media.kind === 'image') {
      items.push(imageItem({
        id,
        trackId: 'mooc-track-packaging',
        from,
        durationInFrames: frames,
        label,
        transform: bg,
        media,
      }));
      return true;
    }
    if (span.consumed < 1) {
      warnings.push(`${label}视频没有可用时长，改用标题文字。`);
      return false;
    }
    const video: VideoItem = {
      ...base({
        id,
        trackId: 'mooc-track-packaging',
        from,
        durationInFrames: Math.min(frames, Math.max(1, Math.round(media.duration * fps))),
        label,
        transform: bg,
      }),
      type: 'video',
      mediaId: media.id,
      src: '',
      sourceWidth: media.width || undefined,
      sourceHeight: media.height || undefined,
      sourceStart: 0,
      sourceEnd: span.consumed,
      sourceDuration: span.sourceDuration,
      sourceFps: span.sourceFps,
    };
    items.push(video);
    return true;
  };

  const introHasMedia = placePackagingMedia(
    'mooc-intro-media',
    sequence.packaging.intro.mediaId,
    0,
    introFrames,
    '片头'
  );
  if (!introHasMedia) {
    addTitles(
      'mooc-intro',
      0,
      introFrames,
      sequence.packaging.intro.title,
      sequence.packaging.intro.subtitle,
      sequence.packaging.intro.sample ? '示例片头' : null
    );
  }

  const outroHasMedia = placePackagingMedia(
    'mooc-outro-media',
    sequence.packaging.outro.mediaId,
    lectureEnd,
    outroFrames,
    '片尾'
  );
  if (!outroHasMedia) {
    addTitles(
      'mooc-outro',
      lectureEnd,
      outroFrames,
      sequence.packaging.outro.title,
      sequence.packaging.outro.subtitle,
      sequence.packaging.outro.sample ? '示例片尾' : null
    );
  }

  sequence.cues.forEach((cue, index) => {
    const range = packedById.get(cue.id);
    if (!range) return;
    const slideAsset = sequence.slides[cue.slide];
    const slideMedia = slideAsset?.mediaId ? request.mediaById[slideAsset.mediaId] : undefined;
    const transform = { ...slideTransform(cue.camera, width, height), cornerRadius: 8 };
    if (slideMedia && slideMedia.kind === 'image') {
      items.push(imageItem({
        id: `mooc-slide-${cue.id}`,
        trackId: 'mooc-track-slides',
        from: range.from,
        durationInFrames: range.duration,
        label: slideAsset?.sample ? `示例课件 ${index + 1}` : (slideAsset?.label || slideMedia.fileName),
        transform,
        media: slideMedia,
      }));
    } else {
      const copy = DEMO_SLIDES[cue.slide];
      const fallback = slideAsset?.sample
        ? `示例课件\n${copy?.title ?? slideAsset.label}`
        : `缺少课件图片\n${slideAsset?.label ?? `第 ${cue.slide + 1} 张`}`;
      if (slideAsset?.mediaId && !slideMedia) warnings.push(`字幕 ${cue.id} 的课件素材找不到。`);
      items.push(textItem({
        id: `mooc-slide-${cue.id}`,
        trackId: 'mooc-track-slides',
        from: range.from,
        durationInFrames: range.duration,
        label: fallback.split('\n')[0] || '课件',
        text: copy ? `${copy.title}\n${copy.body}` : fallback,
        fontSize: Math.round(height * 0.04),
        color: '#0f172a',
        backgroundColor: '#ffffff',
        fontWeight: 'bold',
        transform,
      }));
    }

    items.push(textItem({
      id: `mooc-sub-${cue.id}`,
      trackId: 'mooc-track-subtitles',
      from: range.from,
      durationInFrames: range.duration,
      label: `字幕 ${index + 1}`,
      text: cue.text,
      fontSize: Math.round(height * 0.03),
      color: '#f8fafc',
      backgroundColor: '#0f172a',
      transform: {
        x: 0,
        y: height / 2 - height * 0.07,
        width: width * 0.86,
        height: height * 0.09,
        rotation: 0,
        opacity: 1,
      },
    }));
  });

  const segments: LayoutSegment[] = [];
  let cursor = introFrames;
  for (const cue of sequence.cues) {
    const range = packedById.get(cue.id);
    if (!range) continue;
    if (range.from > cursor) segments.push({ from: cursor, to: range.from, camera: 'hidden' });
    segments.push({ from: range.from, to: range.from + range.duration, camera: cue.camera });
    cursor = range.from + range.duration;
  }
  const lectureFrames = Math.max(0, lectureEnd - introFrames);

  const lecturerMedia = sequence.lecturerMediaId
    ? request.mediaById[sequence.lecturerMediaId]
    : undefined;
  const separateAudio = Boolean(sequence.audioMediaId && request.mediaById[sequence.audioMediaId]?.kind === 'audio');

  if (lectureFrames > 0 && lecturerMedia && (lecturerMedia.kind === 'video' || lecturerMedia.kind === 'image')) {
    const span = sourceSpan(lecturerMedia, fps, lectureFrames);
    const useFrames = lecturerMedia.kind === 'image'
      ? lectureFrames
      : Math.min(lectureFrames, Math.max(0, Math.round(lecturerMedia.duration * fps)));
    if (lecturerMedia.kind === 'video' && span.consumed < 1) {
      warnings.push('讲师视频没有可用时长，人像机位改为占位。');
    } else {
      const visible = segments.find((segment) => segment.camera === 'pip' || segment.camera === 'half');
      const initial = lecturerLayout(visible?.camera ?? 'hidden', width, height);
      const itemId = 'mooc-lecturer';
      if (lecturerMedia.kind === 'image') {
        const image: ImageItem = imageItem({
          id: itemId,
          trackId: 'mooc-track-lecturer',
          from: introFrames,
          durationInFrames: useFrames,
          label: sequence.sample.lecturer ? '示例讲师静帧' : lecturerMedia.fileName,
          transform: initial,
          media: lecturerMedia,
        });
        items.push(image);
        if (sequence.sample.lecturer) {
          warnings.push('讲师是示例静帧，不是视频。接入讲师视频后会按字幕时间连续播放。');
        }
      } else {
        const video: VideoItem = {
          ...base({
            id: itemId,
            trackId: 'mooc-track-lecturer',
            from: introFrames,
            durationInFrames: useFrames,
            label: lecturerMedia.fileName,
            transform: initial,
          }),
          type: 'video',
          mediaId: lecturerMedia.id,
          src: '',
          sourceWidth: lecturerMedia.width || undefined,
          sourceHeight: lecturerMedia.height || undefined,
          sourceStart: 0,
          sourceEnd: span.consumed,
          sourceDuration: span.sourceDuration,
          sourceFps: span.sourceFps,
          embeddedAudioMuted: separateAudio,
        };
        items.push(video);
        if (useFrames < lectureFrames) {
          warnings.push('讲师视频短于正文，播完后的人像机位不再有画面。旁白仍按自己的时长连续播放。');
        }
      }

      const properties = ['x', 'y', 'width', 'height', 'opacity'] as const;
      const grouped: ItemKeyframes['properties'] = properties.map((property) => ({
        property,
        keyframes: holdKeyframes(
          itemId,
          property,
          segments.flatMap((segment) => {
            const layout = lecturerLayout(segment.camera, width, height);
            const value = layout[property] ?? (property === 'opacity' ? 1 : 0);
            const start = segment.from - introFrames;
            const endHold = Math.max(start, segment.to - introFrames - 1);
            return endHold === start
              ? [{ frame: start, value }]
              : [{ frame: start, value }, { frame: endHold, value }];
          })
        ),
      }));
      keyframes.push({ itemId, properties: grouped });
    }
  } else if (lectureFrames > 0) {
    warnings.push(sequence.sample.lecturer
      ? '示例讲师图还没写入素材库。人像和半身机位显示占位，不是视频。'
      : '未接入讲师。人像和半身机位只显示占位。');
    const itemId = 'mooc-lecturer-placeholder';
    const initial = lecturerLayout('pip', width, height);
    items.push(shapeItem({
      id: itemId,
      trackId: 'mooc-track-lecturer',
      from: introFrames,
      durationInFrames: lectureFrames,
      label: '讲师占位',
      transform: { ...initial, opacity: 0 },
      fill: '#0f172a',
      radius: 12,
    }));
    items.push(textItem({
      id: 'mooc-lecturer-label',
      trackId: 'mooc-track-lecturer',
      from: introFrames,
      durationInFrames: lectureFrames,
      label: '讲师占位说明',
      text: sequence.sample.lecturer ? '示例讲师\n不是视频' : '未接入讲师',
      fontSize: Math.round(height * 0.02),
      color: '#e2e8f0',
      transform: { ...initial, opacity: 0 },
    }));
    for (const itemId of ['mooc-lecturer-placeholder', 'mooc-lecturer-label']) {
      keyframes.push({
        itemId,
        properties: (['x', 'y', 'width', 'height', 'opacity'] as const).map((property) => ({
          property,
          keyframes: holdKeyframes(
            itemId,
            property,
            segments.flatMap((segment) => {
              const shown = segment.camera === 'pip' || segment.camera === 'half';
              const layout = lecturerLayout(shown ? segment.camera : 'hidden', width, height);
              const value = property === 'opacity'
                ? (shown ? 1 : 0)
                : (layout[property] ?? 0);
              const start = segment.from - introFrames;
              const endHold = Math.max(start, segment.to - introFrames - 1);
              return endHold === start
                ? [{ frame: start, value }]
                : [{ frame: start, value }, { frame: endHold, value }];
            })
          ),
        })),
      });
    }
  }

  const audioMedia = sequence.audioMediaId ? request.mediaById[sequence.audioMediaId] : undefined;
  if (audioMedia && audioMedia.kind === 'audio' && lectureFrames > 0) {
    const available = Math.max(0, Math.round(audioMedia.duration * fps));
    const used = Math.min(lectureFrames, available);
    if (used < 1) {
      warnings.push('旁白素材时长为 0，时间轴上没有可播放的音频。');
    } else {
      const span = sourceSpan(audioMedia, fps, used);
      const audio: AudioItem = {
        id: 'mooc-audio',
        trackId: 'mooc-track-audio',
        from: introFrames,
        durationInFrames: used,
        label: sequence.sample.audio ? '示例旁白' : audioMedia.fileName,
        type: 'audio',
        mediaId: audioMedia.id,
        src: '',
        originId: 'mooc-audio',
        volume: 0,
        sourceStart: 0,
        sourceEnd: span.consumed,
        sourceDuration: span.sourceDuration,
        sourceFps: span.sourceFps,
      };
      items.push(audio);
      if (sequence.sample.audio) {
        warnings.push('旁白是程序生成的示例 PCM，不是真实录音。波形由这段音频解码得到。');
      }
      if (used < lectureFrames) {
        warnings.push('旁白短于正文，后段没有声音。不会用静音素材冒充完整旁白。');
      }
    }
  } else if (lectureFrames > 0 && !separateAudio) {
    warnings.push('未接入旁白。没有可用音轨时不绘制波形。');
  } else if (sequence.audioMediaId && !audioMedia) {
    warnings.push('旁白素材 id 在素材库里找不到。');
  }

  return { tracks, items, keyframes, warnings };
}
