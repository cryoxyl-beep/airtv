import React, { useEffect, useState, useMemo, useRef, useCallback } from 'react';
import { Check } from 'lucide-react';
import {
  NichePosterItem,
  isPosterUrlReady,
  markPosterUrlLoaded,
  preloadNicheCarouselImages,
} from '../services/nicheContentService';

interface NichePosterStackProps {
  nicheId: string;
  posters: NichePosterItem[];
  carouselPosters?: NichePosterItem[];
  isHovered: boolean;
  isSelected: boolean;
  pointerOffset: { x: number; y: number }; // normalized -1..1
  dragDeltaX: number; // live pixel offset while dragging
  step: number;
  isPopSurging: boolean;
  loading?: boolean;
  eager?: boolean;
  onReadyCountChange?: (len: number) => void;
}

interface SlotVisualStyle {
  zIndex: number;
  sizeClass: string;
  transform: string;
  opacity: number;
  filter: string;
  shadowClass: string;
  ringClass: string;
  transitionTiming: string;
}

/**
 * Computes the 3D physical deck transform for each slot around the central spotlight (slot 0).
 * Slots:
 *   0  = Central Focal Poster (pops upward & forward on hover/step)
 *  -1  = Inner-Left Supporting Poster
 *  +1  = Inner-Right Supporting Poster
 *  -2  = Outer-Left Supporting Poster
 *  +2  = Outer-Right Supporting Poster
 *  -3  = Emerging/Receding Far-Left Deck Poster
 *  +3  = Emerging/Receding Far-Right Deck Poster
 */
function getSlotVisualStyle(
  slot: number,
  isHovered: boolean,
  isSelected: boolean,
  isPopSurging: boolean,
  pointerOffset: { x: number; y: number },
  dragDeltaX: number
): SlotVisualStyle {
  const px = isHovered ? pointerOffset.x : 0;
  const py = isHovered ? pointerOffset.y : 0;
  const dragShift = Math.max(-44, Math.min(44, dragDeltaX * 0.45));

  const springTransition = isPopSurging
    ? 'transition-[transform,opacity,filter,box-shadow] duration-350 ease-[cubic-bezier(0.18,1.28,0.32,1)]'
    : 'transition-[transform,opacity,filter,box-shadow] duration-500 ease-[cubic-bezier(0.22,1,0.36,1)]';

  switch (slot) {
    case 0: {
      // Central focal poster: pops upward and forward out of the deck
      const popY = isHovered ? (isPopSurging ? -30 : -20) + py * 4 : 0;
      const popX = isHovered ? px * 10 + dragShift : 0;
      const popScale = isHovered ? (isPopSurging ? 1.17 : 1.12) : 1;
      const popRotate = isHovered ? px * 2.8 + dragShift * 0.06 : 0;

      return {
        zIndex: 45,
        sizeClass: 'w-[126px] sm:w-[138px] md:w-[148px]',
        transform: `translate3d(${popX.toFixed(1)}px, ${popY.toFixed(1)}px, 0px) rotate(${popRotate.toFixed(2)}deg) scale(${popScale})`,
        opacity: 1,
        filter: isHovered ? 'brightness(1.06)' : 'brightness(1)',
        shadowClass: isHovered
          ? 'shadow-[0_28px_60px_rgba(0,0,0,0.96),0_10px_24px_rgba(0,0,0,0.88),0_0_26px_rgba(255,255,255,0.10)]'
          : 'shadow-[0_20px_44px_rgba(0,0,0,0.94),0_6px_16px_rgba(0,0,0,0.82)]',
        ringClass: isSelected
          ? 'ring-2 ring-white/90'
          : isHovered
          ? 'ring-1 ring-white/40'
          : 'ring-1 ring-white/20',
        transitionTiming: springTransition,
      };
    }

    case -1: {
      // Inner-left supporting poster
      const baseX = isHovered ? -76 : -58;
      const baseY = isHovered ? 4 : 10;
      const baseRot = isHovered ? -12.5 : -9.5;
      const baseScale = isHovered ? 0.92 : 0.89;
      const x = baseX + px * 6 + dragShift * 0.65;
      const y = baseY - py * 2;
      const rot = baseRot + px * 1.5;

      return {
        zIndex: 30,
        sizeClass: 'w-[112px] sm:w-[122px] md:w-[132px]',
        transform: `translate3d(${x.toFixed(1)}px, ${y.toFixed(1)}px, 0px) rotate(${rot.toFixed(2)}deg) scale(${baseScale})`,
        opacity: 1,
        filter: isHovered ? 'brightness(0.88)' : 'brightness(0.78)',
        shadowClass: 'shadow-[0_16px_34px_rgba(0,0,0,0.90)]',
        ringClass: 'ring-1 ring-white/15',
        transitionTiming: springTransition,
      };
    }

    case 1: {
      // Inner-right supporting poster
      const baseX = isHovered ? 76 : 58;
      const baseY = isHovered ? 4 : 10;
      const baseRot = isHovered ? 12.5 : 9.5;
      const baseScale = isHovered ? 0.92 : 0.89;
      const x = baseX + px * 6 + dragShift * 0.65;
      const y = baseY - py * 2;
      const rot = baseRot + px * 1.5;

      return {
        zIndex: 30,
        sizeClass: 'w-[112px] sm:w-[122px] md:w-[132px]',
        transform: `translate3d(${x.toFixed(1)}px, ${y.toFixed(1)}px, 0px) rotate(${rot.toFixed(2)}deg) scale(${baseScale})`,
        opacity: 1,
        filter: isHovered ? 'brightness(0.88)' : 'brightness(0.78)',
        shadowClass: 'shadow-[0_16px_34px_rgba(0,0,0,0.90)]',
        ringClass: 'ring-1 ring-white/15',
        transitionTiming: springTransition,
      };
    }

    case -2: {
      // Outer-left supporting poster
      const baseX = isHovered ? -132 : -104;
      const baseY = isHovered ? 16 : 22;
      const baseRot = isHovered ? -21 : -17;
      const baseScale = isHovered ? 0.82 : 0.79;
      const x = baseX + px * 4 + dragShift * 0.4;
      const y = baseY;
      const rot = baseRot + px * 1.2;

      return {
        zIndex: 20,
        sizeClass: 'w-[98px] sm:w-[108px] md:w-[116px]',
        transform: `translate3d(${x.toFixed(1)}px, ${y.toFixed(1)}px, 0px) rotate(${rot.toFixed(2)}deg) scale(${baseScale})`,
        opacity: 1,
        filter: isHovered ? 'brightness(0.70)' : 'brightness(0.56)',
        shadowClass: 'shadow-[0_12px_26px_rgba(0,0,0,0.86)]',
        ringClass: 'ring-1 ring-white/10',
        transitionTiming: springTransition,
      };
    }

    case 2: {
      // Outer-right supporting poster
      const baseX = isHovered ? 132 : 104;
      const baseY = isHovered ? 16 : 22;
      const baseRot = isHovered ? 21 : 17;
      const baseScale = isHovered ? 0.82 : 0.79;
      const x = baseX + px * 4 + dragShift * 0.4;
      const y = baseY;
      const rot = baseRot + px * 1.2;

      return {
        zIndex: 20,
        sizeClass: 'w-[98px] sm:w-[108px] md:w-[116px]',
        transform: `translate3d(${x.toFixed(1)}px, ${y.toFixed(1)}px, 0px) rotate(${rot.toFixed(2)}deg) scale(${baseScale})`,
        opacity: 1,
        filter: isHovered ? 'brightness(0.70)' : 'brightness(0.56)',
        shadowClass: 'shadow-[0_12px_26px_rgba(0,0,0,0.86)]',
        ringClass: 'ring-1 ring-white/10',
        transitionTiming: springTransition,
      };
    }

    case -3: {
      // Emerging / receding far-left deck card behind the stack
      const x = isHovered ? -162 + px * 3 : -82;
      const y = isHovered ? 28 : 26;
      const rot = isHovered ? -27 : -18;
      const scale = isHovered ? 0.72 : 0.66;

      return {
        zIndex: 10,
        sizeClass: 'w-[92px] sm:w-[100px] md:w-[108px]',
        transform: `translate3d(${x.toFixed(1)}px, ${y.toFixed(1)}px, 0px) rotate(${rot}deg) scale(${scale})`,
        opacity: isHovered ? 0.52 : 0,
        filter: 'brightness(0.46)',
        shadowClass: 'shadow-[0_8px_18px_rgba(0,0,0,0.80)]',
        ringClass: 'ring-1 ring-white/5',
        transitionTiming: springTransition,
      };
    }

    default: {
      // +3: Emerging / receding far-right deck card behind the stack
      const x = isHovered ? 162 + px * 3 : 82;
      const y = isHovered ? 28 : 26;
      const rot = isHovered ? 27 : 18;
      const scale = isHovered ? 0.72 : 0.66;

      return {
        zIndex: 10,
        sizeClass: 'w-[92px] sm:w-[100px] md:w-[108px]',
        transform: `translate3d(${x.toFixed(1)}px, ${y.toFixed(1)}px, 0px) rotate(${rot}deg) scale(${scale})`,
        opacity: isHovered ? 0.52 : 0,
        filter: 'brightness(0.46)',
        shadowClass: 'shadow-[0_8px_18px_rgba(0,0,0,0.80)]',
        ringClass: 'ring-1 ring-white/5',
        transitionTiming: springTransition,
      };
    }
  }
}

const PosterDeckItem: React.FC<{
  poster: NichePosterItem;
  slot: number;
  isHovered: boolean;
  isSelected: boolean;
  isPopSurging: boolean;
  pointerOffset: { x: number; y: number };
  dragDeltaX: number;
  eager: boolean;
  onImageLoaded?: (url: string) => void;
}> = React.memo(
  ({
    poster,
    slot,
    isHovered,
    isSelected,
    isPopSurging,
    pointerOffset,
    dragDeltaX,
    eager,
    onImageLoaded,
  }) => {
    const [imgError, setImgError] = useState(false);
    const [imgLoaded, setImgLoaded] = useState(() => isPosterUrlReady(poster.posterUrl));

    const styleDef = getSlotVisualStyle(
      slot,
      isHovered,
      isSelected,
      isPopSurging,
      pointerOffset,
      dragDeltaX
    );

    const isCenterSlot = slot === 0;

    return (
      <div
        style={{
          zIndex: styleDef.zIndex,
          transform: styleDef.transform,
          opacity: styleDef.opacity,
          filter: styleDef.filter,
        }}
        className={`absolute aspect-[2/3] rounded-xl overflow-hidden bg-[#141414] select-none pointer-events-none motion-reduce:transition-none motion-reduce:transform-none will-change-transform ${styleDef.transitionTiming} ${styleDef.sizeClass} ${styleDef.shadowClass} ${styleDef.ringClass}`}
      >
        {!imgLoaded && !imgError && (
          <div className="absolute inset-0 bg-[#1a1a1a] animate-pulse" />
        )}
        {!imgError ? (
          <img
            src={poster.posterUrl}
            alt=""
            referrerPolicy="no-referrer"
            loading={eager ? 'eager' : 'lazy'}
            decoding="async"
            draggable={false}
            onLoad={() => {
              markPosterUrlLoaded(poster.posterUrl);
              setImgLoaded(true);
              if (onImageLoaded) onImageLoaded(poster.posterUrl);
            }}
            onError={() => setImgError(true)}
            className={`w-full h-full object-cover transition-opacity duration-300 ${
              imgLoaded ? 'opacity-100' : 'opacity-0'
            }`}
          />
        ) : (
          <div className="w-full h-full bg-gradient-to-b from-[#222222] to-[#121212]" />
        )}

        {/* Subtle glossy top edge highlight & bottom vignette for physical poster depth */}
        <div className="absolute inset-0 bg-gradient-to-t from-black/40 via-transparent to-white/[0.07] pointer-events-none" />

        {/* Integrated Selected-State Indicator on the Central Focal Poster */}
        {isCenterSlot && (
          <div
            className={`absolute top-2.5 right-2.5 z-50 transition-all duration-200 ${
              isSelected
                ? 'opacity-100 scale-100'
                : isHovered
                ? 'opacity-90 scale-100'
                : 'opacity-0 scale-90'
            }`}
          >
            {isSelected ? (
              <span className="w-6 h-6 sm:w-7 sm:h-7 rounded-full bg-white text-black flex items-center justify-center shadow-[0_4px_14px_rgba(0,0,0,0.9)] ring-2 ring-black/30">
                <Check className="w-3.5 h-3.5 sm:w-4 sm:h-4 stroke-[3]" />
              </span>
            ) : (
              <span className="w-5 h-5 sm:w-6 sm:h-6 rounded-full bg-black/55 border border-white/40 backdrop-blur-md flex items-center justify-center shadow-[0_2px_10px_rgba(0,0,0,0.75)]" />
            )}
          </div>
        )}
      </div>
    );
  }
);

const NichePosterStack: React.FC<NichePosterStackProps> = React.memo(
  ({
    nicheId,
    posters,
    carouselPosters,
    isHovered,
    isSelected,
    pointerOffset,
    dragDeltaX,
    step,
    isPopSurging,
    loading = false,
    eager = false,
    onReadyCountChange,
  }) => {
    const [readyVersion, setReadyVersion] = useState(0);
    const readyCallbackRef = useRef(onReadyCountChange);
    readyCallbackRef.current = onReadyCountChange;

    // Trigger background preloading of additional posters as soon as hovered or mounted
    useEffect(() => {
      if (!nicheId) return;
      let active = true;
      if (isHovered) {
        preloadNicheCarouselImages(nicheId, () => {
          if (active) setReadyVersion((v) => v + 1);
        }).catch(() => {});
      }
      return () => {
        active = false;
      };
    }, [isHovered, nicheId]);

    // Build the infinite circular poster ring:
    // At step === 0:
    //   ring[0]       -> slot  0 (Center = posters[0])
    //   ring[1]       -> slot +1 (Inner-Right = posters[2])
    //   ring[2]       -> slot +2 (Outer-Right = posters[4])
    //   ring[3..N-3]  -> additional preloaded posters from carouselPosters (~10 extras)
    //   ring[N-2]     -> slot -2 (Outer-Left = posters[3])
    //   ring[N-1]     -> slot -1 (Inner-Left = posters[1])
    const orderedRing = useMemo(() => {
      if (!posters || posters.length === 0) return [];
      const base = posters.slice(0, 5);
      while (base.length < 5 && posters[0]) {
        base.push(posters[base.length % posters.length]);
      }

      const initialKeys = new Set(base.map((p) => p.key));
      const extras = (carouselPosters || []).filter(
        (p) => p && !initialKeys.has(p.key) && isPosterUrlReady(p.posterUrl)
      );

      // Arrange so at step = 0:
      // index 0 is Center (base[0])
      // index 1 is Inner-Right (base[2])
      // index 2 is Outer-Right (base[4])
      // followed by all ready extras
      // ending with Outer-Left (base[3]) at len - 2 and Inner-Left (base[1]) at len - 1
      return [base[0], base[2], base[4], ...extras, base[3], base[1]].filter(Boolean);
    }, [posters, carouselPosters, readyVersion]);

    useEffect(() => {
      if (readyCallbackRef.current) {
        readyCallbackRef.current(orderedRing.length);
      }
    }, [orderedRing.length]);

    const handleImageLoaded = useCallback(() => {
      setReadyVersion((v) => v + 1);
    }, []);

    if (loading || !posters || posters.length === 0) {
      return (
        <div
          className="relative w-full h-[230px] sm:h-[250px] md:h-[268px] flex items-center justify-center select-none pointer-events-none overflow-visible"
          aria-hidden="true"
        >
          {[-2, -1, 0, 1, 2].map((slot) => {
            const st = getSlotVisualStyle(slot, false, false, false, { x: 0, y: 0 }, 0);
            return (
              <div
                key={`skeleton-slot-${slot}`}
                style={{
                  zIndex: st.zIndex,
                  transform: st.transform,
                }}
                className={`absolute aspect-[2/3] rounded-xl bg-[#181818] animate-pulse ${st.sizeClass} ${st.shadowClass} ${st.ringClass}`}
              />
            );
          })}
        </div>
      );
    }

    const len = orderedRing.length;
    const mod = (n: number, m: number) => ((n % m) + m) % m;

    // Render 7 slots (-3..+3) when we have >= 7 posters so emerging cards appear from behind the stack;
    // otherwise render the 5 core fan slots (-2..+2).
    const activeSlots = len >= 7 ? [-3, -2, -1, 0, 1, 2, 3] : [-2, -1, 0, 1, 2];
    const renderedPosters = new Map<string, { poster: NichePosterItem; slot: number }>();

    for (const slot of activeSlots) {
      const ringIndex = mod(step + slot, len);
      const poster = orderedRing[ringIndex];
      if (poster && !renderedPosters.has(poster.key)) {
        renderedPosters.set(poster.key, { poster, slot });
      }
    }

    return (
      <div
        className={`relative w-full h-[230px] sm:h-[250px] md:h-[268px] flex items-center justify-center select-none pointer-events-none overflow-visible transition-transform duration-500 ease-[cubic-bezier(0.22,1,0.36,1)] ${
          isHovered ? '-translate-y-1.5' : 'translate-y-0'
        }`}
      >
        {Array.from(renderedPosters.values()).map(({ poster, slot }) => (
          <PosterDeckItem
            key={poster.key}
            poster={poster}
            slot={slot}
            isHovered={isHovered}
            isSelected={isSelected}
            isPopSurging={isPopSurging}
            pointerOffset={pointerOffset}
            dragDeltaX={dragDeltaX}
            eager={eager && Math.abs(slot) <= 1}
            onImageLoaded={handleImageLoaded}
          />
        ))}
      </div>
    );
  }
);

export default NichePosterStack;
