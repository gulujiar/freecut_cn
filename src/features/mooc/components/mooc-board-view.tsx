import { useEffect, type MouseEvent, type ReactNode } from 'react';
import type { MoocCamera, MoocSequenceDocument } from '@/types/mooc';
import { CAMERA_LABEL } from '../domain/layout';
import { isTextEntryTarget } from '../domain/keyboard';
import { formatMoocTime, locateAt, sequenceEnd } from '../domain/time';
import type { WaveformView } from '../services/waveform';

const CAMERAS: MoocCamera[] = ['ppt', 'pip', 'half'];

export interface MoocBoardViewProps {
  sequence: MoocSequenceDocument;
  time: number;
  playing: boolean;
  busy: boolean;
  error: string | null;
  waveform: WaveformView | null;
  onTogglePlay: () => void;
  onStop: () => void;
  onSeek: (seconds: number) => void;
  onSelectCamera: (cueId: string, camera: MoocCamera) => void;
  onExportXml: () => void;
  onImportXml: (file: File) => void;
  onImportSrt: (file: File) => void;
  onExit: () => void;
  hotkeys: boolean;
}

function percent(time: number, total: number): string {
  if (total <= 0) return '0%';
  return `${(Math.min(Math.max(time, 0), total) / total) * 100}%`;
}

function span(start: number, end: number, total: number): string {
  if (total <= 0) return '0%';
  return `${(Math.max(0, end - start) / total) * 100}%`;
}

function wavePath(waveform: WaveformView, total: number): string {
  const width = 1000;
  const height = 36;
  const mid = height / 2;
  let path = `M0 ${mid}`;
  for (let index = 0; index <= width; index += 1) {
    const ratio = index / width;
    const seconds = ratio * total;
    let amplitude = 0;
    if (
      waveform.playable
      && waveform.peaks.length > 0
      && seconds >= waveform.audioStart
      && seconds <= waveform.audioEnd
    ) {
      const local = (seconds - waveform.audioStart) / Math.max(0.001, waveform.audioEnd - waveform.audioStart);
      const peakIndex = Math.min(waveform.peaks.length - 1, Math.floor(local * waveform.peaks.length));
      amplitude = (waveform.peaks[peakIndex] ?? 0) * 16;
    }
    const y = mid + (index % 2 === 0 ? -amplitude : amplitude);
    path += ` L${index} ${y.toFixed(2)}`;
  }
  return path;
}

export function MoocBoardView({
  sequence,
  time,
  playing,
  busy,
  error,
  waveform,
  onTogglePlay,
  onStop,
  onSeek,
  onSelectCamera,
  onExportXml,
  onImportXml,
  onImportSrt,
  onExit,
  hotkeys,
}: MoocBoardViewProps) {
  const total = sequenceEnd(sequence);
  const place = locateAt(sequence, time);

  useEffect(() => {
    if (!hotkeys) return undefined;
    const onKey = (event: KeyboardEvent) => {
      if (isTextEntryTarget(event.target)) return;
      if (event.metaKey || event.ctrlKey || event.altKey) return;
      const cameraByCode: Record<string, MoocCamera> = {
        Digit1: 'ppt',
        Digit2: 'pip',
        Digit3: 'half',
      };
      const camera = cameraByCode[event.code];
      if (!camera) return;
      const current = locateAt(sequence, time);
      if (current.kind !== 'cue') return;
      event.preventDefault();
      onSelectCamera(current.cue.id, camera);
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [hotkeys, onSelectCamera, sequence, time]);

  const seekFromTrack = (event: MouseEvent<HTMLDivElement>) => {
    const block = (event.target as HTMLElement).closest('[data-mooc-block]');
    if (block) return;
    const rect = event.currentTarget.getBoundingClientRect();
    if (rect.width <= 0) return;
    const ratio = (event.clientX - rect.left) / rect.width;
    onSeek(Math.min(total, Math.max(0, ratio * total)));
  };

  const ticks: number[] = [];
  for (let second = 0; second <= Math.ceil(total); second += 5) ticks.push(second);
  const sample = sequence.sample.audio || sequence.sample.lecturer || sequence.sample.slides || sequence.sample.background;

  return (
    <section data-testid="mooc-board" className="flex h-full min-h-0 flex-col bg-[#0c1422] text-[#e8eef8]">
      <div className="flex flex-wrap items-center gap-2 border-b border-[#2a3a55] px-3 py-2">
        <div className="mr-auto text-xs text-[#8ea0b8]">
          课程序列 · 每句字幕只有一个机位
          {sample ? ' · 含示例素材' : ''}
        </div>
        <span className="font-mono text-xs text-[#22d3ee]">{formatMoocTime(time)} / {formatMoocTime(total)}</span>
        <button type="button" className="rounded-md bg-[#3b82f6] px-3 py-1 text-xs font-semibold" onClick={onTogglePlay}>
          {playing ? '暂停' : '播放'}
        </button>
        <button type="button" className="rounded-md border border-[#2a3a55] px-3 py-1 text-xs" onClick={onStop}>停到开头</button>
        <button type="button" className="rounded-md border border-[#2a3a55] px-3 py-1 text-xs" onClick={onExportXml}>导出 XML</button>
        <label className="rounded-md border border-[#2a3a55] px-3 py-1 text-xs">
          导入 XML
          <input
            className="hidden"
            type="file"
            accept=".xml,text/xml"
            onChange={(event) => {
              const file = event.target.files?.[0];
              if (file) onImportXml(file);
              event.target.value = '';
            }}
          />
        </label>
        <label className="rounded-md border border-[#2a3a55] px-3 py-1 text-xs">
          导入 SRT
          <input
            className="hidden"
            type="file"
            accept=".srt,text/plain"
            onChange={(event) => {
              const file = event.target.files?.[0];
              if (file) onImportSrt(file);
              event.target.value = '';
            }}
          />
        </label>
        <button type="button" className="rounded-md border border-[#2a3a55] px-3 py-1 text-xs" onClick={onExit}>标准时间线</button>
      </div>
      <div className="flex gap-2 overflow-x-auto border-b border-[#2a3a55] px-3 py-1.5 text-[11px] text-[#8ea0b8]">
        <span className="rounded-full border border-[#2a3a55] px-2 py-0.5 text-[#e8eef8]">文稿 / PPT 切分</span>
        <span>→</span>
        <span className="rounded-full border border-[#2a3a55] px-2 py-0.5 text-[#e8eef8]">数字人</span>
        <span>→</span>
        <span className="rounded-full border border-[#2a3a55] px-2 py-0.5 text-[#e8eef8]">包装：片头 / 片尾</span>
        <span>→</span>
        <span className="rounded-full border border-[#2a3a55] px-2 py-0.5 text-[#e8eef8]">XML 课程序列</span>
        <span>→</span>
        <span className="rounded-full border border-[#2a3a55] px-2 py-0.5 text-[#e8eef8]">成片</span>
        <span className="ml-auto">空格播放 · 1 纯PPT · 2 人像小窗 · 3 半身</span>
      </div>
      {busy ? <div className="px-3 py-1 text-xs text-[#22d3ee]">正在把慕课序列编译到预览时间线…</div> : null}
      {error ? <div className="whitespace-pre-wrap px-3 py-1 text-xs text-[#fb7185]">{error}</div> : null}
      <div className="min-h-0 flex-1 overflow-auto px-3 py-2">
        <div className="relative min-w-[980px]">
          <div
            className="pointer-events-none absolute bottom-0 top-0 z-10 w-0.5 bg-[#fb7185]"
            style={{ left: `calc(88px + (100% - 88px) * ${total > 0 ? Math.min(time, total) / total : 0})` }}
          />
          <Row label="时间">
            <div className="relative h-5">
              {ticks.map((second) => (
                <span key={second} className="absolute top-0 -translate-x-1/2 text-[10px] text-[#64748b]" style={{ left: percent(second, total) }}>
                  {formatMoocTime(second).slice(0, 5)}
                </span>
              ))}
            </div>
          </Row>
          <Row label="包装">
            <Track onMouseDown={seekFromTrack}>
              {sequence.packaging.intro.duration > 0 ? (
                <Block className="bg-[#fbbf24] text-[#0b1220]" start={0} end={sequence.packaging.intro.duration} total={total}>片头</Block>
              ) : null}
              <Block className="bg-[#fb923c] text-[#0b1220]" start={total - sequence.packaging.outro.duration} end={total} total={total}>片尾</Block>
            </Track>
          </Row>
          <Row label="字幕 SRT">
            <Track onMouseDown={seekFromTrack}>
              {sequence.cues.map((cue, index) => (
                <button
                  key={cue.id}
                  type="button"
                  data-mooc-block="srt"
                  title={cue.text}
                  className={`absolute inset-y-0.5 overflow-hidden rounded px-1 text-left text-[10px] text-[#e2e8f0] ${place.kind === 'cue' && place.cue.id === cue.id ? 'bg-[#475569] outline outline-1 outline-[#93c5fd]' : 'bg-[#334155]'}`}
                  style={{ left: percent(cue.start, total), width: span(cue.start, cue.end, total) }}
                  onClick={() => onSeek(cue.start + Math.min(0.05, (cue.end - cue.start) / 2))}
                >
                  S{index + 1}
                </button>
              ))}
            </Track>
          </Row>
          {CAMERAS.map((camera) => (
            <Row key={camera} label={CAMERA_LABEL[camera]}>
              <Track onMouseDown={seekFromTrack}>
                {sequence.cues.map((cue) => {
                  const active = cue.camera === camera;
                  const tone = camera === 'ppt' ? 'bg-[#38bdf8]' : camera === 'pip' ? 'bg-[#34d399]' : 'bg-[#a78bfa]';
                  return (
                    <button
                      key={`${cue.id}-${camera}`}
                      type="button"
                      data-mooc-block="camera"
                      data-cue-id={cue.id}
                      data-camera={camera}
                      data-active={active ? 'true' : 'false'}
                      title={`${CAMERA_LABEL[camera]} · ${cue.id}`}
                      className={`absolute inset-y-0.5 rounded border ${active ? `${tone} border-transparent` : 'border-dashed border-[#334155] bg-transparent'}`}
                      style={{ left: percent(cue.start, total), width: span(cue.start, cue.end, total) }}
                      onClick={() => onSelectCamera(cue.id, camera)}
                    />
                  );
                })}
              </Track>
            </Row>
          ))}
          <Row label={waveform?.sample ? '音频·示例' : '音频'}>
            <Track onMouseDown={seekFromTrack}>
              {waveform?.playable ? (
                <svg className="absolute inset-x-0 top-1 h-6 w-full" viewBox="0 0 1000 36" preserveAspectRatio="none" role="img" aria-label={waveform.label}>
                  <title>{waveform.label}</title>
                  <path d={wavePath(waveform, total)} fill="none" stroke="#94a3b8" strokeWidth="1.2" />
                </svg>
              ) : (
                <span className="px-2 text-[10px] leading-7 text-[#8ea0b8]">{waveform?.label ?? '波形尚未读取。'}</span>
              )}
            </Track>
          </Row>
          {waveform?.sample ? <p className="mt-1 text-[11px] text-[#8ea0b8]">{waveform.label}</p> : null}
        </div>
      </div>
    </section>
  );
}

function Row({ label, children }: { label: string; children: ReactNode }) {
  return (
    <div className="mb-1 grid grid-cols-[88px_minmax(0,1fr)] items-center">
      <div className="pr-2 text-right text-[11px] text-[#8ea0b8]">{label}</div>
      {children}
    </div>
  );
}

function Track({ children, onMouseDown }: { children: ReactNode; onMouseDown: (event: MouseEvent<HTMLDivElement>) => void }) {
  return (
    <div className="relative h-8 rounded border border-[#2a3a55] bg-[#10192a]" onMouseDown={onMouseDown}>
      {children}
    </div>
  );
}

function Block({ className, start, end, total, children }: { className: string; start: number; end: number; total: number; children: string }) {
  if (end <= start) return null;
  return (
    <div data-mooc-block="pack" className={`absolute inset-y-0.5 flex items-center justify-center overflow-hidden rounded text-[10px] font-semibold ${className}`} style={{ left: percent(start, total), width: span(start, end, total) }}>
      {children}
    </div>
  );
}
