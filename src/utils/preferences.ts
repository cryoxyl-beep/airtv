const ANIME_SEASON_PREFS_KEY = 'animeSeasonPreferences';
const VIDEO_MUTED_KEY = 'videoMuted';

export function getAnimeSeasonPreference(groupId: number): number | null {
  try {
    const raw = localStorage.getItem(ANIME_SEASON_PREFS_KEY);
    if (raw) {
      const prefs = JSON.parse(raw);
      if (typeof prefs[groupId] === 'number') {
        return prefs[groupId];
      }
    }
  } catch (e) {
    console.warn('Failed to read anime season preferences', e);
  }
  return null;
}

export function setAnimeSeasonPreference(groupId: number, seasonId: number) {
  try {
    let prefs: Record<number, number> = {};
    const raw = localStorage.getItem(ANIME_SEASON_PREFS_KEY);
    if (raw) {
      prefs = JSON.parse(raw);
    }
    prefs[groupId] = seasonId;
    localStorage.setItem(ANIME_SEASON_PREFS_KEY, JSON.stringify(prefs));
  } catch (e) {
    console.warn('Failed to save anime season preference', e);
  }
}

export function getVideoMutedPreference(): boolean {
  try {
    const raw = localStorage.getItem(VIDEO_MUTED_KEY);
    if (raw !== null) {
      return raw === 'true';
    }
  } catch (e) {
    console.warn('Failed to read video muted preference', e);
  }
  return false;
}

export function setVideoMutedPreference(isMuted: boolean) {
  try {
    localStorage.setItem(VIDEO_MUTED_KEY, isMuted ? 'true' : 'false');
  } catch (e) {
    console.warn('Failed to save video muted preference', e);
  }
}
