import { create } from 'zustand';
import { createLogger } from '@/shared/logging/logger';
import { updateProject } from '@/infrastructure/storage/indexeddb';
import { registerMoocSequenceReader, takeLoadedMoocSequence } from '@/shared/mooc/sequence-bridge';
import { usePlaybackStore } from '@/shared/state/playback';
import { useSelectionStore } from '@/shared/state/selection';
import type { MoocCamera, MoocSequenceDocument } from '@/types/mooc';
import { createDemoSequence } from '../domain/demo';
import {
  appendSlide,
  removeSlide,
  setCueCamera,
  setCueSlide,
  setCueText,
  withIntroDuration,
  withOutroDuration,
  withPackagingText,
} from '../domain/edit';
import { acceptSrtImport } from '../domain/srt';
import { validateMoocSequence } from '../domain/validate';
import { acceptXmlImport } from '../domain/xml';
import { loadSequenceWaveform, type WaveformView } from '../services/waveform';

const logger = createLogger('MoocSession');

export interface MoocSessionContext {
  projectId: string;
  width: number;
  height: number;
  fps: number;
}

export type MoocMediaRole = 'audio' | 'lecturer' | 'background' | 'intro' | 'outro' | 'slide';

interface MoocCanvas {
  width: number;
  height: number;
  fps: number;
}

interface MoocState {
  active: boolean;
  hydrated: boolean;
  holdPersistence: boolean;
  confirmReplace: boolean;
  busy: boolean;
  projectId: string | null;
  canvas: MoocCanvas;
  sequence: MoocSequenceDocument | null;
  warnings: string[];
  error: string | null;
  importError: string | null;
  waveform: WaveformView | null;
  libraryMedia: Array<{ id: string; fileName: string; mimeType: string }>;
}

interface MoocActions {
  requestEnter: (context: MoocSessionContext) => void;
  confirmEnter: () => void;
  cancelEnter: () => void;
  exit: () => void;
  togglePlay: () => void;
  stop: () => void;
  seek: (seconds: number) => void;
  setCamera: (cueId: string, camera: MoocCamera) => void;
  setCueText: (cueId: string, text: string) => void;
  setCueSlide: (cueId: string, slide: number) => void;
  setTitle: (title: string) => void;
  setIntroDuration: (duration: number) => void;
  setOutroDuration: (duration: number) => void;
  setPackagingText: (side: 'intro' | 'outro', field: 'title' | 'subtitle', value: string) => void;
  clearPackagingMedia: (side: 'intro' | 'outro') => void;
  removeSlideAt: (index: number) => void;
  importXmlText: (xml: string) => void;
  importSrtText: (srt: string) => void;
  importLocalFile: (role: MoocMediaRole, file: File) => void;
  assignLibraryMedia: (role: MoocMediaRole, mediaId: string) => void;
  refreshLibrary: () => Promise<void>;
}

type MoocStore = MoocState & MoocActions;
type SetState = (partial: Partial<MoocState>) => void;
type GetState = () => MoocStore;

let applyGeneration = 0;

function seekToSeconds(seconds: number, fps: number): void {
  const safeFps = fps > 0 ? fps : 30;
  const frame = Math.max(0, Math.round((Number.isFinite(seconds) ? seconds : 0) * safeFps));
  const playback = usePlaybackStore.getState();
  playback.setPreviewFrame(null);
  playback.setDisplayedFrame(null);
  playback.setCurrentFrame(frame);
}

async function refreshWaveform(sequence: MoocSequenceDocument, generation: number): Promise<void> {
  try {
    const waveform = await loadSequenceWaveform(sequence);
    if (generation !== applyGeneration) return;
    useMoocStore.setState({ waveform });
  } catch (error) {
    logger.warn('Waveform decode failed', error);
    if (generation !== applyGeneration) return;
    useMoocStore.setState({
      waveform: {
        peaks: [],
        audioStart: 0,
        audioEnd: 0,
        label: '读取波形失败。这里不画假波形。',
        sample: sequence.sample.audio,
        playable: false,
      },
    });
  }
}

async function commitSequence(
  set: SetState,
  get: GetState,
  sequence: MoocSequenceDocument,
  seekTo?: number
): Promise<void> {
  const validated = validateMoocSequence(sequence);
  if (!validated.ok) {
    set({ importError: validated.errors.join('\n'), busy: false });
    return;
  }

  const generation = ++applyGeneration;
  const previousAudio = get().sequence?.audioMediaId;
  set({
    sequence: validated.sequence,
    importError: null,
    error: null,
    holdPersistence: false,
    hydrated: true,
    active: true,
    busy: true,
    confirmReplace: false,
  });

  try {
    const projectId = get().projectId;
    let prepared = validated.sequence;
    if (projectId) {
      const { ensureSampleAssets } = await import('../services/sample-assets');
      prepared = await ensureSampleAssets(projectId, prepared);
      if (generation !== applyGeneration) return;
      const again = validateMoocSequence(prepared);
      if (!again.ok) throw new Error(again.errors.join('\n'));
      prepared = again.sequence;
      set({ sequence: prepared });
      await updateProject(projectId, { moocSequence: prepared });
    }
    if (generation !== applyGeneration) return;
    const { applySequenceToTimeline } = await import('../services/apply-sequence');
    const warnings = applySequenceToTimeline(prepared, get().canvas);
    useSelectionStore.getState().clearItemSelection();
    if (seekTo !== undefined) seekToSeconds(seekTo, get().canvas.fps);
    if (generation !== applyGeneration) return;
    set({ warnings, busy: false });
    if (prepared.audioMediaId !== previousAudio || !get().waveform) {
      void refreshWaveform(prepared, generation);
    }
  } catch (error) {
    logger.error('Failed to commit MOOC sequence', error);
    if (generation !== applyGeneration) return;
    set({
      busy: false,
      error: error instanceof Error ? error.message : '编译慕课序列失败',
    });
  }
}

function rememberContext(set: SetState, context: MoocSessionContext): void {
  set({
    projectId: context.projectId,
    canvas: { width: context.width, height: context.height, fps: context.fps },
  });
}

function mediaKind(mimeType: string): 'audio' | 'video' | 'image' {
  if (mimeType.startsWith('audio/')) return 'audio';
  if (mimeType.startsWith('video/')) return 'video';
  return 'image';
}

function withLibraryMedia(
  sequence: MoocSequenceDocument,
  role: MoocMediaRole,
  mediaId: string,
  fileName: string,
  kind: 'audio' | 'video' | 'image'
): MoocSequenceDocument {
  if (role === 'audio') {
    if (kind !== 'audio') throw new Error('旁白需要音频文件。');
    return { ...sequence, audioMediaId: mediaId, sample: { ...sequence.sample, audio: false } };
  }
  if (role === 'lecturer') {
    if (kind === 'audio') throw new Error('讲师需要视频或图片。');
    return {
      ...sequence,
      lecturerMediaId: mediaId,
      lecturerKind: kind,
      sample: { ...sequence.sample, lecturer: false },
    };
  }
  if (role === 'background') {
    if (kind !== 'image') throw new Error('共享背景需要图片。');
    return { ...sequence, backgroundMediaId: mediaId, sample: { ...sequence.sample, background: false } };
  }
  if (role === 'slide') {
    if (kind !== 'image') throw new Error('课件需要图片。');
    return appendSlide(sequence, { label: fileName, mediaId, sample: false });
  }
  if (kind === 'audio') throw new Error('片头和片尾需要视频或图片。');
  return {
    ...sequence,
    packaging: {
      ...sequence.packaging,
      [role]: { ...sequence.packaging[role], mediaId, sample: false },
    },
  };
}

export const useMoocStore = create<MoocStore>()((set, get) => ({
  active: false,
  hydrated: false,
  holdPersistence: false,
  confirmReplace: false,
  busy: false,
  projectId: null,
  canvas: { width: 1920, height: 1080, fps: 30 },
  sequence: null,
  warnings: [],
  error: null,
  importError: null,
  waveform: null,
  libraryMedia: [],

  requestEnter: (context) => {
    rememberContext(set, context);
    const sequence = get().sequence;
    if (sequence) {
      const fps = context.fps > 0 ? context.fps : 30;
      const time = usePlaybackStore.getState().currentFrame / fps;
      void commitSequence(set, get, sequence, time);
      return;
    }
    void (async () => {
      const { useItemsStore } = await import('../deps/timeline-contract');
      const foreign = useItemsStore.getState().items.some((item) => !item.id.startsWith('mooc-'));
      if (foreign) {
        set({ confirmReplace: true });
        return;
      }
      void commitSequence(set, get, createDemoSequence(), 0);
    })();
  },

  confirmEnter: () => {
    set({ confirmReplace: false });
    void commitSequence(set, get, createDemoSequence(), 0);
  },

  cancelEnter: () => set({ confirmReplace: false }),

  exit: () => set({ active: false }),

  togglePlay: () => {
    usePlaybackStore.getState().togglePlayPause();
  },

  stop: () => {
    usePlaybackStore.getState().pause();
    seekToSeconds(0, get().canvas.fps);
  },

  seek: (seconds) => seekToSeconds(seconds, get().canvas.fps),

  setCamera: (cueId, camera) => {
    const sequence = get().sequence;
    if (!sequence) return;
    const next = setCueCamera(sequence, cueId, camera);
    const cue = next.cues.find((item) => item.id === cueId);
    const fps = get().canvas.fps > 0 ? get().canvas.fps : 30;
    const time = usePlaybackStore.getState().currentFrame / fps;
    const inside = Boolean(cue && time >= cue.start && time < cue.end);
    const seekTo = !inside && cue ? cue.start + Math.min(0.05, (cue.end - cue.start) / 2) : undefined;
    void commitSequence(set, get, next, seekTo);
  },

  setCueText: (cueId, text) => {
    const sequence = get().sequence;
    if (!sequence) return;
    void commitSequence(set, get, setCueText(sequence, cueId, text));
  },

  setCueSlide: (cueId, slide) => {
    const sequence = get().sequence;
    if (!sequence) return;
    void commitSequence(set, get, setCueSlide(sequence, cueId, slide));
  },

  setTitle: (title) => {
    const sequence = get().sequence;
    if (!sequence) return;
    void commitSequence(set, get, { ...sequence, title });
  },

  setIntroDuration: (duration) => {
    const sequence = get().sequence;
    if (!sequence) return;
    void commitSequence(set, get, withIntroDuration(sequence, duration));
  },

  setOutroDuration: (duration) => {
    const sequence = get().sequence;
    if (!sequence) return;
    void commitSequence(set, get, withOutroDuration(sequence, duration));
  },

  setPackagingText: (side, field, value) => {
    const sequence = get().sequence;
    if (!sequence) return;
    void commitSequence(set, get, withPackagingText(sequence, side, field, value));
  },

  clearPackagingMedia: (side) => {
    const sequence = get().sequence;
    if (!sequence) return;
    const current = sequence.packaging[side];
    void commitSequence(set, get, {
      ...sequence,
      packaging: {
        ...sequence.packaging,
        [side]: {
          duration: current.duration,
          title: current.title,
          subtitle: current.subtitle,
          sample: current.sample,
        },
      },
    });
  },

  removeSlideAt: (index) => {
    const sequence = get().sequence;
    if (!sequence) return;
    void commitSequence(set, get, removeSlide(sequence, index));
  },

  importXmlText: (xml) => {
    const sequence = get().sequence;
    if (!sequence) return;
    const imported = acceptXmlImport(sequence, xml);
    if (!imported.ok) {
      set({ importError: imported.errors.join('\n') });
      return;
    }
    void commitSequence(set, get, imported.sequence, imported.sequence.cues[0]?.start ?? 0);
  },

  importSrtText: (srt) => {
    const sequence = get().sequence;
    if (!sequence) return;
    const imported = acceptSrtImport(sequence, srt);
    if (!imported.ok) {
      set({ importError: imported.errors.join('\n') });
      return;
    }
    void commitSequence(set, get, imported.sequence, imported.sequence.cues[0]?.start ?? 0);
  },

  importLocalFile: (role, file) => {
    const projectId = get().projectId;
    const sequence = get().sequence;
    if (!projectId || !sequence) return;
    set({ busy: true, importError: null });
    void (async () => {
      try {
        const { mediaLibraryService, useMediaLibraryStore } = await import('../deps/media-library-contract');
        const created = await mediaLibraryService.importMediaFromFile(file, projectId);
        await useMediaLibraryStore.getState().loadMediaItems();
        await get().refreshLibrary();
        const next = withLibraryMedia(
          get().sequence ?? sequence,
          role,
          created.id,
          created.fileName,
          mediaKind(created.mimeType)
        );
        await commitSequence(set, get, next);
      } catch (error) {
        set({
          busy: false,
          importError: error instanceof Error ? error.message : '导入素材失败',
        });
      }
    })();
  },

  assignLibraryMedia: (role, mediaId) => {
    const sequence = get().sequence;
    if (!sequence) return;
    void (async () => {
      const { useMediaLibraryStore } = await import('../deps/media-library-contract');
      const media = useMediaLibraryStore.getState().mediaById[mediaId];
      if (!media) {
        set({ importError: '素材库里没有这条素材。' });
        return;
      }
      try {
        const next = withLibraryMedia(sequence, role, media.id, media.fileName, mediaKind(media.mimeType));
        await commitSequence(set, get, next);
      } catch (error) {
        set({ importError: error instanceof Error ? error.message : '无法使用这条素材' });
      }
    })();
  },

  refreshLibrary: async () => {
    const { useMediaLibraryStore } = await import('../deps/media-library-contract');
    const libraryMedia = useMediaLibraryStore.getState().mediaItems.map((item) => ({
      id: item.id,
      fileName: item.fileName,
      mimeType: item.mimeType,
    }));
    set({ libraryMedia });
  },
}));

registerMoocSequenceReader(() => {
  const state = useMoocStore.getState();
  if (!state.hydrated || state.holdPersistence) return undefined;
  return state.sequence;
});

export async function hydrateMoocAfterTimelineLoad(context: MoocSessionContext): Promise<void> {
  rememberContext(useMoocStore.setState, context);
  const taken = takeLoadedMoocSequence();
  if (!taken.present || taken.value == null) {
    useMoocStore.setState({
      hydrated: true,
      sequence: null,
      active: false,
      holdPersistence: false,
      projectId: context.projectId,
      canvas: { width: context.width, height: context.height, fps: context.fps },
    });
    return;
  }

  const validated = validateMoocSequence(taken.value);
  if (!validated.ok) {
    useMoocStore.setState({
      hydrated: true,
      sequence: null,
      active: true,
      holdPersistence: true,
      projectId: context.projectId,
      canvas: { width: context.width, height: context.height, fps: context.fps },
      error: `已保存的慕课序列未通过校验，没有加载，也没有覆盖工程里的原数据。\n${validated.errors.join('\n')}`,
    });
    return;
  }

  await commitSequence(
    useMoocStore.setState,
    useMoocStore.getState,
    validated.sequence,
    validated.sequence.cues[0]?.start ?? 0
  );
}
