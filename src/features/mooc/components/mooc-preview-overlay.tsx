import { usePlaybackStore } from '@/shared/state/playback';
import { CAMERA_LABEL } from '../domain/layout';
import { locateAt } from '../domain/time';
import { useMoocStore } from '../stores/mooc-store';

export function MoocPreviewOverlay() {
  const sequence = useMoocStore((state) => state.sequence);
  const fps = useMoocStore((state) => state.canvas.fps);
  const frame = usePlaybackStore((state) => state.currentFrame);
  if (!sequence) return null;

  const place = locateAt(sequence, frame / (fps > 0 ? fps : 30));
  const badge = place.kind === 'intro'
    ? '片头包装'
    : place.kind === 'outro'
      ? '片尾包装'
      : place.kind === 'gap'
        ? '字幕间隙'
        : CAMERA_LABEL[place.cue.camera];
  const caption = place.kind === 'cue'
    ? place.cue.text
    : place.kind === 'gap'
      ? '这段没有字幕，也不能切机位'
      : place.kind === 'intro'
        ? '片头 · 不可切机位'
        : '片尾 · 不可切机位';

  return (
    <div className="pointer-events-none absolute left-3 top-3 z-20 max-w-[70%]">
      <div className="rounded-full bg-[#0f172a]/80 px-2.5 py-1 text-[11px] text-white">{badge}</div>
      <div className="mt-1 line-clamp-2 text-xs text-white drop-shadow">{caption}</div>
    </div>
  );
}
