import type { GameMode } from '@prisma/client';

const MODE_EMOJI: Partial<Record<GameMode, string>> = {
  SCREENSHOT:  '📸',
  CHARACTER:   '👤',
  OPENING:     '🎵',
  ANIDLE:      '🎌',
  ANILINK:     '🔗',
  STATDUEL:    '⚖️',
  SAKUGASYNC:  '⚡',
};

const MODE_LABEL: Partial<Record<GameMode, string>> = {
  SCREENSHOT:  'Screenshot',
  CHARACTER:   'Character',
  OPENING:     'Opening',
  ANIDLE:      'Anidle',
  ANILINK:     'AniLink',
  STATDUEL:    'StatDuel',
  SAKUGASYNC:  'SakugaSync',
};

// Reserved for richer share-card variants.
// eslint-disable-next-line @typescript-eslint/no-unused-vars
const RESULT_EMOJI = {
  correct: '🟢',
  partial: '🟡',
  wrong: '🔴',
  won: '✅',
  lost: '❌',
};

const SAKUGA_CLASS_EMOJI: Record<string, string> = {
  D: '🔲', C: '🟦', B: '🟩', A: '🟨', S: '🟧', '★': '🟥',
};

/**
 * Generate a spoiler-safe share card text for a game result.
 */
export function generateShareText(params: {
  mode: GameMode;
  date: string;
  won: boolean;
  attempts: number;
  maxAttempts: number;
  points: number;
  streak: number;
  // For Anidle: per-attribute results per guess
  anidleHistory?: Array<{ status: 'correct' | 'partial' | 'wrong' }[]>;
  // For AniLink
  aniLinkHops?: number;
  aniLinkMinHops?: number;
  aniLinkPath?: string[]; // title names
  // For StatDuel
  statDuelStreak?: number;
  // For SakugaSync
  sakugaClass?: string;
  sakugaMeanDrift?: number;
  sakugaRoundPoints?: number[];
}): string {
  const {
    mode, date, won, attempts, maxAttempts, points, streak,
    anidleHistory,
    aniLinkHops, aniLinkMinHops, aniLinkPath,
    statDuelStreak,
    sakugaClass, sakugaMeanDrift, sakugaRoundPoints,
  } = params;

  const modeEmoji = mode === 'PANEL' ? '📖' : MODE_EMOJI[mode] ?? '🎮';
  const modeLabel = mode === 'PANEL' ? 'Panel' : MODE_LABEL[mode] ?? mode;
  const dateStr = new Date(date).toLocaleDateString('en-US', {
    year: 'numeric', month: 'long', day: 'numeric', timeZone: 'UTC',
  });

  const lines: string[] = [`OtakuGuessr ${modeEmoji} ${modeLabel}`, dateStr, ''];

  // ── Mode-specific card body ──────────────────────────────────────────────

  if (mode === 'SAKUGASYNC' && sakugaClass && sakugaMeanDrift !== undefined && sakugaRoundPoints) {
    lines.push(`Class ${sakugaClass} — ${points.toLocaleString()} pts`);
    lines.push(`Drift: ${sakugaMeanDrift}ms avg | Streak: 🔥 ${streak}`);
    lines.push('');
    lines.push(sakugaRoundPoints.map((p) =>
      p >= 850 ? '⚡' : p >= 500 ? '🟡' : '🔴'
    ).join(''));
  } else if (mode === 'STATDUEL' && statDuelStreak !== undefined) {
    const result = won ? `${statDuelStreak} streak` : `Streak ended at ${statDuelStreak}`;
    lines.push(result);
    lines.push(`Score: ${points.toLocaleString()} pts | Streak: 🔥 ${streak}`);
    lines.push('');
    const duels = Math.min(statDuelStreak, 10);
    lines.push(Array.from({ length: 10 }, (_, i) => (i < duels ? '⚖️' : '⬛')).join(''));
  } else if (mode === 'ANILINK' && aniLinkHops !== undefined) {
    const optimal = aniLinkMinHops ?? aniLinkHops;
    const perfect = aniLinkHops === optimal;
    lines.push(`${won ? aniLinkHops : 'X'} hops (minimum: ${optimal}) — ${points.toLocaleString()} pts`);
    if (aniLinkPath && aniLinkPath.length > 0) {
      lines.push('');
      lines.push(aniLinkPath.join(' → '));
    }
    lines.push('');
    lines.push(`${perfect ? '🔗'.repeat(optimal) : '🔗'.repeat(optimal) + '➕'.repeat(aniLinkHops - optimal)} | Streak: 🔥 ${streak}`);
  } else if (mode === 'ANIDLE' && anidleHistory && anidleHistory.length > 0) {
    const result = won ? `${attempts}/${maxAttempts}` : `X/${maxAttempts}`;
    lines.push(result);
    lines.push('');
    const grid = anidleHistory.map((row) =>
      row.map((cell) => cell.status === 'correct' ? '🟢' : cell.status === 'partial' ? '🟡' : '🔴').join('')
    ).join('\n');
    lines.push(grid);
    lines.push('');
    lines.push(`Score: ${points.toLocaleString()} pts | Streak: 🔥 ${streak}`);
  } else {
    // Default: attempt dots
    const result = won ? `${attempts}/${maxAttempts}` : `X/${maxAttempts}`;
    lines.push(result);
    lines.push('');
    const dots = Array.from({ length: maxAttempts }, (_, i) => {
      if (i < attempts - 1) return '🔴';
      if (won && i === attempts - 1) return '🟢';
      return '⬛';
    }).join('');
    lines.push(dots);
    lines.push('');
    lines.push(`Score: ${points.toLocaleString()} pts | Streak: 🔥 ${streak}`);
  }

  lines.push('');
  lines.push('otakuguessr.com');

  return lines.join('\n');
}

