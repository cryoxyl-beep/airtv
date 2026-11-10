import React, { useEffect, useState, useCallback } from 'react';
import { NICHE_CONFIGS } from '../config/nicheConfig';
import {
  NicheCollectionData,
  getCachedNicheCollections,
  loadAllNicheCollections,
} from '../services/nicheContentService';
import {
  getLocalNicheSelections,
  persistNicheSelections,
  syncNicheSelectionsWithAccount,
} from '../services/nichePreferenceService';
import { useAuth } from '../contexts/AuthContext';
import NicheCard from './NicheCard';

const SelectYourNiche: React.FC = React.memo(function SelectYourNiche() {
  const { currentUser } = useAuth();
  const uid = currentUser?.uid || null;

  const [selectedIds, setSelectedIds] = useState<string[]>(() =>
    getLocalNicheSelections(uid)
  );
  const [collections, setCollections] = useState<Record<string, NicheCollectionData> | null>(() =>
    getCachedNicheCollections()
  );
  const [loading, setLoading] = useState<boolean>(() => !getCachedNicheCollections());

  // Sync niche selections when auth user changes
  useEffect(() => {
    let active = true;
    if (uid) {
      syncNicheSelectionsWithAccount(uid).then((synced) => {
        if (active) {
          setSelectedIds(synced);
        }
      });
    } else {
      setSelectedIds(getLocalNicheSelections(null));
    }
    return () => {
      active = false;
    };
  }, [uid]);

  // Listen for external niche preference updates
  useEffect(() => {
    const handleExternalUpdate = (e: Event) => {
      const custom = e as CustomEvent<{ selectedNiches?: string[] }>;
      if (Array.isArray(custom.detail?.selectedNiches)) {
        setSelectedIds(custom.detail.selectedNiches);
      }
    };
    window.addEventListener('miyoro-niches-updated', handleExternalUpdate);
    return () => {
      window.removeEventListener('miyoro-niches-updated', handleExternalUpdate);
    };
  }, []);

  // Load mixed-media niche collections independently without blocking Hero or Trending Now
  useEffect(() => {
    if (collections) {
      setLoading(false);
      return;
    }

    let isMounted = true;
    loadAllNicheCollections()
      .then((loaded) => {
        if (isMounted) {
          setCollections(loaded);
          setLoading(false);
        }
      })
      .catch(() => {
        if (isMounted) {
          setLoading(false);
        }
      });

    return () => {
      isMounted = false;
    };
  }, [collections]);

  const handleToggleNiche = useCallback(
    (nicheId: string) => {
      setSelectedIds((prev) => {
        const alreadySelected = prev.includes(nicheId);
        const next = alreadySelected
          ? prev.filter((id) => id !== nicheId)
          : [...prev, nicheId];
        persistNicheSelections(next, uid);
        return next;
      });
    },
    [uid]
  );

  return (
    <section
      aria-label="Select Your Niche"
      className="relative py-3 select-none overflow-x-clip"
    >
      {/* Section Heading */}
      <div className="flex items-baseline justify-between pl-6 md:pl-12 pr-6 md:pr-12 mb-4">
        <h2 className="text-2xl font-bold text-white tracking-wide">
          Select Your Niche
        </h2>
      </div>

      {/* 3 × 2 Floating Poster Compositions on Desktop (Responsive on Tablet & Mobile) */}
      <div className="px-6 md:px-12 py-2">
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-x-8 gap-y-8 sm:gap-y-10 md:gap-x-12 md:gap-y-12 items-center justify-items-center">
          {NICHE_CONFIGS.slice(0, 6).map((niche, index) => (
            <NicheCard
              key={niche.id}
              niche={niche}
              data={collections?.[niche.id]}
              isSelected={selectedIds.includes(niche.id)}
              loading={loading}
              eager={index < 6}
              onToggle={handleToggleNiche}
            />
          ))}
        </div>
      </div>
    </section>
  );
});

export default SelectYourNiche;
