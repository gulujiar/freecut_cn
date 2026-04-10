import { useCallback, useMemo, memo } from 'react';
import { useTranslation } from 'react-i18next';
import { Droplet, RotateCcw } from 'lucide-react';
import { useShallow } from 'zustand/react/shallow';
import { Button } from '@/components/ui/button';
import {
  Select,
  SelectContent,
  SelectGroup,
  SelectItem,
  SelectLabel,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import type { TimelineItem } from '@/types/timeline';
import type { BlendMode } from '@/types/blend-modes';
import { BLEND_MODE_GROUPS, BLEND_MODE_LABELS } from '@/types/blend-modes';
import type { TransformProperties, CanvasSettings } from '@/types/transform';
import { useGizmoStore, useThrottledFrame } from '@/features/editor/deps/preview';
import { useKeyframesStore, useTimelineStore } from '@/features/editor/deps/timeline-store';
import {
  resolveTransform,
  getSourceDimensions,
} from '@/features/editor/deps/composition-runtime';
import {
  getAutoKeyframeOperation,
  type AutoKeyframeOperation,
  resolveAnimatedTransform,
  KeyframeToggle,
} from '@/features/editor/deps/keyframes';
import {
  PropertySection,
  PropertyRow,
  NumberInput,
  SliderInput,
} from '../components';

interface FillSectionProps {
  items: TimelineItem[];
  canvas: CanvasSettings;
  onTransformChange: (ids: string[], updates: Partial<TransformProperties>) => void;
}

type MixedValue = number | 'mixed';

export const FillSection = memo(function FillSection({
  items,
  canvas,
  onTransformChange,
}: FillSectionProps) {
  const { t } = useTranslation();
  const itemIds = useMemo(() => items.map((item) => item.id), [items]);
  const itemsById = useMemo(() => new Map(items.map((item) => [item.id, item])), [items]);

  const currentFrame = useThrottledFrame();

  const itemKeyframes = useKeyframesStore(
    useShallow(
      useCallback(
        (s) => itemIds.map((itemId) => s.keyframesByItemId[itemId] ?? null),
        [itemIds]
      )
    )
  );
  const keyframesByItemId = useMemo(() => {
    const map = new Map<string, (typeof itemKeyframes)[number]>();
    for (const [index, itemId] of itemIds.entries()) {
      map.set(itemId, itemKeyframes[index] ?? null);
    }
    return map;
  }, [itemIds, itemKeyframes]);

  const updateItem = useTimelineStore((s) => s.updateItem);

  const setTransformPreview = useGizmoStore((s) => s.setTransformPreview);
  const clearPreview = useGizmoStore((s) => s.clearPreview);

  const { opacityRaw, cornerRadius } = useMemo(() => {
    if (items.length === 0) {
      return { opacityRaw: 1 as MixedValue, cornerRadius: 0 as MixedValue };
    }

      const resolvedValues = items.map((item) => {
        const sourceDimensions = getSourceDimensions(item);
        const baseResolved = resolveTransform(item, canvas, sourceDimensions);

        const itemKeyframes = keyframesByItemId.get(item.id) ?? undefined;
        if (itemKeyframes) {
          const relativeFrame = currentFrame - item.from;
          return resolveAnimatedTransform(baseResolved, itemKeyframes, relativeFrame);
      }

      return baseResolved;
    });

    const getVal = (getter: (r: ReturnType<typeof resolveTransform>) => number): MixedValue => {
      const values = resolvedValues.map(getter);
      const firstValue = values[0]!;
      return values.every((v) => Math.abs(v - firstValue) < 0.01) ? firstValue : 'mixed';
    };

    return {
      opacityRaw: getVal((r) => r.opacity),
      cornerRadius: getVal((r) => r.cornerRadius),
    };
  }, [items, canvas, keyframesByItemId, currentFrame]);

  const opacity = opacityRaw === 'mixed' ? 'mixed' : Math.round(opacityRaw * 100);

  const applyAutoKeyframeOperations = useTimelineStore((s) => s.applyAutoKeyframeOperations);

  const autoKeyframeOpacity = useCallback(
    (itemId: string, value: number): AutoKeyframeOperation | null => {
      const item = itemsById.get(itemId);
      if (!item) return null;

      const itemKeyframes = keyframesByItemId.get(itemId) ?? undefined;
      return getAutoKeyframeOperation(item, itemKeyframes, 'opacity', value, currentFrame);
    },
    [currentFrame, itemsById, keyframesByItemId]
  );

  const autoKeyframeCornerRadius = useCallback(
    (itemId: string, value: number): AutoKeyframeOperation | null => {
      const item = itemsById.get(itemId);
      if (!item) return null;

      const itemKeyframes = keyframesByItemId.get(itemId) ?? undefined;
      return getAutoKeyframeOperation(item, itemKeyframes, 'cornerRadius', value, currentFrame);
    },
    [currentFrame, itemsById, keyframesByItemId]
  );

  const handleOpacityLiveChange = useCallback(
    (value: number) => {
      const previews: Record<string, { opacity: number }> = {};
      items.forEach((item) => {
        previews[item.id] = { opacity: value / 100 };
      });
      setTransformPreview(previews);
    },
    [items, setTransformPreview]
  );

  const handleOpacityChange = useCallback(
    (value: number) => {
      const opacityValue = value / 100;

      const autoOps: AutoKeyframeOperation[] = [];
      const fallbackItemIds: string[] = [];
      for (const itemId of itemIds) {
        const operation = autoKeyframeOpacity(itemId, opacityValue);
        if (operation) {
          autoOps.push(operation);
        } else {
          fallbackItemIds.push(itemId);
        }
      }
      if (autoOps.length > 0) {
        applyAutoKeyframeOperations(autoOps);
      }
      if (fallbackItemIds.length > 0) {
        onTransformChange(fallbackItemIds, { opacity: opacityValue });
      }
      queueMicrotask(() => clearPreview());
    },
    [itemIds, onTransformChange, clearPreview, autoKeyframeOpacity, applyAutoKeyframeOperations]
  );

  const handleCornerRadiusLiveChange = useCallback(
    (value: number) => {
      const previews: Record<string, { cornerRadius: number }> = {};
      items.forEach((item) => {
        previews[item.id] = { cornerRadius: value };
      });
      setTransformPreview(previews);
    },
    [items, setTransformPreview]
  );

  const handleCornerRadiusChange = useCallback(
    (value: number) => {
      const autoOps: AutoKeyframeOperation[] = [];
      const fallbackItemIds: string[] = [];
      for (const itemId of itemIds) {
        const operation = autoKeyframeCornerRadius(itemId, value);
        if (operation) {
          autoOps.push(operation);
        } else {
          fallbackItemIds.push(itemId);
        }
      }
      if (autoOps.length > 0) {
        applyAutoKeyframeOperations(autoOps);
      }
      if (fallbackItemIds.length > 0) {
        onTransformChange(fallbackItemIds, { cornerRadius: value });
      }
      queueMicrotask(() => clearPreview());
    },
    [itemIds, onTransformChange, clearPreview, autoKeyframeCornerRadius, applyAutoKeyframeOperations]
  );

  const blendMode = useMemo(() => {
    if (items.length === 0) return 'normal' as BlendMode;
    const first = items[0]!.blendMode ?? 'normal';
    const allSame = items.every((item) => (item.blendMode ?? 'normal') === first);
    return allSame ? first : ('mixed' as string);
  }, [items]);

  const handleBlendModeChange = useCallback(
    (value: string) => {
      for (const id of itemIds) {
        updateItem(id, { blendMode: value as BlendMode });
      }
    },
    [itemIds, updateItem]
  );

  const handleResetOpacity = useCallback(() => {
    const tolerance = 0.01;
    const needsUpdate = items.some((item) => {
      const sourceDimensions = getSourceDimensions(item);
      const resolved = resolveTransform(item, canvas, sourceDimensions);
      return Math.abs(resolved.opacity - 1) > tolerance;
    });
    if (needsUpdate) {
      onTransformChange(itemIds, { opacity: 1 });
    }
  }, [items, itemIds, onTransformChange, canvas]);

  const handleResetCornerRadius = useCallback(() => {
    const tolerance = 0.5;
    const needsUpdate = items.some((item) => {
      const sourceDimensions = getSourceDimensions(item);
      const resolved = resolveTransform(item, canvas, sourceDimensions);
      return resolved.cornerRadius > tolerance;
    });
    if (needsUpdate) {
      onTransformChange(itemIds, { cornerRadius: 0 });
    }
  }, [items, itemIds, onTransformChange, canvas]);

  return (
    <PropertySection title={t('properties.composite')} icon={Droplet} defaultOpen={true}>
      <PropertyRow label={t('properties.opacity')}>
        <div className="flex items-center gap-1 w-full">
          <SliderInput
            value={opacity}
            onChange={handleOpacityChange}
            onLiveChange={handleOpacityLiveChange}
            min={0}
            max={100}
            step={1}
            unit="%"
            className="flex-1 min-w-0"
          />
          <KeyframeToggle
            itemIds={itemIds}
            property="opacity"
            currentValue={opacityRaw === 'mixed' ? 1 : opacityRaw}
          />
          <Button
            variant="ghost"
            size="icon"
            className="h-7 w-7 flex-shrink-0"
            onClick={handleResetOpacity}
            title={t('properties.resetTo100Percent')}
          >
            <RotateCcw className="w-3.5 h-3.5" />
          </Button>
        </div>
      </PropertyRow>

      <PropertyRow label={t('properties.blend')}>
        <Select
          value={blendMode === 'mixed' ? undefined : blendMode}
          onValueChange={handleBlendModeChange}
        >
          <SelectTrigger className="h-7 text-xs flex-1 min-w-0">
            <SelectValue placeholder={blendMode === 'mixed' ? t('properties.mixed') : t('properties.normal')} />
          </SelectTrigger>
          <SelectContent>
            {BLEND_MODE_GROUPS.map((group) => (
              <SelectGroup key={group.label}>
                <SelectLabel className="text-[10px] text-muted-foreground">{group.label}</SelectLabel>
                {group.modes.map((mode) => (
                  <SelectItem key={mode} value={mode} className="text-xs">
                    {BLEND_MODE_LABELS[mode]}
                  </SelectItem>
                ))}
              </SelectGroup>
            ))}
          </SelectContent>
        </Select>
      </PropertyRow>

      <PropertyRow label={t('properties.radius')}>
        <div className="flex items-center gap-1 w-full">
          <NumberInput
            value={cornerRadius}
            onChange={handleCornerRadiusChange}
            onLiveChange={handleCornerRadiusLiveChange}
            min={0}
            max={1000}
            step={1}
            unit="px"
            className="flex-1 min-w-0"
          />
          <KeyframeToggle
            itemIds={itemIds}
            property="cornerRadius"
            currentValue={cornerRadius === 'mixed' ? 0 : cornerRadius}
          />
          <Button
            variant="ghost"
            size="icon"
            className="h-7 w-7 flex-shrink-0"
            onClick={handleResetCornerRadius}
            title={t('properties.resetTo0')}
          >
            <RotateCcw className="w-3.5 h-3.5" />
          </Button>
        </div>
      </PropertyRow>
    </PropertySection>
  );
});
