export type Provider = 'vidnest' | 'cinesrc' | 'vidfast' | 'movies111' | 'origami' | 'animepahe';

export function buildMovieProviderUrl(provider: Provider, tmdbId: string | number): string {
  switch (provider) {
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

export function buildSeriesProviderUrl(provider: Provider, tmdbId: string | number, season: string | number, episode: string | number): string {
  switch (provider) {
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

export function buildAnimeProviderUrl(provider: Provider, anilistId: string | number, malId: string | number | undefined, episodeNumber: string | number, audioLanguage: 'sub' | 'dub' = 'sub', startAtSeconds: number = 0): string {
  switch (provider) {
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
