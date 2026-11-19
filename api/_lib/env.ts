export const DEFAULT_ANILIST_API_URL = 'https://graphql.anilist.co';

const LOCAL_DEV_ORIGINS = [
  'http://localhost:3000',
  'http://127.0.0.1:3000',
  'http://localhost:5173',
  'http://127.0.0.1:5173',
];

function assertServerRuntime(): void {
  if (typeof window !== 'undefined' || typeof process === 'undefined') {
    throw new Error('Server environment configuration cannot be accessed in browser code.');
  }
}

function normalizeOrigin(raw: string): string | null {
  const trimmed = raw.trim();
  if (!trimmed) return null;
  try {
    const candidate = trimmed.includes('://') ? trimmed : `https://${trimmed}`;
    const parsed = new URL(candidate);
    if (parsed.protocol !== 'https:' && parsed.protocol !== 'http:') {
      return null;
    }
    return parsed.origin;
  } catch {
    return null;
  }
}

export function isProductionRuntime(): boolean {
  assertServerRuntime();
  return (
    process.env.VERCEL_ENV === 'production' ||
    (process.env.VERCEL_ENV === undefined && process.env.NODE_ENV === 'production')
  );
}

/**
 * Reads TMDB_API_TOKEN from server-side environment variables.
 * Never exposed to client bundles.
 */
export function getTmdbApiToken(options: { required?: boolean } = {}): string | null {
  assertServerRuntime();
  const token = process.env.TMDB_API_TOKEN?.trim() || '';
  if (!token) {
    if (options.required) {
      throw new Error('TMDB_API_TOKEN is not configured on the server.');
    }
    return null;
  }
  return token;
}

/**
 * Reads TVDB_API_KEY from server-side environment variables.
 * Never exposed to client bundles.
 */
export function getTvdbApiKey(options: { required?: boolean } = {}): string | null {
  assertServerRuntime();
  const apiKey = process.env.TVDB_API_KEY?.trim() || '';
  if (!apiKey) {
    if (options.required) {
      throw new Error('TVDB_API_KEY is not configured on the server.');
    }
    return null;
  }
  return apiKey;
}

/**
 * Reads ANILIST_API_URL from server-side environment variables,
 * falling back to the official AniList GraphQL endpoint when unset.
 */
export function getAnilistApiUrl(): string {
  assertServerRuntime();
  const raw = process.env.ANILIST_API_URL?.trim();
  if (!raw) {
    return DEFAULT_ANILIST_API_URL;
  }

  try {
    const parsed = new URL(raw);
    if (parsed.protocol !== 'https:' && parsed.protocol !== 'http:') {
      return DEFAULT_ANILIST_API_URL;
    }
    return parsed.toString();
  } catch {
    return DEFAULT_ANILIST_API_URL;
  }
}

/**
 * Computes the strict set of allowed cross-origin request origins.
 * Same-origin requests are handled separately via Host matching.
 */
export function getAllowedOrigins(): Set<string> {
  assertServerRuntime();
  const allowed = new Set<string>();

  const configured = process.env.ALLOWED_ORIGINS || '';
  for (const entry of configured.split(',')) {
    const normalized = normalizeOrigin(entry);
    if (normalized) {
      allowed.add(normalized);
    }
  }

  // Automatically allow the current Vercel deployment and production domain
  const vercelHosts = [
    process.env.VERCEL_URL,
    process.env.VERCEL_BRANCH_URL,
    process.env.VERCEL_PROJECT_PRODUCTION_URL,
  ];
  for (const host of vercelHosts) {
    if (!host) continue;
    const normalized = normalizeOrigin(host);
    if (normalized) {
      allowed.add(normalized);
    }
  }

  // Allow localhost origins only in non-production environments
  if (!isProductionRuntime()) {
    for (const origin of LOCAL_DEV_ORIGINS) {
      allowed.add(origin);
    }
  }

  return allowed;
}

/**
 * Safe non-secret readiness summary for diagnostics/health checks.
 */
export function getServerEnvSummary(): {
  tmdbConfigured: boolean;
  tvdbConfigured: boolean;
  anilistUsingDefault: boolean;
} {
  assertServerRuntime();
  const hasTmdbToken = Boolean(process.env.TMDB_API_TOKEN?.trim());
  const hasTvdbKey = Boolean(process.env.TVDB_API_KEY?.trim());
  const configuredAnilistUrl = getAnilistApiUrl();

  return {
    tmdbConfigured: hasTmdbToken,
    tvdbConfigured: hasTvdbKey,
    anilistUsingDefault: configuredAnilistUrl === DEFAULT_ANILIST_API_URL,
  };
}
