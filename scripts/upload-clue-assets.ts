import { v2 as cloudinary } from 'cloudinary';
import { readFile, writeFile } from 'node:fs/promises';
import path from 'node:path';
import { loadEnvConfig } from '@next/env';

loadEnvConfig(process.cwd());

type ClueType = 'PROP' | 'EYES';
type ManifestEntry = {
  anilistId: number;
  type: ClueType;
  sourceUrl: string;
  hint?: string;
  difficulty?: number;
  license: string;
  attribution: string;
};
type CatalogEntry = { anilistId: number; imageUrl: string; hint?: string; difficulty?: number };
type Catalog = { screenshots?: CatalogEntry[]; panels?: CatalogEntry[]; openings?: unknown[]; props?: CatalogEntry[]; eyes?: CatalogEntry[] };

const manifestPath = path.join(process.cwd(), 'prisma', 'clue-assets.json');
const catalogPath = path.join(process.cwd(), 'prisma', 'content-catalog.json');

function assertConfig() {
  const { CLOUDINARY_CLOUD_NAME, CLOUDINARY_API_KEY, CLOUDINARY_API_SECRET } = process.env;
  if (!CLOUDINARY_CLOUD_NAME || !CLOUDINARY_API_KEY || !CLOUDINARY_API_SECRET) {
    throw new Error('Set CLOUDINARY_CLOUD_NAME, CLOUDINARY_API_KEY, and CLOUDINARY_API_SECRET before uploading clues.');
  }
  cloudinary.config({ cloud_name: CLOUDINARY_CLOUD_NAME, api_key: CLOUDINARY_API_KEY, api_secret: CLOUDINARY_API_SECRET });
}

async function readJson<T>(file: string, fallback?: T): Promise<T> {
  try { return JSON.parse(await readFile(file, 'utf8')) as T; }
  catch (error) {
    if ((error as NodeJS.ErrnoException).code === 'ENOENT' && fallback !== undefined) return fallback;
    throw error;
  }
}

async function main() {
  assertConfig();
  const entries = await readJson<ManifestEntry[]>(manifestPath);
  const catalog = await readJson<Catalog>(catalogPath, {});
  catalog.props ??= [];
  catalog.eyes ??= [];

  for (const entry of entries) {
    if (!Number.isInteger(entry.anilistId) || !entry.sourceUrl || !entry.license || !entry.attribution) {
      throw new Error('Each clue requires anilistId, sourceUrl, type, license, and attribution.');
    }
    const folder = entry.type === 'PROP' ? 'otakuguessr/clues/props' : 'otakuguessr/clues/eyes';
    const result = await cloudinary.uploader.upload(entry.sourceUrl, {
      folder,
      resource_type: 'image',
      use_filename: true,
      unique_filename: true,
      context: { source_url: entry.sourceUrl, license: entry.license, attribution: entry.attribution },
      tags: ['otakuguessr', 'clue', entry.type.toLowerCase()],
    });
    const target: CatalogEntry[] = entry.type === 'PROP' ? catalog.props : catalog.eyes;
    const item: CatalogEntry = { anilistId: entry.anilistId, imageUrl: result.secure_url, difficulty: entry.difficulty ?? 3 };
    if (entry.hint) item.hint = entry.hint;
    const existing = target.findIndex((candidate) => candidate.anilistId === item.anilistId && candidate.imageUrl === item.imageUrl);
    if (existing >= 0) target[existing] = item;
    else target.push(item);
    console.log(`Uploaded ${entry.type.toLowerCase()} clue for AniList ${entry.anilistId}.`);
  }

  await writeFile(catalogPath, `${JSON.stringify(catalog, null, 2)}\n`);
  console.log('Updated prisma/content-catalog.json. Run npm.cmd run db:seed to sync it to the database.');
}

main().catch((error) => { console.error('Clue upload failed:', error); process.exitCode = 1; });
