export type CrisisLevel = 'none' | 'low' | 'high' | 'critical';

export type SpecialistType = 'psychiatrist' | 'psychologist' | 'dietitian';

export interface ChatMessage {
  role: 'user' | 'assistant';
  content: string;
}

export interface ScreeningEntry {
  /** `true` when the instrument crosses its own suspicion threshold. */
  flagged: boolean;
}

export interface ScreeningSummary {
  phq9?: ScreeningEntry;
  gad7?: ScreeningEntry;
  scoff?: ScreeningEntry;
}

export type QuotaState = { used: number; limit: number; degraded: boolean };

export type SseEvent =
  | { type: 'delta'; text: string }
  | {
      type: 'crisis';
      level: Exclude<CrisisLevel, 'none'>;
      message: string;
      messageId: string;
    }
  | { type: 'quota'; used: number; limit: number; degraded: boolean }
  | {
      type: 'memory';
      notes: { id: string; content: string; category: string }[];
    }
  | { type: 'done'; messageId: string; celebrate: boolean; quota: QuotaState }
  | { type: 'error'; code: 'provider_failed' | 'unauthorized' | 'invalid_request' };

export type LlmProviderId = 'mock' | 'openai' | 'anthropic' | 'gemini';

export interface LlmEnv {
  provider: LlmProviderId;
  openaiApiKey?: string;
  anthropicApiKey?: string;
  geminiApiKey?: string;
}