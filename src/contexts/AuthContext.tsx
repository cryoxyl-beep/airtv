import React, { createContext, useContext, useEffect, useState } from 'react';
import { User, signInWithPopup, signOut, onAuthStateChanged } from 'firebase/auth';
import { auth, googleProvider } from '../lib/firebase';
import { reconcileWatchHistoryOnSignIn, handleWatchHistorySignOut } from '../utils/preferences';
import { syncNicheSelectionsWithAccount } from '../services/nichePreferenceService';

interface AuthContextType {
  currentUser: User | null;
  loading: boolean;
  signInWithGoogle: () => Promise<void>;
  logout: () => Promise<void>;
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

  useEffect(() => {
    const unsubscribe = onAuthStateChanged(auth, (user) => {
      setCurrentUser(user);
      setLoading(false);
      if (user?.uid) {
        reconcileWatchHistoryOnSignIn(user.uid).catch(() => {});
        syncNicheSelectionsWithAccount(user.uid).catch(() => {});
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
      await signOut(auth);
    } catch (error) {
      console.error("Logout Error:", error);
    }
  };

  const value = { currentUser, loading, signInWithGoogle, logout };

  return (
    <AuthContext.Provider value={value}>
      {!loading && children}
    </AuthContext.Provider>
  );
}
