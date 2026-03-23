import { clampAudioFadeCurve, clampAudioFadeCurveX } from '@/shared/utils/audio-fade-curve';
import type { AudioFadeHandle } from './audio-fade';

export interface AudioFadeCurveControlPoint {
  x: number;
  y: number;
}

export function getAudioFadeCurveControlPoint(params: {
  handle: AudioFadeHandle;
  fadePixels: number;
  clipWidthPixels: number;
  curve: number | undefined;
  curveX?: number;
}): AudioFadeCurveControlPoint {
  const curve = clampAudioFadeCurve(params.curve);
  const startX = params.handle === 'in' ? 0 : Math.max(0, params.clipWidthPixels - params.fadePixels);
  const endX = params.handle === 'in' ? params.fadePixels : params.clipWidthPixels;
  const startY = params.handle === 'in' ? 100 : 0;
  const endY = params.handle === 'in' ? 0 : 100;
  const normalizedCurveX = clampAudioFadeCurveX(params.curveX);
  const linearX = startX + (endX - startX) * normalizedCurveX;
  const linearY = startY + (endY - startY) * normalizedCurveX;
  const upwardRange = linearY;
  const downwardRange = 100 - linearY;
  const controlY = curve >= 0
    ? linearY - curve * upwardRange
    : linearY - curve * downwardRange;

  return {
    x: Math.max(Math.min(startX, endX), Math.min(Math.max(startX, endX), linearX)),
    y: Math.max(0, Math.min(100, controlY)),
  };
}

export function getAudioFadeCurveFromOffset(params: {
  handle: AudioFadeHandle;
  pointerOffsetX: number;
  pointerOffsetY: number;
  fadePixels: number;
  clipWidthPixels: number;
  rowHeight: number;
}): { curve: number; curveX: number } {
  if (!Number.isFinite(params.rowHeight) || params.rowHeight <= 0 || params.fadePixels <= 0) {
    return { curve: 0, curveX: 0.52 };
  }

  const startX = params.handle === 'in' ? 0 : Math.max(0, params.clipWidthPixels - params.fadePixels);
  const endX = params.handle === 'in' ? params.fadePixels : params.clipWidthPixels;
  const curveX = clampAudioFadeCurveX((params.pointerOffsetX - startX) / Math.max(1, endX - startX));
  const y = Math.max(0, Math.min(100, (params.pointerOffsetY / params.rowHeight) * 100));
  const startY = params.handle === 'in' ? 100 : 0;
  const endY = params.handle === 'in' ? 0 : 100;
  const linearY = startY + (endY - startY) * curveX;
  if (y <= linearY) {
    const range = Math.max(1, linearY);
    return { curve: clampAudioFadeCurve((linearY - y) / range), curveX };
  }

  const range = Math.max(1, 100 - linearY);
  return { curve: clampAudioFadeCurve(-(y - linearY) / range), curveX };
}
