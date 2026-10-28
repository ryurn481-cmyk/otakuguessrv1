import { loadEnvConfig } from '@next/env';
import { PrismaClient } from '@prisma/client';
import { readFile } from 'node:fs/promises';
import path from 'node:path';
import { anilistQuery, TOP_MEDIA_QUERY } from '../src/lib/anilist';

loadEnvConfig(process.cwd());

// Imports are administrative, long-running work. Use Neon's direct endpoint
// when it is available; the pooled URL remains for normal web traffic.
const prisma = new PrismaClient({
  datasources: {
    db: { url: process.env.DIRECT_URL ?? process.env.DATABASE_URL },
  },
});

async function withConnectionRetry<T>(operation: () => Promise<T>): Promise<T> {
  for (let attempt = 0; attempt < 3; attempt++) {
    try {
      return await operation();
    } catch (error) {
      const message = error instanceof Error ? error.message : '';
      const isConnectionReset = message.includes('Server has closed the connection') || message.includes('P1017');
      if (!isConnectionReset || attempt === 2) throw error;
      await new Promise((resolve) => setTimeout(resolve, 250 * (attempt + 1)));
    }
  }
  throw new Error('Unreachable');
}

type CatalogEntry = {
  anilistId: number;
  imageUrl?: string;
  blurredUrl?: string | null;
  audioUrl?: string;
  title?: string | null;
  clipStart?: number;
  clipDuration?: number;
  difficulty?: number;
  hint?: string | null;
};

type ContentCatalog = {
  screenshots?: CatalogEntry[];
  // Licensed manga pages, vertical manhwa panels, or manhua spreads.
  // They use the same image storage model as screenshots.
  panels?: CatalogEntry[];
  props?: CatalogEntry[];
  eyes?: CatalogEntry[];
  openings?: CatalogEntry[];
};

type AniListMedia = {
  id: number;
  title: { romaji: string | null; english: string | null; native: string | null };
  synonyms: string[];
  coverImage: { large: string | null; extraLarge: string | null };
  bannerImage: string | null;
  startDate: { year: number | null };
  season: string | null;
  format: string | null;
  status: string | null;
  episodes: number | null;
  studios: { nodes: Array<{ name: string; isAnimationStudio: boolean }> };
  genres: string[];
  tags: Array<{ name: string; rank: number }>;
  source: string | null;
  meanScore: number | null;
  popularity: number | null;
  description: string | null;
  characters: {
    edges: Array<{
      node: {
        id: number;
        name: { full: string | null; native: string | null };
        image: { large: string | null };
        description: string | null;
      };
      role: string;
    }>;
  };
};

type AniListResponse = { Page: { pageInfo: { hasNextPage: boolean }; media: AniListMedia[] } };

async function loadCatalog(): Promise<ContentCatalog> {
  const catalogPath = path.join(process.cwd(), 'prisma', 'content-catalog.json');
  try {
    const raw = await readFile(catalogPath, 'utf8');
    const parsed: unknown = JSON.parse(raw);
    if (!parsed || typeof parsed !== 'object' || Array.isArray(parsed)) {
      throw new Error('the top-level value must be an object');
    }
    return parsed as ContentCatalog;
  } catch (error) {
    const code = (error as NodeJS.ErrnoException).code;
    if (code === 'ENOENT') {
      console.warn('No prisma/content-catalog.json found; Screenshot and Opening content will not be seeded.');
      console.warn('Copy prisma/content-catalog.example.json and replace the example URLs with media you are licensed to use.');
      return {};
    }
    throw new Error(`Could not read prisma/content-catalog.json: ${(error as Error).message}`);
  }
}

function positiveInteger(value: number | undefined, fallback: number, field: string): number {
  const result = value ?? fallback;
  if (!Number.isInteger(result) || result < 0) throw new Error(`${field} must be a non-negative integer.`);
  return result;
}

async function seedCatalog(catalog: ContentCatalog) {
  let screenshots = 0;
  let openings = 0;

  const visualEntries = [
    ...(catalog.screenshots ?? []).map((entry) => ({ entry, clueType: 'SCREENSHOT' })),
    ...(catalog.panels ?? []).map((entry) => ({ entry, clueType: 'PANEL' })),
    ...(catalog.props ?? []).map((entry) => ({ entry, clueType: 'PROP' })),
    ...(catalog.eyes ?? []).map((entry) => ({ entry, clueType: 'EYES' })),
  ];
  for (const { entry, clueType } of visualEntries) {
    if (!Number.isInteger(entry.anilistId) || !entry.imageUrl) {
      throw new Error('Each screenshot entry needs an integer anilistId and imageUrl.');
    }
    const anime = await prisma.anime.findUnique({ where: { anilistId: entry.anilistId } });
    if (!anime) throw new Error(`Screenshot references AniList ID ${entry.anilistId}, which was not seeded.`);

    const existing = await prisma.screenshot.findFirst({
      where: { animeId: anime.id, imageUrl: entry.imageUrl },
    });
    const data = {
      imageUrl: entry.imageUrl,
      blurredUrl: entry.blurredUrl ?? null,
      difficulty: positiveInteger(entry.difficulty, 3, 'screenshot difficulty'),
      clueType,
      hint: entry.hint ?? null,
      animeId: anime.id,
    };
    if (existing) await prisma.screenshot.update({ where: { id: existing.id }, data });
    else await prisma.screenshot.create({ data });
    screenshots++;
  }

  for (const entry of catalog.openings ?? []) {
    if (!Number.isInteger(entry.anilistId) || !entry.audioUrl) {
      throw new Error('Each opening entry needs an integer anilistId and audioUrl.');
    }
    const anime = await prisma.anime.findUnique({ where: { anilistId: entry.anilistId } });
    if (!anime) throw new Error(`Opening references AniList ID ${entry.anilistId}, which was not seeded.`);

    const existing = await prisma.opening.findFirst({
      where: { animeId: anime.id, audioUrl: entry.audioUrl },
    });
    const data = {
      audioUrl: entry.audioUrl,
      title: entry.title ?? null,
      clipStart: positiveInteger(entry.clipStart, 0, 'opening clipStart'),
      clipDuration: positiveInteger(entry.clipDuration, 30, 'opening clipDuration'),
      animeId: anime.id,
    };
    if (data.clipDuration === 0) throw new Error('opening clipDuration must be greater than zero.');
    if (existing) await prisma.opening.update({ where: { id: existing.id }, data });
    else await prisma.opening.create({ data });
    openings++;
  }

  return { screenshots, openings };
}

async function main() {
  const pages = positiveInteger(Number(process.env.ANILIST_SEED_PAGES ?? 2), 2, 'ANILIST_SEED_PAGES');
  if (pages === 0) throw new Error('ANILIST_SEED_PAGES must be at least 1.');

  let animeCount = 0;
  let characterCount = 0;
  const contentTypes = (process.env.ANILIST_CONTENT_TYPES ?? 'ANIME,MANGA,MANHWA,MANHUA').split(',').map((value) => value.trim().toUpperCase()).filter((value): value is 'ANIME' | 'MANGA' | 'MANHWA' | 'MANHUA' => ['ANIME', 'MANGA', 'MANHWA', 'MANHUA'].includes(value));
  for (const contentType of contentTypes) for (let page = 1; page <= pages; page++) {
    const response = await anilistQuery<AniListResponse>(TOP_MEDIA_QUERY, {
      page,
      perPage: 50,
      type: contentType === 'ANIME' ? 'ANIME' : 'MANGA',
      countryOfOrigin: contentType === 'MANHWA' ? 'KR' : contentType === 'MANHUA' ? 'CN' : undefined,
    });
    for (const media of response.Page.media) {
      const coverImage = media.coverImage.extraLarge ?? media.coverImage.large;
      const title = media.title.romaji;
      if (!coverImage || !title) {
        console.warn(`Skipping AniList ID ${media.id}: it has no usable title or cover image.`);
        continue;
      }

      const anime = await withConnectionRetry(() => prisma.anime.upsert({
        where: { anilistId: media.id },
        update: {
          title,
          titleEnglish: media.title.english,
          titleNative: media.title.native,
          synonyms: media.synonyms,
          coverImage,
          bannerImage: media.bannerImage,
          year: media.startDate.year,
          season: media.season,
          format: media.format,
          status: media.status,
          episodes: media.episodes,
          studios: media.studios.nodes.filter((studio) => studio.isAnimationStudio).map((studio) => studio.name),
          genres: media.genres,
          tags: media.tags.slice(0, 15).map((tag) => tag.name),
          source: media.source,
          score: media.meanScore,
          popularity: media.popularity,
          description: media.description,
          contentType,
        },
        create: {
          anilistId: media.id,
          title,
          titleEnglish: media.title.english,
          titleNative: media.title.native,
          synonyms: media.synonyms,
          coverImage,
          bannerImage: media.bannerImage,
          year: media.startDate.year,
          season: media.season,
          format: media.format,
          status: media.status,
          episodes: media.episodes,
          studios: media.studios.nodes.filter((studio) => studio.isAnimationStudio).map((studio) => studio.name),
          genres: media.genres,
          tags: media.tags.slice(0, 15).map((tag) => tag.name),
          source: media.source,
          score: media.meanScore,
          popularity: media.popularity,
          description: media.description,
          contentType,
        },
      }));
      animeCount++;

      for (const edge of media.characters.edges) {
        const character = edge.node;
        const name = character.name.full;
        const image = character.image.large;
        if (!name || !image) continue;
        await withConnectionRetry(() => prisma.character.upsert({
          where: { anilistId: character.id },
          update: {
            name,
            nameNative: character.name.native,
            image,
            description: character.description,
            animeId: anime.id,
          },
          create: {
            anilistId: character.id,
            name,
            nameNative: character.name.native,
            image,
            description: character.description,
            animeId: anime.id,
          },
        }));
        characterCount++;
      }
    }
    if (!response.Page.pageInfo.hasNextPage) break;
  }

  const catalogCounts = await seedCatalog(await loadCatalog());
  console.log(`Seeded ${animeCount} anime and ${characterCount} characters; synced ${catalogCounts.screenshots} screenshots and ${catalogCounts.openings} openings.`);
}

main()
  .catch((error) => {
    console.error('Seed failed:', error);
    process.exitCode = 1;
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
