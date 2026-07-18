import Image from "next/image";
import Link from "next/link";
import { BrowseCatalog } from "@/components/browse-catalog";
import { formatRuntime } from "@/lib/films";
import { getFilms } from "@/lib/db/queries";

export default async function HomePage() {
  const films = await getFilms();
  if (films.length === 0) {
    return (
      <div className="pb-20">
        <div className="mx-auto max-w-7xl px-6 pt-28">
          <div className="rounded-3xl border border-line/60 bg-surface p-12 text-center text-cream">
            <h1 className="text-3xl font-semibold">No films were found in the database.</h1>
            <p className="mt-4 text-sage">
              The Neon Postgres connection is active, but the catalog is empty.
              Run <code className="rounded bg-bark/70 px-2 py-1 text-sm">npm run db:seed</code> and refresh.
            </p>
          </div>
        </div>
      </div>
    );
  }

  const hero = films[0];
  const categoryCount = new Set(films.map((film) => film.category)).size;

  return (
    <div>
      <section className="relative -mt-16 flex min-h-[100svh] w-full items-center overflow-hidden">
        <Image
          src={hero.backdropUrl ?? hero.posterUrl}
          alt=""
          fill
          priority
          className="scale-105 object-cover opacity-60"
        />
        <div className="absolute inset-0 bg-[linear-gradient(100deg,rgba(7,8,13,0.94)_3%,rgba(7,8,13,0.7)_48%,rgba(7,8,13,0.38)_100%)]" />
        <div className="browse-hero-grain" aria-hidden="true" />
        <div className="absolute inset-0 bg-gradient-to-t from-bark via-bark/40 to-transparent" />

        <div className="relative z-10 mx-auto w-full max-w-7xl px-6 pb-40 pt-32 sm:pt-40">
          <div className="max-w-3xl">
            <div className="mb-5 flex items-center gap-3 font-mono text-[0.7rem] uppercase tracking-[0.16em]">
              <span className="text-amber">Now screening</span>
              <span className="text-cream/35">•</span>
              <span className="text-cream/65">Featured film</span>
            </div>
            <h1 className="font-block text-6xl font-extrabold uppercase leading-[0.84] tracking-[0.015em] sm:text-7xl md:text-8xl lg:text-9xl">
              {hero.title}
            </h1>
            <p className="mt-6 max-w-xl font-display text-lg leading-relaxed text-cream/75 sm:text-xl">{hero.synopsis}</p>
            <div className="mt-8 flex flex-wrap items-center gap-x-6 gap-y-4">
              <Link
                href={`/watch/${hero.slug}`}
                className="inline-flex items-center gap-3 rounded-full bg-gradient-to-r from-amber to-amber-2 px-7 py-4 font-mono text-xs font-medium uppercase tracking-[0.08em] text-bark shadow-[0_12px_30px_-10px_rgba(242,169,59,0.8)] transition-transform hover:-translate-y-0.5"
              >
                <span className="text-sm">▶</span> Start watching
              </Link>
              <Link
                href={`/film/${hero.slug}`}
                className="inline-flex items-center gap-3 font-mono text-xs uppercase tracking-[0.08em] text-cream/65 transition-colors hover:text-cream"
              >
                <span className="grid h-9 w-9 place-items-center rounded-full border border-cream/25 text-[0.6rem]">▶</span>
                More about this film
              </Link>
              <span className="font-mono text-[0.68rem] uppercase tracking-[0.1em] text-cream/45">
                {hero.year} · {formatRuntime(hero.durationSeconds)} to watch
              </span>
            </div>
          </div>
        </div>

        <div className="absolute inset-x-0 bottom-0 z-10 grid grid-cols-1 border-t border-cream/15 bg-bark/30 backdrop-blur-[2px] sm:grid-cols-3">
          <div className="browse-stat"><span className="browse-stat-value">{films.length}</span><span className="browse-stat-label">Films in the catalog</span></div>
          <div className="browse-stat"><span className="browse-stat-value">{categoryCount}</span><span className="browse-stat-label">Genres to explore</span></div>
          <div className="browse-stat"><span className="browse-stat-value">1:1</span><span className="browse-stat-label">Pay only while watching</span></div>
        </div>
      </section>

      <BrowseCatalog films={films} />
    </div>
  );
}
