import { beforeEach, describe, expect, it } from 'vitest';
import type { AudioItem, TimelineTrack, VideoItem } from '@/types/timeline';
import { useItemsStore } from '../items-store';
import { useTransitionsStore } from '../transitions-store';
import { useKeyframesStore } from '../keyframes-store';
import { useTimelineCommandStore } from '../timeline-command-store';
import { useTimelineSettingsStore } from '../timeline-settings-store';
import { addTransition, removeTransition, updateTransition } from './transition-actions';
import { updateItem } from './item-actions';

function makeTrack(overrides: Partial<TimelineTrack> & Pick<TimelineTrack, 'id' | 'name' | 'order'>): TimelineTrack {
  return {
    height: 80,
    locked: false,
    visible: true,
    muted: false,
    solo: false,
    volume: 0,
    items: [],
    ...overrides,
  };
}

function makeVideoItem(overrides: Partial<VideoItem> = {}): VideoItem {
  return {
    id: 'video-1',
    type: 'video',
    trackId: 'video-track',
    from: 0,
    durationInFrames: 60,
    label: 'clip.mp4',
    src: 'blob:video',
    mediaId: 'media-1',
    linkedGroupId: 'group-1',
    sourceStart: 0,
    sourceEnd: 60,
    sourceDuration: 180,
    sourceFps: 30,
    ...overrides,
  } as VideoItem;
}

function makeAudioItem(overrides: Partial<AudioItem> = {}): AudioItem {
  return {
    id: 'audio-1',
    type: 'audio',
    trackId: 'audio-track',
    from: 0,
    durationInFrames: 60,
    label: 'clip.mp4',
    src: 'blob:audio',
    mediaId: 'media-1',
    linkedGroupId: 'group-1',
    sourceStart: 0,
    sourceEnd: 60,
    sourceDuration: 180,
    sourceFps: 30,
    ...overrides,
  } as AudioItem;
}

describe('transition actions with linked audio companions', () => {
  beforeEach(() => {
    useTimelineCommandStore.getState().clearHistory();
    useTimelineSettingsStore.setState({ fps: 30, isDirty: false });
    useItemsStore.getState().setTracks([
      makeTrack({ id: 'video-track', name: 'V1', order: 0, kind: 'video' }),
      makeTrack({ id: 'audio-track', name: 'A1', order: 1, kind: 'audio' }),
    ]);
    useItemsStore.getState().setItems([]);
    useTransitionsStore.getState().setTransitions([]);
    useKeyframesStore.getState().setKeyframes([]);
  });

  it('adds a matching audio crossfade and keeps linked audio aligned', () => {
    useItemsStore.getState().setItems([
      makeVideoItem({ id: 'video-1', linkedGroupId: 'group-1' }),
      makeAudioItem({ id: 'audio-1', linkedGroupId: 'group-1' }),
      makeVideoItem({ id: 'video-2', from: 60, linkedGroupId: 'group-2', sourceStart: 30, sourceEnd: 90, mediaId: 'media-2' }),
      makeAudioItem({ id: 'audio-2', from: 60, linkedGroupId: 'group-2', sourceStart: 30, sourceEnd: 90, mediaId: 'media-2' }),
      makeAudioItem({ id: 'audio-3', from: 150, linkedGroupId: undefined, mediaId: 'music-bed' }),
    ]);

    const added = addTransition('video-1', 'video-2', 'crossfade', 30);

    expect(added).toBe(true);
    expect(useItemsStore.getState().itemById['video-2']).toMatchObject({ from: 30 });
    expect(useItemsStore.getState().itemById['audio-2']).toMatchObject({ from: 30, audioFadeIn: 1 });
    expect(useItemsStore.getState().itemById['audio-1']).toMatchObject({ audioFadeOut: 1 });
    expect(useItemsStore.getState().itemById['audio-3']).toMatchObject({ from: 120 });
  });

  it('updates matching linked audio fades and timing when transition duration changes', () => {
    useItemsStore.getState().setItems([
      makeVideoItem({ id: 'video-1', linkedGroupId: 'group-1' }),
      makeAudioItem({ id: 'audio-1', linkedGroupId: 'group-1' }),
      makeVideoItem({ id: 'video-2', from: 60, linkedGroupId: 'group-2', sourceStart: 45, sourceEnd: 105, mediaId: 'media-2' }),
      makeAudioItem({ id: 'audio-2', from: 60, linkedGroupId: 'group-2', sourceStart: 45, sourceEnd: 105, mediaId: 'media-2' }),
    ]);
    addTransition('video-1', 'video-2', 'crossfade', 30);
    const transitionId = useTransitionsStore.getState().transitions[0]?.id;

    expect(transitionId).toBeDefined();
    updateTransition(transitionId!, { durationInFrames: 45 });

    expect(useItemsStore.getState().itemById['video-2']).toMatchObject({ from: 15 });
    expect(useItemsStore.getState().itemById['audio-2']).toMatchObject({ from: 15, audioFadeIn: 1.5 });
    expect(useItemsStore.getState().itemById['audio-1']).toMatchObject({ audioFadeOut: 1.5 });
  });

  it('removes matching linked audio fades when removing the transition', () => {
    useItemsStore.getState().setItems([
      makeVideoItem({ id: 'video-1', linkedGroupId: 'group-1' }),
      makeAudioItem({ id: 'audio-1', linkedGroupId: 'group-1' }),
      makeVideoItem({ id: 'video-2', from: 60, linkedGroupId: 'group-2', sourceStart: 30, sourceEnd: 90, mediaId: 'media-2' }),
      makeAudioItem({ id: 'audio-2', from: 60, linkedGroupId: 'group-2', sourceStart: 30, sourceEnd: 90, mediaId: 'media-2' }),
    ]);
    addTransition('video-1', 'video-2', 'crossfade', 30);
    const transitionId = useTransitionsStore.getState().transitions[0]?.id;

    removeTransition(transitionId!);

    expect(useItemsStore.getState().itemById['video-2']).toMatchObject({ from: 60 });
    expect(useItemsStore.getState().itemById['audio-2']).toMatchObject({ from: 60, audioFadeIn: 0 });
    expect(useItemsStore.getState().itemById['audio-1']).toMatchObject({ audioFadeOut: 0 });
    expect(useTransitionsStore.getState().transitions).toEqual([]);
  });

  it('stops auto-overwriting a fade once the user edits it manually', () => {
    useItemsStore.getState().setItems([
      makeVideoItem({ id: 'video-1', linkedGroupId: 'group-1' }),
      makeAudioItem({ id: 'audio-1', linkedGroupId: 'group-1' }),
      makeVideoItem({ id: 'video-2', from: 60, linkedGroupId: 'group-2', sourceStart: 45, sourceEnd: 105, mediaId: 'media-2' }),
      makeAudioItem({ id: 'audio-2', from: 60, linkedGroupId: 'group-2', sourceStart: 45, sourceEnd: 105, mediaId: 'media-2' }),
    ]);
    addTransition('video-1', 'video-2', 'crossfade', 30);
    const transitionId = useTransitionsStore.getState().transitions[0]?.id;

    updateItem('audio-1', { audioFadeOut: 0.25 });
    updateTransition(transitionId!, { durationInFrames: 45 });

    expect(useItemsStore.getState().itemById['audio-1']).toMatchObject({ audioFadeOut: 0.25 });
    expect(useItemsStore.getState().itemById['audio-2']).toMatchObject({ audioFadeIn: 1.5, from: 15 });

    removeTransition(transitionId!);

    expect(useItemsStore.getState().itemById['audio-1']).toMatchObject({ audioFadeOut: 0.25 });
    expect(useItemsStore.getState().itemById['audio-2']).toMatchObject({ audioFadeIn: 0, from: 60 });
  });
});
