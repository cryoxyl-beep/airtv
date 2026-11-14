import { doc, getDoc, setDoc } from 'firebase/firestore';
import { db } from '../lib/firebase';
import { getRandomAvatarId, isValidAvatarId } from '../config/profileAvatars';

const GUEST_AVATAR_KEY = 'miyoro_guest_avatar_id';
const USER_AVATAR_PREFIX = 'miyoro_user_avatar_';

function userAvatarCacheKey(uid: string): string {
  return `${USER_AVATAR_PREFIX}${uid}`;
}

export function getOrCreateGuestAvatarId(): string {
  if (typeof window === 'undefined' || !window.localStorage) {
    return getRandomAvatarId();
  }
  try {
    const saved = localStorage.getItem(GUEST_AVATAR_KEY);
    if (isValidAvatarId(saved)) {
      return saved;
    }
    const randomId = getRandomAvatarId();
    localStorage.setItem(GUEST_AVATAR_KEY, randomId);
    return randomId;
  } catch (e) {
    return getRandomAvatarId();
  }
}

export function saveGuestAvatarId(avatarId: string): string {
  if (!isValidAvatarId(avatarId)) {
    return getOrCreateGuestAvatarId();
  }
  if (typeof window !== 'undefined' && window.localStorage) {
    try {
      localStorage.setItem(GUEST_AVATAR_KEY, avatarId);
    } catch (e) {
      console.warn('Failed to save guest avatar to localStorage:', e);
    }
  }
  return avatarId;
}

export function getCachedUserAvatarId(uid: string): string | null {
  if (typeof window === 'undefined' || !window.localStorage) return null;
  try {
    const saved = localStorage.getItem(userAvatarCacheKey(uid));
    return isValidAvatarId(saved) ? saved : null;
  } catch {
    return null;
  }
}

function setCachedUserAvatarId(uid: string, avatarId: string | null) {
  if (typeof window === 'undefined' || !window.localStorage) return;
  try {
    if (avatarId && isValidAvatarId(avatarId)) {
      localStorage.setItem(userAvatarCacheKey(uid), avatarId);
    } else {
      localStorage.removeItem(userAvatarCacheKey(uid));
    }
  } catch {
    // ignore quota errors
  }
}

export async function syncUserAvatarWithAccount(uid: string): Promise<string | null> {
  const cached = getCachedUserAvatarId(uid);

  try {
    const userDocRef = doc(db, 'users', uid);
    const snap = await getDoc(userDocRef);

    if (snap.exists()) {
      const data = snap.data();
      if (isValidAvatarId(data?.profileAvatarId)) {
        setCachedUserAvatarId(uid, data.profileAvatarId);
        return data.profileAvatarId;
      }
      if (data && Object.prototype.hasOwnProperty.call(data, 'profileAvatarId') && data.profileAvatarId === null) {
        setCachedUserAvatarId(uid, null);
        return null;
      }
    }

    // If a cached local avatar exists for this account before cloud sync completed, push it up
    if (cached) {
      await setDoc(
        userDocRef,
        {
          profileAvatarId: cached,
          profileAvatarUpdatedAt: Date.now(),
        },
        { merge: true }
      );
      return cached;
    }
  } catch (e) {
    console.warn('Could not sync profile avatar from Firestore, using local cache:', e);
  }

  return cached;
}

export async function persistUserAvatarId(uid: string, avatarId: string | null): Promise<string | null> {
  const normalized = avatarId && isValidAvatarId(avatarId) ? avatarId : null;
  setCachedUserAvatarId(uid, normalized);

  try {
    const userDocRef = doc(db, 'users', uid);
    await setDoc(
      userDocRef,
      {
        profileAvatarId: normalized,
        profileAvatarUpdatedAt: Date.now(),
      },
      { merge: true }
    );
  } catch (e) {
    console.warn('Failed to persist profile avatar to Firestore:', e);
  }

  return normalized;
}
