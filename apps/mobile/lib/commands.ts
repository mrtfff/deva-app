export type MemoryCommand = { kind: 'note' | 'forget'; content: string };

/**
 * Sohbet içi komutlar:
 *   `hatırla: …` → not eklenir, kalan metin sohbete gider
 *   `unut: …`    → eşleşen not silinir, sohbete hiçbir şey gitmez
 * Eşleşme yoksa `null` döner ve mesaj normal sohbet mesajıdır.
 */
export function parseMemoryCommand(text: string): MemoryCommand | null {
  const note = /^hatırla:\s*(.{3,})$/i.exec(text.trim());
  if (note) return { kind: 'note', content: note[1]!.trim() };

  const forget = /^unut:\s*(.{3,})$/i.exec(text.trim());
  if (forget) return { kind: 'forget', content: forget[1]!.trim() };

  return null;
}

/** Not içeriğinde arama yaparken kullanılan normalize metin. */
export function normalizeNoteText(input: string): string {
  return input
    .toLocaleLowerCase('tr-TR')
    .normalize('NFD')
    .replace(/[̀-ͯ]/g, '')
    .replace(/\s+/g, ' ')
    .trim();
}

/** `unut:` komutunun hangi notu hedeflediğini bulur. */
export function findMatchingNote<T extends { content: string }>(
  notes: T[],
  query: string,
): T | undefined {
  const needle = normalizeNoteText(query);
  if (!needle) return undefined;
  return notes.find((note) => normalizeNoteText(note.content).includes(needle));
}