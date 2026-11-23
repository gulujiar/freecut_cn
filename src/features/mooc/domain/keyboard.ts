import { HOTKEY_OPTIONS } from '@/config/hotkeys';

/**
 * Text entry owns Space and the camera keys.
 * Space playback itself is the editor hotkey, which ignores form tags
 * (`HOTKEY_OPTIONS.enableOnFormTags === false`). Camera keys 1/2/3 use this check.
 */
export function isTextEntryTarget(target: EventTarget | null): boolean {
  if (!(target instanceof HTMLElement)) return false;
  if (target.isContentEditable || target.contentEditable === 'true') return true;
  const editable = target.getAttribute('contenteditable');
  if (editable && editable.toLowerCase() !== 'false') return true;
  const tag = target.tagName;
  return tag === 'INPUT' || tag === 'TEXTAREA' || tag === 'SELECT';
}

export function editorPlayPauseIgnoresTextEntry(): boolean {
  return HOTKEY_OPTIONS.enableOnFormTags === false;
}
