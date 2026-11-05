export type Provider = 'miyoro' | 'vidrift' | 'vidnest' | 'cinesrc' | 'vidfast' | 'movies111' | 'origami' | 'animepahe';

export interface ProviderOptions {
  title?: string;
  poster?: string;
  muted?: boolean;
  isMovie?: boolean;
  tmdbId?: string | number;
}

export function buildVidriftParams(options?: ProviderOptions): string {
  const params = new URLSearchParams();
  params.set('brand', 'Miyoro');
  params.set('brandColor', '#ffffff');
  params.set('exit', '1');
  params.set('hide', 'next');
  params.set('showTitle', '1');
  params.set('uiScale', '1');
  params.set('autoplay', '1');
  if (options?.muted !== undefined) {
    params.set('muted', options.muted ? '1' : '0');
  }
  if (options?.title) {
    params.set('title', options.title);
  }
  if (options?.poster) {
    params.set('poster', options.poster);
  }
  const qs = params.toString();
  return qs ? `?${qs}` : '';
}

export function buildMovieProviderUrl(provider: Provider, tmdbId: string | number, options?: ProviderOptions): string {
  switch (provider) {
    case 'vidrift':
      return `https://embed.vidrift.net/embed/movie/${tmdbId}${buildVidriftParams(options)}`;
    case 'vidnest':
      return `https://vidnest.fun/movie/${tmdbId}`;
    case 'cinesrc':
      return `https://cinesrc.st/embed/movie/${tmdbId}?color=%23ffffff&autoplay=true&autonext=true&autoskip=true`;
    case 'vidfast':
      return `https://vidfast.pro/movie/${tmdbId}?autoPlay=true&theme=FFFFFF`;
    case 'movies111':
      return `https://111movies.net/movie/${tmdbId}`;
    default:
      return `https://vidnest.fun/movie/${tmdbId}`;
  }
}

export function buildSeriesProviderUrl(provider: Provider, tmdbId: string | number, season: string | number, episode: string | number, options?: ProviderOptions): string {
  switch (provider) {
    case 'vidrift':
      return `https://embed.vidrift.net/embed/tv/${tmdbId}/${season}/${episode}${buildVidriftParams(options)}`;
    case 'vidnest':
      return `https://vidnest.fun/tv/${tmdbId}/${season}/${episode}`;
    case 'cinesrc':
      return `https://cinesrc.st/embed/tv/${tmdbId}?s=${season}&e=${episode}&color=%23ffffff&autoplay=true&autonext=true&autoskip=true`;
    case 'vidfast':
      return `https://vidfast.pro/tv/${tmdbId}/${season}/${episode}?autoPlay=true&theme=FFFFFF&nextButton=true&autoNext=true`;
    case 'movies111':
      return `https://111movies.net/tv/${tmdbId}/${season}/${episode}`;
    default:
      return `https://vidnest.fun/tv/${tmdbId}/${season}/${episode}`;
  }
}

export function buildAnimeProviderUrl(provider: Provider, anilistId: string | number, malId: string | number | undefined, episodeNumber: string | number, audioLanguage: 'sub' | 'dub' = 'sub', startAtSeconds: number = 0, options?: ProviderOptions): string {
  switch (provider) {
    case 'vidrift': {
      if (options?.isMovie && options?.tmdbId) {
        return `https://embed.vidrift.net/embed/movie/${options.tmdbId}${buildVidriftParams(options)}`;
      }
      return `https://embed.vidrift.net/embed/anilist/${anilistId}/${episodeNumber}${buildVidriftParams(options)}`;
    }
    case 'origami':
      return `https://megaplay.buzz/stream/mal/${malId || anilistId}/${episodeNumber}/${audioLanguage}`;
    case 'vidnest':
      return `https://vidnest.fun/anime/${anilistId}/${episodeNumber}/${audioLanguage}?startAt=${startAtSeconds}`;
    case 'animepahe':
      return `https://vidnest.fun/animepahe/${anilistId}/${episodeNumber}/${audioLanguage}`;
    default:
      return `https://vidnest.fun/anime/${anilistId}/${episodeNumber}/${audioLanguage}?startAt=${startAtSeconds}`;
  }
}
