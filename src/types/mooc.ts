/**
 * FreeCut MOOC sequence document.
 *
 * Times are seconds on the master timeline. Cue times already include the
 * intro offset: a lecture-relative SRT cue at 0s starts at `intro.duration`.
 * This is not a Final Cut Pro or Premiere sequence.
 */

export const MOOC_SEQUENCE_VERSION = '1.0' as const;

/** Hard cap so non-finite-adjacent values and accidental huge numbers are rejected. */
export const MOOC_MAX_SECONDS = 6 * 60 * 60;

export type MoocCamera = 'ppt' | 'pip' | 'half';

export const MOOC_CAMERAS: readonly MoocCamera[] = ['ppt', 'pip', 'half'];

export interface MoocCue {
  id: string;
  /** Inclusive start on the master timeline, in seconds. */
  start: number;
  /** Exclusive end on the master timeline, in seconds. */
  end: number;
  /** Exactly one camera is active for this cue. */
  camera: MoocCamera;
  /** Index into `slides`. */
  slide: number;
  text: string;
}

export interface MoocPackagingSide {
  duration: number;
  title: string;
  subtitle: string;
  /** FreeCut media-library id. Absent when the side is title text over the shared background. */
  mediaId?: string;
  /** True when this side's generated title card is sample content. */
  sample: boolean;
}

export interface MoocSlideAsset {
  label: string;
  /** FreeCut media-library id of a slide image. */
  mediaId?: string;
  sample: boolean;
}

export interface MoocSampleFlags {
  audio: boolean;
  lecturer: boolean;
  slides: boolean;
  background: boolean;
}

export interface MoocSequenceDocument {
  version: typeof MOOC_SEQUENCE_VERSION;
  title: string;
  packaging: {
    intro: MoocPackagingSide;
    outro: MoocPackagingSide;
  };
  cues: MoocCue[];
  /** Lecture narration. Plays as one clip from the end of the intro through the lecture body. */
  audioMediaId?: string;
  lecturerMediaId?: string;
  lecturerKind?: 'video' | 'image';
  slides: MoocSlideAsset[];
  backgroundMediaId?: string;
  sample: MoocSampleFlags;
}
