// Seed catalog — Blender Foundation open movies (CC-BY licensed).
// Posters self-hosted in /public/posters (sourced from Wikimedia Commons, CC).
// Video streams from Blender's CDN + archive.org during development;
// production media moves to Cloudflare R2 (ARCHITECTURE.md §6).
// NOTE: Google's gtv-videos-bucket sample bucket now returns 403 — do not use.

export type Film = {
  slug: string;
  title: string;
  synopsis: string;
  durationSeconds: number;
  category: "Animation" | "Sci-Fi" | "Fantasy";
  year: number;
  filmmaker: string;
  videoUrl: string;
  posterUrl: string;
  /** landscape still for hero/backdrop use; falls back to posterUrl */
  backdropUrl?: string;
};

export const films: Film[] = [
  {
    slug: "sintel",
    title: "Sintel",
    synopsis:
      "A lonely young woman crosses glaciers, war camps, and ruined cities in search of the dragon she once rescued and raised — only to learn what the search has cost her.",
    durationSeconds: 888,
    category: "Fantasy",
    year: 2010,
    filmmaker: "Colin Levy — Blender Foundation",
    videoUrl:
      "https://archive.org/download/Sintel/sintel-2048-stereo_512kb.mp4",
    posterUrl: "/posters/sintel.jpg",
    backdropUrl: "/posters/sintel-backdrop.jpg",
  },
  {
    slug: "tears-of-steel",
    title: "Tears of Steel",
    synopsis:
      "Forty years after a robot uprising began with a broken heart, a group of scientists in Amsterdam stage a desperate re-enactment of the past to rewrite the future.",
    durationSeconds: 734,
    category: "Sci-Fi",
    year: 2012,
    filmmaker: "Ian Hubert — Blender Foundation",
    videoUrl:
      "https://download.blender.org/demo/movies/ToS/tears_of_steel_720p.mov",
    posterUrl: "/posters/tears-of-steel.png",
  },
  {
    slug: "big-buck-bunny",
    title: "Big Buck Bunny",
    synopsis:
      "A gentle giant of a rabbit wakes to a beautiful morning — until three bullying rodents pick the wrong woodland creature to torment. Slapstick vengeance, beautifully rendered.",
    durationSeconds: 596,
    category: "Animation",
    year: 2008,
    filmmaker: "Sacha Goedegebure — Blender Foundation",
    videoUrl:
      "https://download.blender.org/peach/bigbuckbunny_movies/BigBuckBunny_640x360.m4v",
    posterUrl: "/posters/big-buck-bunny.jpg",
  },
  {
    slug: "elephants-dream",
    title: "Elephants Dream",
    synopsis:
      "Two travelers explore a vast, surreal machine — one sees wonder, the other sees only what he is told to see. The first open movie ever made.",
    durationSeconds: 653,
    category: "Animation",
    year: 2006,
    filmmaker: "Bassam Kurdali — Orange Open Movie Project",
    videoUrl: "https://archive.org/download/ElephantsDream/ed_1024_512kb.mp4",
    posterUrl: "/posters/elephants-dream.jpg",
  },
];

export function getFilm(slug: string): Film | undefined {
  return films.find((f) => f.slug === slug);
}

export function formatRuntime(seconds: number): string {
  const m = Math.round(seconds / 60);
  return `${m} min`;
}
