/**
 * AniList GraphQL API helpers for fetching anime and character data.
 * AniList is a free public API — no API key required.
 */

const ANILIST_URL = 'https://graphql.anilist.co';

/**
 * Execute a GraphQL query against the AniList API with rate limiting awareness.
 */
export async function anilistQuery<T>(query: string, variables: Record<string, unknown>): Promise<T> {
  const response = await fetch(ANILIST_URL, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'Accept': 'application/json',
    },
    body: JSON.stringify({ query, variables }),
  });

  if (!response.ok) {
    const retryAfter = response.headers.get('Retry-After');
    if (response.status === 429 && retryAfter) {
      // Rate limited — wait and retry once
      await new Promise((r) => setTimeout(r, parseInt(retryAfter) * 1000 + 1000));
      return anilistQuery<T>(query, variables);
    }
    const details = await response.text();
    throw new Error(`AniList API error: ${response.status} ${response.statusText}${details ? ` - ${details}` : ''}`);
  }

  const json = await response.json() as {
    errors?: Array<{ message?: string }>;
    data: T;
  };
  if (json.errors) {
    throw new Error(`AniList GraphQL error: ${json.errors[0]?.message}`);
  }

  return json.data as T;
}

export const TOP_ANIME_QUERY = `
query ($page: Int, $perPage: Int) {
  Page(page: $page, perPage: $perPage) {
    pageInfo {
      hasNextPage
      currentPage
    }
    media(
      type: ANIME
      sort: POPULARITY_DESC
      format_in: [TV, MOVIE, OVA, ONA]
      status_not: NOT_YET_RELEASED
    ) {
      id
      title { romaji english native }
      synonyms
      coverImage { large extraLarge }
      bannerImage
      startDate { year }
      season
      format
      status
      episodes
      studios { nodes { name isAnimationStudio } }
      genres
      tags { name rank }
      source
      meanScore
      popularity
      description(asHtml: false)
      characters(page: 1, perPage: 10, sort: ROLE) {
        edges {
          node {
            id
            name { full native }
            image { large }
            description(asHtml: false)
          }
          role
        }
      }
    }
  }
}
`;

// Same rich payload as the anime import, parameterised so the seed pipeline can
// import manga and classify Korean/Chinese source material without another API.
export const TOP_MEDIA_QUERY = TOP_ANIME_QUERY
  .replace('query ($page: Int, $perPage: Int)', 'query ($page: Int, $perPage: Int, $type: MediaType, $countryOfOrigin: CountryCode)')
  .replace('type: ANIME', 'type: $type')
  .replace('format_in: [TV, MOVIE, OVA, ONA]', 'countryOfOrigin: $countryOfOrigin');

export const ANIME_CHARACTERS_QUERY = `
query ($mediaId: Int, $page: Int) {
  Media(id: $mediaId) {
    characters(page: $page, perPage: 10, sort: ROLE) {
      pageInfo { hasNextPage }
      edges {
        node {
          id
          name { full native }
          image { large }
          description(asHtml: false)
        }
        role
      }
    }
  }
}
`;

