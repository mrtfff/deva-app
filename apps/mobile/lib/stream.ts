import { fetch as expoFetch } from 'expo/fetch';
import { parseSseStream } from '@shared/sse';
import type { SseEvent } from '@shared/types';
import { ApiError } from './api';
import { supabase } from './supabase';
import { LOCAL_MODE } from './mode';
import { runLocalChat } from './local/localChat';

interface StreamBody {
  conversationId?: string;
  content: string;
  skipCrisisCheck?: boolean;
}

/**
 * Sohbet akışı.
 *
 * Gerçek modda React Native'in standart `fetch`i `Response.body` streaming
 * desteklemediği için `expo/fetch` kullanılır; parser her iki tarafta
 * `supabase/functions/_shared/sse.ts` dosyasından gelir.
 * Yerel modda akış cihaz içinde üretilir.
 */
export async function streamChat(
  body: StreamBody,
  onEvent: (event: SseEvent) => void,
  signal?: AbortSignal,
): Promise<void> {
  if (LOCAL_MODE) {
    await runLocalChat(body, onEvent, signal);
    return;
  }

  const url = `${process.env.EXPO_PUBLIC_SUPABASE_URL ?? 'http://127.0.0.1:54321'}/functions/v1/chat`;
  const { data } = await supabase.auth.getSession();

  const response = await expoFetch(url, {
    method: 'POST',
    headers: {
      apikey: process.env.EXPO_PUBLIC_SUPABASE_ANON_KEY ?? '',
      Authorization: `Bearer ${data.session?.access_token ?? ''}`,
      'Content-Type': 'application/json',
      Accept: 'text/event-stream',
    },
    body: JSON.stringify(body),
    signal,
  });

  if (!response.ok) {
    const code = await response
      .json()
      .then((payload: { code?: ApiError['code'] }) => payload?.code)
      .catch(() => undefined);
    throw new ApiError(code ?? 'provider_failed');
  }

  if (!response.body) throw new ApiError('provider_failed');

  for await (const event of parseSseStream(response.body as ReadableStream<Uint8Array>)) {
    onEvent(event);
  }
}
