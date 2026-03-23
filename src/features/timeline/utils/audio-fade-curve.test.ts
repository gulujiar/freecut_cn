import { describe, expect, it } from 'vitest';
import { getAudioFadeCurveControlPoint, getAudioFadeCurveFromOffset } from './audio-fade-curve';

describe('timeline audio-fade-curve', () => {
  it('moves the control point above or below the linear midpoint based on curve', () => {
    const linear = getAudioFadeCurveControlPoint({
      handle: 'in',
      fadePixels: 40,
      clipWidthPixels: 120,
      curve: 0,
      curveX: 0.52,
    });
    const curvedUp = getAudioFadeCurveControlPoint({
      handle: 'in',
      fadePixels: 40,
      clipWidthPixels: 120,
      curve: 0.6,
      curveX: 0.52,
    });
    const curvedDown = getAudioFadeCurveControlPoint({
      handle: 'in',
      fadePixels: 40,
      clipWidthPixels: 120,
      curve: -0.6,
      curveX: 0.52,
    });

    expect(curvedUp.y).toBeLessThan(linear.y);
    expect(curvedDown.y).toBeGreaterThan(linear.y);
  });

  it('maps pointer offsets back into a clamped curve value', () => {
    expect(getAudioFadeCurveFromOffset({
      handle: 'in',
      pointerOffsetX: 20,
      pointerOffsetY: 0,
      fadePixels: 40,
      clipWidthPixels: 120,
      rowHeight: 40,
    }).curve).toBeGreaterThan(0);
    expect(getAudioFadeCurveFromOffset({
      handle: 'in',
      pointerOffsetX: 20,
      pointerOffsetY: 40,
      fadePixels: 40,
      clipWidthPixels: 120,
      rowHeight: 40,
    }).curve).toBeLessThan(0);
    const neutral = getAudioFadeCurveFromOffset({
      handle: 'in',
      pointerOffsetX: 20,
      pointerOffsetY: 20,
      fadePixels: 40,
      clipWidthPixels: 120,
      rowHeight: 40,
    });
    expect(neutral.curve).toBeCloseTo(0, 1);
    expect(neutral.curveX).toBeCloseTo(0.5, 1);
  });
});
