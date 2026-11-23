import { usePlaybackStore } from '@/shared/state/playback';
import { serializeMoocXml } from '../domain/xml';
import { useMoocStore } from '../stores/mooc-store';
import { MoocBoardView } from './mooc-board-view';

function readFile(file: File): Promise<string> {
  return file.text();
}

export function MoocBoard() {
  const sequence = useMoocStore((state) => state.sequence);
  const busy = useMoocStore((state) => state.busy);
  const error = useMoocStore((state) => state.error);
  const waveform = useMoocStore((state) => state.waveform);
  const fps = useMoocStore((state) => state.canvas.fps);
  const frame = usePlaybackStore((state) => state.currentFrame);
  const playing = usePlaybackStore((state) => state.isPlaying);
  const togglePlay = useMoocStore((state) => state.togglePlay);
  const stop = useMoocStore((state) => state.stop);
  const seek = useMoocStore((state) => state.seek);
  const setCamera = useMoocStore((state) => state.setCamera);
  const importXmlText = useMoocStore((state) => state.importXmlText);
  const importSrtText = useMoocStore((state) => state.importSrtText);
  const exit = useMoocStore((state) => state.exit);

  if (!sequence) {
    return (
      <section className="flex h-full items-center justify-center bg-[#0c1422] px-6 text-sm text-[#8ea0b8]">
        {error ?? '还没有慕课序列。'}
      </section>
    );
  }

  const safeFps = fps > 0 ? fps : 30;
  return (
    <MoocBoardView
      sequence={sequence}
      time={frame / safeFps}
      playing={playing}
      busy={busy}
      error={error}
      waveform={waveform}
      hotkeys
      onTogglePlay={togglePlay}
      onStop={stop}
      onSeek={seek}
      onSelectCamera={setCamera}
      onExit={exit}
      onExportXml={() => {
        const blob = new Blob([serializeMoocXml(sequence)], { type: 'application/xml' });
        const url = URL.createObjectURL(blob);
        const link = document.createElement('a');
        link.href = url;
        link.download = 'mooc-sequence.xml';
        link.click();
        URL.revokeObjectURL(url);
      }}
      onImportXml={(file) => {
        void readFile(file).then((text) => importXmlText(text));
      }}
      onImportSrt={(file) => {
        void readFile(file).then((text) => importSrtText(text));
      }}
    />
  );
}
