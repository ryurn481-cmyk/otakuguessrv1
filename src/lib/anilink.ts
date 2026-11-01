/**
 * AniLink — Six-degrees graph navigation library
 *
 * Handles:
 *  - Computing attribute-based connections between titles
 *  - BFS shortest path between two titles
 *  - Returning hop options for a given attribute
 */

// ─── Types ────────────────────────────────────────────────────────────────────

export type HopAttribute =
  | { type: 'genre'; value: string }
  | { type: 'studio'; value: string }
  | { type: 'source'; value: string }
  | { type: 'season_year'; value: string }
  | { type: 'author'; value: string }
  | { type: 'artist'; value: string }
  | { type: 'publisher'; value: string }
  | { type: 'magazine'; value: string }
  | { type: 'director'; value: string }
  | { type: 'composer'; value: string }
  | { type: 'source_title'; value: string }
  | { type: 'format'; value: string };

export interface ConnectionGroup {
  attribute: HopAttribute;
  count: number; // how many OTHER titles share this attribute with current
}

/** Minimal shape needed for BFS / connection logic */
export interface AnimeNode {
  id: string;
  title: string;
  titleEnglish?: string | null;
  titleNative?: string | null;
  coverImage: string;
  year?: number | null;
  season?: string | null;
  format?: string | null;
  contentType: string;
  genres: string[];
  studios: string[];
  source?: string | null;
  author?: string | null;
  artist?: string | null;
  publisher?: string | null;
  magazine?: string | null;
  director?: string | null;
  composer?: string | null;
  sourceTitle?: string | null;
  popularity?: number | null;
}

// ─── Internal helpers ──────────────────────────────────────────────────────────

/** Build the season_year string used as a hop value, e.g. "SPRING 2021" */
function seasonYear(node: AnimeNode): string | null {
  if (node.season && node.year) return `${node.season} ${node.year}`;
  return null;
}

/** Collect all hop-key values that a node exposes */
function nodeAttributes(node: AnimeNode): HopAttribute[] {
  const attrs: HopAttribute[] = [];

  for (const g of node.genres) attrs.push({ type: 'genre', value: g });
  for (const s of node.studios) attrs.push({ type: 'studio', value: s });
  if (node.source) attrs.push({ type: 'source', value: node.source });
  const sy = seasonYear(node);
  if (sy) attrs.push({ type: 'season_year', value: sy });
  if (node.author) attrs.push({ type: 'author', value: node.author });
  if (node.artist) attrs.push({ type: 'artist', value: node.artist });
  if (node.publisher) attrs.push({ type: 'publisher', value: node.publisher });
  if (node.magazine) attrs.push({ type: 'magazine', value: node.magazine });
  if (node.director) attrs.push({ type: 'director', value: node.director });
  if (node.composer) attrs.push({ type: 'composer', value: node.composer });
  // A work's title is indexed too, so an adaptation with sourceTitle can link
  // directly to its manga/manhwa entry without making title a general hop.
  attrs.push({ type: 'source_title', value: node.title });
  if (node.titleEnglish && node.titleEnglish !== node.title) attrs.push({ type: 'source_title', value: node.titleEnglish });
  if (node.sourceTitle) attrs.push({ type: 'source_title', value: node.sourceTitle });
  if (node.format) attrs.push({ type: 'format', value: node.format });

  return attrs;
}

/** Serialise a HopAttribute to a unique string key */
function attrKey(attr: HopAttribute): string {
  return `${attr.type}::${attr.value}`;
}

// ─── Public API ───────────────────────────────────────────────────────────────

/**
 * For a given title, return all ConnectionGroups (attribute → how many other
 * titles share it).  The caller's own title is excluded from counts.
 */
export function findConnections(
  animeId: string,
  db: AnimeNode[],
): ConnectionGroup[] {
  const current = db.find((a) => a.id === animeId);
  if (!current) return [];

  const myAttrs = nodeAttributes(current);

  // Build a map: attrKey → count of OTHER nodes sharing it
  const countMap = new Map<string, { attribute: HopAttribute; count: number }>();

  for (const attr of myAttrs) {
    const key = attrKey(attr);
    let count = 0;
    for (const node of db) {
      if (node.id === animeId) continue;
      if (nodeHasAttribute(node, attr)) count++;
    }
    if (count > 0) {
      countMap.set(key, { attribute: attr, count });
    }
  }

  return Array.from(countMap.values()).sort((a, b) => b.count - a.count);
}

/** Check whether a node possesses a specific HopAttribute value */
function nodeHasAttribute(node: AnimeNode, attr: HopAttribute): boolean {
  switch (attr.type) {
    case 'genre':
      return node.genres.includes(attr.value);
    case 'studio':
      return node.studios.includes(attr.value);
    case 'source':
      return node.source === attr.value;
    case 'season_year':
      return seasonYear(node) === attr.value;
    case 'author':
      return node.author === attr.value;
    case 'artist':
      return node.artist === attr.value;
    case 'publisher':
      return node.publisher === attr.value;
    case 'magazine':
      return node.magazine === attr.value;
    case 'director':
      return node.director === attr.value;
    case 'composer':
      return node.composer === attr.value;
    case 'source_title':
      return node.sourceTitle === attr.value || node.title === attr.value || node.titleEnglish === attr.value;
    case 'format':
      return node.format === attr.value;
  }
}

/**
 * Returns all titles reachable via the given hop attribute from currentId,
 * excluding already-visited IDs, sorted by popularity desc (max 50).
 */
export function getHopOptions(
  currentId: string,
  attribute: HopAttribute,
  db: AnimeNode[],
  excludeIds: string[] = [],
): AnimeNode[] {
  const excludeSet = new Set([currentId, ...excludeIds]);

  return db
    .filter((node) => !excludeSet.has(node.id) && nodeHasAttribute(node, attribute))
    .sort((a, b) => (b.popularity ?? 0) - (a.popularity ?? 0))
    .slice(0, 50);
}

/**
 * Check whether two titles share any hop attribute.
 * Returns the first matching HopAttribute or null.
 */
export function isConnected(a: AnimeNode, b: AnimeNode): HopAttribute | null {
  const attrsA = nodeAttributes(a);
  for (const attr of attrsA) {
    if (nodeHasAttribute(b, attr)) return attr;
  }
  return null;
}

/**
 * BFS shortest path between startId and targetId within the provided db.
 * Returns minimum hop count, or -1 if unreachable.
 *
 * For performance, the caller should pass only the top N titles (e.g. 2000)
 * rather than the full database.
 */
export function bfsShortestPath(
  startId: string,
  targetId: string,
  db: AnimeNode[],
): number {
  if (startId === targetId) return 0;

  // Build adjacency map: id → list of directly connected ids
  // Indexed lookup: for each attribute value, which node ids have it?
  const attrIndex = new Map<string, string[]>(); // attrKey → [ids]

  for (const node of db) {
    for (const attr of nodeAttributes(node)) {
      const key = attrKey(attr);
      const arr = attrIndex.get(key);
      if (arr) arr.push(node.id);
      else attrIndex.set(key, [node.id]);
    }
  }

  // Build per-node neighbours list using the index
  const neighbours = new Map<string, Set<string>>();
  for (const node of db) {
    if (!neighbours.has(node.id)) neighbours.set(node.id, new Set());
    for (const attr of nodeAttributes(node)) {
      const key = attrKey(attr);
      const peers = attrIndex.get(key) ?? [];
      const myNeighbours = neighbours.get(node.id)!;
      for (const peerId of peers) {
        if (peerId !== node.id) myNeighbours.add(peerId);
      }
    }
  }

  // Standard BFS
  const visited = new Set<string>([startId]);
  const queue: Array<{ id: string; depth: number }> = [{ id: startId, depth: 0 }];

  while (queue.length > 0) {
    const { id, depth } = queue.shift()!;
    const next = neighbours.get(id);
    if (!next) continue;
    for (const neighbourId of next) {
      if (neighbourId === targetId) return depth + 1;
      if (!visited.has(neighbourId)) {
        visited.add(neighbourId);
        queue.push({ id: neighbourId, depth: depth + 1 });
      }
    }
  }

  return -1; // unreachable
}

/**
 * Reconstruct the actual shortest path (list of ids) via BFS.
 * Returns null if unreachable.
 */
export function bfsPath(
  startId: string,
  targetId: string,
  db: AnimeNode[],
): string[] | null {
  if (startId === targetId) return [startId];

  const attrIndex = new Map<string, string[]>();
  for (const node of db) {
    for (const attr of nodeAttributes(node)) {
      const key = attrKey(attr);
      const arr = attrIndex.get(key);
      if (arr) arr.push(node.id);
      else attrIndex.set(key, [node.id]);
    }
  }

  const neighbours = new Map<string, Set<string>>();
  for (const node of db) {
    if (!neighbours.has(node.id)) neighbours.set(node.id, new Set());
    for (const attr of nodeAttributes(node)) {
      const key = attrKey(attr);
      const peers = attrIndex.get(key) ?? [];
      const myNeighbours = neighbours.get(node.id)!;
      for (const peerId of peers) {
        if (peerId !== node.id) myNeighbours.add(peerId);
      }
    }
  }

  const visited = new Map<string, string | null>([[startId, null]]); // id → parent
  const queue: string[] = [startId];

  while (queue.length > 0) {
    const current = queue.shift()!;
    const next = neighbours.get(current);
    if (!next) continue;
    for (const neighbourId of next) {
      if (!visited.has(neighbourId)) {
        visited.set(neighbourId, current);
        if (neighbourId === targetId) {
          // Reconstruct path
          const path: string[] = [];
          let step: string | null = targetId;
          while (step !== null) {
            path.unshift(step);
            step = visited.get(step) ?? null;
          }
          return path;
        }
        queue.push(neighbourId);
      }
    }
  }

  return null;
}
