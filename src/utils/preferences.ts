const VIDEO_MUTED_KEY = 'videoMuted';
const WATCH_PROGRESS_PREFIX = 'miyoro_watch_progress_';
const LIBRARY_KEY = 'miyoro_library_items';
const RATING_PREFIX = 'miyoro_rating_';

export interface WatchProgressData {
  season?: number;
  episode?: number;
  progress: number; // 0 to 1
  currentTime?: number;
  duration?: number;
  updatedAt: number;
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

export function getWatchProgress(type: string, id: string | number): WatchProgressData | null {
  try {
    const raw = localStorage.getItem(`${WATCH_PROGRESS_PREFIX}${type}_${id}`);
    if (raw) {
      return JSON.parse(raw);
    }
  } catch (e) {
    console.warn('Failed to read watch progress', e);
  }
  return null;
}

export function saveWatchProgress(
  type: string,
  id: string | number,
  data: { season?: number; episode?: number; progress?: number; currentTime?: number; duration?: number }
) {
  try {
    const existing = getWatchProgress(type, id);
    
    // Do not overwrite existing progress with zero during initial player load
    let newProgress = data.progress;
    if (newProgress === undefined) {
      newProgress = existing?.progress ?? 0.35;
    } else if (newProgress === 0 && existing?.progress && existing.progress > 0) {
      newProgress = existing.progress;
    }

    const record: WatchProgressData = {
      season: data.season ?? existing?.season,
      episode: data.episode ?? existing?.episode,
      progress: newProgress,
      currentTime: data.currentTime ?? existing?.currentTime,
      duration: data.duration ?? existing?.duration,
      updatedAt: Date.now(),
    };
    localStorage.setItem(`${WATCH_PROGRESS_PREFIX}${type}_${id}`, JSON.stringify(record));
  } catch (e) {
    console.warn('Failed to save watch progress', e);
  }
}

export function isInLibrary(type: string, id: string | number): boolean {
  try {
    const raw = localStorage.getItem(LIBRARY_KEY);
    if (!raw) return false;
    const list: string[] = JSON.parse(raw);
    return list.includes(`${type}_${id}`);
  } catch (e) {
    return false;
  }
}

export function toggleLibraryItem(type: string, id: string | number): boolean {
  try {
    const raw = localStorage.getItem(LIBRARY_KEY);
    const list: string[] = raw ? JSON.parse(raw) : [];
    const key = `${type}_${id}`;
    const idx = list.indexOf(key);
    let added = false;
    if (idx >= 0) {
      list.splice(idx, 1);
      added = false;
    } else {
      list.push(key);
      added = true;
    }
    localStorage.setItem(LIBRARY_KEY, JSON.stringify(list));
    return added;
  } catch (e) {
    return false;
  }
}

export function getItemRating(type: string, id: string | number): 'like' | 'dislike' | null {
  try {
    const val = localStorage.getItem(`${RATING_PREFIX}${type}_${id}`);
    if (val === 'like' || val === 'dislike') return val;
  } catch (e) {
    // ignore
  }
  return null;
}

export function setItemRating(type: string, id: string | number, rating: 'like' | 'dislike' | null) {
  try {
    const key = `${RATING_PREFIX}${type}_${id}`;
    if (rating === null) {
      localStorage.removeItem(key);
    } else {
      localStorage.setItem(key, rating);
    }
  } catch (e) {
    // ignore
  }
}

