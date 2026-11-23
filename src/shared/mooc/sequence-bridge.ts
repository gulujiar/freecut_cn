import type { MoocSequenceDocument } from '@/types/mooc';

/**
 * Lets timeline save/load carry the MOOC document without importing the MOOC feature.
 * The reader is registered by the MOOC store once it knows whether a document is loaded.
 * `undefined` means "do not touch the stored field".
 */

type MoocReader = () => MoocSequenceDocument | null | undefined;

let reader: MoocReader | null = null;
let stashed: unknown;
let hasStash = false;

export function registerMoocSequenceReader(next: MoocReader): void {
  reader = next;
}

export function readMoocSequenceForPersistence(): MoocSequenceDocument | null | undefined {
  return reader ? reader() : undefined;
}

export function moocSequencePersistencePatch(): { moocSequence?: MoocSequenceDocument | null } {
  const value = readMoocSequenceForPersistence();
  if (value === undefined) return {};
  return { moocSequence: value };
}

export function stashLoadedMoocSequence(value: unknown): void {
  stashed = value;
  hasStash = true;
}

export function takeLoadedMoocSequence(): { present: boolean; value: unknown } {
  if (!hasStash) return { present: false, value: undefined };
  hasStash = false;
  const value = stashed;
  stashed = undefined;
  return { present: true, value };
}

/** Test helper. */
export function resetMoocSequenceBridge(): void {
  reader = null;
  stashed = undefined;
  hasStash = false;
}
