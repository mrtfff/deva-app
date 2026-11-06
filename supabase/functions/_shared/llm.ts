import type { ChatMessage, LlmEnv, LlmProviderId } from './types.ts';

export interface StreamOptions {
  maxOutputTokens: number;
  signal?: AbortSignal;
}

export interface JsonOptions {
  maxOutputTokens: number;
  signal?: AbortSignal;
}

export interface LlmProvider {
  readonly id: LlmProviderId;
  stream(
    system: string,
    messages: ChatMessage[],
    opts: StreamOptions,
  ): AsyncGenerator<string>;
  json<T>(system: string, messages: ChatMessage[], opts: JsonOptions): Promise<T>;
}

const MOCK_CHAR_DELAY_MS = 18;

const MOCK_REFLECTIONS: readonly string[] = [
  'Anlıyorum. Buradayım ve dinliyorum.',
  'Bunu okurken içimde bir yerler bir şey kırıldı. Anlatmak istersen dinlerim.',
  'Böyle hissetmek çok yorucu olmalı. Nasıl geçiyor bu günler sende?',
  'Sana bir şey önermek zorunda değilim, sadece seninle burada olabilirim.',
  'Sesini duyuyorum. Devam etmek istersen, seni dinliyorum.',
  'Yavaşla, acele etmenin bir yeri yok. Ne söylemek istersen söyle.',
  'Bazen böyle anlarda tek yapılacak şey konuşmaktır. Ne söylemek istersin?',
  'Geçmişte böyle bir şey yaşadın mı, yoksa şimdi mi böyle hissediyorsun?',
];

function delay(ms: number, signal?: AbortSignal): Promise<void> {
  if (signal?.aborted) return Promise.resolve();

  const { promise, resolve } = Promise.withResolvers<void>();
  const finish = () => {
    clearTimeout(timer);
    signal?.removeEventListener('abort', finish);
    resolve();
  };
  const timer = setTimeout(finish, ms);
  signal?.addEventListener('abort', finish, { once: true });
  return promise;
}

class MockProvider implements LlmProvider {
  readonly id = 'mock' as const;

  async *stream(
    _system: string,
    messages: ChatMessage[],
    opts: StreamOptions,
  ): AsyncGenerator<string> {
    const lastUser = [...messages].reverse().find((m) => m.role === 'user');
    const wordCount = (lastUser?.content.trim().split(/\s+/).filter(Boolean).length) || 0;
    const reply = MOCK_REFLECTIONS[wordCount % MOCK_REFLECTIONS.length]!;

    for (const char of reply) {
      if (opts.signal?.aborted) return;
      await delay(MOCK_CHAR_DELAY_MS, opts.signal);
      if (opts.signal?.aborted) return;
      yield char;
    }
  }

  async json<T>(_system: string, _messages: ChatMessage[], _opts: JsonOptions): Promise<T> {
    return { notes: [] } as T;
  }
}

/** Sağlayıcının SSE gövdesini satır satır okur; çok baytlı karakterleri korur. */
async function* readSseDataLines(
  response: Response,
  signal?: AbortSignal,
): AsyncGenerator<string> {
  const body = response.body;
  if (!body) return;

  const reader = body.getReader();
  const decoder = new TextDecoder('utf-8');
  let buffer = '';

  try {
    for (;;) {
      if (signal?.aborted) return;
      const { done, value } = await reader.read();
      if (done) break;
      buffer += decoder.decode(value, { stream: true });
      let index: number;
      while ((index = buffer.indexOf('\n')) !== -1) {
        const line = buffer.slice(0, index).replace(/\r$/, '');
        buffer = buffer.slice(index + 1);
        if (line.startsWith('data:')) yield line.slice(5).trim();
      }
    }
    buffer += decoder.decode();
    const tail = buffer.trim();
    if (tail.startsWith('data:')) yield tail.slice(5).trim();
  } finally {
    reader.releaseLock();
  }
}

async function readError(response: Response, provider: string): Promise<Error> {
  let detail = '';
  try {
    detail = (await response.text()).slice(0, 400);
  } catch {
    /* gövde okunamazsa status yeterli */
  }
  return new Error(`${provider}_failed ${response.status}: ${detail}`);
}

class OpenAiProvider implements LlmProvider {
  readonly id = 'openai' as const;
  readonly #apiKey: string;
  readonly #fetch: typeof fetch;

  constructor(apiKey: string, fetchImpl: typeof fetch) {
    this.#apiKey = apiKey;
    this.#fetch = fetchImpl;
  }

  #headers(): Record<string, string> {
    return {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${this.#apiKey}`,
    };
  }

  async *stream(
    system: string,
    messages: ChatMessage[],
    opts: StreamOptions,
  ): AsyncGenerator<string> {
    const response = await this.#fetch('https://api.openai.com/v1/chat/completions', {
      method: 'POST',
      headers: this.#headers(),
      body: JSON.stringify({
        model: 'gpt-4o-mini',
        stream: true,
        max_tokens: opts.maxOutputTokens,
        messages: [
          { role: 'system', content: system },
          ...messages.map((m) => ({ role: m.role, content: m.content })),
        ],
      }),
      signal: opts.signal,
    });

    if (!response.ok) throw await readError(response, 'openai');

    for await (const data of readSseDataLines(response, opts.signal)) {
      if (data === '[DONE]') return;
      const delta = parseChunk<OpenAiChunk>(data)?.choices?.[0]?.delta?.content;
      if (delta) yield delta;
    }
  }

  async json<T>(system: string, messages: ChatMessage[], opts: JsonOptions): Promise<T> {
    const response = await this.#fetch('https://api.openai.com/v1/chat/completions', {
      method: 'POST',
      headers: this.#headers(),
      body: JSON.stringify({
        model: 'gpt-4o-mini',
        response_format: { type: 'json_object' },
        max_tokens: opts.maxOutputTokens,
        messages: [
          { role: 'system', content: system },
          ...messages.map((m) => ({ role: m.role, content: m.content })),
        ],
      }),
      signal: opts.signal,
    });

    if (!response.ok) throw await readError(response, 'openai');
    const payload = (await response.json()) as { choices?: { message?: { content?: string } }[] };
    const raw = payload.choices?.[0]?.message?.content ?? '{}';
    return JSON.parse(raw) as T;
  }
}

class AnthropicProvider implements LlmProvider {
  readonly id = 'anthropic' as const;
  readonly #apiKey: string;
  readonly #fetch: typeof fetch;

  constructor(apiKey: string, fetchImpl: typeof fetch) {
    this.#apiKey = apiKey;
    this.#fetch = fetchImpl;
  }

  #headers(): Record<string, string> {
    return {
      'Content-Type': 'application/json',
      'x-api-key': this.#apiKey,
      'anthropic-version': '2023-06-01',
    };
  }

  #body(system: string, messages: ChatMessage[], maxTokens: number) {
    return {
      model: 'claude-3-5-haiku-latest',
      max_tokens: maxTokens,
      system,
      messages: messages.map((m) => ({ role: m.role, content: m.content })),
    };
  }

  async *stream(
    system: string,
    messages: ChatMessage[],
    opts: StreamOptions,
  ): AsyncGenerator<string> {
    const response = await this.#fetch('https://api.anthropic.com/v1/messages', {
      method: 'POST',
      headers: this.#headers(),
      body: JSON.stringify({ ...this.#body(system, messages, opts.maxOutputTokens), stream: true }),
      signal: opts.signal,
    });

    if (!response.ok) throw await readError(response, 'anthropic');

    for await (const data of readSseDataLines(response, opts.signal)) {
      const event = parseChunk<AnthropicChunk>(data);
      if (event?.type === 'content_block_delta' && event.delta?.text) yield event.delta.text;
    }
  }

  async json<T>(system: string, messages: ChatMessage[], opts: JsonOptions): Promise<T> {
    const response = await this.#fetch('https://api.anthropic.com/v1/messages', {
      method: 'POST',
      headers: this.#headers(),
      body: JSON.stringify(this.#body(system, messages, opts.maxOutputTokens)),
      signal: opts.signal,
    });

    if (!response.ok) throw await readError(response, 'anthropic');
    const payload = (await response.json()) as { content?: { text?: string }[] };
    return JSON.parse(payload.content?.[0]?.text ?? '{}') as T;
  }
}

class GeminiProvider implements LlmProvider {
  readonly id = 'gemini' as const;
  readonly #apiKey: string;
  readonly #fetch: typeof fetch;

  constructor(apiKey: string, fetchImpl: typeof fetch) {
    this.#apiKey = apiKey;
    this.#fetch = fetchImpl;
  }

  #url(method: string): string {
    const base = 'https://generativelanguage.googleapis.com/v1beta/models/gemini-2.0-flash';
    return method === 'json' ? `${base}:generateContent?key=${this.#apiKey}` : `${base}:streamGenerateContent?alt=sse&key=${this.#apiKey}`;
  }

  #body(system: string, messages: ChatMessage[]) {
    return {
      systemInstruction: { parts: [{ text: system }] },
      contents: messages.map((m) => ({
        role: m.role === 'assistant' ? 'model' : 'user',
        parts: [{ text: m.content }],
      })),
    };
  }

  async *stream(
    system: string,
    messages: ChatMessage[],
    opts: StreamOptions,
  ): AsyncGenerator<string> {
    const response = await this.#fetch(this.#url('stream'), {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        ...this.#body(system, messages),
        generationConfig: { maxOutputTokens: opts.maxOutputTokens },
      }),
      signal: opts.signal,
    });

    if (!response.ok) throw await readError(response, 'gemini');

    for await (const data of readSseDataLines(response, opts.signal)) {
      const text = parseChunk<GeminiChunk>(data)?.candidates?.[0]?.content?.parts?.[0]?.text;
      if (text) yield text;
    }
  }

  async json<T>(system: string, messages: ChatMessage[], opts: JsonOptions): Promise<T> {
    const response = await this.#fetch(this.#url('json'), {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        ...this.#body(system, messages),
        generationConfig: { maxOutputTokens: opts.maxOutputTokens, responseMimeType: 'application/json' },
      }),
      signal: opts.signal,
    });

    if (!response.ok) throw await readError(response, 'gemini');
    const payload = (await response.json()) as { candidates?: { content?: { parts?: { text?: string }[] } }[] };
    return JSON.parse(payload.candidates?.[0]?.content?.parts?.[0]?.text ?? '{}') as T;
  }
}

interface OpenAiChunk {
  choices?: { delta?: { content?: string } }[];
}

interface AnthropicChunk {
  type?: string;
  delta?: { text?: string };
}

interface GeminiChunk {
  candidates?: { content?: { parts?: { text?: string }[] } }[];
}

function parseChunk<T>(data: string): T | null {
  try {
    return JSON.parse(data) as T;
  } catch {
    return null;
  }
}

export function createProvider(env: LlmEnv, fetchImpl: typeof fetch): LlmProvider {
  switch (env.provider) {
    case 'openai':
      return new OpenAiProvider(env.openaiApiKey ?? '', fetchImpl);
    case 'anthropic':
      return new AnthropicProvider(env.anthropicApiKey ?? '', fetchImpl);
    case 'gemini':
      return new GeminiProvider(env.geminiApiKey ?? '', fetchImpl);
    case 'mock':
    default:
      return new MockProvider();
  }
}