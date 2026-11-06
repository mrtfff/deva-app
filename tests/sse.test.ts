import { describe, expect, it } from 'vitest';
import { encodeSse, parseSseStream } from '../supabase/functions/_shared/sse.ts';
import type { SseEvent } from '../supabase/functions/_shared/types.ts';

const encoder = new TextEncoder();

function streamOf(chunks: Uint8Array[]): ReadableStream<Uint8Array> {
  return new ReadableStream<Uint8Array>({
    start(controller) {
      for (const chunk of chunks) controller.enqueue(chunk);
      controller.close();
    },
  });
}

function textChunks(...parts: string[]): Uint8Array[] {
  return parts.map((part) => encoder.encode(part));
}

async function collect(stream: ReadableStream<Uint8Array>): Promise<SseEvent[]> {
  const events: SseEvent[] = [];
  for await (const event of parseSseStream(stream)) events.push(event);
  return events;
}

describe('encodeSse', () => {
  it('olayı event/data çifti olarak yazar', () => {
    expect(encodeSse({ type: 'delta', text: 'merhaba' })).toBe(
      'event: delta\ndata: {"type":"delta","text":"merhaba"}\n\n',
    );
  });

  it('içinde satır sonu olan metni olduğu gibi gömer', () => {
    const encoded = encodeSse({ type: 'delta', text: 'satır1\nsatır2' });
    expect(encoded.split('\n').filter((l) => l.startsWith('data:'))).toHaveLength(1);
    const payload = encoded.slice(encoded.indexOf('\ndata: ') + '\ndata: '.length, -2);
    expect(JSON.parse(payload).text).toBe('satır1\nsatır2');
  });
});

describe('parseSseStream', () => {
  it('olayları sırayla üretir', async () => {
    const events = await collect(
      streamOf(
        textChunks(
          'event: quota\ndata: {"type":"quota","used":1,"limit":30,"degraded":false}\n\n',
          'event: delta\ndata: {"type":"delta","text":"a"}\n\n',
          'event: done\ndata: {"type":"done","messageId":"m1","celebrate":true,"quota":{"used":2,"limit":30,"degraded":false}}\n\n',
        ),
      ),
    );
    expect(events.map((e) => e.type)).toEqual(['quota', 'delta', 'done']);
  });

  it('olayı iki read() çağrısına bölünmüş halde de çözer', async () => {
    const full = 'event: delta\ndata: {"type":"delta","text":"şş"}\n\n';
    const cut = full.indexOf('data:') + 6;
    const events = await collect(streamOf(textChunks(full.slice(0, cut), full.slice(cut))));
    expect(events).toEqual([{ type: 'delta', text: 'şş' }]);
  });

  it('çok baytlı karakter iki parça arasında bölünse de bozulmaz', async () => {
    const payload = JSON.stringify({ type: 'delta', text: 'şşş' });
    const bytes = encoder.encode(`event: delta\ndata: ${payload}\n\n`);
    // 'ş' = 0xC5 0x9F; çok baytlı diziyi tam ortadan bölüyoruz.
    const cut = bytes.indexOf(0xc5) + 1;
    const events = await collect(
      streamOf([bytes.slice(0, cut), bytes.slice(cut)]),
    );
    expect(events).toEqual([{ type: 'delta', text: 'şşş' }]);
  });

  it('satır sonu parçaları arasında bölünse de olayı bulur', async () => {
    const events = await collect(
      streamOf(textChunks('event: del', 'ta\ndata: {"type":"delta","text":"x"}\n', '\n')),
    );
    expect(events).toEqual([{ type: 'delta', text: 'x' }]);
  });

  it('boş satırları ve yorum satırlarını yok sayar', async () => {
    const events = await collect(
      streamOf(
        textChunks('\n\n: ping\n\nevent: delta\ndata: {"type":"delta","text":"x"}\n\n\n\n'),
      ),
    );
    expect(events).toEqual([{ type: 'delta', text: 'x' }]);
  });

  it('data alanı olmayan bloğu yok sayar', async () => {
    const events = await collect(streamOf(textChunks('event: delta\n\n', ': yalnızca yorum\n\n')));
    expect(events).toEqual([]);
  });

  it('[DONE] sentinelinde kapanır ve sonrasını okumaz', async () => {
    const events = await collect(
      streamOf(
        textChunks(
          'event: delta\ndata: {"type":"delta","text":"x"}\n\n',
          'data: [DONE]\n\n',
          'event: delta\ndata: {"type":"delta","text":"yok say"}\n\n',
        ),
      ),
    );
    expect(events).toEqual([{ type: 'delta', text: 'x' }]);
  });

  it('son olayın arkasında boş satır gelmese de onu üretir', async () => {
    const events = await collect(
      streamOf(textChunks('event: delta\ndata: {"type":"delta","text":"son"}')),
    );
    expect(events).toEqual([{ type: 'delta', text: 'son' }]);
  });

  it('çok satırlı data alanını birleştirir', async () => {
    const events = await collect(
      streamOf(textChunks('event: delta\ndata: {"type":"delta",\ndata: "text":"çok"}\n\n')),
    );
    expect(events).toEqual([{ type: 'delta', text: 'çok' }]);
  });
});