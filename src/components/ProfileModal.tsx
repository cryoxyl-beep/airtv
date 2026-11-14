import React, { useEffect, useState } from 'react';
import { createPortal } from 'react-dom';
import { useNavigate } from 'react-router-dom';
import { X, Check, Shuffle, LogOut, Bookmark, RotateCcw } from 'lucide-react';
import { useAuth } from '../contexts/AuthContext';
import { PROFILE_AVATARS, getAvatarSrc } from '../config/profileAvatars';
import { LoadingButton } from './MiyoroSpinner';

interface ProfileModalProps {
  isOpen: boolean;
  onClose: () => void;
}

const GoogleIcon = ({ className }: { className?: string }) => (
  <svg className={className} viewBox="0 0 24 24" xmlns="http://www.w3.org/2000/svg" aria-hidden="true">
    <path fill="currentColor" d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z" />
    <path fill="currentColor" d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z" />
    <path fill="currentColor" d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22.81-.62z" />
    <path fill="currentColor" d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z" />
  </svg>
);

export default function ProfileModal({ isOpen, onClose }: ProfileModalProps) {
  const {
    currentUser,
    activeAvatarId,
    activeAvatarSrc,
    userAvatarId,
    selectProfileAvatar,
    randomizeGuestAvatar,
    signInWithGoogle,
    logout,
  } = useAuth();
  const navigate = useNavigate();
  const [isSigningIn, setIsSigningIn] = useState(false);
  const [authError, setAuthError] = useState('');
  const [previewFallback, setPreviewFallback] = useState(false);

  useEffect(() => {
    setPreviewFallback(false);
  }, [activeAvatarSrc]);

  useEffect(() => {
    if (!isOpen) return;
    const prevOverflow = document.body.style.overflow;
    document.body.style.overflow = 'hidden';

    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        onClose();
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => {
      document.body.style.overflow = prevOverflow;
      window.removeEventListener('keydown', handleKeyDown);
    };
  }, [isOpen, onClose]);

  if (!isOpen || typeof document === 'undefined') return null;

  const displaySrc = previewFallback ? getAvatarSrc('miyoro') : activeAvatarSrc;

  const handleGoogleSignIn = async () => {
    if (isSigningIn) return;
    setIsSigningIn(true);
    setAuthError('');
    try {
      await signInWithGoogle();
    } catch (err: any) {
      if (err?.code !== 'auth/popup-closed-by-user') {
        setAuthError('Sign in failed. Please try again.');
      }
    } finally {
      setIsSigningIn(false);
    }
  };

  const handleOpenMySpace = () => {
    onClose();
    navigate('/myspace');
  };

  const handleSignOut = async () => {
    await logout();
  };

  return createPortal(
    <div
      className="fixed inset-0 z-[250] bg-black/75 backdrop-blur-md flex items-center justify-center p-4 sm:p-6 animate-fade-in"
      onClick={onClose}
      role="dialog"
      aria-modal="true"
      aria-labelledby="profile-modal-title"
    >
      <div
        onClick={(e) => e.stopPropagation()}
        className="w-full max-w-2xl max-h-[88vh] flex flex-col rounded-2xl bg-[#0E0F14]/95 border border-white/12 shadow-[0_28px_90px_rgba(0,0,0,0.95)] text-white overflow-hidden select-none"
      >
        {/* Modal Header */}
        <div className="relative px-5 sm:px-7 pt-5 sm:pt-6 pb-5 border-b border-white/10 flex items-center justify-between gap-4 shrink-0 bg-gradient-to-b from-white/[0.04] to-transparent">
          <div className="flex items-center gap-4 min-w-0">
            <div className="w-14 h-14 sm:w-16 sm:h-16 rounded-xl overflow-hidden border-2 border-white/20 bg-[#181920] shadow-[0_8px_24px_rgba(0,0,0,0.75)] shrink-0">
              <img
                src={displaySrc}
                alt={currentUser?.displayName || 'Guest'}
                className="w-full h-full object-cover"
                onError={() => setPreviewFallback(true)}
              />
            </div>
            <div className="min-w-0">
              <h2
                id="profile-modal-title"
                className="text-lg sm:text-xl font-bold tracking-tight text-white truncate"
              >
                {currentUser ? currentUser.displayName || 'Account' : 'Guest Profile'}
              </h2>
              <p className="text-xs sm:text-sm text-white/55 truncate mt-0.5">
                {currentUser
                  ? currentUser.email || 'Profile icon synced to your account'
                  : 'Profile icon saved on this device'}
              </p>
            </div>
          </div>

          <button
            type="button"
            onClick={onClose}
            className="w-9 h-9 rounded-full bg-white/8 hover:bg-white/15 border border-white/10 flex items-center justify-center text-white/75 hover:text-white transition-all cursor-pointer shrink-0 active:scale-95"
            aria-label="Close profile dialog"
          >
            <X className="w-4 h-4 sm:w-5 sm:h-5" />
          </button>
        </div>

        {/* Quick Actions Bar */}
        <div className="px-5 sm:px-7 py-3.5 border-b border-white/8 flex flex-wrap items-center justify-between gap-2.5 shrink-0 bg-black/25">
          <div className="flex flex-wrap items-center gap-2">
            <button
              type="button"
              onClick={handleOpenMySpace}
              className="inline-flex items-center gap-2 px-3.5 py-2 rounded-full bg-white/8 hover:bg-white/15 border border-white/10 text-xs sm:text-sm font-medium text-white/85 hover:text-white transition-all cursor-pointer active:scale-95"
            >
              <Bookmark className="w-3.5 h-3.5" />
              <span>My Space</span>
            </button>

            {!currentUser && (
              <button
                type="button"
                onClick={randomizeGuestAvatar}
                className="inline-flex items-center gap-2 px-3.5 py-2 rounded-full bg-white/8 hover:bg-white/15 border border-white/10 text-xs sm:text-sm font-medium text-white/85 hover:text-white transition-all cursor-pointer active:scale-95"
              >
                <Shuffle className="w-3.5 h-3.5" />
                <span>Randomize</span>
              </button>
            )}

            {currentUser && userAvatarId && currentUser.photoURL && (
              <button
                type="button"
                onClick={() => selectProfileAvatar(null)}
                className="inline-flex items-center gap-2 px-3.5 py-2 rounded-full bg-white/8 hover:bg-white/15 border border-white/10 text-xs sm:text-sm font-medium text-white/85 hover:text-white transition-all cursor-pointer active:scale-95"
              >
                <RotateCcw className="w-3.5 h-3.5" />
                <span>Google Photo</span>
              </button>
            )}
          </div>

          <div className="flex items-center gap-2">
            {currentUser ? (
              <button
                type="button"
                onClick={handleSignOut}
                className="inline-flex items-center gap-2 px-4 py-2 rounded-full bg-white/8 hover:bg-white/15 border border-white/10 text-xs sm:text-sm font-medium text-white/80 hover:text-white transition-all cursor-pointer active:scale-95"
              >
                <LogOut className="w-3.5 h-3.5" />
                <span>Sign Out</span>
              </button>
            ) : (
              <LoadingButton
                type="button"
                loading={isSigningIn}
                onClick={handleGoogleSignIn}
                className="px-4 py-2 rounded-full bg-white hover:bg-white/90 text-black text-xs sm:text-sm font-bold shadow-[0_4px_18px_rgba(255,255,255,0.14)] transition-all cursor-pointer active:scale-95"
              >
                {!isSigningIn && <GoogleIcon className="w-3.5 h-3.5 shrink-0" />}
                <span>{isSigningIn ? 'Signing in...' : 'Sign in with Google'}</span>
              </LoadingButton>
            )}
          </div>
        </div>

        {authError && (
          <div className="px-5 sm:px-7 pt-2.5 text-xs text-red-400">
            {authError}
          </div>
        )}

        {/* Avatar Grid */}
        <div className="px-5 sm:px-7 py-5 overflow-y-auto scrollbar-hide">
          <div className="flex items-center justify-between mb-3.5">
            <h3 className="text-xs sm:text-sm font-semibold uppercase tracking-wider text-white/55">
              Choose Profile Icon
            </h3>
          </div>

          <div className="grid grid-cols-4 sm:grid-cols-6 md:grid-cols-7 gap-3 sm:gap-3.5">
            {PROFILE_AVATARS.map((avatar) => {
              const isSelected = activeAvatarId === avatar.id;
              return (
                <button
                  key={avatar.id}
                  type="button"
                  onClick={() => selectProfileAvatar(avatar.id)}
                  title={avatar.label}
                  aria-label={`Select ${avatar.label} icon`}
                  aria-pressed={isSelected}
                  className={`group relative aspect-square rounded-xl overflow-hidden border-2 transition-all duration-200 cursor-pointer focus:outline-none focus-visible:ring-2 focus-visible:ring-white/60 ${
                    isSelected
                      ? 'border-white scale-[1.04] shadow-[0_0_22px_rgba(255,255,255,0.22)] ring-2 ring-white/25'
                      : 'border-white/10 hover:border-white/65 hover:scale-105 active:scale-95'
                  }`}
                >
                  <img
                    src={avatar.src}
                    alt={avatar.label}
                    className="w-full h-full object-cover"
                    loading="lazy"
                    draggable={false}
                  />
                  {isSelected && (
                    <span className="absolute bottom-1.5 right-1.5 w-5 h-5 rounded-full bg-white text-black flex items-center justify-center shadow-md">
                      <Check className="w-3 h-3 stroke-[3]" />
                    </span>
                  )}
                </button>
              );
            })}
          </div>
        </div>
      </div>
    </div>,
    document.body
  );
}
