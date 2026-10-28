import { MAX_POINTS, POINTS_DEDUCTION, SPEED_BONUS } from '@/constants/game';
import type { GameMode } from '@prisma/client';
import { ANIDLE_ATTRIBUTES } from '@/constants/attributes';
import type { AttributeFeedback } from '@/types/game';

/**
 * Calculate the score for a game submission.
 */
export function calculateScore(
  mode: GameMode,
  won: boolean,
  attempts: number,
  timeTaken?: number
): number {
  if (!won) return 0;

  const maxPoints = MAX_POINTS[mode];
  const deduction = POINTS_DEDUCTION[mode];
  const wrongGuesses = Math.max(0, attempts - 1);

  let points = Math.max(0, maxPoints - wrongGuesses * deduction);

  // Speed bonus
  if (timeTaken !== undefined) {
    if (timeTaken < SPEED_BONUS.FAST.threshold) {
      points += SPEED_BONUS.FAST.bonus;
    } else if (timeTaken < SPEED_BONUS.MEDIUM.threshold) {
      points += SPEED_BONUS.MEDIUM.bonus;
    }
  }

  return Math.min(points, maxPoints + SPEED_BONUS.FAST.bonus);
}

/**
 * Compare a guessed anime against the correct anime for Anidle mode.
 * Returns attribute-level feedback.
 */
export function compareAnidleAttributes(
  guessedAnime: {
    year: number | null;
    season: string | null;
    format: string | null;
    episodes: number | null;
    studios: string[];
    genres: string[];
    source: string | null;
    score: number | null;
  },
  correctAnime: {
    year: number | null;
    season: string | null;
    format: string | null;
    episodes: number | null;
    studios: string[];
    genres: string[];
    source: string | null;
    score: number | null;
  }
): AttributeFeedback[] {
  const feedbacks: AttributeFeedback[] = [];

  for (const attr of ANIDLE_ATTRIBUTES) {
    const guessVal = getAnimeAttributeValue(guessedAnime, attr.key);
    const correctVal = getAnimeAttributeValue(correctAnime, attr.key);

    let status: 'correct' | 'partial' | 'wrong' = 'wrong';
    let direction: 'up' | 'down' | undefined;

    if (attr.type === 'numeric') {
      const gNum = typeof guessVal === 'number' ? guessVal : 0;
      const cNum = typeof correctVal === 'number' ? correctVal : 0;

      if (guessVal === null && correctVal === null) {
        status = 'correct';
      } else if (gNum === cNum) {
        status = 'correct';
      } else if (attr.closeThreshold && Math.abs(gNum - cNum) <= attr.closeThreshold) {
        status = 'partial';
        direction = gNum < cNum ? 'up' : 'down';
      } else {
        status = 'wrong';
        direction = gNum < cNum ? 'up' : 'down';
      }
    } else if (attr.type === 'categorical') {
      status = guessVal === correctVal ? 'correct' : 'wrong';
    } else if (attr.type === 'set') {
      const guessArr = Array.isArray(guessVal) ? guessVal : [];
      const correctArr = Array.isArray(correctVal) ? correctVal : [];
      const intersection = guessArr.filter((v) => correctArr.includes(v));

      if (guessArr.length > 0 && intersection.length === correctArr.length && guessArr.length === correctArr.length) {
        status = 'correct';
      } else if (intersection.length > 0) {
        status = 'partial';
      } else {
        status = 'wrong';
      }
    }

    feedbacks.push({
      key: attr.key,
      label: attr.label,
      guessValue: guessVal as string | number | string[],
      correctValue: correctVal as string | number | string[],
      status,
      direction,
    });
  }

  return feedbacks;
}

function getAnimeAttributeValue(
  anime: {
    year: number | null;
    season: string | null;
    format: string | null;
    episodes: number | null;
    studios: string[];
    genres: string[];
    source: string | null;
    score: number | null;
  },
  key: string
): string | number | string[] | null {
  switch (key) {
    case 'year': return anime.year;
    case 'season': return anime.season;
    case 'format': return anime.format;
    case 'episodes': return anime.episodes;
    case 'genres': return anime.genres.slice(0, 3); // compare top 3
    case 'studio': return anime.studios[0] ?? null; // compare primary studio
    case 'source': return anime.source;
    case 'score': return anime.score ? Math.round(anime.score) : null;
    default: return null;
  }
}

