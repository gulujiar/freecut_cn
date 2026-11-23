import { fireEvent, render, screen } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';
import { createDemoSequence } from '../domain/demo';
import { MoocBoardView } from './mooc-board-view';

function renderBoard(onSelectCamera = vi.fn()) {
  const sequence = createDemoSequence();
  render(
    <div>
      <input aria-label="标题" />
      <MoocBoardView
        sequence={sequence}
        time={10}
        playing={false}
        busy={false}
        error={null}
        waveform={{
          peaks: [0.2, 0.8, 0.4],
          audioStart: 8,
          audioEnd: 74,
          label: '示例波形：由程序生成的 PCM 旁白解码得到，不是真实录音。',
          sample: true,
          playable: true,
        }}
        hotkeys
        onTogglePlay={vi.fn()}
        onStop={vi.fn()}
        onSeek={vi.fn()}
        onSelectCamera={onSelectCamera}
        onExportXml={vi.fn()}
        onImportXml={vi.fn()}
        onImportSrt={vi.fn()}
        onExit={vi.fn()}
      />
    </div>
  );
  return { sequence, onSelectCamera };
}

describe('MOOC board cameras', () => {
  it('shows exactly one active camera cell for every cue', () => {
    const { sequence } = renderBoard();
    for (const cue of sequence.cues) {
      const active = document.querySelectorAll(`[data-cue-id="${cue.id}"][data-active="true"]`);
      expect(active).toHaveLength(1);
      expect(active[0]?.getAttribute('data-camera')).toBe(cue.camera);
    }
  });

  it('switches only the clicked cue and ignores 1/2/3 while typing', () => {
    const onSelectCamera = vi.fn();
    renderBoard(onSelectCamera);
    fireEvent.click(document.querySelector('[data-cue-id="b2"][data-camera="half"]') as Element);
    expect(onSelectCamera).toHaveBeenCalledWith('b2', 'half');

    fireEvent.keyDown(window, { code: 'Digit1' });
    expect(onSelectCamera).toHaveBeenCalledWith('b1', 'ppt');

    const input = screen.getByLabelText('标题');
    fireEvent.keyDown(input, { code: 'Digit2' });
    expect(onSelectCamera).not.toHaveBeenCalledWith('b1', 'pip');
  });
});
