import { doc, getDoc, setDoc } from 'firebase/firestore';
import { db } from '../lib/firebase';

const VIDEO_MUTED_KEY = 'videoMuted';
const WATCH_PROGRESS_PREFIX = 'miyoro_watch_progress_';
const USER_WATCH_CACHE_PREFIX = 'miyoro_user_watch_cache_';
const LIBRARY_KEY = 'miyoro_library_items';
const RATING_PREFIX = 'miyoro_rating_';

export interface EpisodeProgressData {
  season?: number;
  episode: number;
  progress: number;
  currentTime?: number;
  duration?: number;
  completed?: boolean;
  updatedAt: number;
}

export interface WatchProgressData {
  contentId?: string;
  mediaType?: 'movie' | 'tv' | 'anime';
  season?: number;
  episode?: number;
  progress: number; // 0 to 1
  currentTime?: number;
  duration?: number;
  completed?: boolean;
  updatedAt: number;
  episodes?: Record<string, EpisodeProgressData>;
}

export interface SaveWatchProgressOptions {
  immediate?: boolean;
}

// In-memory mirror & throttling state
let activeUserId: string | null = null;
const memoryProgress = new Map<string, WatchProgressData>();
const dirtyKeysForStorage = new Set<string>();
const dirtyKeysForCloud = new Set<string>();
const lastLocalWriteTime = new Map<string, number>();

let cloudSyncTimer: ReturnType<typeof setTimeout> | null = null;
let localFlushTimer: ReturnType<typeof setTimeout> | null = null;

const LOCAL_THROTTLE_MS = 2000;
const CLOUD_THROTTLE_MS = 12000;

function makeItemKey(type: string, id: string | number): string {
  return `${type}_${id}`;
}

function makeEpisodeKey(type: string, season?: number, episode?: number): string | null {
  if (type === 'movie' || !episode) return null;
  if (type === 'tv') {
    return `S${season || 1}E${episode}`;
  }
  return `E${episode}`;
}

function dispatchWatchHistoryUpdated() {
  if (typeof window !== 'undefined') {
    window.dispatchEvent(new CustomEvent('miyoro-watch-history-updated'));
  }
}

function readAllLocalWatchProgress(): Record<string, WatchProgressData> {
  const result: Record<string, WatchProgressData> = {};
  if (typeof window === 'undefined' || !window.localStorage) return result;
  try {
    for (let i = 0; i < localStorage.length; i++) {
      const fullKey = localStorage.key(i);
      if (fullKey && fullKey.startsWith(WATCH_PROGRESS_PREFIX)) {
        const raw = localStorage.getItem(fullKey);
        if (!raw) continue;
        const itemKey = fullKey.slice(WATCH_PROGRESS_PREFIX.length);
        const parsed = JSON.parse(raw) as WatchProgressData;
        if (parsed && typeof parsed === 'object') {
          result[itemKey] = parsed;
        }
      }
    }
  } catch (e) {
    console.warn('Failed reading local watch progress map', e);
  }
  return result;
}

function writeLocalWatchProgressItem(itemKey: string, record: WatchProgressData) {
  if (typeof window === 'undefined' || !window.localStorage) return;
  try {
    localStorage.setItem(`${WATCH_PROGRESS_PREFIX}${itemKey}`, JSON.stringify(record));
    lastLocalWriteTime.set(itemKey, Date.now());
    dirtyKeysForStorage.delete(itemKey);
  } catch (e) {
    console.warn('Failed to write watch progress to localStorage', e);
  }
}

function persistUserCacheSnapshot(uid: string) {
  if (typeof window === 'undefined' || !window.localStorage) return;
  try {
    const snapshot: Record<string, WatchProgressData> = {};
    memoryProgress.forEach((val, key) => {
      snapshot[key] = val;
    });
    localStorage.setItem(`${USER_WATCH_CACHE_PREFIX}${uid}`, JSON.stringify(snapshot));
  } catch (e) {
    // ignore storage quota errors
  }
}

function readUserCacheSnapshot(uid: string): Record<string, WatchProgressData> {
  if (typeof window === 'undefined' || !window.localStorage) return {};
  try {
    const raw = localStorage.getItem(`${USER_WATCH_CACHE_PREFIX}${uid}`);
    if (raw) {
      const parsed = JSON.parse(raw);
      if (parsed && typeof parsed === 'object') return parsed;
    }
  } catch (e) {
    // ignore
  }
  return {};
}

async function flushCloudWatchProgress(targetUid?: string | null): Promise<void> {
  const uid = targetUid || activeUserId;
  if (!uid || dirtyKeysForCloud.size === 0) return;

  const keysToSync = Array.from(dirtyKeysForCloud);
  dirtyKeysForCloud.clear();

  const watchHistoryPatch: Record<string, WatchProgressData> = {};
  for (const key of keysToSync) {
    const record = memoryProgress.get(key);
    if (record) {
      watchHistoryPatch[key] = record;
    }
  }

  if (Object.keys(watchHistoryPatch).length === 0) return;

  try {
    persistUserCacheSnapshot(uid);
    const userDocRef = doc(db, 'users', uid);
    await setDoc(
      userDocRef,
      {
        watchHistory: watchHistoryPatch,
        watchHistoryUpdatedAt: Date.now(),
      },
      { merge: true }
    );
  } catch (e) {
    // Re-queue keys if network/Firestore temporarily failed
    keysToSync.forEach((k) => dirtyKeysForCloud.add(k));
  }
}

function scheduleCloudWatchSync(immediate = false) {
  if (!activeUserId) return;

  if (immediate) {
    if (cloudSyncTimer) {
      clearTimeout(cloudSyncTimer);
      cloudSyncTimer = null;
    }
    flushCloudWatchProgress(activeUserId).catch(() => {});
    return;
  }

  if (cloudSyncTimer) return;
  cloudSyncTimer = setTimeout(() => {
    cloudSyncTimer = null;
    flushCloudWatchProgress(activeUserId).catch(() => {});
  }, CLOUD_THROTTLE_MS);
}

export function flushWatchProgress(): void {
  if (localFlushTimer) {
    clearTimeout(localFlushTimer);
    localFlushTimer = null;
  }
  if (dirtyKeysForStorage.size > 0) {
    Array.from(dirtyKeysForStorage).forEach((itemKey) => {
      const rec = memoryProgress.get(itemKey);
      if (rec) {
        writeLocalWatchProgressItem(itemKey, rec);
      }
    });
  }
  if (activeUserId) {
    persistUserCacheSnapshot(activeUserId);
    scheduleCloudWatchSync(true);
  }
}

// Register lifecycle listeners once in browser to flush pending progress on tab hide / unload
if (typeof window !== 'undefined') {
  const initialLocal = readAllLocalWatchProgress();
  Object.entries(initialLocal).forEach(([k, v]) => {
    memoryProgress.set(k, v);
  });

  window.addEventListener('pagehide', () => {
    flushWatchProgress();
  });
  window.addEventListener('beforeunload', () => {
    flushWatchProgress();
  });
  document.addEventListener('visibilitychange', () => {
    if (document.visibilityState === 'hidden') {
      flushWatchProgress();
    }
  });
}

function mergeTwoWatchRecords(
  a: WatchProgressData | undefined,
  b: WatchProgressData | undefined
): WatchProgressData | null {
  if (!a && !b) return null;
  if (!a) return b!;
  if (!b) return a;

  const primary = (b.updatedAt || 0) >= (a.updatedAt || 0) ? b : a;
  const secondary = primary === b ? a : b;

  // Merge episode-level progress dictionaries preserving newer episode records
  const mergedEpisodes: Record<string, EpisodeProgressData> = {};
  if (secondary.episodes) {
    Object.entries(secondary.episodes).forEach(([epKey, epVal]) => {
      if (epVal) mergedEpisodes[epKey] = epVal;
    });
  }
  if (primary.episodes) {
    Object.entries(primary.episodes).forEach(([epKey, epVal]) => {
      if (!epVal) return;
      const existingEp = mergedEpisodes[epKey];
      if (!existingEp || (epVal.updatedAt || 0) >= (existingEp.updatedAt || 0)) {
        mergedEpisodes[epKey] = epVal;
      }
    });
  }

  return {
    ...secondary,
    ...primary,
    completed: Boolean(primary.completed || secondary.completed || primary.progress >= 0.92),
    episodes: Object.keys(mergedEpisodes).length > 0 ? mergedEpisodes : undefined,
  };
}

/**
 * Reconciles guest localStorage watch history with the signed-in user's Firestore account
 * without overwriting newer Firestore records with older local records.
 */
export async function reconcileWatchHistoryOnSignIn(uid: string): Promise<void> {
  if (!uid) return;
  flushWatchProgress();
  activeUserId = uid;

  const guestLocalMap = readAllLocalWatchProgress();
  const cachedUserMap = readUserCacheSnapshot(uid);

  let cloudMap: Record<string, WatchProgressData> = {};
  try {
    const userDocRef = doc(db, 'users', uid);
    const snap = await getDoc(userDocRef);
    if (snap.exists()) {
      const data = snap.data();
      if (data?.watchHistory && typeof data.watchHistory === 'object') {
        cloudMap = data.watchHistory as Record<string, WatchProgressData>;
      }
    }
  } catch (e) {
    // Offline or Firestore rule fallback: rely on cachedUserMap + guestLocalMap
  }

  const allKeys = new Set<string>([
    ...Object.keys(guestLocalMap),
    ...Object.keys(cachedUserMap),
    ...Object.keys(cloudMap),
  ]);

  const mergedAll: Record<string, WatchProgressData> = {};
  const keysNeedingCloudUpdate: Record<string, WatchProgressData> = {};

  allKeys.forEach((itemKey) => {
    const localCandidate = mergeTwoWatchRecords(cachedUserMap[itemKey], guestLocalMap[itemKey]) || undefined;
    const cloudCandidate = cloudMap[itemKey];
    const finalRecord = mergeTwoWatchRecords(cloudCandidate, localCandidate);

    if (finalRecord) {
      mergedAll[itemKey] = finalRecord;
      memoryProgress.set(itemKey, finalRecord);
      writeLocalWatchProgressItem(itemKey, finalRecord);

      if (!cloudCandidate || (finalRecord.updatedAt || 0) > (cloudCandidate.updatedAt || 0)) {
        keysNeedingCloudUpdate[itemKey] = finalRecord;
      }
    }
  });

  persistUserCacheSnapshot(uid);
  dispatchWatchHistoryUpdated();

  if (Object.keys(keysNeedingCloudUpdate).length > 0) {
    try {
      const userDocRef = doc(db, 'users', uid);
      await setDoc(
        userDocRef,
        {
          watchHistory: keysNeedingCloudUpdate,
          watchHistoryUpdatedAt: Date.now(),
        },
        { merge: true }
      );
    } catch (e) {
      // Ignore remote sync error gracefully
    }
  }
}

/**
 * Isolates signed-in account watch history when signing out so subsequent guest sessions
 * start cleanly without overwriting or leaking the signed-in user's watch progress.
 */
export function handleWatchHistorySignOut(): void {
  if (!activeUserId) return;
  flushWatchProgress();
  const previousUid = activeUserId;
  persistUserCacheSnapshot(previousUid);
  activeUserId = null;

  if (typeof window !== 'undefined' && window.localStorage) {
    try {
      const keysToRemove: string[] = [];
      for (let i = 0; i < localStorage.length; i++) {
        const k = localStorage.key(i);
        if (k && k.startsWith(WATCH_PROGRESS_PREFIX)) {
          keysToRemove.push(k);
        }
      }
      keysToRemove.forEach((k) => localStorage.removeItem(k));
    } catch (e) {
      // ignore
    }
  }

  memoryProgress.clear();
  dirtyKeysForStorage.clear();
  dirtyKeysForCloud.clear();
  dispatchWatchHistoryUpdated();
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
  const itemKey = makeItemKey(type, id);
  const inMem = memoryProgress.get(itemKey);
  if (inMem) return inMem;

  try {
    const raw = localStorage.getItem(`${WATCH_PROGRESS_PREFIX}${itemKey}`);
    if (raw) {
      const parsed = JSON.parse(raw) as WatchProgressData;
      memoryProgress.set(itemKey, parsed);
      return parsed;
    }
  } catch (e) {
    console.warn('Failed to read watch progress', e);
  }
  return null;
}

export function saveWatchProgress(
  type: string,
  id: string | number,
  data: {
    season?: number;
    episode?: number;
    progress?: number;
    currentTime?: number;
    duration?: number;
    completed?: boolean;
  },
  options?: SaveWatchProgressOptions
) {
  try {
    const itemKey = makeItemKey(type, id);
    const existing = getWatchProgress(type, id);
    const now = Date.now();

    const targetSeason = data.season ?? existing?.season;
    const targetEpisode = data.episode ?? existing?.episode;
    const isSameEpisode =
      type === 'movie' ||
      (existing?.season === targetSeason && existing?.episode === targetEpisode);

    // Do not overwrite existing progress with zero during initial player load of the same episode
    let newProgress = data.progress;
    if (newProgress === undefined) {
      newProgress = isSameEpisode && existing?.progress ? existing.progress : 0.35;
    } else if (newProgress === 0 && isSameEpisode && existing?.progress && existing.progress > 0) {
      newProgress = existing.progress;
    } else if (
      newProgress === 0.35 &&
      isSameEpisode &&
      existing?.progress &&
      existing.progress > 0.05 &&
      data.currentTime === undefined
    ) {
      // Preserve real playback progress when PlayerPage mounts and records initial visit
      newProgress = existing.progress;
    }

    const clampedProgress = Math.min(1, Math.max(0, newProgress));
    const isCompleted = Boolean(data.completed || clampedProgress >= 0.92);

    const existingEpisodes = existing?.episodes ? { ...existing.episodes } : {};
    const epKey = makeEpisodeKey(type, targetSeason, targetEpisode);
    if (epKey && targetEpisode) {
      const prevEp = existingEpisodes[epKey];
      const epCurrentTime = data.currentTime ?? (isSameEpisode ? existing?.currentTime : prevEp?.currentTime);
      const epDuration = data.duration ?? (isSameEpisode ? existing?.duration : prevEp?.duration);
      existingEpisodes[epKey] = {
        season: targetSeason,
        episode: targetEpisode,
        progress: clampedProgress,
        currentTime: epCurrentTime,
        duration: epDuration,
        completed: Boolean(isCompleted || prevEp?.completed),
        updatedAt: now,
      };
    }

    const record: WatchProgressData = {
      contentId: String(id),
      mediaType: (type === 'anime' || type === 'tv' || type === 'movie' ? type : 'movie') as
        | 'movie'
        | 'tv'
        | 'anime',
      season: targetSeason,
      episode: targetEpisode,
      progress: clampedProgress,
      currentTime: data.currentTime ?? (isSameEpisode ? existing?.currentTime : undefined),
      duration: data.duration ?? (isSameEpisode ? existing?.duration : undefined),
      completed: isCompleted,
      updatedAt: now,
      episodes: Object.keys(existingEpisodes).length > 0 ? existingEpisodes : undefined,
    };

    memoryProgress.set(itemKey, record);
    dirtyKeysForStorage.add(itemKey);
    dirtyKeysForCloud.add(itemKey);

    const forceImmediate = Boolean(options?.immediate || isCompleted || !existing);
    const lastWrite = lastLocalWriteTime.get(itemKey) || 0;

    if (forceImmediate || now - lastWrite >= LOCAL_THROTTLE_MS) {
      writeLocalWatchProgressItem(itemKey, record);
      dispatchWatchHistoryUpdated();
    } else if (!localFlushTimer) {
      localFlushTimer = setTimeout(() => {
        localFlushTimer = null;
        Array.from(dirtyKeysForStorage).forEach((k) => {
          const rec = memoryProgress.get(k);
          if (rec) writeLocalWatchProgressItem(k, rec);
        });
        dispatchWatchHistoryUpdated();
      }, LOCAL_THROTTLE_MS);
    }

    if (activeUserId) {
      scheduleCloudWatchSync(forceImmediate);
    }
  } catch (e) {
    console.warn('Failed to save watch progress', e);
  }
}

export function getAllWatchProgressItems(): Array<
  WatchProgressData & { key: string; type: 'movie' | 'tv' | 'anime'; id: string }
> {
  const localMap = readAllLocalWatchProgress();
  Object.entries(localMap).forEach(([k, v]) => {
    const existing = memoryProgress.get(k);
    if (!existing || (v.updatedAt || 0) > (existing.updatedAt || 0)) {
      memoryProgress.set(k, v);
    }
  });

  const list: Array<WatchProgressData & { key: string; type: 'movie' | 'tv' | 'anime'; id: string }> = [];
  memoryProgress.forEach((record, itemKey) => {
    const parts = itemKey.split('_');
    const itemType = parts[0] as 'movie' | 'tv' | 'anime';
    const itemId = parts.slice(1).join('_');
    if (itemType && itemId) {
      list.push({
        ...record,
        key: `${WATCH_PROGRESS_PREFIX}${itemKey}`,
        type: itemType,
        id: itemId,
      });
    }
  });

  list.sort((a, b) => (b.updatedAt || 0) - (a.updatedAt || 0));
  return list;
}

export function getCompletedContentKeys(): Set<string> {
  const completed = new Set<string>();
  const items = getAllWatchProgressItems();
  for (const item of items) {
    if (item.completed || item.progress >= 0.92) {
      completed.add(`${item.type}_${item.id}`);
    }
  }
  return completed;
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
