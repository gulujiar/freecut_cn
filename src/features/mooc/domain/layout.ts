import type { MoocCamera } from '@/types/mooc';
import type { TransformProperties } from '@/types/transform';

/**
 * Fractions of the canvas. The background rect never changes between cameras,
 * so the backdrop does not jump when a cue switches view.
 * Slide and lecturer rects are the three mutually exclusive body layouts.
 */
export interface FrameRect {
  left: number;
  top: number;
  width: number;
  height: number;
}

export const BACKGROUND_RECT: FrameRect = { left: 0, top: 0, width: 1, height: 1 };

export const CAMERA_SLIDE_RECT: Record<MoocCamera, FrameRect> = {
  ppt: { left: 0.058, top: 0.058, width: 0.884, height: 0.884 },
  pip: { left: 0.026, top: 0.089, width: 0.767, height: 0.767 },
  half: { left: 0.099, top: 0.152, width: 0.658, height: 0.658 },
};

export const CAMERA_LECTURER_RECT: Record<Exclude<MoocCamera, 'ppt'>, FrameRect> = {
  pip: { left: 1 - 0.032 - 0.167, top: 1 - 0.089 - 0.36, width: 0.167, height: 0.36 },
  half: { left: 1 - 0.04 - 0.22, top: 0.16, width: 0.22, height: 0.68 },
};

export function rectToTransform(
  rect: FrameRect,
  canvasWidth: number,
  canvasHeight: number
): TransformProperties {
  const width = rect.width * canvasWidth;
  const height = rect.height * canvasHeight;
  const centerX = (rect.left + rect.width / 2) * canvasWidth;
  const centerY = (rect.top + rect.height / 2) * canvasHeight;
  return {
    x: centerX - canvasWidth / 2,
    y: centerY - canvasHeight / 2,
    width,
    height,
    rotation: 0,
    opacity: 1,
  };
}

export function backgroundTransform(canvasWidth: number, canvasHeight: number): TransformProperties {
  return rectToTransform(BACKGROUND_RECT, canvasWidth, canvasHeight);
}

export function slideTransform(
  camera: MoocCamera,
  canvasWidth: number,
  canvasHeight: number
): TransformProperties {
  return rectToTransform(CAMERA_SLIDE_RECT[camera], canvasWidth, canvasHeight);
}

export function lecturerTransform(
  camera: Exclude<MoocCamera, 'ppt'>,
  canvasWidth: number,
  canvasHeight: number
): TransformProperties {
  return rectToTransform(CAMERA_LECTURER_RECT[camera], canvasWidth, canvasHeight);
}

export const CAMERA_LABEL: Record<MoocCamera, string> = {
  ppt: '纯 PPT',
  pip: 'PPT + 人像',
  half: 'PPT + 半身',
};
