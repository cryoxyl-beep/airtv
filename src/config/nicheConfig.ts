export interface NicheDefinition {
  id: string;
  name: string;
  description: string;
  ambientGlow: string;
  ambientSecondary: string;
  tmdbMovieGenres: number[];
  tmdbTvGenres: number[];
  anilistGenres: string[];
  anilistTags: string[];
}

/**
 * Exactly 6 curated mixed-media entertainment niches arranged in a 3x2 desktop layout.
 */
export const NICHE_CONFIGS: NicheDefinition[] = [
  {
    id: 'scifi-futuristic',
    name: 'Sci-Fi & Futuristic Worlds',
    description: 'Cyberpunk, space odysseys & AI frontiers',
    ambientGlow: 'rgba(38, 110, 205, 0.28)',
    ambientSecondary: 'rgba(16, 48, 96, 0.14)',
    tmdbMovieGenres: [878],
    tmdbTvGenres: [10765],
    anilistGenres: ['Sci-Fi'],
    anilistTags: ['Cyberpunk'],
  },
  {
    id: 'fantasy-magical',
    name: 'Fantasy & Magical Worlds',
    description: 'Mythic realms, sorcery & otherworldly quests',
    ambientGlow: 'rgba(124, 64, 185, 0.28)',
    ambientSecondary: 'rgba(58, 26, 92, 0.14)',
    tmdbMovieGenres: [14],
    tmdbTvGenres: [10765],
    anilistGenres: ['Fantasy'],
    anilistTags: ['Isekai'],
  },
  {
    id: 'action-adventure',
    name: 'Action & Adventure',
    description: 'High-octane combat, relentless heroes & epic journeys',
    ambientGlow: 'rgba(195, 92, 38, 0.26)',
    ambientSecondary: 'rgba(92, 40, 14, 0.14)',
    tmdbMovieGenres: [28, 12],
    tmdbTvGenres: [10759],
    anilistGenres: ['Action'],
    anilistTags: ['Martial Arts'],
  },
  {
    id: 'psychological-thrillers',
    name: 'Psychological Thrillers',
    description: 'Mind games, fractured realities & high-stakes tension',
    ambientGlow: 'rgba(160, 42, 62, 0.26)',
    ambientSecondary: 'rgba(72, 18, 28, 0.14)',
    tmdbMovieGenres: [53],
    tmdbTvGenres: [9648, 80],
    anilistGenres: ['Psychological'],
    anilistTags: [],
  },
  {
    id: 'dark-supernatural',
    name: 'Dark & Supernatural',
    description: 'Occult mysteries, ancient curses & haunting folklore',
    ambientGlow: 'rgba(76, 58, 160, 0.28)',
    ambientSecondary: 'rgba(34, 24, 76, 0.14)',
    tmdbMovieGenres: [27],
    tmdbTvGenres: [9648],
    anilistGenres: ['Supernatural', 'Horror'],
    anilistTags: [],
  },
  {
    id: 'romance-relationships',
    name: 'Romance & Relationships',
    description: 'Heartstrings, fateful encounters & emotional bonds',
    ambientGlow: 'rgba(175, 58, 92, 0.26)',
    ambientSecondary: 'rgba(82, 24, 42, 0.14)',
    tmdbMovieGenres: [10749, 35],
    tmdbTvGenres: [18, 35],
    anilistGenres: ['Romance', 'Slice of Life'],
    anilistTags: [],
  },
];

export const VALID_NICHE_IDS = new Set(NICHE_CONFIGS.map((n) => n.id));
