import { createLogger } from '@/shared/logging/logger';

const logger = createLogger('KittenTtsService');

type ModelSize = 'nano' | 'micro' | 'mini';
type KittenTTSEngine = any;

const MB = 1024 * 1024;

export type KittenTtsVoice =
  | 'Bella'
  | 'Luna'
  | 'Rosie'
  | 'Kiki'
  | 'Jasper'
  | 'Bruno'
  | 'Hugo'
  | 'Leo';

export interface KittenTtsModelOption {
  value: ModelSize;
  label: string;
  downloadLabel: string;
  qualityLabel: string;
  estimatedBytes: number;
}

export const KITTEN_TTS_MODEL_OPTIONS: KittenTtsModelOption[] = [
  { value: 'nano', label: 'Nano', downloadLabel: '24 MB', qualityLabel: 'Fastest', estimatedBytes: 24 * MB },
  { value: 'micro', label: 'Micro', downloadLabel: '41 MB', qualityLabel: 'Balanced', estimatedBytes: 41 * MB },
  { value: 'mini', label: 'Mini', downloadLabel: '78 MB', qualityLabel: 'Best quality', estimatedBytes: 78 * MB },
];

export const KITTEN_TTS_VOICE_OPTIONS: Array<{ value: KittenTtsVoice; label: string }> = [
  { value: 'Bella', label: 'Bella' },
  { value: 'Luna', label: 'Luna' },
  { value: 'Rosie', label: 'Rosie' },
  { value: 'Kiki', label: 'Kiki' },
  { value: 'Jasper', label: 'Jasper' },
  { value: 'Bruno', label: 'Bruno' },
  { value: 'Hugo', label: 'Hugo' },
  { value: 'Leo', label: 'Leo' },
];

class KittenTtsService {
  isSupported(): boolean {
    return false;
  }

  async generateSpeechFile(): Promise<{ blob: Blob; file: File; duration: number }> {
    throw new Error('Kitten TTS is not available');
  }

  async unloadModel(): Promise<void> {
  }
}

export const kittenTtsService = new KittenTtsService();
