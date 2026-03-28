import type { TimelineItem, TimelineTrack } from '@/types/timeline';
import { hasLinkedAudioCompanion } from '@/shared/utils/linked-media';

export interface CompositionOwnedAudioSource {
  itemId: string;
  mediaId: string;
  from: number;
  durationInFrames: number;
  sourceStart: number;
  sourceFps: number;
  speed: number;
}

export interface CompositionClipSummary {
  visualMediaId: string | null;
  audioMediaId: string | null;
  hasOwnedAudio: boolean;
  hasMultipleOwnedAudioSources: boolean;
}

function getVisibleTrackIds(tracks: TimelineTrack[]): Set<string> {
  const hasSoloTracks = tracks.some((track) => track.solo);
  return new Set(
    tracks
      .filter((track) => (hasSoloTracks ? track.solo === true : track.visible !== false))
      .map((track) => track.id)
  );
}

function getOrderedActiveCompositionItems(params: {
  items: TimelineItem[];
  tracks: TimelineTrack[];
}): TimelineItem[] {
  const visibleTrackIds = getVisibleTrackIds(params.tracks);
  const trackOrderMap = new Map(params.tracks.map((track) => [track.id, track.order ?? 0]));
  return params.items
    .filter((item) => visibleTrackIds.has(item.trackId))
    .toSorted((left, right) => {
      const leftOrder = trackOrderMap.get(left.trackId) ?? 0;
      const rightOrder = trackOrderMap.get(right.trackId) ?? 0;
      if (leftOrder !== rightOrder) return leftOrder - rightOrder;
      if (left.from !== right.from) return left.from - right.from;
      return left.id.localeCompare(right.id);
    });
}

export function getCompositionOwnedAudioSources(params: {
  items: TimelineItem[];
  tracks: TimelineTrack[];
  fps: number;
  mediaFpsById?: Record<string, number | undefined>;
}): CompositionOwnedAudioSource[] {
  const orderedItems = getOrderedActiveCompositionItems(params);
  const trackById = new Map(params.tracks.map((track) => [track.id, track]));

  return orderedItems.flatMap((item) => {
    if (!item.mediaId) return [];

    const track = trackById.get(item.trackId);
    if (track?.muted) return [];

    if (item.type === 'audio') {
      return [{
        itemId: item.id,
        mediaId: item.mediaId,
        from: item.from,
        durationInFrames: item.durationInFrames,
        sourceStart: item.sourceStart ?? item.trimStart ?? 0,
        sourceFps: item.sourceFps ?? params.mediaFpsById?.[item.mediaId] ?? params.fps,
        speed: item.speed ?? 1,
      }];
    }

    if (item.type === 'video' && !hasLinkedAudioCompanion(orderedItems, item)) {
      return [{
        itemId: item.id,
        mediaId: item.mediaId,
        from: item.from,
        durationInFrames: item.durationInFrames,
        sourceStart: item.sourceStart ?? item.trimStart ?? item.offset ?? 0,
        sourceFps: item.sourceFps ?? params.mediaFpsById?.[item.mediaId] ?? params.fps,
        speed: item.speed ?? 1,
      }];
    }

    return [];
  });
}

export function summarizeCompositionClipContent(params: {
  items: TimelineItem[];
  tracks: TimelineTrack[];
  fps?: number;
  mediaFpsById?: Record<string, number | undefined>;
}): CompositionClipSummary {
  const orderedItems = getOrderedActiveCompositionItems(params);
  const ownedAudioSources = getCompositionOwnedAudioSources({
    items: params.items,
    tracks: params.tracks,
    fps: params.fps ?? 30,
    mediaFpsById: params.mediaFpsById,
  });

  const visualItem = orderedItems.find(
    (item): item is Extract<TimelineItem, { type: 'video' }> => item.type === 'video' && !!item.mediaId
  ) ?? null;

  return {
    visualMediaId: visualItem?.mediaId ?? null,
    audioMediaId: ownedAudioSources[0]?.mediaId ?? null,
    hasOwnedAudio: ownedAudioSources.length > 0,
    hasMultipleOwnedAudioSources: ownedAudioSources.length > 1,
  };
}
