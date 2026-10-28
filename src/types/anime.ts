// Anime and character type definitions

export interface AnimeBasic {
  id: string;
  anilistId: number;
  title: string;
  titleEnglish: string | null;
  titleNative: string | null;
  coverImage: string;
}

export interface AnimeDetailed extends AnimeBasic {
  bannerImage: string | null;
  year: number | null;
  season: string | null;
  format: string | null;
  status: string | null;
  episodes: number | null;
  studios: string[];
  genres: string[];
  tags: string[];
  source: string | null;
  score: number | null;
  popularity: number | null;
  description: string | null;
  contentType: string;
}

export interface CharacterBasic {
  id: string;
  anilistId: number | null;
  name: string;
  nameNative: string | null;
  image: string;
  animeId: string;
  anime: AnimeBasic;
}

export interface AnilistAnime {
  id: number;
  title: {
    romaji: string;
    english: string | null;
    native: string | null;
  };
  synonyms: string[];
  coverImage: {
    large: string;
    extraLarge: string;
  };
  bannerImage: string | null;
  startDate: {
    year: number | null;
    month: number | null;
    day: number | null;
  };
  season: string | null;
  format: string | null;
  status: string | null;
  episodes: number | null;
  studios: {
    nodes: Array<{ name: string; isAnimationStudio: boolean }>;
  };
  genres: string[];
  tags: Array<{ name: string; rank: number }>;
  source: string | null;
  meanScore: number | null;
  popularity: number | null;
  description: string | null;
}

export interface AnilistCharacter {
  id: number;
  name: {
    full: string;
    native: string | null;
  };
  image: {
    large: string;
  };
  description: string | null;
}

