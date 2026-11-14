import React, { createContext, useCallback, useContext, useEffect, useState } from 'react';
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

interface AuthContextType {
  currentUser: User | null;
  loading: boolean;
  guestAvatarId: string;
  guestAvatarSrc: string;
  userAvatarId: string | null;
  activeAvatarId: string | null;
  activeAvatarSrc: string;
  savingAvatar: boolean;
  signInWithGoogle: () => Promise<void>;
  logout: () => Promise<void>;
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
  const [currentUser, setCurrentUser] = useState<User | null>(null);
  const [loading, setLoading] = useState(true);
  const [guestAvatarId, setGuestAvatarId] = useState<string>(() => getOrCreateGuestAvatarId());
  const [userAvatarId, setUserAvatarId] = useState<string | null>(null);
  const [savingAvatar, setSavingAvatar] = useState(false);

  useEffect(() => {
    const unsubscribe = onAuthStateChanged(auth, (user) => {
      setCurrentUser(user);
      setLoading(false);
      if (user?.uid) {
        const cached = getCachedUserAvatarId(user.uid);
        setUserAvatarId(cached);
        reconcileWatchHistoryOnSignIn(user.uid).catch(() => {});
        syncNicheSelectionsWithAccount(user.uid).catch(() => {});
        syncUserAvatarWithAccount(user.uid)
          .then((cloudAvatar) => {
            setUserAvatarId(cloudAvatar);
          })
          .catch(() => {});
      } else {
        setUserAvatarId(null);
      }
    });
    return unsubscribe;
  }, []);

  const signInWithGoogle = async () => {
    try {
      await signInWithPopup(auth, googleProvider);
    } catch (error: any) {
      console.error("Firebase Auth Error:", error);
      throw error;
    }
  };

  const logout = async () => {
    try {
      handleWatchHistorySignOut();
      setUserAvatarId(null);
      await signOut(auth);
    } catch (error) {
      console.error("Logout Error:", error);
    }
  };

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
  const activeAvatarId = currentUser ? userAvatarId : guestAvatarId;
  const activeAvatarSrc = currentUser
    ? userAvatarId
      ? getAvatarSrc(userAvatarId)
      : currentUser.photoURL || getAvatarSrc('miyoro')
    : guestAvatarSrc;

  const value: AuthContextType = {
    currentUser,
    loading,
    guestAvatarId,
    guestAvatarSrc,
    userAvatarId,
    activeAvatarId,
    activeAvatarSrc,
    savingAvatar,
    signInWithGoogle,
    logout,
    selectProfileAvatar,
    randomizeGuestAvatar,
  };

  return (
    <AuthContext.Provider value={value}>
      {!loading && children}
    </AuthContext.Provider>
  );
}
