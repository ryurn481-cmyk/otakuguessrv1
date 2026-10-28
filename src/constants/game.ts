// Game constants

export const GAME_MODES = ['SCREENSHOT', 'PANEL', 'PROP', 'EYES', 'CHARACTER', 'OPENING', 'ANIDLE'] as const;

export const MAX_GUESSES = {
  SCREENSHOT: 6,
  PANEL: 6,
  PROP: 6,
  EYES: 6,
  CHARACTER: 3,
  OPENING: 6,
  ANIDLE: 6,
} as const;

export const MAX_POINTS = {
  SCREENSHOT: 1000,
  PANEL: 1000,
  PROP: 1000,
  EYES: 1000,
  CHARACTER: 1000,
  OPENING: 1000,
  ANIDLE: 1000,
} as const;

export const POINTS_DEDUCTION = {
  SCREENSHOT: 150,
  PANEL: 150,
  PROP: 150,
  EYES: 150,
  CHARACTER: 150,
  OPENING: 150,
  ANIDLE: 100,
} as const;

export const SPEED_BONUS = {
  FAST: { threshold: 30, bonus: 100 },   // under 30 seconds
  MEDIUM: { threshold: 60, bonus: 50 },  // under 60 seconds
} as const;

export const BLUR_LEVELS = [
  'blur-3xl',   // attempt 0 (initial): maximum blur
  'blur-2xl',   // attempt 1
  'blur-xl',    // attempt 2
  'blur-lg',    // attempt 3
  'blur-md',    // attempt 4
  'blur-sm',    // attempt 5
  '',           // attempt 6: no blur (final reveal)
] as const;

export const AUDIO_REVEAL_SECONDS = [5, 8, 12, 18, 25, 30] as const;

export const STREAK_FREEZE_MILESTONE = 7; // earn 1 freeze every 7-day streak

