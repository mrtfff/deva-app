import { createProvider } from '@shared/llm';
import { CRISIS_WARN_TEXT, detectCrisis } from '@shared/crisis';
import { istanbulDateKey } from '@shared/dates';
import { mergeMemoryNotes } from '@shared/memory';
import { buildScreeningSummaryText } from '@shared/scoring';
import { buildSystemPrompt, MEMORY_EXTRACTION_SYSTEM } from '@shared/prompt';
import { resolveQuota } from '@shared/quota';
import { updateStreak } from '@shared/streak';
import type { ChatMessage, QuotaState, SseEvent } from '@shared/types';
import { from } from './localDb';
import { LOCAL_USER_ID_EXPORT } from './localAuth';

/**
 * `supabase/functions/chat` edge fonksiyonunun cihaz içi aynası. Aynı olay
 * sırasını (quota → delta… → done / kriz dalı) üretir; veriler yerel DB'de
 * tutulur, LLM olarak anahtarsız MockProvider kullanılır.
 */

export interface LocalChatBody {
  conversationId?: string;
  content: string;
  skipCrisisCheck?: boolean;
}

export async function runLocalChat(
  body: LocalChatBody,
  onEvent: (event: SseEvent) => void,
  signal?: AbortSignal,
): Promise<void> {
  const userId = LOCAL_USER_ID_EXPORT;
  const provider = createProvider({ provider: 'mock' }, fetch);
  const day = istanbulDateKey();

  // --- Konuşma çözümü -------------------------------------------------------
  let conversationId = body.conversationId ?? '';
  if (conversationId) {
    const { data: owned } = await from('conversations')
      .select('id')
      .eq('id', conversationId)
      .maybeSingle();
    if (!owned) {
      onEvent({ type: 'error', code: 'invalid_request' });
      return;
    }
  } else {
    const { data: created } = await from('conversations')
      .insert({ user_id: userId })
      .select('id')
      .single();
    conversationId = (created as { id: string } | null)?.id ?? '';
  }

  // --- Ayarlar ve profil ----------------------------------------------------
  const { data: settings } = await from('user_settings')
    .select('is_pro')
    .eq('user_id', userId)
    .maybeSingle();
  const isPro = (settings as { is_pro?: boolean } | null)?.is_pro ?? false;

  const { data: profile } = await from('profiles')
    .select('display_name')
    .eq('id', userId)
    .maybeSingle();

  const detection = detectCrisis(body.content);
  const isCrisis = !body.skipCrisisCheck && (detection.level === 'high' || detection.level === 'critical');

  // --- Günlük kullanım ------------------------------------------------------
  const { data: usageRow } = await from('daily_usage')
    .select('message_count')
    .eq('user_id', userId)
    .eq('day', day)
    .maybeSingle();
  const usedToday = ((usageRow as { message_count?: number } | null)?.message_count ?? 0) + 1;
  await from('daily_usage').upsert({ user_id: userId, day, message_count: usedToday });

  const policy = resolveQuota({ usedToday, isPro });
  const quota: QuotaState = { used: usedToday, limit: policy.limit, degraded: policy.degraded };

  // --- Kullanıcı mesajı -----------------------------------------------------
  const { data: userMessage } = await from('messages')
    .insert({
      conversation_id: conversationId,
      user_id: userId,
      role: 'user',
      content: body.content,
      crisis_level: detection.level,
      crisis_acknowledged: body.skipCrisisCheck === true,
    })
    .select('id')
    .single();
  const userMessageId = (userMessage as { id: string } | null)?.id ?? '';

  await from('conversations')
    .update({ last_message_at: new Date().toISOString() })
    .eq('id', conversationId);

  // --- Kriz dalı ------------------------------------------------------------
  if (isCrisis && detection.level !== 'none') {
    await from('crisis_events').insert({
      user_id: userId,
      level: detection.level,
      source: 'chat',
      message_id: userMessageId,
    });

    const { data: warnMessage } = await from('messages')
      .insert({
        conversation_id: conversationId,
        user_id: userId,
        role: 'assistant',
        content: CRISIS_WARN_TEXT,
        crisis_level: detection.level,
      })
      .select('id')
      .single();

    onEvent({
      type: 'crisis',
      level: detection.level,
      message: CRISIS_WARN_TEXT,
      messageId: (warnMessage as { id: string } | null)?.id ?? '',
    });
    onEvent({ type: 'done', messageId: userMessageId, celebrate: false, quota });
    return;
  }

  // --- Bağlam ---------------------------------------------------------------
  const { data: notes } = await from('memory_notes')
    .select('id, content')
    .eq('user_id', userId)
    .eq('is_active', true)
    .order('updated_at', { ascending: false })
    .limit(20);
  const { data: screenings } = await from('screening_results')
    .select('instrument_code, score, severity, completed_at')
    .eq('user_id', userId)
    .order('completed_at', { ascending: false });
  const { data: history } = await from('messages')
    .select('id, role, content')
    .eq('conversation_id', conversationId)
    .order('created_at', { ascending: false })
    .limit(policy.historyWindow + 1);

  const noteRows = (notes ?? []) as { id: string; content: string }[];
  const screeningRows = (screenings ?? []) as {
    instrument_code: 'PHQ9' | 'GAD7' | 'SCOFF';
    score: number;
    severity: string;
    completed_at: string;
  }[];
  const latestScreenings: Partial<
    Record<'PHQ9' | 'GAD7' | 'SCOFF', { score: number; severity: string }>
  > = {};
  for (const row of screeningRows) {
    if (
      !screeningRows.some(
        (other) =>
          other.instrument_code === row.instrument_code &&
          other.completed_at > row.completed_at,
      )
    ) {
      latestScreenings[row.instrument_code] = { score: row.score, severity: row.severity };
    }
  }

  const systemPrompt = buildSystemPrompt({
    displayName: (profile as { display_name?: string | null } | null)?.display_name ?? undefined,
    memoryNotes: noteRows.map((note) => note.content),
    screeningSummary: buildScreeningSummaryText(latestScreenings),
    crisisLevel: detection.level,
    tone: 'casual',
  });

  const priorMessages: ChatMessage[] = ((history ?? []) as { role: 'user' | 'assistant'; content: string }[])
    .slice(1)
    .reverse()
    .map((message) => ({ role: message.role, content: message.content }));

  onEvent({ type: 'quota', ...quota });

  let assistantText = '';
  try {
    for await (const chunk of provider.stream(
      systemPrompt,
      [...priorMessages, { role: 'user', content: body.content }],
      { maxOutputTokens: policy.maxOutputTokens, signal },
    )) {
      assistantText += chunk;
      onEvent({ type: 'delta', text: chunk });
    }
  } catch {
    onEvent({ type: 'error', code: 'provider_failed' });
    return;
  }

  const { data: assistantMessage } = await from('messages')
    .insert({
      conversation_id: conversationId,
      user_id: userId,
      role: 'assistant',
      content: assistantText,
      output_tokens: Math.ceil(assistantText.length / 3.2),
      crisis_level: detection.level,
    })
    .select('id')
    .single();
  const assistantMessageId = (assistantMessage as { id: string } | null)?.id ?? '';

  // --- Hafıza ---------------------------------------------------------------
  if (policy.memoryExtraction) {
    try {
      const extracted = await provider.json<{
        notes?: { content: string; category: string }[];
      }>(MEMORY_EXTRACTION_SYSTEM, [...priorMessages, { role: 'user', content: body.content }], {
        maxOutputTokens: 200,
      });
      const newNotes = mergeMemoryNotes(
        noteRows.map((note) => ({ id: note.id, content: note.content })),
        extracted.notes ?? [],
      );
      if (newNotes.length > 0) {
        const { data: inserted } = await from('memory_notes')
          .insert(
            newNotes.map((note) => ({
              user_id: userId,
              content: note.content,
              category: note.category,
              source: 'ai',
            })),
          )
          .select('id, content, category');
        onEvent({
          type: 'memory',
          notes: ((inserted ?? []) as { id: string; content: string; category: string }[]).map(
            (note) => ({ id: note.id, content: note.content, category: note.category }),
          ),
        });
      }
    } catch {
      // Hafıza çıkarma başarısız olsa da akış kesilmez.
    }
  }

  // --- Seri -----------------------------------------------------------------
  const { data: streakRow } = await from('streaks')
    .select('current_streak, longest_streak, last_chat_date')
    .eq('user_id', userId)
    .maybeSingle();
  const existing = streakRow as {
    current_streak: number;
    longest_streak: number;
    last_chat_date: string | null;
  } | null;

  const streak = updateStreak(
    existing
      ? { current: existing.current_streak, longest: existing.longest_streak, lastChatDate: existing.last_chat_date }
      : null,
    day,
  );

  await from('streaks').upsert({
    user_id: userId,
    current_streak: streak.current,
    longest_streak: streak.longest,
    last_chat_date: streak.lastChatDate,
  });

  onEvent({ type: 'done', messageId: assistantMessageId, celebrate: streak.celebrate, quota });
}
