import { useState, useCallback, useMemo, useRef, useEffect } from 'react';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { cn } from '@/shared/ui/cn';
import { X } from 'lucide-react';
import { useTranslation } from 'react-i18next';
import { useBentoLayoutDialogStore } from './bento-layout-dialog-store';
import { useBentoPresetsStore } from '../stores/bento-presets-store';
import { useProjectStore } from '@/features/timeline/deps/projects';
import { useItemsStore } from '../stores/items-store';
import { useTransitionsStore } from '../stores/transitions-store';
import { applyBentoLayout } from '../stores/actions/transform-actions';
import { computeLayout, buildTransitionChains } from '../utils/bento-layout';
import { buildTransitionIndexes } from '../utils/transition-indexes';
import type { LayoutPresetType, LayoutConfig, BentoLayoutItem } from '../utils/bento-layout';
import type { TimelineItem } from '@/types/timeline';

interface BuiltInPreset {
  type: LayoutPresetType;
  label: string;
  cols?: number;
  rows?: number;
}

const ITEM_TYPE_COLORS: Record<string, { bg: string; border: string }> = {
  video: { bg: 'bg-blue-500/60', border: 'border-blue-400/80' },
  image: { bg: 'bg-green-500/60', border: 'border-green-400/80' },
  text: { bg: 'bg-amber-500/60', border: 'border-amber-400/80' },
  shape: { bg: 'bg-purple-500/60', border: 'border-purple-400/80' },
  adjustment: { bg: 'bg-violet-500/60', border: 'border-violet-400/80' },
};

const DEFAULT_COLOR = { bg: 'bg-muted-foreground/40', border: 'border-muted-foreground/60' };

function getItemColor(type: string) {
  return ITEM_TYPE_COLORS[type] ?? DEFAULT_COLOR;
}

function NumberInput({
  label,
  value,
  onChange,
  min,
  max,
}: {
  label: string;
  value: number;
  onChange: (v: number) => void;
  min: number;
  max: number;
}) {
  return (
    <div className="flex items-center gap-1.5">
      <span className="text-xs text-muted-foreground whitespace-nowrap">{label}</span>
      <Input
        type="number"
        min={min}
        max={max}
        value={value}
        onChange={(e) => onChange(Math.max(min, Math.min(max, Number(e.target.value) || 0)))}
        className="w-16 h-7 text-xs px-2"
      />
    </div>
  );
}

interface CanvasItemRect {
  id: string;
  label: string;
  type: string;
  left: number;
  top: number;
  width: number;
  height: number;
}

function CanvasItem({
  rect,
  isDragging,
  isDropTarget,
  dragOffset,
  onMouseDown,
}: {
  rect: CanvasItemRect;
  isDragging: boolean;
  isDropTarget: boolean;
  dragOffset: { x: number; y: number } | null;
  onMouseDown: (e: React.MouseEvent) => void;
}) {
  const color = getItemColor(rect.type);

  const style: React.CSSProperties = {
    position: 'absolute',
    left: rect.left,
    top: rect.top,
    width: rect.width,
    height: rect.height,
    transform: isDragging && dragOffset
      ? `translate(${dragOffset.x}px, ${dragOffset.y}px)`
      : undefined,
    zIndex: isDragging ? 50 : 1,
    transition: isDragging ? 'none' : 'left 0.2s ease, top 0.2s ease, width 0.2s ease, height 0.2s ease',
  };

  return (
    <div
      style={style}
      onMouseDown={onMouseDown}
      className={cn(
        'rounded border select-none cursor-grab overflow-hidden',
        'flex items-center justify-center',
        color.bg,
        color.border,
        isDragging && 'shadow-lg opacity-80 cursor-grabbing',
        isDropTarget && 'ring-2 ring-primary ring-dashed',
        !isDragging && 'hover:brightness-110',
      )}
    >
      <span className="text-[10px] text-white font-medium truncate px-1 pointer-events-none drop-shadow-sm">
        {rect.label}
      </span>
    </div>
  );
}

function LayoutCanvas({
  chainOrder,
  onSwap,
  canvasWidth,
  canvasHeight,
  config,
  itemsLookup,
  noItemsText,
}: {
  chainOrder: string[][];
  onSwap: (fromIndex: number, toIndex: number) => void;
  canvasWidth: number;
  canvasHeight: number;
  config: LayoutConfig;
  itemsLookup: Map<string, TimelineItem>;
  noItemsText: string;
}) {
  const containerRef = useRef<HTMLDivElement>(null);
  const [containerWidth, setContainerWidth] = useState(0);

  useEffect(() => {
    const el = containerRef.current;
    if (!el) return;
    const observer = new ResizeObserver((entries) => {
      for (const entry of entries) {
        setContainerWidth(entry.contentRect.width);
      }
    });
    observer.observe(el);
    return () => observer.disconnect();
  }, []);

  const safeCanvasWidth = canvasWidth > 0 ? canvasWidth : 1920;
  const safeCanvasHeight = canvasHeight > 0 ? canvasHeight : 1080;
  const aspectRatio = safeCanvasWidth / safeCanvasHeight;
  const displayWidth = containerWidth;
  const displayHeight = containerWidth > 0 ? displayWidth / aspectRatio : 200;
  const scale = containerWidth > 0 ? displayWidth / safeCanvasWidth : 1;

  const layoutItems: BentoLayoutItem[] = useMemo(() => {
    return chainOrder.map((chain) => {
      const repId = chain[0]!;
      const item = itemsLookup.get(repId);
      const sw = item && 'sourceWidth' in item && item.sourceWidth ? item.sourceWidth : safeCanvasWidth;
      const sh = item && 'sourceHeight' in item && item.sourceHeight ? item.sourceHeight : safeCanvasHeight;
      return { id: repId, sourceWidth: sw, sourceHeight: sh };
    });
  }, [chainOrder, itemsLookup, safeCanvasWidth, safeCanvasHeight]);

  const transformsMap = useMemo(() => {
    if (layoutItems.length === 0) return new Map<string, { x?: number; y?: number; width?: number; height?: number }>();
    return computeLayout(layoutItems, safeCanvasWidth, safeCanvasHeight, config);
  }, [layoutItems, safeCanvasWidth, safeCanvasHeight, config]);

  const canvasRects: CanvasItemRect[] = useMemo(() => {
    const cx = safeCanvasWidth / 2;
    const cy = safeCanvasHeight / 2;
    return chainOrder.map((chain) => {
      const repId = chain[0]!;
      const t = transformsMap.get(repId);
      const item = itemsLookup.get(repId);
      const w = t?.width ?? safeCanvasWidth;
      const h = t?.height ?? safeCanvasHeight;
      const absLeft = cx + (t?.x ?? 0) - w / 2;
      const absTop = cy + (t?.y ?? 0) - h / 2;
      const label = chain.length === 1
        ? (item?.label ?? repId.slice(0, 6))
        : chain.map((id) => itemsLookup.get(id)?.label ?? id.slice(0, 4)).join(' → ');
      return {
        id: repId,
        label,
        type: item?.type ?? 'video',
        left: absLeft * scale,
        top: absTop * scale,
        width: w * scale,
        height: h * scale,
      };
    });
  }, [chainOrder, transformsMap, itemsLookup, safeCanvasWidth, safeCanvasHeight, scale]);

  const [dragIndex, setDragIndex] = useState<number | null>(null);
  const [dragOffset, setDragOffset] = useState<{ x: number; y: number } | null>(null);
  const [dropTargetIndex, setDropTargetIndex] = useState<number | null>(null);
  const dragStartPos = useRef<{ x: number; y: number } | null>(null);

  const hitTest = useCallback(
    (clientX: number, clientY: number): number | null => {
      const el = containerRef.current;
      if (!el) return null;
      const bounds = el.getBoundingClientRect();
      const px = clientX - bounds.left;
      const py = clientY - bounds.top;
      for (let i = 0; i < canvasRects.length; i++) {
        const r = canvasRects[i]!;
        if (px >= r.left && px <= r.left + r.width && py >= r.top && py <= r.top + r.height) {
          return i;
        }
      }
      return null;
    },
    [canvasRects],
  );

  useEffect(() => {
    if (dragIndex === null) return;

    const handleMouseMove = (e: MouseEvent) => {
      if (!dragStartPos.current) return;
      setDragOffset({
        x: e.clientX - dragStartPos.current.x,
        y: e.clientY - dragStartPos.current.y,
      });
      const target = hitTest(e.clientX, e.clientY);
      setDropTargetIndex(target !== null && target !== dragIndex ? target : null);
    };

    const handleMouseUp = () => {
      if (dragIndex !== null && dropTargetIndex !== null && dropTargetIndex !== dragIndex) {
        onSwap(dragIndex, dropTargetIndex);
      }
      setDragIndex(null);
      setDragOffset(null);
      setDropTargetIndex(null);
      dragStartPos.current = null;
    };

    window.addEventListener('mousemove', handleMouseMove);
    window.addEventListener('mouseup', handleMouseUp);
    return () => {
      window.removeEventListener('mousemove', handleMouseMove);
      window.removeEventListener('mouseup', handleMouseUp);
    };
  }, [dragIndex, dropTargetIndex, hitTest, onSwap]);

  const handleItemMouseDown = useCallback(
    (index: number, e: React.MouseEvent) => {
      e.preventDefault();
      setDragIndex(index);
      dragStartPos.current = { x: e.clientX, y: e.clientY };
      setDragOffset({ x: 0, y: 0 });
    },
    [],
  );

  return (
    <div
      ref={containerRef}
      className="relative w-full rounded-md border border-border bg-muted/30 overflow-hidden"
      style={{ height: displayHeight > 0 ? displayHeight : 200 }}
    >
      {canvasRects.map((rect, i) => (
        <CanvasItem
          key={rect.id}
          rect={rect}
          isDragging={dragIndex === i}
          isDropTarget={dropTargetIndex === i}
          dragOffset={dragIndex === i ? dragOffset : null}
          onMouseDown={(e) => handleItemMouseDown(i, e)}
        />
      ))}
      {canvasRects.length === 0 && (
        <div className="flex items-center justify-center h-full text-xs text-muted-foreground">
          {noItemsText}
        </div>
      )}
    </div>
  );
}

type SelectedPreset =
  | { kind: 'builtin'; index: number }
  | { kind: 'custom'; id: string };

export function BentoLayoutDialog() {
  const { t } = useTranslation();
  const isOpen = useBentoLayoutDialogStore((s) => s.isOpen);
  const itemIds = useBentoLayoutDialogStore((s) => s.itemIds);
  const close = useBentoLayoutDialogStore((s) => s.close);

  const customPresets = useBentoPresetsStore((s) => s.customPresets);
  const addPreset = useBentoPresetsStore((s) => s.addPreset);
  const removePreset = useBentoPresetsStore((s) => s.removePreset);

  const canvasWidth = useProjectStore((s) => s.currentProject?.metadata.width ?? 1920);
  const canvasHeight = useProjectStore((s) => s.currentProject?.metadata.height ?? 1080);

  const [selected, setSelected] = useState<SelectedPreset>({ kind: 'builtin', index: 0 });
  const [gap, setGap] = useState(0);
  const [padding, setPadding] = useState(0);
  const [chainOrder, setChainOrder] = useState<string[][]>([]);

  const [isSaving, setIsSaving] = useState(false);
  const [presetName, setPresetName] = useState('');

  const transitions = useTransitionsStore((s) => s.transitions);

  const BUILT_IN_PRESETS: BuiltInPreset[] = [
    { type: 'auto', label: t('dialogs.bentoLayout.presets.auto') },
    { type: 'row', label: t('dialogs.bentoLayout.presets.sideBySide') },
    { type: 'column', label: t('dialogs.bentoLayout.presets.stacked') },
    { type: 'pip', label: t('dialogs.bentoLayout.presets.pip') },
    { type: 'focus-sidebar', label: t('dialogs.bentoLayout.presets.focusSidebar') },
    { type: 'grid', label: t('dialogs.bentoLayout.presets.2x2'), cols: 2, rows: 2 },
    { type: 'grid', label: t('dialogs.bentoLayout.presets.3x3'), cols: 3, rows: 3 },
  ];

  useEffect(() => {
    if (isOpen && itemIds.length > 0) {
      const { transitionsByClipId } = buildTransitionIndexes(transitions);
      const chains = buildTransitionChains(itemIds, transitionsByClipId);
      setChainOrder(chains);
      setSelected({ kind: 'builtin', index: 0 });
      setGap(0);
      setPadding(0);
      setIsSaving(false);
      setPresetName('');
    }
  }, [isOpen, itemIds, transitions]);

  const items = useItemsStore((state) => state.items);
  const itemsLookup = useMemo(() => {
    const map = new Map<string, TimelineItem>();
    for (const id of itemIds) {
      const item = items.find((i) => i.id === id);
      if (item) map.set(id, item);
    }
    return map;
  }, [items, itemIds]);

  const itemCount = itemIds.length;

  const resolveConfig = useCallback((): LayoutConfig => {
    if (selected.kind === 'custom') {
      const preset = customPresets.find((p) => p.id === selected.id);
      if (preset) {
        return {
          preset: preset.preset,
          cols: preset.cols,
          rows: preset.rows,
          gap: preset.gap,
          padding: preset.padding,
        };
      }
    }

    const builtin = BUILT_IN_PRESETS[selected.kind === 'builtin' ? selected.index : 0];
    if (!builtin) return { preset: 'auto', gap, padding };

    return {
      preset: builtin.type,
      cols: builtin.cols,
      rows: builtin.rows,
      gap,
      padding,
    };
  }, [selected, customPresets, gap, padding, BUILT_IN_PRESETS]);

  const config = useMemo(() => resolveConfig(), [resolveConfig]);

  const handleSwap = useCallback((fromIndex: number, toIndex: number) => {
    setChainOrder((prev) => {
      const next = [...prev];
      const temp = next[fromIndex]!;
      next[fromIndex] = next[toIndex]!;
      next[toIndex] = temp;
      return next;
    });
  }, []);

  const handleApply = useCallback(() => {
    const flatIds = chainOrder.flat();
    if (flatIds.length < 2) return;
    const cfg = resolveConfig();
    applyBentoLayout(flatIds, canvasWidth, canvasHeight, cfg, chainOrder);
    close();
  }, [chainOrder, canvasWidth, canvasHeight, resolveConfig, close]);

  const handleSavePreset = useCallback(() => {
    const layoutUnitCount = chainOrder.length;
    if (!presetName.trim() || layoutUnitCount < 1) return;

    const cfg = resolveConfig();
    const safeCols = cfg.cols ?? Math.max(1, Math.ceil(Math.sqrt(layoutUnitCount)));
    const safeRows = cfg.rows ?? Math.max(1, Math.ceil(layoutUnitCount / safeCols));
    addPreset({
      name: presetName.trim(),
      preset: cfg.preset,
      cols: safeCols,
      rows: safeRows,
      gap: cfg.gap ?? 0,
      padding: cfg.padding ?? 0,
    });

    setPresetName('');
    setIsSaving(false);
  }, [presetName, resolveConfig, chainOrder.length, addPreset]);

  const handleSelectPreset = useCallback(
    (sel: SelectedPreset) => {
      setSelected(sel);
      const { transitionsByClipId } = buildTransitionIndexes(transitions);
      setChainOrder(buildTransitionChains(itemIds, transitionsByClipId));

      if (sel.kind === 'custom') {
        const preset = customPresets.find((p) => p.id === sel.id);
        if (preset) {
          setGap(preset.gap);
          setPadding(preset.padding);
        }
      }
    },
    [itemIds, transitions, customPresets],
  );

  const handleOpenChange = useCallback(
    (open: boolean) => {
      if (!open) {
        close();
        setIsSaving(false);
        setPresetName('');
      }
    },
    [close],
  );

  return (
    <Dialog open={isOpen} onOpenChange={handleOpenChange}>
      <DialogContent className="max-w-lg">
        <DialogHeader>
          <DialogTitle>{t('dialogs.bentoLayout.title')}</DialogTitle>
          <DialogDescription>
            {t('dialogs.bentoLayout.description', { count: itemCount })}
          </DialogDescription>
        </DialogHeader>

        <div className="flex flex-wrap gap-1.5">
          {BUILT_IN_PRESETS.map((preset, idx) => {
            const isSelected = selected.kind === 'builtin' && selected.index === idx;
            return (
              <button
                key={`${preset.type}-${idx}`}
                onClick={() => handleSelectPreset({ kind: 'builtin', index: idx })}
                className={cn(
                  'px-2.5 py-1 rounded-md text-xs font-medium transition-colors',
                  'hover:bg-accent',
                  isSelected
                    ? 'ring-2 ring-primary bg-accent text-accent-foreground'
                    : 'bg-muted text-muted-foreground',
                )}
              >
                {preset.label}
              </button>
            );
          })}
          {customPresets.map((preset) => {
            const isSelected = selected.kind === 'custom' && selected.id === preset.id;
            return (
              <div key={preset.id} className="relative group">
                <button
                  onClick={() => handleSelectPreset({ kind: 'custom', id: preset.id })}
                  className={cn(
                    'px-2.5 py-1 rounded-md text-xs font-medium transition-colors pr-6',
                    'hover:bg-accent',
                    isSelected
                      ? 'ring-2 ring-primary bg-accent text-accent-foreground'
                      : 'bg-muted text-muted-foreground',
                  )}
                >
                  {preset.name}
                </button>
                <button
                  onClick={() => removePreset(preset.id)}
                  className="absolute right-1 top-1/2 -translate-y-1/2 p-0.5 rounded hover:bg-destructive/10 text-muted-foreground hover:text-destructive opacity-0 group-hover:opacity-100 transition-opacity"
                >
                  <X className="h-3 w-3" />
                </button>
              </div>
            );
          })}
        </div>

        <div className="space-y-4">
          <LayoutCanvas
            chainOrder={chainOrder}
            onSwap={handleSwap}
            canvasWidth={canvasWidth}
            canvasHeight={canvasHeight}
            config={config}
            itemsLookup={itemsLookup}
            noItemsText={t('dialogs.bentoLayout.noItems')}
          />

          <div className="flex items-center justify-between">
            <div className="flex items-center gap-4">
              <NumberInput
                label={t('dialogs.bentoLayout.gap')}
                value={gap}
                onChange={setGap}
                min={0}
                max={200}
              />
              <NumberInput
                label={t('dialogs.bentoLayout.padding')}
                value={padding}
                onChange={setPadding}
                min={0}
                max={200}
              />
            </div>
          </div>
        </div>

        <DialogFooter className="gap-2 sm:gap-0">
          {!isSaving ? (
            <>
              <Button variant="secondary" size="sm" onClick={() => setIsSaving(true)}>
                {t('dialogs.bentoLayout.savePreset')}
              </Button>
            </>
          ) : (
            <div className="flex items-center gap-2 flex-1">
              <Input
                type="text"
                placeholder={t('dialogs.bentoLayout.presetName')}
                value={presetName}
                onChange={(e) => setPresetName(e.target.value)}
                className="h-7 text-xs"
                autoFocus
              />
              <Button variant="ghost" size="sm" onClick={() => setIsSaving(false)}>
                {t('dialogs.bentoLayout.cancel')}
              </Button>
              <Button size="sm" onClick={handleSavePreset}>
                {t('dialogs.bentoLayout.save')}
              </Button>
            </div>
          )}
          <div className="flex gap-2">
            <Button variant="ghost" onClick={close}>
              {t('dialogs.bentoLayout.cancel')}
            </Button>
            <Button onClick={handleApply}>
              {t('dialogs.bentoLayout.apply')}
            </Button>
          </div>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
