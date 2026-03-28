import type { TimelineTrack } from '@/types/timeline';

/**
 * Build a set of track IDs whose items should contribute snap targets.
 */
export function getVisibleTrackIds(tracks: TimelineTrack[]): Set<string> {
  return new Set(
    tracks
      .filter((track) => !track.isGroup && track.visible !== false)
      .map((track) => track.id)
  );
}

/**
 * Return active timeline lanes without any legacy group headers.
 */
export function resolveEffectiveTrackStates(tracks: TimelineTrack[]): TimelineTrack[] {
  return tracks.filter((track) => !track.isGroup);
}
