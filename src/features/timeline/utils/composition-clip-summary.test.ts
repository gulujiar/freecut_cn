import { describe, expect, it } from 'vitest';
import type { AudioItem, TimelineTrack, VideoItem } from '@/types/timeline';
import { summarizeCompositionClipContent } from './composition-clip-summary';

function makeTrack(overrides: Partial<TimelineTrack> & Pick<TimelineTrack, 'id' | 'order'>): TimelineTrack {
  return {
    name: overrides.id,
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
    trackId: 'v1',
    from: 0,
    durationInFrames: 90,
    src: 'blob:video',
    mediaId: 'media-video',
    label: 'Video',
    ...overrides,
  } as VideoItem;
}

function makeAudioItem(overrides: Partial<AudioItem> = {}): AudioItem {
  return {
    id: 'audio-1',
    type: 'audio',
    trackId: 'a1',
    from: 0,
    durationInFrames: 90,
    src: 'blob:audio',
    mediaId: 'media-audio',
    label: 'Audio',
    ...overrides,
  } as AudioItem;
}

describe('summarizeCompositionClipContent', () => {
  it('uses top video for visuals and linked audio item for owned audio', () => {
    const summary = summarizeCompositionClipContent({
      tracks: [
        makeTrack({ id: 'v1', kind: 'video', order: 0 }),
        makeTrack({ id: 'a1', kind: 'audio', order: 1 }),
      ],
      items: [
        makeVideoItem({ id: 'video-1', trackId: 'v1', mediaId: 'media-video', linkedGroupId: 'group-1' }),
        makeAudioItem({ id: 'audio-1', trackId: 'a1', mediaId: 'media-video', linkedGroupId: 'group-1' }),
      ],
    });

    expect(summary).toEqual({
      visualMediaId: 'media-video',
      audioMediaId: 'media-video',
      hasOwnedAudio: true,
      hasMultipleOwnedAudioSources: false,
    });
  });

  it('treats standalone video as the owned audio source when no paired audio exists', () => {
    const summary = summarizeCompositionClipContent({
      tracks: [makeTrack({ id: 'v1', kind: 'video', order: 0 })],
      items: [makeVideoItem({ id: 'video-standalone', trackId: 'v1', mediaId: 'media-video' })],
    });

    expect(summary.audioMediaId).toBe('media-video');
    expect(summary.hasOwnedAudio).toBe(true);
  });

  it('supports audio-only compound clips', () => {
    const summary = summarizeCompositionClipContent({
      tracks: [makeTrack({ id: 'a1', kind: 'audio', order: 0 })],
      items: [makeAudioItem({ id: 'audio-only', trackId: 'a1', mediaId: 'media-audio' })],
    });

    expect(summary.visualMediaId).toBeNull();
    expect(summary.audioMediaId).toBe('media-audio');
    expect(summary.hasOwnedAudio).toBe(true);
  });

  it('ignores non-visible tracks when a solo track is active', () => {
    const summary = summarizeCompositionClipContent({
      tracks: [
        makeTrack({ id: 'v1', kind: 'video', order: 0, solo: true }),
        makeTrack({ id: 'a1', kind: 'audio', order: 1, solo: false }),
      ],
      items: [
        makeVideoItem({ id: 'video-solo', trackId: 'v1', mediaId: 'media-video' }),
        makeAudioItem({ id: 'audio-muted-by-solo', trackId: 'a1', mediaId: 'media-audio' }),
      ],
    });

    expect(summary.visualMediaId).toBe('media-video');
    expect(summary.audioMediaId).toBe('media-video');
  });
});
