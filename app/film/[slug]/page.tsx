import Image from "next/image";
import Link from "next/link";
import { notFound } from "next/navigation";
import { films, formatRuntime, getFilm } from "@/lib/films";

export function generateStaticParams() {
  return films.map((f) => ({ slug: f.slug }));
}

export default async function FilmPage({
  params,
}: {
  params: Promise<{ slug: string }>;
}) {
  const { slug } = await params;
  const film = getFilm(slug);
  if (!film) notFound();

  return (
    <div className="pb-20">
      <section className="relative h-[56vh] min-h-[400px] w-full overflow-hidden">
        <Image
          src={film.backdropUrl ?? film.posterUrl}
          alt=""
          fill
          priority
          className="object-cover object-top"
        />
        <div className="absolute inset-0 bg-gradient-to-t from-bark via-bark/50 to-transparent" />
      </section>

      <div className="mx-auto -mt-28 max-w-4xl px-6">
        <h1 className="relative font-display text-5xl font-semibold tracking-tight">
          {film.title}
        </h1>
        <p className="relative mt-2 text-sage">
          {film.year} · {film.category} · {formatRuntime(film.durationSeconds)}{" "}
          · {film.filmmaker}
        </p>

        <p className="relative mt-6 max-w-2xl text-lg leading-relaxed text-cream/85">
          {film.synopsis}
        </p>

        <div className="relative mt-8 flex items-center gap-4">
          <Link
            href={`/watch/${film.slug}`}
            className="rounded-full bg-amber px-8 py-3 font-medium text-bark transition-opacity hover:opacity-90"
          >
            ▶ Play
          </Link>
          {/* Cost preview before commitment — PLANNING.md §9 */}
          <span className="text-sm text-sage">
            Watching the full film uses ≈{" "}
            <span className="text-amber-soft">
              {formatRuntime(film.durationSeconds)}
            </span>{" "}
            of your time. Pausing is always free.
          </span>
        </div>
      </div>
    </div>
  );
}
