import {
  cors,
  HttpError,
  getAdmin,
  getEnv,
  jsonError,
  requireUser,
  sseResponse,
} from '../_shared/server.ts';
import { createProvider } from '../_shared/llm.ts';
import { CRISIS_WARN_TEXT, detectCrisis } from '../_shared/crisis.ts';
import { istanbulDateKey } from '../_shared/dates.ts';
import { mergeMemoryNotes } from '../_shared/memory.ts';
import { buildScreeningSummaryText } from '../_shared/scoring.ts';
import { buildSystemPrompt, MEMORY_EXTRACTION_SYSTEM } from '../_shared/prompt.ts';
import { resolveQuota } from '../_shared/quota.ts';
import { updateStreak } from '../_shared/streak.ts';
import type { ChatMessage, QuotaState as Quota, SseEvent } from '../_shared/types.ts';

interface ChatBody {
  conversationId?: string;
  content: string;
  skipCrisisCheck?: boolean;
}

interface MessageRow {
  id: string;
  role: 'user' | 'assistant';
  content: string;
}

interface ScreeningRow {
  instrument_code: 'PHQ9' | 'GAD7' | 'SCOFF';
  score: number;
  severity: string;
  completed_at: string;
}

function screeningIsLatest(row: ScreeningRow, all: ScreeningRow[]): boolean {
  return !all.some(
    (other) => other.instrument_code === row.instrument_code && other.completed_at > row.completed_at,
  );
}

async function* runChat(req: Request, body: ChatBody): AsyncGenerator<SseEvent> {
  const { user, db } = await requireUser(req);
  const admin = getAdmin();
  const provider = createProvider(getEnv(), fetch);

  const day = istanbulDateKey();

  // --- Konuşma çözümü -------------------------------------------------------
  let conversationId = body.conversationId ?? '';
  if (conversationId) {
    const { data: owned } = await db
      .from('conversations')
      .select('id')
      .eq('id', conversationId)
      .maybeSingle();
    if (!owned) throw new HttpError(400, 'invalid_request');
  } else {
    const { data: created, error } = await admin
      .from('conversations')
      .insert({ user_id: user.id })
      .select('id')
      .single();
    if (error) throw error;
    conversationId = created.id as string;
  }

  // --- Kullanıcı kapsamlı ayarlar ve profil --------------------------------
  const [{ data: settings }, { data: profile }] = await Promise.all([
    db.from('user_settings').select('is_pro').eq('user_id', user.id).maybeSingle(),
    db.from('profiles').select('display_name').eq('id', user.id).maybeSingle(),
  ]);
  const isPro = settings?.is_pro ?? false;

  const detection = detectCrisis(body.content);
  const isCrisis = !body.skipCrisisCheck && (detection.level === 'high' || detection.level === 'critical');

  // --- Günlük kullanım sayacı ----------------------------------------------
  const { data: usageRow } = await admin
    .from('daily_usage')
    .select('message_count')
    .eq('user_id', user.id)
    .eq('day', day)
    .maybeSingle();
  const usedToday = (usageRow?.message_count ?? 0) + 1;

  const { error: usageError } = await admin.from('daily_usage').upsert(
    { user_id: user.id, day, message_count: usedToday },
    { onConflict: 'user_id,day' },
  );
  if (usageError) throw usageError;

  const policy = resolveQuota({ usedToday, isPro });
  const quota: Quota = { used: usedToday, limit: policy.limit, degraded: policy.degraded };

  // --- Kullanıcı mesajı ------------------------------------------------------
  const { data: userMessage, error: userMessageError } = await admin
    .from('messages')
    .insert({
      conversation_id: conversationId,
      user_id: user.id,
      role: 'user',
      content: body.content,
      crisis_level: detection.level,
      crisis_acknowledged: body.skipCrisisCheck === true,
    })
    .select('id')
    .single();
  if (userMessageError) throw userMessageError;
  const userMessageId = userMessage.id as string;

  await admin
    .from('conversations')
    .update({ last_message_at: new Date().toISOString() })
    .eq('id', conversationId);

  // --- Kriz dalı: modele hiç gidilmez --------------------------------------
  if (isCrisis && detection.level !== 'none') {
    await admin.from('crisis_events').insert({
      user_id: user.id,
      level: detection.level,
      source: 'chat',
      message_id: userMessageId,
    });

    const { data: warnMessage, error: warnError } = await admin
      .from('messages')
      .insert({
        conversation_id: conversationId,
        user_id: user.id,
        role: 'assistant',
        content: CRISIS_WARN_TEXT,
        crisis_level: detection.level,
      })
      .select('id')
      .single();
    if (warnError) throw warnError;

    yield {
      type: 'crisis',
      level: detection.level,
      message: CRISIS_WARN_TEXT,
      messageId: warnMessage!.id as string,
    };
    yield { type: 'done', messageId: userMessageId, celebrate: false, quota };
    return;
  }

  // --- Bağlam ----------------------------------------------------------------
  const [
    { data: notes },
    { data: screenings },
    { data: history },
  ] = await Promise.all([
    db
      .from('memory_notes')
      .select('id, content')
      .eq('user_id', user.id)
      .eq('is_active', true)
      .order('updated_at', { ascending: false })
      .limit(20),
    db
      .from('screening_results')
      .select('instrument_code, score, severity, completed_at')
      .eq('user_id', user.id)
      .order('completed_at', { ascending: false }),
    db
      .from('messages')
      .select('id, role, content')
      .eq('conversation_id', conversationId)
      .order('created_at', { ascending: false })
      .limit(policy.historyWindow + 1),
  ]);

  const noteRows = (notes ?? []) as { id: string; content: string }[];
  const messageRows = (history ?? []) as MessageRow[];
  const memoryNotes = noteRows.map((note) => note.content);
  const screeningRows = (screenings ?? []) as ScreeningRow[];
  const latestScreenings: Partial<Record<ScreeningRow['instrument_code'], { score: number; severity: string }>> = {};
  for (const row of screeningRows) {
    if (screeningIsLatest(row, screeningRows)) {
      latestScreenings[row.instrument_code] = { score: row.score, severity: row.severity };
    }
  }
  const screeningSummary = buildScreeningSummaryText(latestScreenings);

  const systemPrompt = buildSystemPrompt({
    displayName: (profile?.display_name as string | null) ?? undefined,
    memoryNotes,
    screeningSummary,
    crisisLevel: detection.level,
    tone: 'casual',
  });

  const priorMessages: ChatMessage[] = messageRows
    .slice(1)
    .reverse()
    .map((message) => ({ role: message.role, content: message.content }));
  const messages: ChatMessage[] = [
    ...priorMessages,
    { role: 'user', content: body.content },
  ];

  yield { type: 'quota', ...quota };

  let assistantText = '';
  try {
    for await (const chunk of provider.stream(systemPrompt, messages, {
      maxOutputTokens: policy.maxOutputTokens,
      signal: req.signal,
    })) {
      assistantText += chunk;
      yield { type: 'delta', text: chunk };
    }
  } catch (error) {
    console.error('provider_stream_failed', error);
    yield { type: 'error', code: 'provider_failed' };
    return;
  }

  const outputTokens = Math.ceil(assistantText.length / 3.2);
  const { data: assistantMessage, error: assistantError } = await admin
    .from('messages')
    .insert({
      conversation_id: conversationId,
      user_id: user.id,
      role: 'assistant',
      content: assistantText,
      output_tokens: outputTokens,
      crisis_level: detection.level,
    })
    .select('id')
    .single();
  if (assistantError) throw assistantError;
  const assistantMessageId = assistantMessage!.id as string;

  // --- Hafıza notları: hata olursa akış kesilmez ---------------------------
  if (policy.memoryExtraction) {
    try {
      const extracted = await provider.json<{ notes?: { content: string; category: string }[] }>(
        MEMORY_EXTRACTION_SYSTEM,
        messages,
        { maxOutputTokens: 200 },
      );
      const newNotes = mergeMemoryNotes(
        noteRows.map((note) => ({ id: note.id, content: note.content })),
        extracted.notes ?? [],
      );

      if (newNotes.length > 0) {
        const { data: inserted } = await admin
          .from('memory_notes')
          .insert(
            newNotes.map((note) => ({
              user_id: user.id,
              content: note.content,
              category: note.category,
              source: 'ai',
            })),
          )
          .select('id, content, category');

        yield {
          type: 'memory',
          notes: ((inserted ?? []) as { id: string; content: string; category: string }[]).map(
            (note) => ({ id: note.id, content: note.content, category: note.category }),
          ),
        };
      }
    } catch (error) {
      console.error('memory_extraction_failed', error);
    }
  }

  // --- Seri ------------------------------------------------------------------
  const { data: streakRow } = await admin
    .from('streaks')
    .select('current_streak, longest_streak, last_chat_date')
    .eq('user_id', user.id)
    .maybeSingle();

  const streak = updateStreak(
    streakRow
      ? {
          current: streakRow.current_streak as number,
          longest: streakRow.longest_streak as number,
          lastChatDate: (streakRow.last_chat_date as string | null) ?? null,
        }
      : null,
    day,
  );

  await admin.from('streaks').upsert(
    {
      user_id: user.id,
      current_streak: streak.current,
      longest_streak: streak.longest,
      last_chat_date: streak.lastChatDate,
    },
    { onConflict: 'user_id' },
  );

  yield { type: 'done', messageId: assistantMessageId, celebrate: streak.celebrate, quota };
}
Deno.serve(async (req: Request): Promise<Response> => {
  const preflight = cors(req);
  if (preflight) return preflight;

  try {
    if (req.method !== 'POST') throw new HttpError(405, 'invalid_request');

    let body: ChatBody;
    try {
      body = (await req.json()) as ChatBody;
    } catch {
      throw new HttpError(400, 'invalid_request');
    }

    const content = typeof body.content === 'string' ? body.content.trim() : '';
    if (content.length === 0) throw new HttpError(400, 'invalid_request');

    return sseResponse(
      runChat(req, {
        conversationId: body.conversationId,
        content,
        skipCrisisCheck: body.skipCrisisCheck === true,
      }),
    );
  } catch (error) {
    return jsonError(error);
  }
});
