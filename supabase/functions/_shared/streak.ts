export interface StreakState {
  current: number;
  longest: number;
  lastChatDate: string | null;
}

export interface StreakResult {
  current: number;
  longest: number;
  lastChatDate: string;
  celebrate: boolean;
}

function dayNumber(isoDate: string): number {
  const [y, m, d] = isoDate.split('-').map((part) => Number.parseInt(part, 10));
  return Date.UTC(y ?? 1970, (m ?? 1) - 1, d ?? 1) / 86_400_000;
}

/**
 * Seri cezalandırmaz: koparsa yalnızca 1'e döner, `celebrate` false olur ve
 * arayüzde hiçbir uyarı gösterilmez.
 */
export function updateStreak(
  current: StreakState | null,
  today: string,
): StreakResult {
  const base: StreakState = current ?? { current: 0, longest: 0, lastChatDate: null };
  const todayNumber = dayNumber(today);

  if (!base.lastChatDate) {
    return { current: 1, longest: Math.max(base.longest, 1), lastChatDate: today, celebrate: true };
  }

  const gap = todayNumber - dayNumber(base.lastChatDate);

  if (gap === 0) {
    return {
      current: base.current,
      longest: base.longest,
      lastChatDate: today,
      celebrate: false,
    };
  }

  const nextCurrent = gap === 1 ? base.current + 1 : 1;
  return {
    current: nextCurrent,
    longest: Math.max(base.longest, nextCurrent),
    lastChatDate: today,
    celebrate: true,
  };
}