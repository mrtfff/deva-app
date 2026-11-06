import { cors, HttpError, jsonError, jsonOk, requireUser } from '../_shared/server.ts';
import { findInstrument } from '../_shared/instruments.ts';
import { flagsScreeningCrisis, needsSupportCard, scoreInstrument } from '../_shared/scoring.ts';

interface ScreeningBody {
  instrumentCode?: string;
  answers?: number[];
}

/**
 * Anket sonucu burada hesaplanır ve sunucuda saklanır.
 * Yanıt yalnızca `{ completed, needsSupportCard }` içerir; skor ve şiddet
 * bilinçli olarak istemciye hiç gönderilmez.
 */
Deno.serve(async (req: Request): Promise<Response> => {
  const preflight = cors(req);
  if (preflight) return preflight;

  try {
    if (req.method !== 'POST') throw new HttpError(405, 'invalid_request');

    const { user, db } = await requireUser(req);

    let body: ScreeningBody;
    try {
      body = (await req.json()) as ScreeningBody;
    } catch {
      throw new HttpError(400, 'invalid_request');
    }

    const instrument =
      typeof body.instrumentCode === 'string' ? findInstrument(body.instrumentCode) : undefined;
    if (!instrument) throw new HttpError(400, 'invalid_request');

    const answers = Array.isArray(body.answers) ? body.answers : [];

    let scored;
    try {
      scored = scoreInstrument(instrument, answers);
    } catch {
      throw new HttpError(400, 'invalid_request');
    }

    const { error } = await db.from('screening_results').insert({
      user_id: user.id,
      instrument_code: instrument.code,
      answers,
      score: scored.score,
      severity: scored.severity,
    });
    if (error) throw error;

    // Herhangi bir işaret kayıt altına alınır; ekrandaki destek kartı daha
    // seçici bir eşik kullanır (bkz. scoring.needsSupportCard).
    if (flagsScreeningCrisis(instrument, answers)) {
      await db.from('crisis_events').insert({
        user_id: user.id,
        level: 'low',
        source: 'screening',
      });
    }

    return jsonOk({ completed: true, needsSupportCard: needsSupportCard(instrument, answers) });
  } catch (error) {
    return jsonError(error);
  }
});