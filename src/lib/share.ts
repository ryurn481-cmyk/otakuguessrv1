import type { GameMode } from '@prisma/client';

const MODE_EMOJI: Partial<Record<GameMode, string>> = {
  SCREENSHOT: '📸',
  CHARACTER: '👤',
  OPENING: '🎵',
  ANIDLE: '🎌',
};

const MODE_LABEL: Partial<Record<GameMode, string>> = {
  SCREENSHOT: 'Screenshot',
  CHARACTER: 'Character',
  OPENING: 'Opening',
  ANIDLE: 'Anidle',
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
}): string {
  const { mode, date, won, attempts, maxAttempts, points, streak, anidleHistory } = params;

  const modeEmoji = mode === 'PANEL' ? '📖' : MODE_EMOJI[mode] ?? '🎮';
  const modeLabel = mode === 'PANEL' ? 'Panel' : MODE_LABEL[mode] ?? mode;
  const dateStr = new Date(date).toLocaleDateString('en-US', {
    year: 'numeric',
    month: 'long',
    day: 'numeric',
    timeZone: 'UTC',
  });
  const result = won ? `${attempts}/${maxAttempts}` : `X/${maxAttempts}`;

  const lines: string[] = [
    `OtakuGuessr ${modeEmoji} ${modeLabel}`,
    dateStr,
    '',
    result,
  ];

  if (mode === 'ANIDLE' && anidleHistory && anidleHistory.length > 0) {
    // Emoji grid for Anidle
    const grid = anidleHistory
      .map((row) =>
        row.map((cell) => {
          if (cell.status === 'correct') return '🟢';
          if (cell.status === 'partial') return '🟡';
          return '🔴';
        }).join('')
      )
      .join('\n');
    lines.push('');
    lines.push(grid);
  } else {
    // Simple attempt dots for other modes
    const dots = Array.from({ length: maxAttempts }, (_, i) => {
      if (i < attempts - 1) return '🔴'; // wrong guesses
      if (won && i === attempts - 1) return '🟢'; // final correct
      return '⬛'; // unused
    }).join('');
    lines.push('');
    lines.push(dots);
  }

  lines.push('');
  lines.push(`Score: ${points.toLocaleString()} pts | Streak: 🔥 ${streak}`);
  lines.push('');
  lines.push('otakuguessr.com');

  return lines.join('\n');
}

