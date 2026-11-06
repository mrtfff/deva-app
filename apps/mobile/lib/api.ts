import type { SupabaseClient } from '@supabase/supabase-js';
import { supabase } from './supabase';
import { LOCAL_MODE } from './mode';

/** Sunucu tarafındaki hata kodları. */
export type ApiErrorCode =
  | 'provider_failed'
  | 'unauthorized'
  | 'invalid_request'
  | 'network_error';

export class ApiError extends Error {
  readonly code: ApiErrorCode;

  constructor(code: ApiErrorCode) {
    super(code);
    this.code = code;
  }
}

interface LocalSupabase extends SupabaseClient {
  __callFunction?: <T>(name: string, body: unknown) => Promise<T>;
}

async function authHeaders(): Promise<Record<string, string>> {
  const { data } = await supabase.auth.getSession();
  const token = data.session?.access_token;
  return {
    apikey: process.env.EXPO_PUBLIC_SUPABASE_ANON_KEY ?? '',
    Authorization: `Bearer ${token ?? ''}`,
    'Content-Type': 'application/json',
  };
}

/**
 * Edge Function'ları çağıran tek nokta. İkinci bir HTTP istemcisi kullanılmaz.
 * `!res.ok` durumunda gövdedeki `code` alanı `ApiError` olarak fırlatılır.
 * Yerel modda `screening` ve `triage` cihaz içinde hesaplanır.
 */
export async function callFunction<T>(
  name: string,
  body: unknown,
  opts?: { signal?: AbortSignal },
): Promise<T> {
  if (LOCAL_MODE) {
    const handler = (supabase as LocalSupabase).__callFunction;
    if (!handler) throw new ApiError('invalid_request');
    try {
      return await handler<T>(name, body);
    } catch (error) {
      if (error instanceof ApiError) throw error;
      throw new ApiError('invalid_request');
    }
  }

  const url = `${process.env.EXPO_PUBLIC_SUPABASE_URL ?? 'http://127.0.0.1:54321'}/functions/v1/${name}`;

  let response: Response;
  try {
    response = await fetch(url, {
      method: 'POST',
      headers: await authHeaders(),
      body: JSON.stringify(body),
      signal: opts?.signal,
    });
  } catch {
    throw new ApiError('network_error');
  }

  if (!response.ok) {
    const code = await response
      .json()
      .then((payload: { code?: ApiErrorCode }) => payload?.code)
      .catch(() => undefined);
    throw new ApiError(code ?? 'provider_failed');
  }

  return (await response.json()) as T;
}

/** KVKK: kalıcı silme. Sunucudaki `delete_my_data()` RPC'sini çağırır. */
export async function deleteAllMyData(): Promise<void> {
  const { error } = await supabase.rpc('delete_my_data');
  if (error) throw new ApiError('provider_failed');
}