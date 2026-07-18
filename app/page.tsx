import Image from 'next/image';
import Link from 'next/link';
import { BrowseCatalog } from '@/components/browse-catalog';
import { formatRuntime } from '@/lib/films';
import { getFilms } from '@/lib/db/queries';

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

  return (
    <div className="pb-20">
      {/* Hero */}
      <section className="relative h-[72vh] min-h-[480px] w-full overflow-hidden">
        <Image
          src={hero.backdropUrl ?? hero.posterUrl}
          alt=""
          fill
          priority
          className="object-cover"
        />
        <div className="absolute inset-0 bg-gradient-to-t from-bark via-bark/60 to-bark/10" />
        <div className="absolute inset-0 bg-gradient-to-r from-bark/80 to-transparent" />

        <div className="absolute inset-x-0 bottom-0 mx-auto max-w-7xl px-6 pb-16">
          <p className="mb-2 text-sm uppercase tracking-widest text-amber">
            Featured
          </p>
          <h1 className="font-display text-5xl font-semibold tracking-tight md:text-6xl">
            {hero.title}
          </h1>
          <p className="mt-4 max-w-xl text-lg text-cream/85">{hero.synopsis}</p>
          <div className="mt-6 flex items-center gap-4">
            <Link
              href={`/watch/${hero.slug}`}
              className="rounded-full bg-amber px-6 py-2.5 font-medium text-bark transition-opacity hover:opacity-90"
            >
              ▶ Play
            </Link>
            <Link
              href={`/film/${hero.slug}`}
              className="rounded-full border border-cream/30 px-6 py-2.5 font-medium text-cream transition-colors hover:border-cream/60"
            >
              More info
            </Link>
            <span className="text-sm text-sage">
              {formatRuntime(hero.durationSeconds)} of your time
            </span>
          </div>
        </div>
      </section>

      <BrowseCatalog films={films} />
    </div>
  );
}
