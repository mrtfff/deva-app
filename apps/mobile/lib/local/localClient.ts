import type { Session, User } from '@supabase/supabase-js';
import type { SupabaseClient } from '@supabase/supabase-js';
import { from, rpc, wipeUserData } from './localDb';
import { seedFacilitiesIfEmpty } from './seed';
import { localAuth } from './localAuth';
import { LOCAL_USER_ID_EXPORT } from './localAuth';
import { findInstrument } from '@shared/instruments';
import { flagsScreeningCrisis, needsSupportCard, scoreInstrument } from '@shared/scoring';
import { detectCrisis } from '@shared/crisis';
import { buildTriage, extractMessageSignals } from '@shared/triage';
import type { Row } from './localDb';

/**
 * Gerçek Supabase istemcisiyle aynı arayüzlü yerel istemci. Yalnızca uygulamanın
 * kullandığı metotlar uygulanır; tip tarafı SupabaseClient'a dönüştürülerek
 * ekranların tip tanımları korunur.
 */


async function callFunctionLocal<T>(name: string, body: unknown): Promise<T> {
  const userId = LOCAL_USER_ID_EXPORT;

  if (name === 'screening') {
    const payload = body as { instrumentCode?: string; answers?: number[] };
    const instrument =
      typeof payload.instrumentCode === 'string' ? findInstrument(payload.instrumentCode) : undefined;
    const answers = Array.isArray(payload.answers) ? payload.answers : [];
    if (!instrument) throw new Error('invalid_request');
    const scored = scoreInstrument(instrument, answers);
    await from('screening_results').insert({
      user_id: userId,
      instrument_code: instrument.code,
      answers,
      score: scored.score,
      severity: scored.severity,
    });
    if (flagsScreeningCrisis(instrument, answers)) {
      await from('crisis_events').insert({ user_id: userId, level: 'low', source: 'screening' });
    }
    return {
      completed: true,
      needsSupportCard: needsSupportCard(instrument, answers),
    } as T;
  }

  if (name === 'triage') {
    const payload = (body as { conversationId?: string }) ?? {};
    const since = new Date(Date.now() - 30 * 86_400_000).toISOString();

    const { data: crisisEvents } = await from('crisis_events')
      .select('level')
      .gte('created_at', since);
    const { data: screenings } = await from('screening_results')
      .select('instrument_code, score, severity, completed_at')
      .order('completed_at', { ascending: false });
    const { data: messages } = payload.conversationId
      ? await from('messages')
          .select('content')
          .eq('conversation_id', payload.conversationId)
          .eq('role', 'user')
          .order('created_at', { ascending: false })
          .limit(40)
      : { data: [] as Row[] | null };

    const crisisRows = ((crisisEvents ?? []) as { level: string }[]) ?? [];
    const hasRecentHighCrisis = crisisRows.some(
      (row) => row.level === 'high' || row.level === 'critical',
    );

    const latestScreenings: Partial<
      Record<'PHQ9' | 'GAD7' | 'SCOFF', { score: number; severity: string }>
    > = {};
    for (const row of ((screenings ?? []) as { instrument_code: 'PHQ9' | 'GAD7' | 'SCOFF'; score: number; severity: string }[]) ?? []) {
      if (!latestScreenings[row.instrument_code]) latestScreenings[row.instrument_code] = row;
    }

    const texts = (((messages ?? []) as { content: string }[]) ?? []).map((m) => m.content);
    const latestMessageCrisis = texts.length > 0 ? detectCrisis(texts[0]!).level : 'none';

    const result = buildTriage({
      crisisLevel: latestMessageCrisis,
      hasRecentHighCrisis,
      screening: {
        phq9: latestScreenings.PHQ9
          ? { flagged: latestScreenings.PHQ9.severity !== 'minimal' }
          : undefined,
        gad7: latestScreenings.GAD7
          ? { flagged: latestScreenings.GAD7.severity !== 'minimal' }
          : undefined,
        scoff: latestScreenings.SCOFF
          ? { flagged: latestScreenings.SCOFF.severity === 'screening_suspect' }
          : undefined,
      },
      messageSignals: extractMessageSignals(texts),
    });
    return result as T;
  }

  throw new Error('invalid_request');
}

const localClient = {
  from,
  rpc,
  auth: localAuth,
  // callFunction/deleteAllMyData lib/api.ts tarafından bu yardımcılarla yönlendirilir.
  __callFunction: callFunctionLocal,
  __wipe: wipeUserData,
  __seed: seedFacilitiesIfEmpty,
} as unknown as SupabaseClient;

export function createLocalSupabaseClient(): SupabaseClient {
  return localClient;
}

export type { Session, User };
