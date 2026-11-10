import React, { useState, useRef, useEffect, useCallback } from 'react';
import { NicheDefinition } from '../config/nicheConfig';
import { NicheCollectionData } from '../services/nicheContentService';
import NichePosterStack from './NichePosterStack';

interface NicheCardProps {
  niche: NicheDefinition;
  data?: NicheCollectionData;
  isSelected: boolean;
  loading?: boolean;
  eager?: boolean;
  onToggle: (nicheId: string) => void;
}

const DRAG_STEP_THRESHOLD_PX = 52;
const CLICK_SUPPRESS_DRAG_PX = 8;

const NicheCard: React.FC<NicheCardProps> = React.memo(
  ({ niche, data, isSelected, loading = false, eager = false, onToggle }) => {
    const [isHovered, setIsHovered] = useState(false);
    const [step, setStep] = useState(0);
    const [isPopSurging, setIsPopSurging] = useState(false);
    const [pointerOffset, setPointerOffset] = useState<{ x: number; y: number }>({ x: 0, y: 0 });
    const [dragDeltaX, setDragDeltaX] = useState(0);

    const buttonRef = useRef<HTMLButtonElement>(null);
    const flowDirRef = useRef<1 | -1>(1);
    const isDraggingRef = useRef(false);
    const dragStartXRef = useRef(0);
    const dragAnchorXRef = useRef(0);
    const totalDragDistanceRef = useRef(0);
    const suppressNextClickRef = useRef(false);
    const lastPointerStepAtRef = useRef(0);
    const lastPointerZoneXRef = useRef<number | null>(null);
    const lastWheelStepAtRef = useRef(0);
    const popSurgeTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
    const readyCountRef = useRef(5);

    const posters = data?.posters || [];
    const carouselPosters = data?.carouselPosters || posters;

    const triggerPopStep = useCallback((delta: number) => {
      setStep((prev) => prev + delta);
      setIsPopSurging(true);
      if (popSurgeTimerRef.current) {
        clearTimeout(popSurgeTimerRef.current);
      }
      popSurgeTimerRef.current = setTimeout(() => {
        setIsPopSurging(false);
      }, 280);
    }, []);

    // Cleanup timers on unmount
    useEffect(() => {
      return () => {
        if (popSurgeTimerRef.current) {
          clearTimeout(popSurgeTimerRef.current);
        }
      };
    }, []);

    // Automatic poster deck cycling while hovered (and not actively dragging)
    useEffect(() => {
      if (!isHovered) {
        setStep(0);
        setIsPopSurging(false);
        setPointerOffset({ x: 0, y: 0 });
        setDragDeltaX(0);
        lastPointerZoneXRef.current = null;
        return;
      }

      // Immediately pop the central poster forward on hover entry, then cycle through the stack
      setIsPopSurging(true);
      const initialSurgeTimer = setTimeout(() => {
        setIsPopSurging(false);
      }, 280);

      let cycleInterval: ReturnType<typeof setInterval> | null = null;
      const firstStepTimer = setTimeout(() => {
        if (!isDraggingRef.current) {
          triggerPopStep(flowDirRef.current);
        }
        cycleInterval = setInterval(() => {
          if (!isDraggingRef.current) {
            triggerPopStep(flowDirRef.current);
          }
        }, 950);
      }, 380);

      return () => {
        clearTimeout(initialSurgeTimer);
        clearTimeout(firstStepTimer);
        if (cycleInterval) clearInterval(cycleInterval);
      };
    }, [isHovered, triggerPopStep]);

    const handlePointerEnter = () => {
      setIsHovered(true);
    };

    const handlePointerLeave = () => {
      isDraggingRef.current = false;
      setDragDeltaX(0);
      setIsHovered(false);
    };

    const handlePointerDown = (e: React.PointerEvent<HTMLButtonElement>) => {
      if (e.button !== 0 && e.pointerType === 'mouse') return;
      isDraggingRef.current = true;
      dragStartXRef.current = e.clientX;
      dragAnchorXRef.current = e.clientX;
      totalDragDistanceRef.current = 0;
      suppressNextClickRef.current = false;
    };

    const handlePointerMove = (e: React.PointerEvent<HTMLButtonElement>) => {
      const rect = buttonRef.current?.getBoundingClientRect();
      if (rect && rect.width > 0 && rect.height > 0) {
        const normX = Math.max(-1, Math.min(1, ((e.clientX - rect.left) / rect.width - 0.5) * 2));
        const normY = Math.max(-1, Math.min(1, ((e.clientY - rect.top) / rect.height - 0.5) * 2));
        setPointerOffset({ x: normX, y: normY });

        // Encourage deck direction based on horizontal pointer position
        if (normX < -0.22) {
          flowDirRef.current = -1;
        } else if (normX > 0.22) {
          flowDirRef.current = 1;
        }

        // Controlled cursor-driven deck step when moving deliberately across the composition
        if (!isDraggingRef.current) {
          if (lastPointerZoneXRef.current === null) {
            lastPointerZoneXRef.current = normX;
          } else {
            const deltaZone = normX - lastPointerZoneXRef.current;
            const now = Date.now();
            if (Math.abs(deltaZone) >= 0.48 && now - lastPointerStepAtRef.current >= 320) {
              lastPointerZoneXRef.current = normX;
              lastPointerStepAtRef.current = now;
              triggerPopStep(deltaZone > 0 ? 1 : -1);
            }
          }
        }
      }

      if (!isDraggingRef.current) return;

      const totalDelta = e.clientX - dragStartXRef.current;
      totalDragDistanceRef.current = Math.max(totalDragDistanceRef.current, Math.abs(totalDelta));
      if (totalDragDistanceRef.current > CLICK_SUPPRESS_DRAG_PX) {
        suppressNextClickRef.current = true;
      }

      const anchorDelta = e.clientX - dragAnchorXRef.current;
      if (Math.abs(anchorDelta) >= DRAG_STEP_THRESHOLD_PX) {
        const steps = Math.trunc(anchorDelta / DRAG_STEP_THRESHOLD_PX);
        // Dragging left moves deck forward (+1); dragging right moves deck backward (-1)
        const dir = steps < 0 ? 1 : -1;
        flowDirRef.current = dir;
        triggerPopStep(dir);
        dragAnchorXRef.current = e.clientX;
        setDragDeltaX(0);
      } else {
        setDragDeltaX(anchorDelta);
      }
    };

    const handlePointerUpOrCancel = () => {
      if (isDraggingRef.current) {
        isDraggingRef.current = false;
        setDragDeltaX(0);
      }
    };

    const handleWheel = (e: React.WheelEvent<HTMLButtonElement>) => {
      // Allow horizontal trackpad swipe to browse through the poster stack
      if (Math.abs(e.deltaX) > Math.abs(e.deltaY) && Math.abs(e.deltaX) > 16) {
        const now = Date.now();
        if (now - lastWheelStepAtRef.current >= 240) {
          lastWheelStepAtRef.current = now;
          const dir: 1 | -1 = e.deltaX > 0 ? 1 : -1;
          flowDirRef.current = dir;
          triggerPopStep(dir);
        }
      }
    };

    const handleClick = () => {
      if (suppressNextClickRef.current || totalDragDistanceRef.current > CLICK_SUPPRESS_DRAG_PX) {
        suppressNextClickRef.current = false;
        totalDragDistanceRef.current = 0;
        return;
      }
      onToggle(niche.id);
    };

    return (
      <button
        ref={buttonRef}
        type="button"
        onClick={handleClick}
        onPointerEnter={handlePointerEnter}
        onPointerLeave={handlePointerLeave}
        onPointerDown={handlePointerDown}
        onPointerMove={handlePointerMove}
        onPointerUp={handlePointerUpOrCancel}
        onPointerCancel={handlePointerUpOrCancel}
        onWheel={handleWheel}
        onFocus={() => setIsHovered(true)}
        onBlur={() => setIsHovered(false)}
        aria-pressed={isSelected}
        aria-label={`${niche.name}${isSelected ? ' (Selected)' : ''}`}
        className="group/niche relative w-full py-3 bg-transparent border-0 shadow-none rounded-none overflow-visible cursor-pointer select-none touch-pan-y focus:outline-none focus-visible:ring-2 focus-visible:ring-white/60 focus-visible:rounded-2xl"
      >
        {/* Soft, natural radial backlight directly behind the floating posters (no rectangular box) */}
        <div
          aria-hidden="true"
          className={`pointer-events-none absolute left-1/2 top-1/2 -translate-x-1/2 -translate-y-1/2 w-[320px] sm:w-[360px] h-[220px] sm:h-[240px] rounded-full blur-2xl transition-opacity duration-500 ${
            isSelected
              ? 'opacity-95'
              : isHovered
              ? 'opacity-90'
              : 'opacity-55'
          }`}
          style={{
            background: `radial-gradient(circle at 50% 50%, ${niche.ambientGlow} 0%, ${niche.ambientSecondary} 45%, rgba(0,0,0,0) 75%)`,
          }}
        />

        {/* Floating Poster Deck Composition (Artwork Only) */}
        <div className="relative z-20 flex items-center justify-center overflow-visible">
          <NichePosterStack
            nicheId={niche.id}
            posters={posters}
            carouselPosters={carouselPosters}
            isHovered={isHovered}
            isSelected={isSelected}
            pointerOffset={pointerOffset}
            dragDeltaX={dragDeltaX}
            step={step}
            isPopSurging={isPopSurging}
            loading={loading}
            eager={eager}
            onReadyCountChange={(count) => {
              readyCountRef.current = count;
            }}
          />
        </div>
      </button>
    );
  }
);

export default NicheCard;
