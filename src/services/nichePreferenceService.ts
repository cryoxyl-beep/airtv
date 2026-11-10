import { doc, getDoc, setDoc } from 'firebase/firestore';
import { db } from '../lib/firebase';
import { VALID_NICHE_IDS } from '../config/nicheConfig';

const LOCAL_NICHES_KEY = 'miyoro_selected_niches';
const USER_NICHES_PREFIX = 'miyoro_selected_niches_user_';

export function sanitizeNicheIds(ids: unknown): string[] {
  if (!Array.isArray(ids)) return [];
  const unique: string[] = [];
  for (const raw of ids) {
    if (typeof raw === 'string' && VALID_NICHE_IDS.has(raw) && !unique.includes(raw)) {
      unique.push(raw);
    }
  }
  return unique;
}

function USER_NICHES_KEY(uid: string): string {
  return `${USER_NICHES_PREFIX}${uid}`;
}

export function getLocalNicheSelections(uid?: string | null): string[] {
  if (typeof window === 'undefined' || !window.localStorage) return [];
  try {
    if (uid) {
      const userRaw = localStorage.getItem(USER_NICHES_KEY(uid));
      if (userRaw) {
        const parsed = sanitizeNicheIds(JSON.parse(userRaw));
        if (parsed.length > 0) return parsed;
      }
    }
    const guestRaw = localStorage.getItem(LOCAL_NICHES_KEY);
    if (guestRaw) {
      return sanitizeNicheIds(JSON.parse(guestRaw));
    }
  } catch (e) {
    console.warn('Failed to read niche selections from localStorage:', e);
  }
  return [];
}

export function saveLocalNicheSelections(nicheIds: string[], uid?: string | null): string[] {
  const sanitized = sanitizeNicheIds(nicheIds);
  if (typeof window === 'undefined' || !window.localStorage) return sanitized;
  try {
    const serialized = JSON.stringify(sanitized);
    localStorage.setItem(LOCAL_NICHES_KEY, serialized);
    if (uid) {
      localStorage.setItem(USER_NICHES_KEY(uid), serialized);
    }
    window.dispatchEvent(
      new CustomEvent('miyoro-niches-updated', { detail: { selectedNiches: sanitized, uid: uid || null } })
    );
  } catch (e) {
    console.warn('Failed to write niche selections to localStorage:', e);
  }
  return sanitized;
}

export async function syncNicheSelectionsWithAccount(uid: string): Promise<string[]> {
  const localGuest = getLocalNicheSelections(null);
  const localUser = getLocalNicheSelections(uid);
  const fallbackLocal = localUser.length > 0 ? localUser : localGuest;

  try {
    const userDocRef = doc(db, 'users', uid);
    const snap = await getDoc(userDocRef);

    if (snap.exists()) {
      const data = snap.data();
      if (Array.isArray(data?.selectedNiches)) {
        const cloudNiches = sanitizeNicheIds(data.selectedNiches);
        // Restore account selections if present, or if no guest selections need reconciling
        if (cloudNiches.length > 0 || fallbackLocal.length === 0) {
          saveLocalNicheSelections(cloudNiches, uid);
          return cloudNiches;
        }
      }
    }

    // Reconcile local guest choices into the user's Firestore account when no cloud preferences exist yet
    if (fallbackLocal.length > 0) {
      const reconciled = sanitizeNicheIds(fallbackLocal);
      saveLocalNicheSelections(reconciled, uid);
      await setDoc(
        userDocRef,
        {
          selectedNiches: reconciled,
          nichesUpdatedAt: Date.now(),
        },
        { merge: true }
      );
      return reconciled;
    }
  } catch (e) {
    // Graceful fallback to local storage if Firestore rules or offline mode block access
  }

  return fallbackLocal;
}

export async function persistNicheSelections(nicheIds: string[], uid?: string | null): Promise<string[]> {
  const sanitized = saveLocalNicheSelections(nicheIds, uid);

  if (uid) {
    try {
      const userDocRef = doc(db, 'users', uid);
      await setDoc(
        userDocRef,
        {
          selectedNiches: sanitized,
          nichesUpdatedAt: Date.now(),
        },
        { merge: true }
      );
    } catch (e) {
      // Local persistence already succeeded; ignore remote error gracefully
    }
  }

  return sanitized;
}
