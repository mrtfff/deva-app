import { createClient, type SupabaseClient, type User } from 'npm:@supabase/supabase-js@2';
import type { LlmEnv, SseEvent } from './types.ts';
import { encodeSse } from './sse.ts';

/**
 * Edge Function tarafının tek bağımlılık noktası.
 * `_shared` içindeki diğer modüller npm paketi import etmez; HTTP'yi `fetchImpl`
 * olarak enjekte eder. Bu dosya yalnızca sunucu tarafında çalışır.
 */

export function getEnv(): LlmEnv {
  return {
    provider: (Deno.env.get('LLM_PROVIDER') ?? 'mock') as LlmEnv['provider'],
    openaiApiKey: Deno.env.get('OPENAI_API_KEY') ?? undefined,
    anthropicApiKey: Deno.env.get('ANTHROPIC_API_KEY') ?? undefined,
    geminiApiKey: Deno.env.get('GEMINI_API_KEY') ?? undefined,
  };
}

export function getAdmin(): SupabaseClient {
  return createClient(
    Deno.env.get('SUPABASE_URL')!,
    Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!,
    { auth: { persistSession: false, autoRefreshToken: false } },
  );
}

export class HttpError extends Error {
  readonly status: number;
  readonly code: string;

  constructor(status: number, code: string) {
    super(code);
    this.status = status;
    this.code = code;
  }
}

export interface AuthedRequest {
  user: User;
  /** RLS geçerli, kullanıcı kapsamlı istemci — okuma için. */
  db: SupabaseClient;
}

export async function requireUser(req: Request): Promise<AuthedRequest> {
  const authHeader = req.headers.get('Authorization') ?? '';
  const token = authHeader.startsWith('Bearer ') ? authHeader.slice(7) : null;
  if (!token) throw new HttpError(401, 'unauthorized');

  const db = createClient(
    Deno.env.get('SUPABASE_URL')!,
    Deno.env.get('SUPABASE_ANON_KEY')!,
    {
      global: { headers: { Authorization: `Bearer ${token}` } },
      auth: { persistSession: false, autoRefreshToken: false },
    },
  );

  const { data, error } = await db.auth.getUser(token);
  if (error || !data.user) throw new HttpError(401, 'unauthorized');

  return { user: data.user, db };
}

const CORS_HEADERS: Record<string, string> = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
  'Access-Control-Allow-Method': 'POST, OPTIONS',
};

export function cors(req: Request): Response | null {
  if (req.method === 'OPTIONS') {
    return new Response(null, { status: 204, headers: CORS_HEADERS });
  }
  return null;
}

export function jsonError(error: unknown): Response {
  if (error instanceof HttpError) {
    return new Response(JSON.stringify({ code: error.code }), {
      status: error.status,
      headers: { ...CORS_HEADERS, 'Content-Type': 'application/json' },
    });
  }
  console.error('unexpected_error', error);
  return new Response(JSON.stringify({ code: 'provider_failed' }), {
    status: 500,
    headers: { ...CORS_HEADERS, 'Content-Type': 'application/json' },
  });
}

export function jsonOk(payload: unknown, status = 200): Response {
  return new Response(JSON.stringify(payload), {
    status,
    headers: { ...CORS_HEADERS, 'Content-Type': 'application/json' },
  });
}

export function sseResponse(gen: AsyncGenerator<SseEvent>): Response {
  const stream = new ReadableStream<Uint8Array>({
    async start(controller) {
      const encoder = new TextEncoder();
      try {
        for await (const event of gen) {
          controller.enqueue(encoder.encode(encodeSse(event)));
        }
      } catch (error) {
        console.error('sse_stream_error', error);
        controller.enqueue(
          encoder.encode(encodeSse({ type: 'error', code: 'provider_failed' })),
        );
      } finally {
        controller.close();
      }
    },
  });

  return new Response(stream, {
    headers: {
      ...CORS_HEADERS,
      'Content-Type': 'text/event-stream; charset=utf-8',
      'Cache-Control': 'no-cache',
      Connection: 'keep-alive',
      'X-Accel-Buffering': 'no',
    },
  });
}