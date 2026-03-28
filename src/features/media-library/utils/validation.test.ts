import { describe, expect, it } from 'vitest';
import { getMediaType, getMimeType, validateMediaFile } from './validation';

describe('validation', () => {
  it('prefers known extension MIME mappings over browser-reported variants', () => {
    const file = new File(['data'], 'capture.mkv', { type: 'video/matroska' });

    expect(getMimeType(file)).toBe('video/x-matroska');
  });

  it('accepts newly supported avi, m4a, and svg files', () => {
    const avi = new File(['data'], 'clip.avi', { type: 'video/x-msvideo' });
    const m4a = new File(['data'], 'voice.m4a', { type: 'audio/mp4' });
    const svg = new File(['<svg></svg>'], 'graphic.svg', { type: '' });

    expect(validateMediaFile(avi)).toEqual({ valid: true });
    expect(validateMediaFile(m4a)).toEqual({ valid: true });
    expect(validateMediaFile(svg)).toEqual({ valid: true });
  });

  it('classifies alternate supported MIME types correctly', () => {
    expect(getMediaType('video/matroska')).toBe('video');
    expect(getMediaType('audio/mp4')).toBe('audio');
    expect(getMediaType('image/svg+xml')).toBe('image');
  });
});
