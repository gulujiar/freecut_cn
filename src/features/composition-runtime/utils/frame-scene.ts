import type { ItemKeyframes } from '@/types/keyframe';
import type { ShapeItem, TimelineItem } from '@/types/timeline';
import type { CanvasSettings, ResolvedTransform } from '@/types/transform';
import type { CompositionRenderPlan } from './scene-assembly';
import type { ShapeMaskWithTrackOrder } from './scene-assembly';
import {
  resolveTransform,
  getSourceDimensions,
} from './transform-resolver';
import {
  applyPreviewPathVerticesToShape,
  type PreviewPathVerticesOverride,
} from './preview-path-override';
import { expandTextTransformToFitContent } from './text-layout';
import {
  resolveAnimatedTransform,
  hasKeyframeAnimation,
} from '../deps/keyframes';
import {
  resolveTransitionFrameState,
  type TransitionFrameState,
} from './transition-scene';

export type TransformOverride = Partial<ResolvedTransform> | undefined;

export interface ResolvedShapeMask {
  shape: ShapeItem;
  transform: ResolvedTransform;
  trackOrder: number;
}

export interface FrameCompositionScene<TItem extends TimelineItem = TimelineItem> {
  frame: number;
  activeShapeMasks: ResolvedShapeMask[];
  transitionFrameState: TransitionFrameState<TItem>;
}

export function applyTransformOverride(
  baseTransform: ResolvedTransform,
  override?: TransformOverride,
): ResolvedTransform {
  if (!override) return baseTransform;

  return {
    ...baseTransform,
    ...override,
    opacity: override.opacity ?? baseTransform.opacity,
    cornerRadius: override.cornerRadius ?? baseTransform.cornerRadius,
  };
}

export function resolveItemTransformAtRelativeFrame(
  item: TimelineItem,
  {
    canvas,
    relativeFrame,
    keyframes,
    previewTransform,
  }: {
    canvas: CanvasSettings;
    relativeFrame: number;
    keyframes?: ItemKeyframes;
    previewTransform?: TransformOverride;
  }
): ResolvedTransform {
  const baseResolved = resolveTransform(item, canvas, getSourceDimensions(item));
  const animatedResolved = keyframes && hasKeyframeAnimation(keyframes)
    ? resolveAnimatedTransform(baseResolved, keyframes, relativeFrame)
    : baseResolved;

  const resolved = applyTransformOverride(animatedResolved, previewTransform);

  return item.type === 'text'
    ? expandTextTransformToFitContent(item, resolved)
    : resolved;
}

export function resolveItemTransformAtFrame(
  item: TimelineItem,
  {
    canvas,
    frame,
    keyframes,
    previewTransform,
  }: {
    canvas: CanvasSettings;
    frame: number;
    keyframes?: ItemKeyframes;
    previewTransform?: TransformOverride;
  }
): ResolvedTransform {
  return resolveItemTransformAtRelativeFrame(item, {
    canvas,
    relativeFrame: frame - item.from,
    keyframes,
    previewTransform,
  });
}

export function resolveActiveShapeMasksAtFrame(
  masks: Array<ShapeItem | ShapeMaskWithTrackOrder>,
  {
    canvas,
    frame,
    getKeyframes,
    getPreviewTransform,
    getPreviewPathVertices,
  }: {
    canvas: CanvasSettings;
    frame: number;
    getKeyframes?: (itemId: string) => ItemKeyframes | undefined;
    getPreviewTransform?: (itemId: string) => TransformOverride;
    getPreviewPathVertices?: PreviewPathVerticesOverride;
  }
): ResolvedShapeMask[] {
  if (masks.length === 0) return [];

  return masks
    .map((maskSource) => (
      'mask' in maskSource
        ? maskSource
        : { mask: maskSource, trackOrder: 0 }
    ))
    .filter(({ mask }) => {
      const start = mask.from;
      const end = mask.from + mask.durationInFrames;
      return frame >= start && frame < end;
    })
    .map(({ mask, trackOrder }) => {
      const shape = applyPreviewPathVerticesToShape(mask, getPreviewPathVertices);

      return {
        shape,
        trackOrder,
        transform: resolveItemTransformAtFrame(shape, {
        canvas,
        frame,
          keyframes: getKeyframes?.(mask.id),
          previewTransform: getPreviewTransform?.(mask.id),
        }),
      };
    });
}

export function resolveFrameCompositionScene({
  renderPlan,
  frame,
  canvas,
  getKeyframes,
  getPreviewTransform,
  getPreviewPathVertices,
}: {
  renderPlan: CompositionRenderPlan;
  frame: number;
  canvas: CanvasSettings;
  getKeyframes?: (itemId: string) => ItemKeyframes | undefined;
  getPreviewTransform?: (itemId: string) => TransformOverride;
  getPreviewPathVertices?: PreviewPathVerticesOverride;
}): FrameCompositionScene {
  return {
    frame,
    activeShapeMasks: resolveActiveShapeMasksAtFrame(renderPlan.visibleShapeMasks, {
      canvas,
      frame,
      getKeyframes,
      getPreviewTransform,
      getPreviewPathVertices,
    }),
    transitionFrameState: resolveTransitionFrameState({
      transitionWindows: renderPlan.transitionWindows,
      frame,
    }),
  };
}

/**
 * Cached version of resolveFrameCompositionScene.
 * Returns the cached result when called with the same frame number consecutively
 * (common during playback where the same frame renders at multiple vsyncs).
 */
let _cachedScene: FrameCompositionScene | null = null;
let _cachedSceneFrame = -1;

export function resolveFrameCompositionSceneCached(
  params: Parameters<typeof resolveFrameCompositionScene>[0],
): FrameCompositionScene {
  if (_cachedScene && _cachedSceneFrame === params.frame) {
    return _cachedScene;
  }
  _cachedSceneFrame = params.frame;
  _cachedScene = resolveFrameCompositionScene(params);
  return _cachedScene;
}

/** Invalidate the cached scene (call when composition structure changes). */
export function invalidateFrameSceneCache(): void {
  _cachedScene = null;
  _cachedSceneFrame = -1;
}
