import type { SseEvent } from './types.ts';

const DONE_SENTINEL = '[DONE]';
const DONE = Symbol('sse-done');

export function encodeSse(event: SseEvent): string {
  return `event: ${event.type}\ndata: ${JSON.stringify(event)}\n\n`;
}

/**
 * Sunucu (Edge Function) ile istemci (React Native) arasındaki tek SSE parser'ı.
 * `TextDecoder` akış modunda kullanıldığı için çok baytlı karakterler iki `read()`
 * arasında bölünse bile bozulmaz; `data: [DONE]` görüldüğünde akış kalıcı olarak kapanır.
 */
export async function* parseSseStream(
  stream: ReadableStream<Uint8Array>,
): AsyncGenerator<SseEvent> {
  const reader = stream.getReader();
  const decoder = new TextDecoder('utf-8');
  let buffer = '';
  let finished = false;

  const drain = (flush: boolean): SseEvent[] => {
    const events: SseEvent[] = [];
    let index: number;

    const push = (block: string) => {
      const event = blockToEvent(block);
      if (event === DONE) {
        finished = true;
        return false;
      }
      if (event) events.push(event);
      return true;
    };

    while ((index = buffer.indexOf('\n\n')) !== -1) {
      const block = buffer.slice(0, index);
      buffer = buffer.slice(index + 2);
      if (!push(block)) return events;
    }

    if (flush && buffer.trim()) {
      const block = buffer;
      buffer = '';
      push(block);
    }

    return events;
  };

  try {
    for (;;) {
      const { done, value } = await reader.read();
      if (done) break;
      buffer += decoder.decode(value, { stream: true });
      for (const event of drain(false)) yield event;
      if (finished) return;
    }
    buffer += decoder.decode();
    for (const event of drain(true)) yield event;
  } finally {
    reader.releaseLock();
  }
}

function blockToEvent(block: string): SseEvent | typeof DONE | null {
  let eventType: SseEvent['type'] | null = null;
  const dataLines: string[] = [];

  for (const rawLine of block.split('\n')) {
    const line = rawLine.endsWith('\r') ? rawLine.slice(0, -1) : rawLine;
    if (!line || line.startsWith(':')) continue;
    const colon = line.indexOf(':');
    const field = colon === -1 ? line : line.slice(0, colon);
    const value = colon === -1 ? '' : line.slice(colon + 1).replace(/^ /, '');
    if (field === 'event') eventType = value as SseEvent['type'];
    else if (field === 'data') dataLines.push(value);
  }

  if (dataLines.length === 0) return null;

  const data = dataLines.join('\n');
  if (data === DONE_SENTINEL) return DONE;

  try {
    // Gövde `type` alanını taşır; `event:` satırı yalnızca gövde boşsa devreye girer.
    const parsed = JSON.parse(data) as { type?: SseEvent['type'] };
    const type = parsed.type ?? eventType;
    return type ? ({ ...parsed, type } as SseEvent) : null;
  } catch {
    return null;
  }
}