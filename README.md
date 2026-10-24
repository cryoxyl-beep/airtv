# 🎬 Miyoro

> **Watch. Whatever. You Want.**

[![Live Demo](https://img.shields.io/badge/Demo-miyoro.vercel.app-E50914?style=for-the-badge&logo=vercel&logoColor=white)](https://miyoro.vercel.app)
[![React 19](https://img.shields.io/badge/React%2019-20232A?style=for-the-badge&logo=react&logoColor=61DAFB)](#-tech-stack)
[![TypeScript](https://img.shields.io/badge/TypeScript%205.8-3178C6?style=for-the-badge&logo=typescript&logoColor=white)](#-tech-stack)
[![Tailwind CSS v4](https://img.shields.io/badge/Tailwind_CSS-38B2AC?style=for-the-badge&logo=tailwind-css&logoColor=white)](#-tech-stack)
[![Vite](https://img.shields.io/badge/Vite%206-646CFF?style=for-the-badge&logo=vite&logoColor=white)](#-tech-stack)

---

## 🌐 Live Application
Experience Miyoro directly in production:  
👉 **[https://miyoro.vercel.app](https://miyoro.vercel.app)**

---

## 📖 Description

**Miyoro** is a modern, ultra-responsive streaming and media discovery web application built for movie lovers, series bingers, and anime enthusiasts. Designed with a sleek dark aesthetic and smooth micro-interactions, Miyoro seamlessly unifies cinematic content from multiple global sources into a single fluid experience.

Featuring real-time catalog sync with **The Movie Database (TMDB)** and the **AniList GraphQL API**, Miyoro bridges the gap between western cinema and anime using an intelligent cross-ID mapping layer (Fribb). From instant universal search (`⌘K` / `Ctrl+K`) to responsive drag-scroll carousels, genre-specific explorations, platform filtering, and dedicated video playback views with season and episode selectors, Miyoro delivers an effortless entertainment experience.

### 🏷️ Description Tags
`#streaming` `#movies` `#tv-series` `#anime` `#tmdb` `#anilist` `#video-player` `#cinematic-ui` `#entertainment` `#media-platform` `#responsive-design` `#react19` `#typescript` `#vite` `#tailwind-css` `#framer-motion`

---

## 🖼️ Interface Previews & Walkthrough

### 1. Landing Gateway (`/`)
The entry gate to Miyoro featuring an animated, cinematic floating poster wall displaying trending cinema and anime titles. Includes brand messaging, seamless Google Authentication, and instant one-click Guest access.

![Miyoro Landing Page](1.png)

---

### 2. Main Feed & Hero Spotlight (`/home`)
The primary browse feed welcomes users with a dynamic full-bleed Hero Billboard highlighting trending movies, anime, and series. Features direct playback triggers, rich info overlays, a live thumbnail carousel selector, quick interaction controls (favorite, bookmark, watchlist), and a quick-action top navbar with universal `⌘K` search.

![Miyoro Home Spotlight](2.png)

---

### 3. Trending Rails & Curated Content (Continuation of `/home`)
Continuing down the home feed, users encounter high-impact numbered Top 10 countdown carousels followed by curated recommendation rails. Every card is rendered with official title logos, backdrop artwork, and smooth drag-to-scroll navigation with optimized vertical rhythm.

![Miyoro Home Content Rows](3.png)

---

## 🚀 Key Features

- **🌟 Dynamic Hero Banner & Cinematic Wall**: Curated billboard spotlighting top trending releases with direct trailer and playback entry points.
- **🎌 Dual Cinema & Anime Ecosystem**:
  - Live TMDB integration for trending movies, top 10 rankings, and genre classifications.
  - Live AniList GraphQL integration for seasonal, popular, and trending anime releases.
  - Automatic Fribb Cross-Mapping to match AniList IDs with TMDB/TVDB backdrops, titles, and episode metadata.
- **⚡ Instant Quick-Search (`⌘K` / `Ctrl+K`)**: Fast universal search overlay supporting real-time filtering across movies, TV shows, and anime.
- **📺 Dedicated Watch & Player Views**:
  - Rich media detail pages including synopsis, ratings, trailers, cast info, and similar recommendations.
  - Interactive season/episode selector with multi-provider video player embed capabilities.
- **🏷️ Browse by Platform**: Quick-filter content catalog by favorite platforms (Netflix, Prime Video, Disney+, Apple TV+, Crunchyroll, HBO Max, and more).
- **🔒 Flexible Authentication**: Seamless sign-in powered by Firebase Authentication with Google Sign-In and one-click Guest access.
- **🎨 Modern Dark UI / UX**: Compact vertical rhythm, buttery-smooth drag-to-scroll carousels, backdrop logo overlays, and responsive mobile-first layouts.

---

## 🛠️ Tech Stack & Badges

### Core Technologies
| Category | Technologies | Badges / Tags |
| :--- | :--- | :--- |
| **Framework & UI** | React 19, TypeScript | `![React](https://img.shields.io/badge/React%2019-20232A?style=flat-square&logo=react&logoColor=61DAFB)` `![TypeScript](https://img.shields.io/badge/TypeScript-3178C6?style=flat-square&logo=typescript&logoColor=white)` |
| **Styling & Motion** | Tailwind CSS v4, Motion (Framer Motion) | `![Tailwind](https://img.shields.io/badge/Tailwind_CSS_v4-38B2AC?style=flat-square&logo=tailwind-css&logoColor=white)` `![Motion](https://img.shields.io/badge/Motion-0055FF?style=flat-square&logo=framer&logoColor=white)` |
| **Build & Bundler** | Vite 6 | `![Vite](https://img.shields.io/badge/Vite-646CFF?style=flat-square&logo=vite&logoColor=white)` |
| **Icons** | Lucide React | `![Lucide](https://img.shields.io/badge/Lucide_Icons-F56565?style=flat-square&logo=feather&logoColor=white)` |
| **Authentication & DB**| Firebase Auth, Firestore | `![Firebase](https://img.shields.io/badge/Firebase-FFCA28?style=flat-square&logo=firebase&logoColor=black)` |
| **Media Metadata** | TMDB API, AniList GraphQL, Fribb Mappings | `![TMDB](https://img.shields.io/badge/TMDB_API-01B4E4?style=flat-square&logo=themoviedatabase&logoColor=white)` `![AniList](https://img.shields.io/badge/AniList_GraphQL-02A9FF?style=flat-square&logo=anilist&logoColor=white)` |

### Tech Stack Tags
```text
[React 19] [TypeScript] [Vite] [Tailwind CSS v4] [Motion] [Lucide Icons] [Firebase] [TMDB API] [AniList API] [Fribb Anime Database] [Express]
```

---

## 📂 Project Structure

```text
├── public/                  # Static assets and media files
├── 1.png                    # Landing page preview
├── 2.png                    # Home spotlight preview
├── 3.png                    # Home content rails preview
├── src/
│   ├── api/                 # API connectors & resolvers
│   │   ├── anilist.ts       # AniList GraphQL queries, queue & Fribb normalization
│   │   └── tmdb.ts          # TMDB v3 API endpoints, genres & logo resolvers
│   ├── components/          # Reusable UI components
│   │   ├── Hero.tsx         # Spotlight billboard carousel
│   │   ├── Navbar.tsx       # Navigation, quick-search trigger & profile controls
│   │   ├── PlatformRow.tsx  # Platform-specific streaming provider rail
│   │   └── Row.tsx          # Horizontal swipeable/draggable content carousels
│   ├── contexts/            # React context providers (AuthContext, etc.)
│   ├── hooks/               # Custom hooks (scroll restoration, debounce, etc.)
│   ├── pages/               # Application view routes
│   │   ├── Landing.tsx      # Welcome screen with animated poster wall & auth
│   │   ├── Home.tsx         # Primary browse feed (trending, top 10, genres)
│   │   ├── WatchPage.tsx    # Media detail hub, cast, trailers & episodes
│   │   ├── PlayerPage.tsx   # Immersive media player view
│   │   ├── BrowsePage.tsx   # Platform & category explorer
│   │   └── SearchPage.tsx   # Full-page search view
│   ├── App.tsx              # Router configuration and global keyboard shortcuts
│   ├── index.css            # Tailwind CSS styling and custom animation directives
│   └── main.tsx             # React application entry point
├── package.json             # Scripts and project dependencies
├── tsconfig.json            # TypeScript configuration
└── vite.config.ts           # Vite development and build configuration
```

---

## 💻 Getting Started Locally

### Prerequisites
- Node.js (version 18+ recommended)
- npm or pnpm or yarn

### 1. Clone the repository
```bash
git clone https://github.com/your-username/miyoro.git
cd miyoro
```

### 2. Install dependencies
```bash
npm install
```

### 3. Environment Configuration
Create a `.env` file in the root directory and supply your TMDB API read access token (or key) if desired:
```env
VITE_TMDB_ACCESS_TOKEN=your_tmdb_bearer_token_here
```

### 4. Run development server
```bash
npm run dev
```
Open your browser at `http://localhost:3000` to start exploring.

### 5. Build for production
```bash
npm run build
npm run preview
```

---

## 🌐 API Attribution & Credits

- **[The Movie Database (TMDB)](https://www.themoviedb.org/)**: Movie and TV metadata, backdrops, cast info, and official platform logos.
- **[AniList](https://anilist.co/)**: Comprehensive Anime database and GraphQL API.
- **[Fribb Anime Lists](https://github.com/Fribb/anime-lists)**: Anime-to-TMDB/TVDB cross-reference database for unified metadata.

---

## 📄 License
This project is open-source and available under the [MIT License](LICENSE).
