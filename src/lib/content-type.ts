export const MEDIA_CONTENT_TYPES = ['ANIME', 'MANGA', 'MANHWA', 'MANHUA'] as const;
export const PLAYABLE_CONTENT_TYPES = [...MEDIA_CONTENT_TYPES, 'MIXED'] as const;

export type MediaContentType = (typeof MEDIA_CONTENT_TYPES)[number];
export type PlayableContentType = (typeof PLAYABLE_CONTENT_TYPES)[number];

export function contentTypeFrom(value: string | null | undefined): PlayableContentType {
  return PLAYABLE_CONTENT_TYPES.includes(value as PlayableContentType)
    ? value as PlayableContentType
    : 'ANIME';
}

export function isMediaContentType(value: string): value is MediaContentType {
  return MEDIA_CONTENT_TYPES.includes(value as MediaContentType);
}

export function contentTypeLabel(value: PlayableContentType) {
  return value === 'MIXED' ? 'Mixed' : value[0] + value.slice(1).toLowerCase();
}
