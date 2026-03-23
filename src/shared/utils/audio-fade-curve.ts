export const AUDIO_FADE_CURVE_MIN = -1;
export const AUDIO_FADE_CURVE_MAX = 1;
export const AUDIO_FADE_CURVE_X_MIN = 0.15;
export const AUDIO_FADE_CURVE_X_MAX = 0.85;
export const AUDIO_FADE_CURVE_X_DEFAULT = 0.52;

export function clampAudioFadeCurve(curve: number | undefined): number {
  const value = typeof curve === 'number' && Number.isFinite(curve) ? curve : 0;
  return Math.max(AUDIO_FADE_CURVE_MIN, Math.min(AUDIO_FADE_CURVE_MAX, Math.round(value * 100) / 100));
}

export function clampAudioFadeCurveX(curveX: number | undefined): number {
  const value = typeof curveX === 'number' && Number.isFinite(curveX) ? curveX : AUDIO_FADE_CURVE_X_DEFAULT;
  return Math.max(AUDIO_FADE_CURVE_X_MIN, Math.min(AUDIO_FADE_CURVE_X_MAX, Math.round(value * 1000) / 1000));
}

function getFadeInControlY(curve: number | undefined, curveX: number | undefined): number {
  const normalizedX = clampAudioFadeCurveX(curveX);
  const normalizedCurve = clampAudioFadeCurve(curve);
  const linearY = normalizedX;
  const upwardRange = 1 - linearY;
  const downwardRange = linearY;
  return normalizedCurve >= 0
    ? linearY + normalizedCurve * upwardRange
    : linearY + normalizedCurve * downwardRange;
}

function getFadeOutControlY(curve: number | undefined, curveX: number | undefined): number {
  const normalizedX = clampAudioFadeCurveX(curveX);
  const normalizedCurve = clampAudioFadeCurve(curve);
  const linearY = 1 - normalizedX;
  const upwardRange = 1 - linearY;
  const downwardRange = linearY;
  return normalizedCurve >= 0
    ? linearY + normalizedCurve * upwardRange
    : linearY + normalizedCurve * downwardRange;
}

function solveQuadraticBezierTime(progress: number, controlX: number): number {
  const x = Math.max(0, Math.min(1, progress));
  const cx = clampAudioFadeCurveX(controlX);
  const a = 1 - (2 * cx);
  const b = 2 * cx;
  const c = -x;

  if (Math.abs(a) < 0.000001) {
    return b === 0 ? x : Math.max(0, Math.min(1, x / b));
  }

  const discriminant = Math.max(0, (b * b) - (4 * a * c));
  const sqrt = Math.sqrt(discriminant);
  const t1 = (-b + sqrt) / (2 * a);
  const t2 = (-b - sqrt) / (2 * a);
  if (t1 >= 0 && t1 <= 1) return t1;
  if (t2 >= 0 && t2 <= 1) return t2;
  return Math.max(0, Math.min(1, t1));
}

function evaluateQuadraticBezierY(progress: number, controlX: number, controlY: number, startY: number, endY: number): number {
  const t = solveQuadraticBezierTime(progress, controlX);
  const oneMinusT = 1 - t;
  return (oneMinusT * oneMinusT * startY) + (2 * oneMinusT * t * controlY) + (t * t * endY);
}

export function evaluateAudioFadeInCurve(progress: number, curve: number | undefined, curveX?: number): number {
  return evaluateQuadraticBezierY(progress, clampAudioFadeCurveX(curveX), getFadeInControlY(curve, curveX), 0, 1);
}

export function evaluateAudioFadeOutCurve(progress: number, curve: number | undefined, curveX?: number): number {
  return evaluateQuadraticBezierY(progress, clampAudioFadeCurveX(curveX), getFadeOutControlY(curve, curveX), 1, 0);
}
