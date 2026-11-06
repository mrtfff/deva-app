import { describe, expect, it, vi } from 'vitest';
import { createProvider } from '../supabase/functions/_shared/llm.ts';

async function drain(gen: AsyncGenerator<string>): Promise<string> {
  let out = '';
  for await (const chunk of gen) out += chunk;
  return out;
}

const conversation = (text: string) => [{ role: 'user' as const, content: text }];

describe('mock sağlayıcı', () => {
  const provider = createProvider({ provider: 'mock' }, globalThis.fetch);

  it('aynı girdi için deterministik yanıt üretir', async () => {
    const a = await drain(provider.stream('sistem', conversation('bugün çok yorgunum'), { maxOutputTokens: 100 }));
    const b = await drain(provider.stream('sistem', conversation('bugün çok yorgunum'), { maxOutputTokens: 100 }));
    expect(a).toBe(b);
    expect(a.length).toBeGreaterThan(0);
  });

  it('kelime sayısına göre farklı yansıtma cümleleri seçer', async () => {
    const one = await drain(provider.stream('s', conversation('yalnızım'), { maxOutputTokens: 100 }));
    const many = await drain(
      provider.stream('s', conversation('bugün çok yalnız hissediyorum ve uyuyamıyorum'), {
        maxOutputTokens: 100,
      }),
    );
    expect(one).not.toBe(many);
  });

  it('Türkçe, kısa ve bir tavsiye cümlesi içermeyen yansıtma üretir', async () => {
    const reply = await drain(
      provider.stream('s', conversation('hiçbir şey hissetmiyorum'), { maxOutputTokens: 100 }),
    );
    expect(reply).not.toMatch(/\b(tavsiye|öneriyorum|ilaç|terapi|depresyon|anksiyete)\b/i);
  });

  it('json çağrısında not çıkarmaz', async () => {
    await expect(
      provider.json<{ notes: unknown[] }>('sistem', conversation('merhaba'), { maxOutputTokens: 100 }),
    ).resolves.toEqual({ notes: [] });
  });

  it('iptal sinyali geldiğinde üreticiyi durdurur', async () => {
    const controller = new AbortController();
    const gen = provider.stream('s', conversation('yalnızım'), {
      maxOutputTokens: 100,
      signal: controller.signal,
    });

    const first = await gen.next();
    controller.abort();
    const rest: string[] = [];
    for (;;) {
      const next = await gen.next();
      if (next.done) break;
      rest.push(next.value);
    }

    expect(first.done).toBe(false);
    expect(rest.join('')).toBe('');
  });
});

describe('openai sağlayıcı', () => {
  it('istek gövdesinde stream:true ve Authorization başlığı gönderir', async () => {
    const calls: { url: string; init: RequestInit }[] = [];
    const stubFetch = (async (url: string, init: RequestInit) => {
      calls.push({ url: String(url), init });
      const sseBody =
        'data: {"choices":[{"delta":{"content":"mer"}}]}\n\n' +
        'data: {"choices":[{"delta":{"content":"haba"}}]}\n\n' +
        'data: [DONE]\n\n';
      return new Response(sseBody, {
        headers: { 'Content-Type': 'text/event-stream' },
      });
    }) as unknown as typeof fetch;

    const provider = createProvider({ provider: 'openai', openaiApiKey: 'sk-test' }, stubFetch);
    const reply = await drain(
      provider.stream('sistem', conversation('merhaba'), { maxOutputTokens: 100 }),
    );

    expect(reply).toBe('merhaba');
    expect(calls).toHaveLength(1);
    expect(calls[0]!.url).toBe('https://api.openai.com/v1/chat/completions');

    const headers = calls[0]!.init.headers as Record<string, string>;
    expect(headers.Authorization).toBe('Bearer sk-test');

    const body = JSON.parse(String(calls[0]!.init.body));
    expect(body.stream).toBe(true);
    expect(body.messages[0]).toEqual({ role: 'system', content: 'sistem' });
    expect(body.max_tokens).toBe(100);
  });

  it('json modunda response_format ister', async () => {
    const stubFetch = (async (_url: string, init: RequestInit) => {
      const body = JSON.parse(String(init.body));
      expect(body.response_format).toEqual({ type: 'json_object' });
      expect(body.stream).toBeUndefined();
      return new Response(
        JSON.stringify({ choices: [{ message: { content: '{"notes":[]}' } }] }),
        { headers: { 'Content-Type': 'application/json' } },
      );
    }) as unknown as typeof fetch;

    const provider = createProvider({ provider: 'openai', openaiApiKey: 'sk-test' }, stubFetch);
    await expect(
      provider.json<{ notes: unknown[] }>('sistem', conversation('merhaba'), { maxOutputTokens: 50 }),
    ).resolves.toEqual({ notes: [] });
  });

  it('sağlayıcı hata verirse provider_failed fırlatır', async () => {
    const stubFetch = (async () => new Response('boom', { status: 500 })) as unknown as typeof fetch;
    const provider = createProvider({ provider: 'openai', openaiApiKey: 'sk-test' }, stubFetch);
    await expect(
      drain(provider.stream('sistem', conversation('merhaba'), { maxOutputTokens: 10 })),
    ).rejects.toThrow(/openai_failed/);
  });

  it('gemini sağlayıcı da aynı arayüzü uygular', async () => {
    const fetchSpy = vi.fn(
      async () =>
        new Response('data: {"candidates":[{"content":{"parts":[{"text":"tamam"}]}}]}\n\n', {
          headers: { 'Content-Type': 'text/event-stream' },
        }),
    );
    const provider = createProvider(
      { provider: 'gemini', geminiApiKey: 'k' },
      fetchSpy as unknown as typeof fetch,
    );
    expect(provider.id).toBe('gemini');
    await expect(
      drain(provider.stream('sistem', conversation('merhaba'), { maxOutputTokens: 10 })),
    ).resolves.toBe('tamam');
  });
});