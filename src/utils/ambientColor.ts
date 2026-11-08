import { IMAGE_BASE_URL_W500 } from '../api/tmdb';

export interface AmbientColor {
  r: number;
  g: number;
  b: number;
  secondaryR: number;
  secondaryG: number;
  secondaryB: number;
  cssRgb: string;
  secondaryCssRgb: string;
}

/**
 * Neutral dark atmospheric fallback if an artwork fails to load or has no valid image.
 */
export const DEFAULT_AMBIENT_COLOR: AmbientColor = {
  r: 36,
  g: 42,
  b: 56,
  secondaryR: 28,
  secondaryG: 34,
  secondaryB: 48,
  cssRgb: '36, 42, 56',
  secondaryCssRgb: '28, 34, 48',
};

const TMDB_W300_BASE = 'https://image.tmdb.org/t/p/w300';

// Persistent in-memory cache keyed by hero item identifier / image URL
const ambientColorCache = new Map<string, AmbientColor>();
const inFlightExtractions = new Map<string, Promise<AmbientColor>>();

/**
 * Generates a stable cache key for a hero entry based on its static artwork.
 */
export function getHeroAmbientCacheKey(item: any): string {
  if (!item) return 'unknown';
  const idPart = `${item.source || item.media_type || 'media'}-${item.id || item.tmdb_id || ''}`;
  const artPart = item.backdrop_path || item.poster_path || item.bannerImage || '';
  return `${idPart}:${artPart}`;
}

/**
 * Resolves the static artwork URL used exclusively for ambient color extraction.
 * Uses w300 for TMDB paths so extraction is fast and never conflicts with
 * non-CORS cached original-size images in the hero <img> tag.
 */
function resolveExtractionImageUrl(item: any): string | null {
  if (!item) return null;
  const rawPath =
    item.backdrop_path ||
    item.poster_path ||
    item.bannerImage ||
    item.anilist_raw?.bannerImage ||
    item.anilist_raw?.coverImage?.extraLarge ||
    item.anilist_raw?.coverImage?.large ||
    null;

  if (!rawPath || typeof rawPath !== 'string') return null;

  if (rawPath.startsWith('http')) {
    // If it's already a TMDB original or w500 URL, downscale to w300 for fast CORS-safe sampling
    if (rawPath.includes('image.tmdb.org/t/p/')) {
      return rawPath.replace(/\/t\/p\/(original|w1280|w780|w500)\//, '/t/p/w300/');
    }
    return rawPath;
  }

  return `${TMDB_W300_BASE}${rawPath.startsWith('/') ? rawPath : `/${rawPath}`}`;
}

function rgbToHsl(r: number, g: number, b: number): [number, number, number] {
  const rn = r / 255;
  const gn = g / 255;
  const bn = b / 255;

  const max = Math.max(rn, gn, bn);
  const min = Math.min(rn, gn, bn);
  const l = (max + min) / 2;

  if (max === min) {
    return [0, 0, l];
  }

  const d = max - min;
  const s = l > 0.5 ? d / (2 - max - min) : d / (max + min);

  let h = 0;
  if (max === rn) {
    h = (gn - bn) / d + (gn < bn ? 6 : 0);
  } else if (max === gn) {
    h = (bn - rn) / d + 2;
  } else {
    h = (rn - gn) / d + 4;
  }

  return [h * 60, s, l];
}

function hslToRgb(h: number, s: number, l: number): [number, number, number] {
  const hn = ((h % 360) + 360) % 360 / 360;

  if (s === 0) {
    const val = Math.round(l * 255);
    return [val, val, val];
  }

  const hue2rgb = (p: number, q: number, t: number) => {
    let tt = t;
    if (tt < 0) tt += 1;
    if (tt > 1) tt -= 1;
    if (tt < 1 / 6) return p + (q - p) * 6 * tt;
    if (tt < 1 / 2) return q;
    if (tt < 2 / 3) return p + (q - p) * (2 / 3 - tt) * 6;
    return p;
  };

  const q = l < 0.5 ? l * (1 + s) : l + s - l * s;
  const p = 2 * l - q;

  const r = Math.round(hue2rgb(p, q, hn + 1 / 3) * 255);
  const g = Math.round(hue2rgb(p, q, hn) * 255);
  const b = Math.round(hue2rgb(p, q, hn - 1 / 3) * 255);

  return [
    Math.max(0, Math.min(255, r)),
    Math.max(0, Math.min(255, g)),
    Math.max(0, Math.min(255, b)),
  ];
}

/**
 * Adjusts raw RGB values to produce a rich, cinematic ambient glow that
 * looks vibrant against pure black without being overexposed or muddy.
 */
function tuneForCinematicAmbient(r: number, g: number, b: number): [number, number, number] {
  const [h, s, l] = rgbToHsl(r, g, b);

  // If artwork is nearly monochrome, preserve a subtle moody slate/tinted glow
  if (s < 0.08) {
    const tunedL = Math.min(0.42, Math.max(0.28, l * 0.65 + 0.14));
    return hslToRgb(h || 215, Math.max(s, 0.14), tunedL);
  }

  // Boost muted mid-tones and cap hyper-saturated neon so the glow feels rich & natural
  const tunedS = Math.min(0.86, Math.max(0.54, Math.pow(s, 0.74) * 1.16));
  // Keep luminance in the sweet spot [0.42, 0.54] so it radiates softly into black
  const tunedL = Math.min(0.54, Math.max(0.42, l * 0.58 + 0.21));

  return hslToRgb(h, tunedS, tunedL);
}

function parseHexToAmbient(hex: string): AmbientColor | null {
  const cleaned = hex.replace('#', '').trim();
  if (!/^[0-9a-fA-F]{6}$/.test(cleaned)) return null;
  const r = parseInt(cleaned.slice(0, 2), 16);
  const g = parseInt(cleaned.slice(2, 4), 16);
  const b = parseInt(cleaned.slice(4, 6), 16);

  const [tr, tg, tb] = tuneForCinematicAmbient(r, g, b);
  const [h, s, l] = rgbToHsl(tr, tg, tb);
  const [sr, sg, sb] = hslToRgb((h + 22) % 360, Math.max(0.45, s * 0.9), Math.max(0.36, l * 0.92));

  return {
    r: tr,
    g: tg,
    b: tb,
    secondaryR: sr,
    secondaryG: sg,
    secondaryB: sb,
    cssRgb: `${tr}, ${tg}, ${tb}`,
    secondaryCssRgb: `${sr}, ${sg}, ${sb}`,
  };
}

/**
 * Loads an image with CORS enabled for pixel sampling.
 */
function loadCorsImage(url: string): Promise<HTMLImageElement> {
  return new Promise((resolve, reject) => {
    const img = new Image();
    img.crossOrigin = 'anonymous';
    img.decoding = 'async';

    img.onload = () => resolve(img);
    img.onerror = () => {
      // Retry once with a cache-differentiating query param in case the browser
      // cached a non-CORS response for the same URL earlier
      const retryImg = new Image();
      retryImg.crossOrigin = 'anonymous';
      retryImg.decoding = 'async';
      const sep = url.includes('?') ? '&' : '?';
      retryImg.onload = () => resolve(retryImg);
      retryImg.onerror = (err) => reject(err);
      retryImg.src = `${url}${sep}ambient_cors=1`;
    };

    img.src = url;
  });
}

/**
 * Extracts dominant primary & secondary ambient colors from a loaded HTMLImageElement.
 */
function extractColorsFromImageElement(img: HTMLImageElement): AmbientColor {
  const sampleW = 48;
  const sampleH = 27;
  const canvas = document.createElement('canvas');
  canvas.width = sampleW;
  canvas.height = sampleH;

  const ctx = canvas.getContext('2d', { willReadFrequently: true });
  if (!ctx) return DEFAULT_AMBIENT_COLOR;

  ctx.drawImage(img, 0, 0, sampleW, sampleH);
  const { data } = ctx.getImageData(0, 0, sampleW, sampleH);

  const NUM_BUCKETS = 24; // 15-degree hue buckets
  const buckets = Array.from({ length: NUM_BUCKETS }, () => ({
    weight: 0,
    rSum: 0,
    gSum: 0,
    bSum: 0,
  }));

  let fallbackWeight = 0;
  let fallbackR = 0;
  let fallbackG = 0;
  let fallbackB = 0;

  for (let y = 0; y < sampleH; y++) {
    // Weight upper and middle regions higher since ambient light bleeds from the top & sides of the hero
    const verticalFactor = y < sampleH * 0.72 ? 1.35 : 0.75;

    for (let x = 0; x < sampleW; x++) {
      const idx = (y * sampleW + x) * 4;
      const a = data[idx + 3];
      if (a < 128) continue;

      const r = data[idx];
      const g = data[idx + 1];
      const b = data[idx + 2];

      const [h, s, l] = rgbToHsl(r, g, b);

      // Skip deep shadows/letterboxing and pure blown-out white highlights
      if (l < 0.08 || l > 0.92) continue;

      const edgeFactor = x < sampleW * 0.25 || x > sampleW * 0.75 ? 1.2 : 1.0;
      const spatialWeight = verticalFactor * edgeFactor;

      fallbackWeight += spatialWeight;
      fallbackR += r * spatialWeight;
      fallbackG += g * spatialWeight;
      fallbackB += b * spatialWeight;

      // Chromatic pixel weighting: favor rich, saturated, mid-luminance pixels
      if (s >= 0.10 && l >= 0.10 && l <= 0.88) {
        const lumBalance = Math.max(0.15, 1 - Math.abs(l - 0.50) * 1.45);
        const satBoost = Math.pow(s, 1.15);
        const weight = satBoost * lumBalance * spatialWeight;

        const bucketIdx = Math.floor(h / 15) % NUM_BUCKETS;
        buckets[bucketIdx].weight += weight;
        buckets[bucketIdx].rSum += r * weight;
        buckets[bucketIdx].gSum += g * weight;
        buckets[bucketIdx].bSum += b * weight;
      }
    }
  }

  // Smooth bucket scores with immediate neighbors so hues on bucket boundaries aren't split
  const smoothedScores = buckets.map((b, i) => {
    const prev = buckets[(i - 1 + NUM_BUCKETS) % NUM_BUCKETS].weight;
    const next = buckets[(i + 1) % NUM_BUCKETS].weight;
    return b.weight + (prev + next) * 0.35;
  });

  let bestBucketIdx = -1;
  let bestScore = 0;

  for (let i = 0; i < NUM_BUCKETS; i++) {
    if (smoothedScores[i] > bestScore && buckets[i].weight > 0) {
      bestScore = smoothedScores[i];
      bestBucketIdx = i;
    }
  }

  let primaryRawR: number;
  let primaryRawG: number;
  let primaryRawB: number;

  if (bestBucketIdx !== -1) {
    // Combine the winning bucket with its immediate neighbors for a smooth average
    const indices = [
      (bestBucketIdx - 1 + NUM_BUCKETS) % NUM_BUCKETS,
      bestBucketIdx,
      (bestBucketIdx + 1) % NUM_BUCKETS,
    ];
    let wTotal = 0;
    let rTotal = 0;
    let gTotal = 0;
    let bTotal = 0;
    for (const bi of indices) {
      const factor = bi === bestBucketIdx ? 1.0 : 0.35;
      const w = buckets[bi].weight * factor;
      wTotal += w;
      rTotal += buckets[bi].rSum * factor;
      gTotal += buckets[bi].gSum * factor;
      bTotal += buckets[bi].bSum * factor;
    }
    primaryRawR = rTotal / wTotal;
    primaryRawG = gTotal / wTotal;
    primaryRawB = bTotal / wTotal;
  } else if (fallbackWeight > 0) {
    primaryRawR = fallbackR / fallbackWeight;
    primaryRawG = fallbackG / fallbackWeight;
    primaryRawB = fallbackB / fallbackWeight;
  } else {
    return DEFAULT_AMBIENT_COLOR;
  }

  const [pr, pg, pb] = tuneForCinematicAmbient(primaryRawR, primaryRawG, primaryRawB);

  // Find a secondary accent bucket at least 2 buckets away for multi-dimensional lighting
  let secondBucketIdx = -1;
  let secondScore = 0;
  if (bestBucketIdx !== -1) {
    for (let i = 0; i < NUM_BUCKETS; i++) {
      const dist = Math.min(
        Math.abs(i - bestBucketIdx),
        NUM_BUCKETS - Math.abs(i - bestBucketIdx)
      );
      if (dist >= 2 && smoothedScores[i] > secondScore && buckets[i].weight > 0) {
        secondScore = smoothedScores[i];
        secondBucketIdx = i;
      }
    }
  }

  let sr: number;
  let sg: number;
  let sb: number;

  if (secondBucketIdx !== -1 && secondScore >= bestScore * 0.18) {
    const b2 = buckets[secondBucketIdx];
    [sr, sg, sb] = tuneForCinematicAmbient(
      b2.rSum / b2.weight,
      b2.gSum / b2.weight,
      b2.bSum / b2.weight
    );
  } else {
    // Derive a subtle analogous companion tone
    const [h, s, l] = rgbToHsl(pr, pg, pb);
    [sr, sg, sb] = hslToRgb((h + 24) % 360, Math.max(0.45, s * 0.92), Math.max(0.38, l * 0.94));
  }

  return {
    r: pr,
    g: pg,
    b: pb,
    secondaryR: sr,
    secondaryG: sg,
    secondaryB: sb,
    cssRgb: `${pr}, ${pg}, ${pb}`,
    secondaryCssRgb: `${sr}, ${sg}, ${sb}`,
  };
}

/**
 * Synchronously returns the cached AmbientColor for a hero item if already extracted.
 */
export function getCachedAmbientColor(item: any): AmbientColor | null {
  if (!item) return null;
  const key = getHeroAmbientCacheKey(item);
  return ambientColorCache.get(key) || null;
}

/**
 * Extracts and caches the dominant ambient color for a single hero item from its static artwork.
 * Never extracts from video or trailers.
 */
export async function extractHeroAmbientColor(item: any): Promise<AmbientColor> {
  if (!item) return DEFAULT_AMBIENT_COLOR;

  const key = getHeroAmbientCacheKey(item);
  const cached = ambientColorCache.get(key);
  if (cached) return cached;

  const existingPromise = inFlightExtractions.get(key);
  if (existingPromise) return existingPromise;

  const promise = (async (): Promise<AmbientColor> => {
    const imageUrl = resolveExtractionImageUrl(item);
    if (!imageUrl) {
      const hexFallback = item.anilist_raw?.coverImage?.color;
      const parsed = hexFallback ? parseHexToAmbient(hexFallback) : null;
      const result = parsed || DEFAULT_AMBIENT_COLOR;
      ambientColorCache.set(key, result);
      return result;
    }

    try {
      const img = await loadCorsImage(imageUrl);
      const extracted = extractColorsFromImageElement(img);
      ambientColorCache.set(key, extracted);
      return extracted;
    } catch {
      // Fallback to poster if backdrop failed
      const posterPath = item.poster_path;
      if (posterPath && typeof posterPath === 'string') {
        const posterUrl = posterPath.startsWith('http')
          ? posterPath
          : `${IMAGE_BASE_URL_W500}${posterPath}`;
        if (posterUrl !== imageUrl) {
          try {
            const posterImg = await loadCorsImage(posterUrl);
            const extractedPoster = extractColorsFromImageElement(posterImg);
            ambientColorCache.set(key, extractedPoster);
            return extractedPoster;
          } catch {
            // continue to fallback
          }
        }
      }

      const hexFallback = item.anilist_raw?.coverImage?.color;
      const parsed = hexFallback ? parseHexToAmbient(hexFallback) : null;
      const fallback = parsed || DEFAULT_AMBIENT_COLOR;
      ambientColorCache.set(key, fallback);
      return fallback;
    } finally {
      inFlightExtractions.delete(key);
    }
  })();

  inFlightExtractions.set(key, promise);
  return promise;
}

/**
 * Preloads and caches ambient colors for all hero entries in parallel so colors
 * are ready before their corresponding slides become active.
 */
export async function preloadHeroAmbientColors(items: any[]): Promise<void> {
  if (!Array.isArray(items) || items.length === 0) return;
  await Promise.allSettled(items.map((item) => extractHeroAmbientColor(item)));
}

/**
 * Builds the multi-layered radial & linear CSS gradient for the ambient background layer.
 * Strongest near the top of the viewport, spreading softly behind the hero container,
 * and fading organically into pure black.
 */
export function buildAmbientBackgroundStyle(color: AmbientColor): string {
  const c1 = color.cssRgb;
  const c2 = color.secondaryCssRgb;

  return [
    // 1. Primary top-viewport canopy light (strongest at top behind navbar, sidebar & upper hero edge)
    `radial-gradient(ellipse 100% 62% at 46% 0%, rgba(${c1}, 0.62) 0%, rgba(${c1}, 0.40) 32%, rgba(${c1}, 0.16) 58%, rgba(${c1}, 0) 80%)`,
    // 2. Upper-left soft bleed across the sidebar and hero top-left corner
    `radial-gradient(ellipse 72% 58% at 8% 20%, rgba(${c1}, 0.48) 0%, rgba(${c1}, 0.24) 44%, rgba(${c1}, 0) 76%)`,
    // 3. Upper-right soft bleed around hero top-right corner
    `radial-gradient(ellipse 68% 54% at 86% 16%, rgba(${c2}, 0.42) 0%, rgba(${c2}, 0.18) 42%, rgba(${c2}, 0) 74%)`,
    // 4. Broad atmospheric halo centered behind the hero container
    `radial-gradient(ellipse 94% 62% at 48% 42%, rgba(${c1}, 0.30) 0%, rgba(${c2}, 0.14) 46%, rgba(${c1}, 0) 76%)`,
  ].join(', ');
}
