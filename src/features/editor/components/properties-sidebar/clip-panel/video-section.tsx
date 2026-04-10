import { useCallback, useMemo } from 'react';
import { useTranslation } from 'react-i18next';
import { Crop, RotateCcw, Video } from 'lucide-react';
import { Button } from '@/components/ui/button';
import type { TimelineItem, VideoItem, AudioItem } from '@/types/timeline';
import { useTimelineStore } from '@/features/editor/deps/timeline-store';
import { useGizmoStore } from '@/features/editor/deps/preview';
import type { TimelineState, TimelineActions } from '@/features/editor/deps/timeline-store';
import { timelineToSourceFrames, sourceToTimelineFrames } from '@/features/editor/deps/timeline-utils';
import {
  PropertySection,
  PropertyRow,
  SliderInput,
} from '../components';
import { getMixedValue } from '../utils';
import {
  cropPixelsToRatio,
  cropSignedPixelsToRatio,
  cropSignedRatioToPixels,
  cropRatioToPixels,
  getCropSoftnessReferenceDimension,
  normalizeCropSettings,
} from '@/shared/utils/media-crop';

const MIN_SPEED = 0.1;
const MAX_SPEED = 10.0;
const CROP_STEP = 0.1;
const CROP_TOLERANCE = 0.01;

interface VideoSectionProps {
  items: TimelineItem[];
}

type CropEdge = 'left' | 'right' | 'top' | 'bottom';

function getSourceWidth(item: VideoItem): number {
  return Math.max(1, item.sourceWidth ?? item.transform?.width ?? 1920);
}

function getSourceHeight(item: VideoItem): number {
  return Math.max(1, item.sourceHeight ?? item.transform?.height ?? 1080);
}

function getCropPixels(item: VideoItem, edge: CropEdge): number {
  const dimension = edge === 'left' || edge === 'right'
    ? getSourceWidth(item)
    : getSourceHeight(item);
  return cropRatioToPixels(item.crop?.[edge], dimension);
}

function getCropSoftnessDimension(item: VideoItem): number {
  return Math.max(1, getCropSoftnessReferenceDimension(getSourceWidth(item), getSourceHeight(item)));
}

function getCropSoftnessPixels(item: VideoItem): number {
  return cropSignedRatioToPixels(item.crop?.softness, getCropSoftnessDimension(item));
}

function buildCropUpdate(item: VideoItem, edge: CropEdge, pixels: number) {
  const dimension = edge === 'left' || edge === 'right'
    ? getSourceWidth(item)
    : getSourceHeight(item);
  return normalizeCropSettings({
    ...item.crop,
    [edge]: cropPixelsToRatio(pixels, dimension),
  });
}

function buildCropSoftnessUpdate(item: VideoItem, pixels: number) {
  return normalizeCropSettings({
    ...item.crop,
    softness: cropSignedPixelsToRatio(pixels, getCropSoftnessDimension(item)),
  });
}

function formatCropValue(value: number): string {
  return value.toFixed(3);
}

export function VideoSection({ items }: VideoSectionProps) {
  const { t } = useTranslation();
  const rateStretchItem = useTimelineStore((s: TimelineState & TimelineActions) => s.rateStretchItem);
  const updateItem = useTimelineStore((s: TimelineState & TimelineActions) => s.updateItem);

  const setPropertiesPreviewNew = useGizmoStore((s) => s.setPropertiesPreviewNew);
  const clearPreview = useGizmoStore((s) => s.clearPreview);

  const videoItems = useMemo(
    () => items.filter((item): item is VideoItem => item.type === 'video'),
    [items]
  );

  const itemIds = useMemo(() => videoItems.map((item) => item.id), [videoItems]);

  const rateStretchableIds = useMemo(
    () => items
      .filter((item): item is VideoItem | AudioItem => item.type === 'video' || item.type === 'audio')
      .map((item) => item.id),
    [items]
  );

  const speed = getMixedValue(videoItems, (item) => item.speed, 1);
  const fadeIn = getMixedValue(videoItems, (item) => item.fadeIn, 0);
  const fadeOut = getMixedValue(videoItems, (item) => item.fadeOut, 0);
  const cropLeft = getMixedValue(videoItems, (item) => getCropPixels(item, 'left'), 0);
  const cropRight = getMixedValue(videoItems, (item) => getCropPixels(item, 'right'), 0);
  const cropTop = getMixedValue(videoItems, (item) => getCropPixels(item, 'top'), 0);
  const cropBottom = getMixedValue(videoItems, (item) => getCropPixels(item, 'bottom'), 0);
  const cropSoftness = getMixedValue(videoItems, getCropSoftnessPixels, 0);

  const maxSourceWidth = useMemo(
    () => Math.max(1, ...videoItems.map(getSourceWidth)),
    [videoItems]
  );
  const maxSourceHeight = useMemo(
    () => Math.max(1, ...videoItems.map(getSourceHeight)),
    [videoItems]
  );
  const maxCropSoftness = useMemo(
    () => Math.max(1, ...videoItems.map(getCropSoftnessDimension)),
    [videoItems]
  );

  const handleSpeedChange = useCallback(
    (newSpeed: number) => {
      const roundedSpeed = Math.round(newSpeed * 100) / 100;
      const clampedSpeed = Math.max(MIN_SPEED, Math.min(MAX_SPEED, roundedSpeed));

      const { items: currentItems, fps } = useTimelineStore.getState();
      currentItems
        .filter((item: TimelineItem): item is VideoItem | AudioItem =>
          (item.type === 'video' || item.type === 'audio') && rateStretchableIds.includes(item.id))
        .forEach((item: VideoItem | AudioItem) => {
          const currentSpeed = item.speed || 1;
          const sourceFps = item.sourceFps ?? fps;
          const effectiveSourceFrames =
            item.sourceEnd !== undefined && item.sourceStart !== undefined
              ? item.sourceEnd - item.sourceStart
              : timelineToSourceFrames(item.durationInFrames, currentSpeed, fps, sourceFps);
          const newDuration = Math.max(1, sourceToTimelineFrames(effectiveSourceFrames, clampedSpeed, sourceFps, fps));
          rateStretchItem(item.id, item.from, newDuration, clampedSpeed);
        });
    },
    [rateStretchableIds, rateStretchItem]
  );

  const commitPreviewClear = useCallback(() => {
    queueMicrotask(() => clearPreview());
  }, [clearPreview]);

  const handleFadeInLiveChange = useCallback(
    (value: number) => {
      const previews: Record<string, { fadeIn: number }> = {};
      itemIds.forEach((id) => {
        previews[id] = { fadeIn: value };
      });
      setPropertiesPreviewNew(previews);
    },
    [itemIds, setPropertiesPreviewNew]
  );

  const handleFadeInChange = useCallback(
    (value: number) => {
      itemIds.forEach((id) => updateItem(id, { fadeIn: value }));
      commitPreviewClear();
    },
    [itemIds, updateItem, commitPreviewClear]
  );

  const handleFadeOutLiveChange = useCallback(
    (value: number) => {
      const previews: Record<string, { fadeOut: number }> = {};
      itemIds.forEach((id) => {
        previews[id] = { fadeOut: value };
      });
      setPropertiesPreviewNew(previews);
    },
    [itemIds, setPropertiesPreviewNew]
  );

  const handleFadeOutChange = useCallback(
    (value: number) => {
      itemIds.forEach((id) => updateItem(id, { fadeOut: value }));
      commitPreviewClear();
    },
    [itemIds, updateItem, commitPreviewClear]
  );

  const previewCropEdge = useCallback(
    (edge: CropEdge, pixels: number) => {
      const previews: Record<string, { crop: VideoItem['crop'] }> = {};
      videoItems.forEach((item) => {
        previews[item.id] = {
          crop: buildCropUpdate(item, edge, pixels),
        };
      });
      setPropertiesPreviewNew(previews);
    },
    [setPropertiesPreviewNew, videoItems]
  );

  const commitCropEdge = useCallback(
    (edge: CropEdge, pixels: number) => {
      videoItems.forEach((item) => {
        updateItem(item.id, {
          crop: buildCropUpdate(item, edge, pixels),
        });
      });
      commitPreviewClear();
    },
    [videoItems, updateItem, commitPreviewClear]
  );

  const previewCropSoftness = useCallback(
    (pixels: number) => {
      const previews: Record<string, { crop: VideoItem['crop'] }> = {};
      videoItems.forEach((item) => {
        previews[item.id] = {
          crop: buildCropSoftnessUpdate(item, pixels),
        };
      });
      setPropertiesPreviewNew(previews);
    },
    [setPropertiesPreviewNew, videoItems]
  );

  const commitCropSoftness = useCallback(
    (pixels: number) => {
      videoItems.forEach((item) => {
        updateItem(item.id, {
          crop: buildCropSoftnessUpdate(item, pixels),
        });
      });
      commitPreviewClear();
    },
    [videoItems, updateItem, commitPreviewClear]
  );

  const resetCropEdge = useCallback(
    (edge: CropEdge) => {
      const needsUpdate = videoItems.some((item) => getCropPixels(item, edge) > CROP_TOLERANCE);
      if (!needsUpdate) return;

      videoItems.forEach((item) => {
        updateItem(item.id, {
          crop: normalizeCropSettings({
            ...item.crop,
            [edge]: 0,
          }),
        });
      });
    },
    [updateItem, videoItems]
  );

  const resetCropSoftness = useCallback(() => {
      const needsUpdate = videoItems.some((item) => Math.abs(getCropSoftnessPixels(item)) > CROP_TOLERANCE);
      if (!needsUpdate) return;

      videoItems.forEach((item) => {
        updateItem(item.id, {
          crop: normalizeCropSettings({
            ...item.crop,
            softness: 0,
          }),
        });
      });
    },
    [updateItem, videoItems]
  );

  const resetSpeedWithRipple = useTimelineStore((s: TimelineState & TimelineActions) => s.resetSpeedWithRipple);
  const handleResetSpeed = useCallback(() => {
    resetSpeedWithRipple(rateStretchableIds);
  }, [rateStretchableIds, resetSpeedWithRipple]);

  const handleResetFadeIn = useCallback(() => {
    const tolerance = 0.01;
    const currentItems = useTimelineStore.getState().items;
    const needsUpdate = currentItems.some(
      (item: TimelineItem) => itemIds.includes(item.id) && ((item as VideoItem).fadeIn ?? 0) > tolerance
    );
    if (needsUpdate) {
      itemIds.forEach((id) => updateItem(id, { fadeIn: 0 }));
    }
  }, [itemIds, updateItem]);

  const handleResetFadeOut = useCallback(() => {
    const tolerance = 0.01;
    const currentItems = useTimelineStore.getState().items;
    const needsUpdate = currentItems.some(
      (item: TimelineItem) => itemIds.includes(item.id) && ((item as VideoItem).fadeOut ?? 0) > tolerance
    );
    if (needsUpdate) {
      itemIds.forEach((id) => updateItem(id, { fadeOut: 0 }));
    }
  }, [itemIds, updateItem]);

  if (videoItems.length === 0) return null;

  return (
    <>
      <PropertySection title={t('properties.playback')} icon={Video} defaultOpen={true}>
        <PropertyRow label={t('properties.speed')}>
          <div className="flex items-center gap-1 w-full">
            <SliderInput
              value={speed}
              onChange={handleSpeedChange}
              min={MIN_SPEED}
              max={MAX_SPEED}
              step={0.01}
              unit="x"
              className="flex-1 min-w-0"
            />
            <Button
              variant="ghost"
              size="icon"
              className="h-7 w-7 flex-shrink-0"
              onClick={handleResetSpeed}
              title={t('properties.resetTo1x')}
            >
              <RotateCcw className="w-3.5 h-3.5" />
            </Button>
          </div>
        </PropertyRow>

        <PropertyRow label={t('properties.fadeIn')}>
          <div className="flex items-center gap-1 w-full">
            <SliderInput
              value={fadeIn}
              onChange={handleFadeInChange}
              onLiveChange={handleFadeInLiveChange}
              min={0}
              max={5}
              step={0.1}
              unit="s"
              className="flex-1 min-w-0"
            />
            <Button
              variant="ghost"
              size="icon"
              className="h-7 w-7 flex-shrink-0"
              onClick={handleResetFadeIn}
              title={t('properties.resetTo0')}
            >
              <RotateCcw className="w-3.5 h-3.5" />
            </Button>
          </div>
        </PropertyRow>

        <PropertyRow label={t('properties.fadeOut')}>
          <div className="flex items-center gap-1 w-full">
            <SliderInput
              value={fadeOut}
              onChange={handleFadeOutChange}
              onLiveChange={handleFadeOutLiveChange}
              min={0}
              max={5}
              step={0.1}
              unit="s"
              className="flex-1 min-w-0"
            />
            <Button
              variant="ghost"
              size="icon"
              className="h-7 w-7 flex-shrink-0"
              onClick={handleResetFadeOut}
              title={t('properties.resetTo0')}
            >
              <RotateCcw className="w-3.5 h-3.5" />
            </Button>
          </div>
        </PropertyRow>
      </PropertySection>

      <PropertySection title={t('properties.cropping')} icon={Crop} defaultOpen={true}>
        <PropertyRow label={t('properties.left')}>
          <div className="flex items-center gap-1 w-full">
            <SliderInput
              value={cropLeft}
              onChange={(value) => commitCropEdge('left', value)}
              onLiveChange={(value) => previewCropEdge('left', value)}
              min={0}
              max={maxSourceWidth}
              step={CROP_STEP}
              unit="px"
              formatValue={formatCropValue}
              formatInputValue={formatCropValue}
              className="flex-1 min-w-0"
            />
            <Button
              variant="ghost"
              size="icon"
              className="h-7 w-7 flex-shrink-0"
              onClick={() => resetCropEdge('left')}
              title={t('properties.resetLeftCrop')}
            >
              <RotateCcw className="w-3.5 h-3.5" />
            </Button>
          </div>
        </PropertyRow>

        <PropertyRow label={t('properties.right')}>
          <div className="flex items-center gap-1 w-full">
            <SliderInput
              value={cropRight}
              onChange={(value) => commitCropEdge('right', value)}
              onLiveChange={(value) => previewCropEdge('right', value)}
              min={0}
              max={maxSourceWidth}
              step={CROP_STEP}
              unit="px"
              formatValue={formatCropValue}
              formatInputValue={formatCropValue}
              className="flex-1 min-w-0"
            />
            <Button
              variant="ghost"
              size="icon"
              className="h-7 w-7 flex-shrink-0"
              onClick={() => resetCropEdge('right')}
              title={t('properties.resetRightCrop')}
            >
              <RotateCcw className="w-3.5 h-3.5" />
            </Button>
          </div>
        </PropertyRow>

        <PropertyRow label={t('properties.top')}>
          <div className="flex items-center gap-1 w-full">
            <SliderInput
              value={cropTop}
              onChange={(value) => commitCropEdge('top', value)}
              onLiveChange={(value) => previewCropEdge('top', value)}
              min={0}
              max={maxSourceHeight}
              step={CROP_STEP}
              unit="px"
              formatValue={formatCropValue}
              formatInputValue={formatCropValue}
              className="flex-1 min-w-0"
            />
            <Button
              variant="ghost"
              size="icon"
              className="h-7 w-7 flex-shrink-0"
              onClick={() => resetCropEdge('top')}
              title={t('properties.resetTopCrop')}
            >
              <RotateCcw className="w-3.5 h-3.5" />
            </Button>
          </div>
        </PropertyRow>

        <PropertyRow label={t('properties.bottom')}>
          <div className="flex items-center gap-1 w-full">
            <SliderInput
              value={cropBottom}
              onChange={(value) => commitCropEdge('bottom', value)}
              onLiveChange={(value) => previewCropEdge('bottom', value)}
              min={0}
              max={maxSourceHeight}
              step={CROP_STEP}
              unit="px"
              formatValue={formatCropValue}
              formatInputValue={formatCropValue}
              className="flex-1 min-w-0"
            />
            <Button
              variant="ghost"
              size="icon"
              className="h-7 w-7 flex-shrink-0"
              onClick={() => resetCropEdge('bottom')}
              title={t('properties.resetBottomCrop')}
            >
              <RotateCcw className="w-3.5 h-3.5" />
            </Button>
          </div>
        </PropertyRow>

        <PropertyRow label={t('properties.softness')}>
          <div className="flex items-center gap-1 w-full">
            <SliderInput
              value={cropSoftness}
              onChange={commitCropSoftness}
              onLiveChange={previewCropSoftness}
              min={-maxCropSoftness}
              max={maxCropSoftness}
              step={CROP_STEP}
              unit="px"
              formatValue={formatCropValue}
              formatInputValue={formatCropValue}
              className="flex-1 min-w-0"
            />
            <Button
              variant="ghost"
              size="icon"
              className="h-7 w-7 flex-shrink-0"
              onClick={resetCropSoftness}
              title={t('properties.resetCropSoftness')}
            >
              <RotateCcw className="w-3.5 h-3.5" />
            </Button>
          </div>
        </PropertyRow>
      </PropertySection>
    </>
  );
}
