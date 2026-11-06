import { normalizeText } from './crisis.ts';

export const MEMORY_CATEGORIES = ['fact', 'preference', 'event', 'context'] as const;
export type MemoryCategory = (typeof MEMORY_CATEGORIES)[number];

export const MAX_NEW_NOTES = 2;
export const MAX_NOTE_LENGTH = 80;

export interface ExistingNote {
  id: string;
  content: string;
}

export interface NoteCandidate {
  content: string;
  category: string;
}

export interface NewNote {
  content: string;
  category: MemoryCategory;
}

/**
 * Aynı olguya işaret eden aday notları eler. Karşılaştırma normalize edilmiş
 * metin üzerinden yapılır: mevcut not adayın içinde geçiyorsa ya da ilk token'ı
 * aynıysa aday atılır.
 */
export function mergeMemoryNotes(
  existing: ExistingNote[],
  candidates: NoteCandidate[],
): NewNote[] {
  const seen = existing.map((note) => normalizeText(note.content)).filter(Boolean);
  const accepted: NewNote[] = [];

  for (const candidate of candidates) {
    if (accepted.length >= MAX_NEW_NOTES) break;

    const category = candidate.category as MemoryCategory;
    if (!MEMORY_CATEGORIES.includes(category)) continue;

    const content = candidate.content.trim().replace(/\s+/g, ' ');
    if (content.length === 0 || content.length > MAX_NOTE_LENGTH) continue;

    const normalized = normalizeText(content);
    if (!normalized) continue;

    const firstToken = normalized.split(' ')[0]!;
    const isDuplicate = [...seen, ...accepted.map((n) => normalizeText(n.content))].some(
      (note) =>
        note.includes(normalized) ||
        normalized.includes(note) ||
        note.split(' ')[0] === firstToken,
    );
    if (isDuplicate) continue;

    accepted.push({ content, category });
    seen.push(normalized);
  }

  return accepted;
}