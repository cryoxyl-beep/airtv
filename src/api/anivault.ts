export interface AnivaultSubtitle {
  url: string;
  lang: string;
  default?: boolean;
}

export interface AnivaultTimestamp {
  start: number;
  end: number;
}

export interface AnivaultWatchResponse {
  anilistId?: number | string;
  malId?: number | string;
  title?: string;
  episode?: number | string;
  type?: string;
  source?: string;
  server?: string;
  availableServers?: string[];
  embedUrl?: string;
  m3u8?: string;
  hlsProxyUrl?: string;
  playbackMode?: string;
  iframeOnly?: boolean;
  subtitles?: AnivaultSubtitle[];
  intro?: AnivaultTimestamp | null;
  outro?: AnivaultTimestamp | null;
  note?: string;
}

export interface AnimeStreamResult {
  hlsProxyUrl: string;
  englishSubtitleUrl?: string;
  availableServers: string[];
  currentServer: string;
  intro?: AnivaultTimestamp | null;
  outro?: AnivaultTimestamp | null;
  raw: AnivaultWatchResponse;
}

/**
 * Fetches native HLS stream details from Anivault Anime API.
 * Strict requirement: always use hlsProxyUrl exclusively.
 * Only English subtitles are extracted.
 */
export async function fetchAnivaultStream(
  anilistId: number | string,
  episode: number | string,
  server?: string,
  signal?: AbortSignal
): Promise<AnimeStreamResult> {
  const url = new URL('https://anivault-scraper-pink.vercel.app/api/watch');
  url.searchParams.set('anilistId', String(anilistId));
  url.searchParams.set('ep', String(episode));
  if (server) {
    url.searchParams.set('server', server);
  }

  const response = await fetch(url.toString(), { signal });
  if (!response.ok) {
    throw new Error(`Anivault API returned HTTP ${response.status}`);
  }

  const data: AnivaultWatchResponse = await response.json();

  if (!data.hlsProxyUrl) {
    throw new Error('No hlsProxyUrl available from Anivault');
  }

  // Deduplicate available servers while preserving original response order
  const rawServers = Array.isArray(data.availableServers) ? data.availableServers : [];
  const deduplicatedServers: string[] = Array.from(new Set(rawServers.filter(Boolean)));

  if (data.server && !deduplicatedServers.includes(data.server)) {
    deduplicatedServers.unshift(data.server);
  }

  // Extract English subtitles only
  let englishSub: AnivaultSubtitle | undefined;
  if (Array.isArray(data.subtitles)) {
    englishSub = data.subtitles.find(
      (s) => s && typeof s.lang === 'string' && s.lang.trim().toLowerCase() === 'english' && s.url
    );
    if (!englishSub) {
      englishSub = data.subtitles.find(
        (s) => s && typeof s.lang === 'string' && s.lang.trim().toLowerCase().startsWith('english') && s.url
      );
    }
  }

  const validIntro =
    data.intro &&
    typeof data.intro.start === 'number' &&
    typeof data.intro.end === 'number' &&
    data.intro.end > data.intro.start
      ? data.intro
      : null;

  const validOutro =
    data.outro &&
    typeof data.outro.start === 'number' &&
    typeof data.outro.end === 'number' &&
    data.outro.end > data.outro.start
      ? data.outro
      : null;

  return {
    hlsProxyUrl: data.hlsProxyUrl,
    englishSubtitleUrl: englishSub?.url,
    availableServers: deduplicatedServers.length > 0 ? deduplicatedServers : [data.server || 'HD-1'],
    currentServer: data.server || deduplicatedServers[0] || 'HD-1',
    intro: validIntro,
    outro: validOutro,
    raw: data,
  };
}
