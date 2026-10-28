// Anidle attribute definitions for the Wordle-style mode

export interface AnidleAttribute {
  key: string;
  label: string;
  type: 'numeric' | 'categorical' | 'set';
  closeThreshold?: number; // for numeric: within this range = yellow
  icon: string;            // emoji or icon name
}

export const ANIDLE_ATTRIBUTES: AnidleAttribute[] = [
  {
    key: 'year',
    label: 'Year',
    type: 'numeric',
    closeThreshold: 3,
    icon: '📅',
  },
  {
    key: 'season',
    label: 'Season',
    type: 'categorical',
    icon: '🌸',
  },
  {
    key: 'format',
    label: 'Format',
    type: 'categorical',
    icon: '📺',
  },
  {
    key: 'episodes',
    label: 'Episodes',
    type: 'numeric',
    closeThreshold: 10,
    icon: '🎬',
  },
  {
    key: 'genres',
    label: 'Genres',
    type: 'set',
    icon: '🏷️',
  },
  {
    key: 'studio',
    label: 'Studio',
    type: 'categorical',
    icon: '🏢',
  },
  {
    key: 'source',
    label: 'Source',
    type: 'categorical',
    icon: '📚',
  },
  {
    key: 'score',
    label: 'Score',
    type: 'numeric',
    closeThreshold: 15, // out of 100
    icon: '⭐',
  },
];

export const SEASON_DISPLAY: Record<string, string> = {
  WINTER: 'Winter',
  SPRING: 'Spring',
  SUMMER: 'Summer',
  FALL: 'Fall',
};

export const FORMAT_DISPLAY: Record<string, string> = {
  TV: 'TV',
  MOVIE: 'Movie',
  OVA: 'OVA',
  ONA: 'ONA',
  SPECIAL: 'Special',
  MUSIC: 'Music',
  TV_SHORT: 'TV Short',
};

export const SOURCE_DISPLAY: Record<string, string> = {
  MANGA: 'Manga',
  ORIGINAL: 'Original',
  LIGHT_NOVEL: 'Light Novel',
  VISUAL_NOVEL: 'Visual Novel',
  VIDEO_GAME: 'Video Game',
  NOVEL: 'Novel',
  DOUJINSHI: 'Doujinshi',
  ANIME: 'Anime',
  MANHWA: 'Manhwa',
  MANHUA: 'Manhua',
  OTHER: 'Other',
};

