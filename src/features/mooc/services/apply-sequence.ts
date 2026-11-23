import type { MediaMetadata } from '@/types/storage';
import type { MoocSequenceDocument } from '@/types/mooc';
import { compileMoocSequence, type MoocCompileMedia } from '../domain/compile';
import { replaceRootTimeline } from '../deps/timeline-contract';
import { useMediaLibraryStore } from '../deps/media-library-contract';

function compileKind(media: MediaMetadata): MoocCompileMedia['kind'] {
  if (media.mimeType.startsWith('audio/')) return 'audio';
  if (media.mimeType.startsWith('video/')) return 'video';
  return 'image';
}

export function mediaLookup(): Record<string, MoocCompileMedia> {
  const lookup: Record<string, MoocCompileMedia> = {};
  for (const media of useMediaLibraryStore.getState().mediaItems) {
    lookup[media.id] = {
      id: media.id,
      kind: compileKind(media),
      duration: media.duration,
      width: media.width,
      height: media.height,
      fps: media.fps,
      fileName: media.fileName,
    };
  }
  return lookup;
}

export function applySequenceToTimeline(
  sequence: MoocSequenceDocument,
  canvas: { width: number; height: number; fps: number }
): string[] {
  const compiled = compileMoocSequence({
    sequence,
    fps: canvas.fps > 0 ? canvas.fps : 30,
    canvasWidth: canvas.width > 0 ? canvas.width : 1920,
    canvasHeight: canvas.height > 0 ? canvas.height : 1080,
    mediaById: mediaLookup(),
  });
  replaceRootTimeline({
    tracks: compiled.tracks,
    items: compiled.items,
    keyframes: compiled.keyframes,
  });
  return compiled.warnings;
}
