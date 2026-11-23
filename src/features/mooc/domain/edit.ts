import type { MoocCamera, MoocSequenceDocument, MoocSlideAsset } from '@/types/mooc';
import { canonSeconds } from './time';

export function setCueCamera(
  sequence: MoocSequenceDocument,
  cueId: string,
  camera: MoocCamera
): MoocSequenceDocument {
  const cue = sequence.cues.find((item) => item.id === cueId);
  if (!cue || cue.camera === camera) return sequence;
  return {
    ...sequence,
    cues: sequence.cues.map((item) => (item.id === cueId ? { ...item, camera } : item)),
  };
}

export function setCueText(
  sequence: MoocSequenceDocument,
  cueId: string,
  text: string
): MoocSequenceDocument {
  if (!sequence.cues.some((cue) => cue.id === cueId)) return sequence;
  return {
    ...sequence,
    cues: sequence.cues.map((cue) => (cue.id === cueId ? { ...cue, text } : cue)),
  };
}

export function setCueSlide(
  sequence: MoocSequenceDocument,
  cueId: string,
  slide: number
): MoocSequenceDocument {
  if (!Number.isInteger(slide) || slide < 0) return sequence;
  if (sequence.slides.length > 0 && slide >= sequence.slides.length) return sequence;
  if (!sequence.cues.some((cue) => cue.id === cueId)) return sequence;
  return {
    ...sequence,
    cues: sequence.cues.map((cue) => (cue.id === cueId ? { ...cue, slide } : cue)),
  };
}

/** Move every cue by the intro delta so lecture-relative timing stays put. */
export function withIntroDuration(
  sequence: MoocSequenceDocument,
  duration: number
): MoocSequenceDocument {
  const next = canonSeconds(duration);
  const delta = canonSeconds(next - sequence.packaging.intro.duration);
  return {
    ...sequence,
    packaging: {
      ...sequence.packaging,
      intro: { ...sequence.packaging.intro, duration: next },
    },
    cues: sequence.cues.map((cue) => ({
      ...cue,
      start: canonSeconds(cue.start + delta),
      end: canonSeconds(cue.end + delta),
    })),
  };
}

export function withOutroDuration(
  sequence: MoocSequenceDocument,
  duration: number
): MoocSequenceDocument {
  return {
    ...sequence,
    packaging: {
      ...sequence.packaging,
      outro: { ...sequence.packaging.outro, duration: canonSeconds(duration) },
    },
  };
}

export function withPackagingText(
  sequence: MoocSequenceDocument,
  side: 'intro' | 'outro',
  field: 'title' | 'subtitle',
  value: string
): MoocSequenceDocument {
  return {
    ...sequence,
    packaging: {
      ...sequence.packaging,
      [side]: { ...sequence.packaging[side], [field]: value },
    },
  };
}

export function appendSlide(
  sequence: MoocSequenceDocument,
  slide: MoocSlideAsset
): MoocSequenceDocument {
  const slides = [...sequence.slides, slide];
  return {
    ...sequence,
    slides,
    sample: { ...sequence.sample, slides: slides.some((item) => item.sample) },
  };
}

export function removeSlide(sequence: MoocSequenceDocument, index: number): MoocSequenceDocument {
  if (!Number.isInteger(index) || index < 0 || index >= sequence.slides.length) return sequence;
  const slides = sequence.slides.filter((_, slideIndex) => slideIndex !== index);
  const cues = sequence.cues.map((cue) => {
    if (cue.slide === index) return { ...cue, slide: 0 };
    if (cue.slide > index) return { ...cue, slide: cue.slide - 1 };
    return cue;
  });
  return {
    ...sequence,
    slides,
    cues,
    sample: { ...sequence.sample, slides: slides.some((slide) => slide.sample) },
  };
}
