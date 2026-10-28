// Canonical media search endpoint. The legacy /api/search/anime route remains
// available so older clients and bookmarks continue to work.
import { GET as searchMedia } from '@/app/api/search/anime/route';
export const runtime = 'nodejs';
export const GET = searchMedia;
