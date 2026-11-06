/**
 * Edge Function'lar Deno runtime'ında çalışır; `tsc -b` altında da tip kontrolü
 * yapılabilsin diye ihtiyaç duyulan ambient bildirimler burada toplanır.
 * Mobil uygulama bu dosyayı içe aktarmaz.
 */

declare namespace Deno {
  const env: {
    get(key: string): string | undefined;
  };
  function serve(
    handler: (request: Request) => Response | Promise<Response>,
  ): { finished: Promise<void> };
}

declare module 'npm:@supabase/supabase-js@2' {
  export * from '@supabase/supabase-js';
}