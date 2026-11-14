import React, { createContext, useCallback, useContext, useEffect, useRef, useState } from 'react';
import { User, signInWithPopup, signOut, onAuthStateChanged } from 'firebase/auth';
import { auth, googleProvider } from '../lib/firebase';
import { reconcileWatchHistoryOnSignIn, handleWatchHistorySignOut } from '../utils/preferences';
import { syncNicheSelectionsWithAccount } from '../services/nichePreferenceService';
import { getAvatarSrc, getRandomAvatarId, isValidAvatarId } from '../config/profileAvatars';
import {
  getCachedUserAvatarId,
  getOrCreateGuestAvatarId,
  persistUserAvatarId,
  saveGuestAvatarId,
  syncUserAvatarWithAccount,
} from '../services/profileAvatarService';

const GUEST_MODE_STORAGE_KEY = 'miyoro_guest_mode';

function readInitialGuestMode(): boolean {
  if (typeof window === 'undefined' || !window.localStorage) return false;
  try {
    return window.localStorage.getItem(GUEST_MODE_STORAGE_KEY) === 'true';
  } catch {
    return false;
  }
}

function writeGuestMode(enabled: boolean): void {
  if (typeof window === 'undefined' || !window.localStorage) return;
  try {
    if (enabled) {
      window.localStorage.setItem(GUEST_MODE_STORAGE_KEY, 'true');
    } else {
      window.localStorage.removeItem(GUEST_MODE_STORAGE_KEY);
    }
  } catch {
    // ignore storage errors
  }
}

interface AuthContextType {
  currentUser: User | null;
  signedInUser: User | null;
  isGuestMode: boolean;
  loading: boolean;
  guestAvatarId: string;
  guestAvatarSrc: string;
  userAvatarId: string | null;
  accountAvatarSrc: string;
  activeAvatarId: string | null;
  activeAvatarSrc: string;
  savingAvatar: boolean;
  signInWithGoogle: () => Promise<void>;
  logout: () => Promise<void>;
  enterGuestMode: () => void;
  enterAccountMode: () => void;
  selectProfileAvatar: (avatarId: string | null) => Promise<void>;
  randomizeGuestAvatar: () => string;
}

const AuthContext = createContext<AuthContextType | null>(null);

export function useAuth() {
  const context = useContext(AuthContext);
  if (!context) throw new Error("useAuth must be used within AuthProvider");
  return context;
}

export function AuthProvider({ children }: { children: React.ReactNode }) {
  const [firebaseUser, setFirebaseUser] = useState<User | null>(null);
  const [isGuestMode, setIsGuestMode] = useState<boolean>(() => readInitialGuestMode());
  const isGuestModeRef = useRef<boolean>(isGuestMode);
  const [loading, setLoading] = useState(true);
  const [guestAvatarId, setGuestAvatarId] = useState<string>(() => getOrCreateGuestAvatarId());
  const [userAvatarId, setUserAvatarId] = useState<string | null>(null);
  const [savingAvatar, setSavingAvatar] = useState(false);

  const activateAccountSync = useCallback((user: User) => {
    const cached = getCachedUserAvatarId(user.uid);
    setUserAvatarId(cached);
    reconcileWatchHistoryOnSignIn(user.uid).catch(() => {});
    syncNicheSelectionsWithAccount(user.uid).catch(() => {});
    syncUserAvatarWithAccount(user.uid)
      .then((cloudAvatar) => {
        setUserAvatarId(cloudAvatar);
      })
      .catch(() => {});
  }, []);

  useEffect(() => {
    const unsubscribe = onAuthStateChanged(auth, (user) => {
      setFirebaseUser(user);
      setLoading(false);
      if (user?.uid) {
        const cached = getCachedUserAvatarId(user.uid);
        setUserAvatarId(cached);
        if (isGuestModeRef.current) {
          // Only refresh account avatar for Landing tile; keep active session in Guest mode
          syncUserAvatarWithAccount(user.uid)
            .then((cloudAvatar) => {
              setUserAvatarId(cloudAvatar);
            })
            .catch(() => {});
        } else {
          activateAccountSync(user);
        }
      } else {
        setUserAvatarId(null);
      }
    });
    return unsubscribe;
  }, [activateAccountSync]);

  const enterGuestMode = useCallback(() => {
    isGuestModeRef.current = true;
    setIsGuestMode(true);
    writeGuestMode(true);
    handleWatchHistorySignOut();
  }, []);

  const enterAccountMode = useCallback(() => {
    isGuestModeRef.current = false;
    setIsGuestMode(false);
    writeGuestMode(false);
    if (firebaseUser?.uid) {
      activateAccountSync(firebaseUser);
    }
  }, [firebaseUser, activateAccountSync]);

  const signInWithGoogle = async () => {
    try {
      const cred = await signInWithPopup(auth, googleProvider);
      isGuestModeRef.current = false;
      setIsGuestMode(false);
      writeGuestMode(false);
      if (cred?.user) {
        setFirebaseUser(cred.user);
        activateAccountSync(cred.user);
      }
    } catch (error: any) {
      console.error("Firebase Auth Error:", error);
      throw error;
    }
  };

  const logout = async () => {
    try {
      isGuestModeRef.current = false;
      setIsGuestMode(false);
      writeGuestMode(false);
      handleWatchHistorySignOut();
      setUserAvatarId(null);
      await signOut(auth);
    } catch (error) {
      console.error("Logout Error:", error);
    }
  };

  const currentUser = isGuestMode ? null : firebaseUser;

  const selectProfileAvatar = useCallback(
    async (avatarId: string | null) => {
      if (currentUser?.uid) {
        const nextId = avatarId && isValidAvatarId(avatarId) ? avatarId : null;
        setUserAvatarId(nextId);
        setSavingAvatar(true);
        try {
          await persistUserAvatarId(currentUser.uid, nextId);
        } finally {
          setSavingAvatar(false);
        }
      } else if (avatarId && isValidAvatarId(avatarId)) {
        const saved = saveGuestAvatarId(avatarId);
        setGuestAvatarId(saved);
      }
    },
    [currentUser?.uid]
  );

  const randomizeGuestAvatar = useCallback(() => {
    const nextId = getRandomAvatarId(guestAvatarId);
    const saved = saveGuestAvatarId(nextId);
    setGuestAvatarId(saved);
    return saved;
  }, [guestAvatarId]);

  const guestAvatarSrc = getAvatarSrc(guestAvatarId);
  const accountAvatarSrc = firebaseUser
    ? userAvatarId
      ? getAvatarSrc(userAvatarId)
      : firebaseUser.photoURL || getAvatarSrc('miyoro')
    : getAvatarSrc('miyoro');
  const activeAvatarId = currentUser ? userAvatarId : guestAvatarId;
  const activeAvatarSrc = currentUser ? accountAvatarSrc : guestAvatarSrc;

  const value: AuthContextType = {
    currentUser,
    signedInUser: firebaseUser,
    isGuestMode,
    loading,
    guestAvatarId,
    guestAvatarSrc,
    userAvatarId,
    accountAvatarSrc,
    activeAvatarId,
    activeAvatarSrc,
    savingAvatar,
    signInWithGoogle,
    logout,
    enterGuestMode,
    enterAccountMode,
    selectProfileAvatar,
    randomizeGuestAvatar,
  };

  return (
    <AuthContext.Provider value={value}>
      {!loading && children}
    </AuthContext.Provider>
  );
}
