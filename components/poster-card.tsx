import Image from "next/image";
import Link from "next/link";
import { formatRuntime, type Film } from "@/lib/films";

export function PosterCard({ film }: { film: Film }) {
  return (
    <div
      className="group relative w-44 shrink-0 overflow-hidden rounded-card border border-line-soft bg-surface transition-colors hover:border-cream/30 sm:w-[220px]"
    >
      <Image
        src={film.posterUrl}
        alt={`${film.title} poster`}
        width={440}
        height={660}
        className="aspect-[2/3] w-full object-cover transition-transform duration-500 ease-out group-hover:scale-[1.06]"
      />
      <div className="absolute inset-0 bg-[linear-gradient(to_top,rgba(7,8,13,0.96)_0%,rgba(7,8,13,0.3)_48%,transparent_72%)]" />
      <Link
        href={`/film/${film.slug}`}
        className="poster-play-link absolute right-3 top-3 grid h-8 w-8 place-items-center rounded-full border border-cream/30 bg-bark/55 text-[0.6rem] text-cream opacity-0 backdrop-blur-sm transition-all duration-200 group-hover:scale-100 group-hover:opacity-100"
      >
        ▶
      </Link>
      <div className="absolute inset-x-0 bottom-0 p-4">
        <p className="font-block text-xl font-bold uppercase leading-[0.9] tracking-wide text-cream">{film.title}</p>
        <p className="mt-2 font-mono text-[0.6rem] uppercase tracking-[0.08em] text-cream/65">
          {film.category} · {formatRuntime(film.durationSeconds)}
        </p>
      </div>
    </div>
  );
}
