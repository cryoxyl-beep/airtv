/**
 * Centralized Movy API service for native movie & TV-series streaming in Miyoro.
 * Base URL: https://movy-scraper.vercel.app
 */

export const MOV_API_BASE = 'https://movy-scraper.vercel.app';

export interface MovySource {
  quality: string;
  url: string;
  format: 'hls' | 'dash' | 'mp4' | string;
}

export interface MovySubtitle {
  lang: string;
  language: string;
  url: string;
}

export interface MovyPlayResponse {
  sources: MovySource[];
  subtitles: MovySubtitle[];
  thumbnail?: string | null;
}

export interface MovyTrendingItem {
  id: number;
  title?: string;
  name?: string;
  media_type: 'movie' | 'tv';
  poster?: string;
  backdrop?: string;
  overview?: string;
  [key: string]: any;
}

export interface MovySearchResult {
  page: number;
  total_pages: number;
  results: any[];
}

export interface MovyTitleDetails {
  id: number;
  type: 'movie' | 'tv';
  title: string;
  overview: string;
  poster?: string;
  backdrop?: string;
  year?: string;
  rating?: number | string;
  runtime?: number | string;
  genres?: string[];
  seasons?: any[];
  total_episodes?: number;
  [key: string]: any;
}

export interface MovyEpisode {
  id: number;
  episode_number: number;
  name: string;
  overview?: string;
  still?: string;
  runtime?: number;
  air_date?: string;
}

export interface MovySeasonResponse {
  season: number;
  episodes: MovyEpisode[];
}

/**
 * Builds the mandatory browser-playable stream proxy URL.
 * Movy's CDN requires `Referer: https://www.movy.sx/`, which browsers cannot set.
 * The /api/stream proxy provides CORS and automatically rewrites internal HLS/DASH manifest URLs.
 */
export function buildMovyProxyUrl(sourceUrl: string): string {
  if (!sourceUrl) return '';
  // Avoid double-encoding and decode any XML entities first
  const cleanUrl = sourceUrl.trim().replace(/&amp;/g, '&');
  return `${MOV_API_BASE}/api/stream?url=${encodeURIComponent(cleanUrl)}`;
}

export type MovyMimeType = 'application/x-mpegurl' | 'application/dash+xml' | 'video/mp4';

/**
 * Resolves the appropriate MIME type for Vidstack's provider based on source format/URL.
 */
export function getMovyMimeType(format?: string, url?: string): MovyMimeType {
  const f = (format || '').toLowerCase();
  const u = (url || '').toLowerCase();

  if (f === 'dash' || u.includes('.mpd')) {
    return 'application/dash+xml';
  }
  if (f === 'mp4' || u.includes('.mp4')) {
    return 'video/mp4';
  }
  // Default to HLS
  return 'application/x-mpegurl';
}

/**
 * Fetch trending movies or TV series from Movy API.
 */
export async function fetchMovyTrending(type: 'movie' | 'tv' = 'movie', page = 1): Promise<any> {
  const res = await fetch(`${MOV_API_BASE}/api/trending?type=${type}&page=${page}`);
  if (!res.ok) {
    throw new Error(`Failed to fetch Movy trending: ${res.status}`);
  }
  return res.json();
}

/**
 * Search movies and TV shows using Movy API.
 */
export async function fetchMovySearch(query: string, page = 1): Promise<MovySearchResult> {
  const res = await fetch(`${MOV_API_BASE}/api/search?q=${encodeURIComponent(query)}&page=${page}`);
  if (!res.ok) {
    throw new Error(`Failed to search Movy: ${res.status}`);
  }
  return res.json();
}

/**
 * Fetch title metadata (movie or TV) from Movy API using TMDB ID.
 */
export async function fetchMovyTitle(type: 'movie' | 'tv', tmdbId: number | string): Promise<MovyTitleDetails> {
  const res = await fetch(`${MOV_API_BASE}/api/title?type=${type}&id=${tmdbId}`);
  if (!res.ok) {
    throw new Error(`Failed to fetch Movy title details: ${res.status}`);
  }
  return res.json();
}

/**
 * Fetch TV season episodes from Movy API.
 */
export async function fetchMovySeason(tmdbId: number | string, seasonNumber: number | string): Promise<MovySeasonResponse> {
  const res = await fetch(`${MOV_API_BASE}/api/season?id=${tmdbId}&season=${seasonNumber}`);
  if (!res.ok) {
    throw new Error(`Failed to fetch Movy season ${seasonNumber}: ${res.status}`);
  }
  return res.json();
}

/**
 * Fetch playable stream sources from Movy API.
 * Automatically retries once after 2s if the returned sources array is empty.
 */
export async function fetchMovyPlay(
  type: 'movie' | 'tv',
  tmdbId: number | string,
  season?: number,
  episode?: number,
  signal?: AbortSignal
): Promise<MovyPlayResponse> {
  const numericId = typeof tmdbId === 'string' ? parseInt(tmdbId, 10) : tmdbId;

  const payload = type === 'movie'
    ? { type: 'movie', id: numericId }
    : {
        type: 'tv',
        id: numericId,
        season: season !== undefined ? Number(season) : 1,
        episode: episode !== undefined ? Number(episode) : 1,
      };

  const executePost = async (): Promise<MovyPlayResponse> => {
    const res = await fetch(`${MOV_API_BASE}/api/play`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(payload),
      signal,
    });

    if (!res.ok) {
      throw new Error(`Movy /api/play request failed: ${res.status}`);
    }

    const data: MovyPlayResponse = await res.json();
    return data;
  };

  let response = await executePost();

  // If sources is empty, retry once after 2 seconds per requirement
  if (!response.sources || response.sources.length === 0) {
    await new Promise((resolve) => setTimeout(resolve, 2000));
    if (signal?.aborted) {
      throw new Error('Aborted');
    }
    response = await executePost();
  }

  return response;
}
