import { beforeEach, describe, expect, it } from 'vitest';
import type { CompositionInputProps } from '@/types/export';
import type { AudioItem, CompositionItem, TimelineTrack, VideoItem } from '@/types/timeline';
import { useCompositionsStore } from '@/features/export/deps/timeline';
import { extractAudioSegments } from './canvas-audio';

function makeTrack(params: {
  id: string;
  order: number;
  kind?: 'video' | 'audio';
  items?: TimelineTrack['items'];
}): TimelineTrack {
  return {
    id: params.id,
    name: params.id,
    kind: params.kind,
    order: params.order,
    height: 80,
    locked: false,
    visible: true,
    muted: false,
    solo: false,
    volume: 0,
    items: params.items ?? [],
  };
}

function makeVideoItem(overrides: Partial<VideoItem> = {}): VideoItem {
  return {
    id: 'video-1',
    type: 'video',
    trackId: 'track-v1',
    from: 0,
    durationInFrames: 90,
    src: 'blob:video',
    mediaId: 'media-1',
    label: 'Video',
    ...overrides,
  } as VideoItem;
}

function makeAudioItem(overrides: Partial<AudioItem> = {}): AudioItem {
  return {
    id: 'audio-1',
    type: 'audio',
    trackId: 'track-a1',
    from: 0,
    durationInFrames: 90,
    src: 'blob:audio',
    mediaId: 'media-1',
    label: 'Audio',
    ...overrides,
  } as AudioItem;
}

describe('extractAudioSegments', () => {
  beforeEach(() => {
    useCompositionsStore.setState({
      compositions: [],
      compositionById: {},
      mediaDependencyIds: [],
      mediaDependencyVersion: 0,
    });
  });

  it('skips root video audio when a linked audio companion exists', () => {
    const video = makeVideoItem({ linkedGroupId: 'group-1' });
    const audio = makeAudioItem({ linkedGroupId: 'group-1' });
    const composition: CompositionInputProps = {
      fps: 30,
      durationInFrames: 90,
      width: 1920,
      height: 1080,
      tracks: [
        makeTrack({ id: 'track-v1', order: 0, kind: 'video', items: [video] }),
        makeTrack({ id: 'track-a1', order: 1, kind: 'audio', items: [audio] }),
      ],
      transitions: [],
      keyframes: [],
    };

    const segments = extractAudioSegments(composition, composition.fps);

    expect(segments).toHaveLength(1);
    expect(segments[0]).toMatchObject({ itemId: 'audio-1', type: 'audio' });
  });

  it('skips precomp video audio when a linked audio companion exists inside the precomp', () => {
    const subVideo = makeVideoItem({ id: 'sub-video', linkedGroupId: 'group-1', trackId: 'sub-v1' });
    const subAudio = makeAudioItem({ id: 'sub-audio', linkedGroupId: 'group-1', trackId: 'sub-a1' });
    const subComp = {
      id: 'sub-comp-1',
      name: 'Compound Clip',
      items: [subVideo, subAudio],
      tracks: [
        makeTrack({ id: 'sub-v1', order: 0, kind: 'video' }),
        makeTrack({ id: 'sub-a1', order: 1, kind: 'audio' }),
      ],
      transitions: [],
      keyframes: [],
      fps: 30,
      width: 1920,
      height: 1080,
      durationInFrames: 90,
    };
    useCompositionsStore.setState({
      compositions: [subComp],
      compositionById: { [subComp.id]: subComp },
      mediaDependencyIds: [],
      mediaDependencyVersion: 0,
    });

    const compositionItem: CompositionItem = {
      id: 'comp-item-1',
      type: 'composition',
      compositionId: subComp.id,
      trackId: 'root-v1',
      from: 0,
      durationInFrames: 90,
      label: 'Compound Clip',
      compositionWidth: 1920,
      compositionHeight: 1080,
      transform: { x: 0, y: 0, rotation: 0, opacity: 1 },
    };

    const composition: CompositionInputProps = {
      fps: 30,
      durationInFrames: 90,
      width: 1920,
      height: 1080,
      tracks: [makeTrack({ id: 'root-v1', order: 0, kind: 'video', items: [compositionItem] })],
      transitions: [],
      keyframes: [],
    };

    const segments = extractAudioSegments(composition, composition.fps);

    expect(segments).toHaveLength(1);
    expect(segments[0]).toMatchObject({ itemId: 'sub-audio', type: 'audio' });
  });
});
