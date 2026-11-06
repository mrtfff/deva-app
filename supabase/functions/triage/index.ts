import { cors, HttpError, jsonError, jsonOk, requireUser } from '../_shared/server.ts';
import { detectCrisis } from '../_shared/crisis.ts';
import { buildTriage, extractMessageSignals } from '../_shared/triage.ts';

interface TriageBody {
  conversationId?: string;
}

interface ScreeningRow {
  instrument_code: 'PHQ9' | 'GAD7' | 'SCOFF';
  score: number;
  severity: string;
  completed_at: string;
}

/**
 * Yönlendirme kalıcı yazmaz: her açılışta sohbet + anket verisinden yeniden hesaplanır.
 */
Deno.serve(async (req: Request): Promise<Response> => {
  const preflight = cors(req);
  if (preflight) return preflight;

  try {
    if (req.method !== 'POST') throw new HttpError(405, 'invalid_request');

    const { db } = await requireUser(req);

    let body: TriageBody = {};
    try {
      body = ((await req.json()) as TriageBody) ?? {};
    } catch {
      body = {};
    }

    const [crisisResult, screeningResult, messageResult] = await Promise.all([
      db
        .from('crisis_events')
        .select('level')
        .gte('created_at', new Date(Date.now() - 30 * 86_400_000).toISOString()),
      db
        .from('screening_results')
        .select('instrument_code, score, severity, completed_at')
        .order('completed_at', { ascending: false }),
      body.conversationId
        ? db
            .from('messages')
            .select('content')
            .eq('conversation_id', body.conversationId)
            .eq('role', 'user')
            .order('created_at', { ascending: false })
            .limit(40)
        : Promise.resolve({ data: [] as { content: string }[] }),
    ]);

    const crisisRows = (crisisResult.data ?? []) as { level: string }[];
    const hasRecentHighCrisis = crisisRows.some(
      (row) => row.level === 'high' || row.level === 'critical',
    );

    const latestScreenings: Partial<
      Record<ScreeningRow['instrument_code'], { score: number; severity: string }>
    > = {};
    for (const row of (screeningResult.data ?? []) as ScreeningRow[]) {
      if (latestScreenings[row.instrument_code]) continue;
      latestScreenings[row.instrument_code] = { score: row.score, severity: row.severity };
    }

    const texts = ((messageResult.data ?? []) as { content: string }[]).map((m) => m.content);
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

    return jsonOk(result);
  } catch (error) {
    return jsonError(error);
  }
});