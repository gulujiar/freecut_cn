/**
 * Settings & Persistence Actions - Timeline settings and bulk operations.
 */

import type { ItemKeyframes } from '@/types/keyframe';
import type { TimelineItem, TimelineTrack } from '@/types/timeline';
import { useItemsStore } from '../items-store';
import { useTransitionsStore } from '../transitions-store';
import { useKeyframesStore } from '../keyframes-store';
import { useMarkersStore } from '../markers-store';
import { useTimelineSettingsStore } from '../timeline-settings-store';
import { useTimelineCommandStore } from '../timeline-command-store';
import { useCompositionNavigationStore } from '../composition-navigation-store';
import { execute } from './shared';

export function toggleSnap(): void {
  execute('TOGGLE_SNAP', () => {
    useTimelineSettingsStore.getState().toggleSnap();
  });
}

export function setScrollPosition(position: number): void {
  // No undo for scroll position - it's UI state
  useTimelineSettingsStore.getState().setScrollPosition(position);
}

// =============================================================================
// PERSISTENCE ACTIONS (no individual undo - these are bulk operations)
// =============================================================================

export function clearTimeline(): void {
  execute('CLEAR_TIMELINE', () => {
    useItemsStore.getState().setItems([]);
    useItemsStore.getState().setTracks([]);
    useTransitionsStore.getState().setTransitions([]);
    useKeyframesStore.getState().setKeyframes([]);
    useMarkersStore.getState().setMarkers([]);
    useMarkersStore.getState().clearInOutPoints();
    useTimelineSettingsStore.getState().markClean();
  });

  // Clear undo history when clearing timeline
  useTimelineCommandStore.getState().clearHistory();
}

// Mark dirty/clean (no undo)
export function markDirty(): void {
  useTimelineSettingsStore.getState().markDirty();
}

export function markClean(): void {
  useTimelineSettingsStore.getState().markClean();
}

/**
 * Replace the root timeline in one undo step.
 * Used by MOOC mode to compile a sequence into real clips.
 * In/out points are cleared so playback is not clipped to a previous selection.
 */
export function replaceRootTimeline(payload: {
  tracks: TimelineTrack[];
  items: TimelineItem[];
  keyframes: ItemKeyframes[];
}): void {
  execute('REPLACE_ROOT_TIMELINE', () => {
    const navigation = useCompositionNavigationStore.getState();
    if (navigation.activeCompositionId) {
      navigation.resetToRoot();
    }
    useTransitionsStore.getState().setTransitions([]);
    useKeyframesStore.getState().setKeyframes(payload.keyframes);
    useMarkersStore.getState().setInPoint(null);
    useMarkersStore.getState().setOutPoint(null);
    useItemsStore.getState().setTracks(payload.tracks);
    useItemsStore.getState().setItems(payload.items);
    useTimelineSettingsStore.getState().markDirty();
  }, { count: payload.items.length });
}
