/**
 * Transition Actions - FCP-style overlap transition operations.
 *
 * When adding a transition, the right clip physically slides left to overlap
 * the left clip. Both clips have real source content during the overlap.
 * Removing a transition reverses this — the right clip slides back right.
 */

import type {
  Transition,
  TransitionType,
  TransitionPresentation,
  WipeDirection,
  SlideDirection,
  FlipDirection,
} from '@/types/transition';
import type { AudioItem, TimelineItem, VideoItem } from '@/types/timeline';
import { useItemsStore } from '../items-store';
import { useTransitionsStore } from '../transitions-store';
import { useTimelineSettingsStore } from '../timeline-settings-store';
import { canAddTransition } from '../../utils/transition-utils';
import { execute, logger, applyTransitionRepairs } from './shared';
import { getLinkedAudioCompanion } from '@/shared/utils/linked-media';

const AUDIO_FADE_EPSILON = 0.0001;

interface LinkedAudioTransitionPair {
  leftAudio: AudioItem;
  rightAudio: AudioItem;
}

function isSynchronizedLinkedAudio(videoClip: VideoItem, audioClip: AudioItem): boolean {
  return audioClip.from === videoClip.from
    && audioClip.durationInFrames === videoClip.durationInFrames;
}

function getManagedLinkedAudioTransitionPair(
  items: TimelineItem[],
  leftClip: TimelineItem,
  rightClip: TimelineItem,
): LinkedAudioTransitionPair | null {
  if (leftClip.type !== 'video' || rightClip.type !== 'video') {
    return null;
  }

  const leftAudio = getLinkedAudioCompanion(items, leftClip);
  const rightAudio = getLinkedAudioCompanion(items, rightClip);
  if (!leftAudio || !rightAudio) {
    return null;
  }

  if (leftAudio.trackId !== rightAudio.trackId) {
    return null;
  }

  if (!isSynchronizedLinkedAudio(leftClip, leftAudio) || !isSynchronizedLinkedAudio(rightClip, rightAudio)) {
    return null;
  }

  return { leftAudio, rightAudio };
}

function shouldUpdateManagedAudioFade(currentFadeSeconds: number | undefined, expectedFadeSeconds: number): boolean {
  if (currentFadeSeconds === undefined) return true;
  return Math.abs(currentFadeSeconds - expectedFadeSeconds) <= AUDIO_FADE_EPSILON;
}

function syncLinkedAudioTransitionAddition(
  pair: LinkedAudioTransitionPair,
  durationInFrames: number,
  fps: number,
): void {
  const fadeSeconds = durationInFrames / fps;
  const originalRightAudioFrom = pair.rightAudio.from;

  useItemsStore.getState()._updateItem(pair.leftAudio.id, {
    audioFadeOut: fadeSeconds,
  });
  useItemsStore.getState()._updateItem(pair.rightAudio.id, {
    from: pair.rightAudio.from - durationInFrames,
    audioFadeIn: fadeSeconds,
  });
  rippleItemsAfter(pair.rightAudio.id, originalRightAudioFrom, pair.rightAudio.trackId, -durationInFrames);
}

function syncLinkedAudioTransitionDurationChange(params: {
  pair: LinkedAudioTransitionPair;
  oldDurationInFrames: number;
  newDurationInFrames: number;
  fps: number;
}): void {
  const { pair, oldDurationInFrames, newDurationInFrames, fps } = params;
  const delta = newDurationInFrames - oldDurationInFrames;
  const oldFadeSeconds = oldDurationInFrames / fps;
  const newFadeSeconds = newDurationInFrames / fps;
  const originalRightAudioFrom = pair.rightAudio.from;

  const leftAudioUpdates: Partial<AudioItem> = {};
  if (shouldUpdateManagedAudioFade(pair.leftAudio.audioFadeOut, oldFadeSeconds)) {
    leftAudioUpdates.audioFadeOut = newFadeSeconds;
  }
  if (Object.keys(leftAudioUpdates).length > 0) {
    useItemsStore.getState()._updateItem(pair.leftAudio.id, leftAudioUpdates);
  }

  const rightAudioUpdates: Partial<AudioItem> = {
    from: pair.rightAudio.from - delta,
  };
  if (shouldUpdateManagedAudioFade(pair.rightAudio.audioFadeIn, oldFadeSeconds)) {
    rightAudioUpdates.audioFadeIn = newFadeSeconds;
  }
  useItemsStore.getState()._updateItem(pair.rightAudio.id, rightAudioUpdates);
  rippleItemsAfter(pair.rightAudio.id, originalRightAudioFrom, pair.rightAudio.trackId, -delta);
}

function syncLinkedAudioTransitionRemoval(
  pair: LinkedAudioTransitionPair,
  durationInFrames: number,
  fps: number,
): void {
  const fadeSeconds = durationInFrames / fps;
  const originalRightAudioFrom = pair.rightAudio.from;

  const leftAudioUpdates: Partial<AudioItem> = {};
  if (shouldUpdateManagedAudioFade(pair.leftAudio.audioFadeOut, fadeSeconds)) {
    leftAudioUpdates.audioFadeOut = 0;
  }
  if (Object.keys(leftAudioUpdates).length > 0) {
    useItemsStore.getState()._updateItem(pair.leftAudio.id, leftAudioUpdates);
  }

  const rightAudioUpdates: Partial<AudioItem> = {
    from: pair.rightAudio.from + durationInFrames,
  };
  if (shouldUpdateManagedAudioFade(pair.rightAudio.audioFadeIn, fadeSeconds)) {
    rightAudioUpdates.audioFadeIn = 0;
  }
  useItemsStore.getState()._updateItem(pair.rightAudio.id, rightAudioUpdates);
  rippleItemsAfter(pair.rightAudio.id, originalRightAudioFrom, pair.rightAudio.trackId, durationInFrames);
}

/**
 * Ripple items after the given clip on the same track by a delta amount.
 * Only affects items whose `from` is strictly after the right clip's original `from`.
 */
function rippleItemsAfter(
  rightClipId: string,
  rightClipFrom: number,
  trackId: string,
  delta: number
): void {
  const store = useItemsStore.getState();
  const items = store.items;

  for (const item of items) {
    if (item.id === rightClipId) continue;
    if (item.trackId !== trackId) continue;
    if (item.from > rightClipFrom) {
      store._updateItem(item.id, { from: item.from + delta });
    }
  }
}

export function addTransition(
  leftClipId: string,
  rightClipId: string,
  type: TransitionType = 'crossfade',
  durationInFrames?: number,
  presentation?: TransitionPresentation,
  direction?: WipeDirection | SlideDirection | FlipDirection
): boolean {
  return execute('ADD_TRANSITION', () => {
    const items = useItemsStore.getState().items;
    const transitions = useTransitionsStore.getState().transitions;
    const fps = useTimelineSettingsStore.getState().fps;

    // Find the clips
    const leftClip = items.find((i) => i.id === leftClipId);
    const rightClip = items.find((i) => i.id === rightClipId);

    if (!leftClip || !rightClip) {
      logger.warn('[addTransition] Clips not found');
      return false;
    }

    const maxByClipDuration = Math.floor(Math.min(leftClip.durationInFrames, rightClip.durationInFrames) - 1);
    if (maxByClipDuration < 1) {
      logger.warn('[addTransition] Cannot add transition: clips are too short');
      return false;
    }

    // Default duration is 1 second (fps frames), but clamp to what both clips can support.
    const requestedDuration = durationInFrames ?? fps;
    const duration = Math.max(1, Math.min(Math.round(requestedDuration), maxByClipDuration));

    // Validate that transition can be added (includes handle check)
    const validation = canAddTransition(leftClip, rightClip, duration);
    if (!validation.canAdd) {
      logger.warn('[addTransition] Cannot add transition:', validation.reason);
      return false;
    }

    // Check if transition already exists
    const existingTransition = transitions.find(
      (t) => t.leftClipId === leftClipId && t.rightClipId === rightClipId
    );
    if (existingTransition) {
      logger.warn('[addTransition] Transition already exists between these clips');
      return false;
    }

    // FCP-style overlap: slide right clip left by transition duration
    const originalRightFrom = rightClip.from;
    const linkedAudioPair = getManagedLinkedAudioTransitionPair(items, leftClip, rightClip);

    // Update right clip: slide left (sourceStart stays unchanged — the first D
    // source frames become the transition-in region)
    useItemsStore.getState()._updateItem(rightClipId, {
      from: rightClip.from - duration,
    });

    // Ripple all items after right clip on the same track left by duration
    rippleItemsAfter(rightClipId, originalRightFrom, rightClip.trackId, -duration);

    if (linkedAudioPair) {
      syncLinkedAudioTransitionAddition(linkedAudioPair, duration, fps);
    }

    // Create transition record
    useTransitionsStore.getState()._addTransition(
      leftClipId,
      rightClipId,
      leftClip.trackId,
      type,
      duration,
      presentation,
      direction
    );

    // Repair any affected transitions
    applyTransitionRepairs([leftClipId, rightClipId]);

    useTimelineSettingsStore.getState().markDirty();
    return true;
  }, { leftClipId, rightClipId, type });
}

export function updateTransition(
  id: string,
  updates: Partial<Pick<Transition, 'durationInFrames' | 'type' | 'presentation' | 'direction' | 'timing' | 'alignment' | 'bezierPoints' | 'presetId'>>
): void {
  execute('UPDATE_TRANSITION', () => {
    const transitions = useTransitionsStore.getState().transitions;
    const transition = transitions.find((t) => t.id === id);
    if (!transition) return;
    const items = useItemsStore.getState().items;
    const leftClip = items.find((i) => i.id === transition.leftClipId);
    const rightClip = items.find((i) => i.id === transition.rightClipId);
    const linkedAudioPair = leftClip && rightClip
      ? getManagedLinkedAudioTransitionPair(items, leftClip, rightClip)
      : null;

    // If duration is changing, adjust clip overlap
    if (updates.durationInFrames !== undefined && updates.durationInFrames !== transition.durationInFrames) {
      if (rightClip) {
        const oldDuration = transition.durationInFrames;
        const newDuration = updates.durationInFrames;
        const delta = newDuration - oldDuration;

        // Validate constraints when increasing duration
        if (delta > 0) {
          const leftClip = items.find((i) => i.id === transition.leftClipId);
          if (leftClip) {
            // Check clip duration constraint
            const maxByClipDuration = Math.min(leftClip.durationInFrames, rightClip.durationInFrames) - 1;
            if (newDuration > maxByClipDuration) {
              logger.warn('[updateTransition] Duration exceeds clip bounds');
              return;
            }
          }
        }

        const originalRightFrom = rightClip.from;

        // Adjust right clip: slide by delta (sourceStart unchanged)
        useItemsStore.getState()._updateItem(transition.rightClipId, {
          from: rightClip.from - delta,
        });

        // Ripple subsequent items
        rippleItemsAfter(transition.rightClipId, originalRightFrom, rightClip.trackId, -delta);

        if (linkedAudioPair) {
          syncLinkedAudioTransitionDurationChange({
            pair: linkedAudioPair,
            oldDurationInFrames: oldDuration,
            newDurationInFrames: newDuration,
            fps: useTimelineSettingsStore.getState().fps,
          });
        }
      }
    }

    useTransitionsStore.getState()._updateTransition(id, updates);
    useTimelineSettingsStore.getState().markDirty();
  }, { id, updates });
}

export function updateTransitions(
  updates: Array<{
    id: string;
    updates: Partial<Pick<Transition, 'durationInFrames' | 'type' | 'presentation' | 'direction' | 'timing' | 'alignment' | 'bezierPoints' | 'presetId'>>;
  }>
): void {
  if (updates.length === 0) return;
  execute('UPDATE_TRANSITIONS', () => {
    // For batch updates that don't change duration, apply directly
    // Duration changes require individual processing via updateTransition
    const store = useTransitionsStore.getState();
    for (const { id, updates: u } of updates) {
      if (u.durationInFrames !== undefined) {
        // Delegate to single update for proper clip adjustment
        const transitions = store.transitions;
        const transition = transitions.find((t) => t.id === id);
        if (transition && u.durationInFrames !== transition.durationInFrames) {
          // This will be handled in its own execute, but since we're already
          // in an execute block, call the logic directly
          updateTransition(id, u);
          continue;
        }
      }
      store._updateTransition(id, u);
    }
    useTimelineSettingsStore.getState().markDirty();
  }, { updates });
}

export function removeTransition(id: string): void {
  execute('REMOVE_TRANSITION', () => {
    const transitions = useTransitionsStore.getState().transitions;
    const transition = transitions.find((t) => t.id === id);

    if (transition) {
      const items = useItemsStore.getState().items;
      const leftClip = items.find((i) => i.id === transition.leftClipId);
      const rightClip = items.find((i) => i.id === transition.rightClipId);
      const linkedAudioPair = leftClip && rightClip
        ? getManagedLinkedAudioTransitionPair(items, leftClip, rightClip)
        : null;

      if (rightClip) {
        const duration = transition.durationInFrames;
        const originalRightFrom = rightClip.from;

        // Reverse the overlap: slide right clip back right (sourceStart unchanged)
        useItemsStore.getState()._updateItem(transition.rightClipId, {
          from: rightClip.from + duration,
        });

        // Ripple subsequent items back right
        rippleItemsAfter(transition.rightClipId, originalRightFrom, rightClip.trackId, duration);

        if (linkedAudioPair) {
          syncLinkedAudioTransitionRemoval(
            linkedAudioPair,
            duration,
            useTimelineSettingsStore.getState().fps,
          );
        }
      }
    }

    useTransitionsStore.getState()._removeTransition(id);
    useTimelineSettingsStore.getState().markDirty();
  }, { id });
}
