import { createLogger } from '@/shared/logging/logger';
import type { MoocSequenceDocument } from '@/types/mooc';
import { DEMO_SLIDES } from '../domain/demo';
import { buildSampleNarration, encodePcm16Wav } from '../domain/wav';
import { mediaLibraryService, useMediaLibraryStore } from '../deps/media-library-contract';

const logger = createLogger('MoocSampleAssets');

function needsSampleAssets(sequence: MoocSequenceDocument): boolean {
  if (sequence.sample.background && !sequence.backgroundMediaId) return true;
  if (sequence.sample.audio && !sequence.audioMediaId) return true;
  if (sequence.sample.lecturer && !sequence.lecturerMediaId) return true;
  if (sequence.sample.slides && sequence.slides.some((slide) => slide.sample && !slide.mediaId)) return true;
  return false;
}

function canvasFile(canvas: HTMLCanvasElement, name: string): Promise<File> {
  return new Promise((resolve, reject) => {
    canvas.toBlob((blob) => {
      if (!blob) {
        reject(new Error(`无法生成 ${name}`));
        return;
      }
      resolve(new File([blob], name, { type: 'image/png' }));
    }, 'image/png');
  });
}

function badge(ctx: CanvasRenderingContext2D, text: string): void {
  ctx.save();
  ctx.font = 'bold 28px sans-serif';
  const width = ctx.measureText(text).width + 28;
  ctx.fillStyle = '#fbbf24';
  ctx.fillRect(28, 28, width, 46);
  ctx.fillStyle = '#0f172a';
  ctx.fillText(text, 42, 60);
  ctx.restore();
}

function drawBackground(): HTMLCanvasElement {
  const canvas = document.createElement('canvas');
  canvas.width = 1280;
  canvas.height = 720;
  const ctx = canvas.getContext('2d');
  if (!ctx) return canvas;
  const gradient = ctx.createLinearGradient(0, 0, 0, 720);
  gradient.addColorStop(0, '#f8fbff');
  gradient.addColorStop(1, '#e7f0ff');
  ctx.fillStyle = gradient;
  ctx.fillRect(0, 0, 1280, 720);
  ctx.strokeStyle = 'rgba(59,130,246,0.2)';
  ctx.beginPath();
  ctx.arc(-40, -20, 280, 0, Math.PI * 2);
  ctx.stroke();
  ctx.strokeStyle = 'rgba(167,139,250,0.22)';
  ctx.beginPath();
  ctx.arc(1180, 760, 260, 0, Math.PI * 2);
  ctx.stroke();
  badge(ctx, '示例背景');
  return canvas;
}

function drawSlide(index: number): HTMLCanvasElement {
  const slide = DEMO_SLIDES[index] ?? DEMO_SLIDES[0];
  const canvas = document.createElement('canvas');
  canvas.width = 1280;
  canvas.height = 720;
  const ctx = canvas.getContext('2d');
  if (!ctx || !slide) return canvas;
  ctx.fillStyle = '#ffffff';
  ctx.fillRect(0, 0, 1280, 720);
  ctx.fillStyle = '#64748b';
  ctx.font = '24px sans-serif';
  ctx.fillText(slide.kicker, 56, 70);
  ctx.fillStyle = '#0f172a';
  ctx.font = 'bold 42px sans-serif';
  ctx.fillText(slide.title, 56, 140);
  ctx.fillStyle = '#334155';
  ctx.font = '28px sans-serif';
  ctx.fillText(slide.body, 56, 196);
  slide.cards.forEach((card, cardIndex) => {
    const x = 56 + cardIndex * 390;
    ctx.strokeStyle = '#cbd5e1';
    ctx.strokeRect(x, 260, 360, 220);
    ctx.fillStyle = '#ea580c';
    ctx.font = 'bold 22px sans-serif';
    ctx.fillText(card[0], x + 20, 304);
    ctx.fillStyle = '#0f172a';
    ctx.font = 'bold 24px sans-serif';
    ctx.fillText(card[1], x + 20, 348);
    ctx.fillStyle = '#475569';
    ctx.font = '20px sans-serif';
    ctx.fillText(card[2], x + 20, 390);
  });
  badge(ctx, '示例课件');
  return canvas;
}

function drawLecturer(): HTMLCanvasElement {
  const canvas = document.createElement('canvas');
  canvas.width = 480;
  canvas.height = 640;
  const ctx = canvas.getContext('2d');
  if (!ctx) return canvas;
  ctx.fillStyle = '#0f172a';
  ctx.fillRect(0, 0, 480, 640);
  ctx.fillStyle = '#fdba74';
  ctx.beginPath();
  ctx.arc(240, 190, 90, 0, Math.PI * 2);
  ctx.fill();
  ctx.fillStyle = '#1d4ed8';
  ctx.beginPath();
  ctx.ellipse(240, 520, 150, 180, 0, Math.PI, 0);
  ctx.fill();
  ctx.fillStyle = '#f8fafc';
  ctx.font = 'bold 28px sans-serif';
  ctx.textAlign = 'center';
  ctx.fillText('示例讲师静帧', 240, 80);
  ctx.font = '20px sans-serif';
  ctx.fillText('不是视频', 240, 116);
  return canvas;
}

async function importImage(projectId: string, canvas: HTMLCanvasElement, name: string, width: number, height: number) {
  const file = await canvasFile(canvas, name);
  return mediaLibraryService.importGeneratedImage(file, projectId, {
    width,
    height,
    tags: ['mooc-sample'],
  });
}

/**
 * Create labelled sample media through the real media library.
 * Existing ids are left alone. Failures stay visible as missing-media warnings.
 */
export async function ensureSampleAssets(
  projectId: string,
  sequence: MoocSequenceDocument
): Promise<MoocSequenceDocument> {
  if (!needsSampleAssets(sequence)) return sequence;
  let next: MoocSequenceDocument = {
    ...sequence,
    slides: sequence.slides.map((slide) => ({ ...slide })),
    packaging: {
      intro: { ...sequence.packaging.intro },
      outro: { ...sequence.packaging.outro },
    },
    sample: { ...sequence.sample },
  };

  try {
    if (next.sample.background && !next.backgroundMediaId) {
      const created = await importImage(projectId, drawBackground(), '示例背景.png', 1280, 720);
      next = { ...next, backgroundMediaId: created.id };
    }
  } catch (error) {
    logger.warn('Failed to store sample background', error);
  }

  try {
    if (next.sample.lecturer && !next.lecturerMediaId) {
      const created = await importImage(projectId, drawLecturer(), '示例讲师静帧.png', 480, 640);
      next = { ...next, lecturerMediaId: created.id, lecturerKind: 'image' };
    }
  } catch (error) {
    logger.warn('Failed to store sample lecturer', error);
  }

  for (let index = 0; index < next.slides.length; index += 1) {
    const slide = next.slides[index];
    if (!slide?.sample || slide.mediaId) continue;
    try {
      const created = await importImage(
        projectId,
        drawSlide(index),
        `示例课件-${String(index + 1).padStart(2, '0')}.png`,
        1280,
        720
      );
      const slides = next.slides.map((item, slideIndex) => (
        slideIndex === index ? { ...item, mediaId: created.id } : item
      ));
      next = { ...next, slides };
    } catch (error) {
      logger.warn(`Failed to store sample slide ${index}`, error);
    }
  }

  try {
    if (next.sample.audio && !next.audioMediaId) {
      const last = next.cues[next.cues.length - 1];
      const duration = Math.max(1, (last?.end ?? next.packaging.intro.duration + 1) - next.packaging.intro.duration);
      const samples = buildSampleNarration(duration, 16000);
      const bytes = encodePcm16Wav(samples, 16000);
      const file = new File([bytes], '示例旁白.wav', { type: 'audio/wav' });
      const created = await mediaLibraryService.importGeneratedAudio(file, projectId, {
        tags: ['mooc-sample'],
      });
      next = { ...next, audioMediaId: created.id };
    }
  } catch (error) {
    logger.warn('Failed to store sample narration', error);
  }

  await useMediaLibraryStore.getState().loadMediaItems();
  return next;
}
