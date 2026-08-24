export type MovieProvider = 'vidnest' | 'cinesrc' | 'vidfast' | 'movies111';
export type SeriesProvider = 'vidnest' | 'cinesrc' | 'vidfast' | 'movies111';
export type AnimeProvider = 'vidnest' | 'origami' | 'animepahe';

export function getMovieProviderUrl(tmdbId: string | number, provider: MovieProvider = 'vidnest') {
  switch (provider) {
    case 'cinesrc':
      return `https://cinesrc.st/embed/movie/${tmdbId}?color=%23ffffff&autoplay=true&autonext=true&autoskip=true`;
    case 'vidfast':
      return `https://vidfast.pro/movie/${tmdbId}?autoPlay=true&theme=FFFFFF`;
    case 'movies111':
      return `https://111movies.net/movie/${tmdbId}`;
    case 'vidnest':
    default:
      return `https://vidnest.fun/movie/${tmdbId}`;
  }
}

export function getSeriesProviderUrl(tmdbId: string | number, season: number, episode: number, provider: SeriesProvider = 'vidnest') {
  switch (provider) {
    case 'cinesrc':
      return `https://cinesrc.st/embed/tv/${tmdbId}?s=${season}&e=${episode}&color=%23ffffff&autoplay=true&autonext=true&autoskip=true`;
    case 'vidfast':
      return `https://vidfast.pro/tv/${tmdbId}/${season}/${episode}?autoPlay=true&theme=FFFFFF&nextButton=true&autoNext=true`;
    case 'movies111':
      return `https://111movies.net/tv/${tmdbId}/${season}/${episode}`;
    case 'vidnest':
    default:
      return `https://vidnest.fun/tv/${tmdbId}/${season}/${episode}`;
  }
}

export function getAnimeProviderUrl(anilistId: string | number, episode: number, provider: AnimeProvider = 'vidnest', audioLanguage: string = 'sub', malId?: string | number) {
  switch (provider) {
    case 'origami':
      // Requires MAL ID ideally, fallback to anilistId if not provided (though prompt says MAL id)
      return `https://megaplay.buzz/stream/mal/${malId || anilistId}/${episode}/${audioLanguage}`;
    case 'animepahe':
      return `https://vidnest.fun/animepahe/${anilistId}/${episode}/${audioLanguage}`;
    case 'vidnest':
    default:
      return `https://vidnest.fun/anime/${anilistId}/${episode}/${audioLanguage}?startAt=0`;
  }
}
