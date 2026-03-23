import { memo } from 'react';
import { cn } from '@/shared/ui/cn';

interface AudioVolumeControlProps {
  trackLocked: boolean;
  activeTool: string;
  lineYPercent: number;
  isSelected: boolean;
  isEditing: boolean;
  editLabel?: string | null;
  onVolumeMouseDown: (e: React.MouseEvent) => void;
  onVolumeDoubleClick: () => void;
}

export const AudioVolumeControl = memo(function AudioVolumeControl({
  trackLocked,
  activeTool,
  lineYPercent,
  isSelected,
  isEditing,
  editLabel,
  onVolumeMouseDown,
  onVolumeDoubleClick,
}: AudioVolumeControlProps) {
  if (trackLocked || activeTool !== 'select') {
    return null;
  }

  const visibilityClass = isEditing || isSelected
    ? 'opacity-100'
    : 'opacity-0 group-hover/timeline-item:opacity-100';

  return (
    <div className="absolute inset-x-0 inset-y-0 pointer-events-none z-30">
      <button
        type="button"
        className={cn(
          'absolute left-0 right-0 h-4 -translate-y-1/2 pointer-events-auto cursor-ns-resize touch-none transition-opacity',
          visibilityClass,
        )}
        style={{ top: `${lineYPercent}%` }}
        onMouseDown={onVolumeMouseDown}
        onDoubleClick={onVolumeDoubleClick}
        aria-label="Adjust clip volume"
      />

      {isEditing && editLabel && (
        <div
          className="absolute left-1/2 -translate-x-1/2 rounded bg-slate-950/95 px-1.5 py-0.5 text-[10px] font-medium text-white shadow-lg whitespace-nowrap"
          style={{ top: `calc(${lineYPercent}% + 10px)` }}
        >
          {editLabel}
        </div>
      )}
    </div>
  );
});
