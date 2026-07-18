"use client";

import Image from "next/image";
import Link from "next/link";
import { useEffect, useMemo, useRef, useState } from "react";
import { createPortal } from "react-dom";
import { formatRuntime, type Film } from "@/lib/films";

function SearchIcon({ className = "" }: { className?: string }) {
  return (
    <svg aria-hidden="true" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" className={className}>
      <circle cx="10.8" cy="10.8" r="6.4" />
      <path d="m16 16 4.2 4.2" />
    </svg>
  );
}

function CloseIcon({ className = "" }: { className?: string }) {
  return (
    <svg 
      aria-hidden="true" 
      viewBox="0 0 24 24" 
      fill="none" 
      stroke="currentColor" 
      strokeWidth="1.8" 
      className={className}
    >
      <path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" />
    </svg>
  );
}

function matchesFilm(film: Film, query: string) {
  return [film.title, film.synopsis, film.category, film.filmmaker, String(film.year)]
    .join(" ")
    .toLocaleLowerCase()
    .includes(query);
}

export function FilmSearch({ films }: { films: Film[] }) {
  const [isSearchMode, setIsSearchMode] = useState(false);
  const [query, setQuery] = useState("");
  const inputRef = useRef<HTMLInputElement>(null);
  const triggerRef = useRef<HTMLButtonElement>(null);
  const normalizedQuery = query.trim().toLocaleLowerCase();
  const results = useMemo(
    () => (normalizedQuery ? films.filter((film) => matchesFilm(film, normalizedQuery)) : films),
    [films, normalizedQuery],
  );

  const close = (restoreFocus = true) => {
    setIsSearchMode(false);
    setQuery("");
    if (restoreFocus) {
      requestAnimationFrame(() => triggerRef.current?.focus());
    }
  };

  useEffect(() => {
    if (!isSearchMode) return;

    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.key === "Escape") {
        event.preventDefault();
        close();
      }
    };
    const originalOverflow = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    inputRef.current?.focus();
    window.addEventListener("keydown", handleKeyDown);
    return () => {
      document.body.style.overflow = originalOverflow;
      window.removeEventListener("keydown", handleKeyDown);
    };
  }, [isSearchMode]);

  return (
    <>
      {!isSearchMode && (
        <button
          ref={triggerRef}
          type="button"
          onClick={() => setIsSearchMode(true)}
          className="flex h-10 w-full items-center gap-2 rounded-full border border-transparent px-3 text-sage transition-colors hover:border-line hover:bg-surface hover:text-cream focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-amber"
          aria-label="Search films"
          aria-haspopup="dialog"
        >
          <SearchIcon className="h-5 w-5" />
          <span className="font-mono text-xs tracking-wide">Search films</span>
        </button>
      )}

      {isSearchMode && typeof document !== "undefined" &&
        createPortal(
          <>
            <div
              aria-hidden="true"
              className="animate-backdrop-in fixed inset-0 z-[80] bg-bark/75 backdrop-blur-md"
              onPointerDown={() => close(false)}
            />

            <div className="pointer-events-none fixed inset-0 z-[90] flex items-center justify-center p-4 sm:p-6">
              <section
                role="dialog"
                aria-modal="true"
                aria-labelledby="film-search-title"
                className="pointer-events-auto animate-modal-in relative h-[76vh] w-full max-w-3xl overflow-hidden rounded-2xl border border-line bg-[#090a0d]/95 shadow-2xl shadow-black/60"
                onPointerDown={(event) => event.stopPropagation()}
              >
                <h2 id="film-search-title" className="sr-only">Search the film catalog</h2>
                <div className="absolute inset-x-0 top-0 z-10 flex h-[77px] items-center border-b border-line bg-[#090a0d]/95 px-5">
                  <SearchIcon className="h-6 w-6 shrink-0 text-amber" />
                  <input
                    ref={inputRef}
                    type="text"
                    value={query}
                    onChange={(event) => setQuery(event.target.value)}
                    placeholder="Search a title, genre, filmmaker, or year"
                    aria-label="Search films"
                    className="h-[76px] min-w-0 flex-1 bg-transparent px-4 text-lg text-cream outline-none placeholder:text-ink-faint sm:text-xl"
                  />
                  {query && (
                    <button
                      type="button"
                      onClick={() => setQuery("")}
                      className="ml-1 rounded-md p-2 text-sage transition-colors hover:bg-surface hover:text-cream focus-visible:outline-2 focus-visible:outline-amber"
                      aria-label="Clear search"
                    >
                      <CloseIcon className="h-5 w-5" />
                    </button>
                  )}
                  <button
                    type="button"
                    onClick={() => close()}
                    className="ml-2 hidden rounded-md border border-line px-2 py-1 font-mono text-[0.65rem] tracking-wide text-sage transition-colors hover:border-sage hover:text-cream focus-visible:outline-2 focus-visible:outline-amber lg:inline-flex"
                    aria-label="Close search"
                  >
                    ESC
                  </button>
                </div>

                <div className="h-full overflow-y-auto px-5 pb-5 pt-24 sm:px-7">
                  {!normalizedQuery && (
                    <div className="mb-5">
                      <p className="font-mono text-[0.68rem] uppercase tracking-[0.18em] text-ink-faint">Explore the catalog</p>
                      <div className="mt-3 flex flex-wrap gap-2">
                        {["Animation", "Sci-Fi", "Fantasy"].map((suggestion) => (
                          <button
                            key={suggestion}
                            type="button"
                            onClick={() => setQuery(suggestion)}
                            className="rounded-full border border-line px-3 py-1.5 text-sm text-sage transition-colors hover:border-amber/60 hover:text-amber"
                          >
                            {suggestion}
                          </button>
                        ))}
                      </div>
                    </div>
                  )}

                  <p className="mb-3 font-mono text-[0.68rem] uppercase tracking-[0.18em] text-ink-faint">
                    {normalizedQuery ? `${results.length} result${results.length === 1 ? "" : "s"}` : "All films"}
                  </p>

                  {results.length > 0 ? (
                    <div className="divide-y divide-line/70">
                      {results.map((film) => (
                        <Link
                          key={film.slug}
                          href={`/film/${film.slug}`}
                          onClick={() => close(false)}
                          className="group flex gap-4 py-3 first:pt-0 focus-visible:outline-2 focus-visible:outline-amber"
                        >
                          <Image
                            src={film.posterUrl}
                            alt=""
                            width={64}
                            height={96}
                            className="h-20 w-[53px] rounded-md object-cover transition-transform duration-200 group-hover:scale-[1.03]"
                          />
                          <div className="min-w-0 py-1">
                            <p className="font-display text-lg text-cream transition-colors group-hover:text-amber">{film.title}</p>
                            <p className="mt-1 text-sm text-sage">{film.year} <span aria-hidden="true">·</span> {film.category} <span aria-hidden="true">·</span> {formatRuntime(film.durationSeconds)}</p>
                            <p className="mt-1 line-clamp-1 text-sm text-ink-faint">{film.synopsis}</p>
                          </div>
                        </Link>
                      ))}
                    </div>
                  ) : (
                    <div className="flex min-h-[calc(76vh-116px)] items-center justify-center text-center">
                      <div>
                        <p className="font-display text-2xl font-bold text-cream">No films found</p>
                        <p className="mt-3 text-sm text-sage">Try a different title, genre, filmmaker, or year.</p>
                      </div>
                    </div>
                  )}
                </div>
              </section>
            </div>
          </>,
          document.body,
        )}
    </>
  );
}
