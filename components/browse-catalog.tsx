"use client";

import { useMemo, useState } from "react";
import { PosterCard } from "@/components/poster-card";
import type { Film } from "@/lib/films";

const rows: { title: string; filter: (category: string) => boolean }[] = [
  { title: "Featured", filter: () => true },
  { title: "Animation", filter: (category) => category === "Animation" },
  { title: "Beyond the Festival", filter: (category) => category !== "Animation" },
];

function matchesFilm(film: Film, query: string) {
  const searchable = [
    film.title,
    film.synopsis,
    film.category,
    film.filmmaker,
    String(film.year),
  ]
    .join(" ")
    .toLocaleLowerCase();

  return searchable.includes(query);
}

export function BrowseCatalog({ films }: { films: Film[] }) {
  const [query, setQuery] = useState("");
  const normalizedQuery = query.trim().toLocaleLowerCase();
  const results = useMemo(
    () =>
      normalizedQuery
        ? films.filter((film) => matchesFilm(film, normalizedQuery))
        : films,
    [films, normalizedQuery],
  );

  return (
    <div className="mx-auto max-w-7xl space-y-10 px-6 pt-10">
      <section aria-labelledby="browse-search-heading">
        <div className="flex flex-col gap-3 sm:flex-row sm:items-end sm:justify-between">
          <div>
            <p className="font-mono text-xs uppercase tracking-[0.18em] text-amber">
              Browse the catalog
            </p>
            <h2 id="browse-search-heading" className="mt-1 font-display text-2xl font-medium">
              Find your next film
            </h2>
          </div>
          <p className="text-sm text-sage">
            {normalizedQuery ? `${results.length} result${results.length === 1 ? "" : "s"}` : `${films.length} films`}
          </p>
        </div>

        <div className="relative mt-4 max-w-2xl">
          <svg
            aria-hidden="true"
            viewBox="0 0 24 24"
            className="pointer-events-none absolute left-4 top-1/2 h-5 w-5 -translate-y-1/2 text-sage"
            fill="none"
            stroke="currentColor"
            strokeWidth="2"
          >
            <circle cx="11" cy="11" r="6" />
            <path d="m16 16 4 4" />
          </svg>
          <input
            type="search"
            value={query}
            onChange={(event) => setQuery(event.target.value)}
            placeholder="Search by title, genre, filmmaker, or year"
            aria-label="Search films"
            className="w-full rounded-xl border border-line bg-surface py-3 pl-12 pr-12 text-cream outline-none transition-colors placeholder:text-ink-faint focus:border-amber focus:ring-2 focus:ring-amber/20"
          />
          {query && (
            <button
              type="button"
              onClick={() => setQuery("")}
              className="absolute right-3 top-1/2 -translate-y-1/2 rounded-md px-2 py-1 text-sm text-sage transition-colors hover:bg-bark hover:text-cream focus-visible:outline-2 focus-visible:outline-amber"
              aria-label="Clear search"
            >
              Clear
            </button>
          )}
        </div>
      </section>

      {normalizedQuery ? (
        <section aria-live="polite">
          <h2 className="mb-4 font-display text-2xl font-medium">
            Results for <span className="text-amber">&ldquo;{query.trim()}&rdquo;</span>
          </h2>
          {results.length > 0 ? (
            <div className="grid grid-cols-2 gap-x-4 gap-y-7 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-6">
              {results.map((film) => (
                <PosterCard key={film.slug} film={film} />
              ))}
            </div>
          ) : (
            <div className="rounded-xl border border-line/60 bg-surface p-8 text-center">
              <p className="text-lg font-medium text-cream">No films match that search.</p>
              <p className="mt-2 text-sm text-sage">Try a title, genre, filmmaker, or release year.</p>
            </div>
          )}
        </section>
      ) : (
        rows.map((row) => {
          const items = films.filter((film) => row.filter(film.category));
          if (items.length === 0) return null;

          return (
            <section key={row.title}>
              <h2 className="mb-4 font-display text-2xl font-medium">{row.title}</h2>
              <div className="row-scroll flex gap-4 overflow-x-auto pb-2">
                {items.map((film) => (
                  <PosterCard key={film.slug} film={film} />
                ))}
              </div>
            </section>
          );
        })
      )}
    </div>
  );
}
