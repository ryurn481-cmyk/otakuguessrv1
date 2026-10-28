// Type definitions for game modes, results, and API shapes

export type GameMode = 'SCREENSHOT' | 'CHARACTER' | 'OPENING' | 'ANIDLE';

export interface GuessResult {
  correct: boolean;
  points?: number;
  attemptsUsed: number;
  answer?: {
    animeId: string;
    title: string;
    coverImage: string;
  };
}

export interface AnidleGuessResult {
  won: boolean;
  guessesLeft: number;
  attributes: AttributeFeedback[];
  correctAnswer?: {
    id: string;
    title: string;
    titleEnglish: string | null;
    coverImage: string;
  };
}

export interface AttributeFeedback {
  key: string;
  label: string;
  guessValue: string | number | string[];
  correctValue: string | number | string[];
  status: 'correct' | 'partial' | 'wrong';
  direction?: 'up' | 'down'; // for numeric attributes
}

export interface DailyChallengeData {
  id: string;
  date: string; // ISO date string
  mode: GameMode;
  expiresAt: string; // ISO datetime
}

export interface ScreenshotChallengeData extends DailyChallengeData {
  mode: 'SCREENSHOT';
  screenshotUrl: string;
  difficulty: number;
}

export interface CharacterChallengeData extends DailyChallengeData {
  mode: 'CHARACTER';
  characterImage: string;
  characterName?: string; // revealed after solve
}

export interface OpeningChallengeData extends DailyChallengeData {
  mode: 'OPENING';
  audioUrl: string;
  clipStart: number;
  clipDuration: number;
}

export interface AnidleChallengeData extends DailyChallengeData {
  mode: 'ANIDLE';
  // No answer data — just confirm daily exists
}

export interface StreakData {
  currentStreak: number;
  longestStreak: number;
  lastPlayedAt: string | null;
  freezesAvailable: number;
}

export interface LeaderboardEntry {
  rank: number;
  userId: string;
  userName: string;
  userImage: string | null;
  points: number;
  streak: number;
}

export interface ScoreSubmission {
  challengeId: string;
  mode: GameMode;
  won: boolean;
  attempts: number;
  points: number;
  timeTaken?: number;
}

