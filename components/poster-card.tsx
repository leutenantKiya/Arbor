import Image from "next/image";
import Link from "next/link";
import { formatRuntime, type Film } from "@/lib/films";

export function PosterCard({ film }: { film: Film }) {
  return (
    <Link
      href={`/film/${film.slug}`}
      className="group w-44 shrink-0 focus-visible:outline-2 focus-visible:outline-offset-4 focus-visible:outline-amber"
    >
      <div className="overflow-hidden rounded-card border border-line/50 bg-surface">
        <Image
          src={film.posterUrl}
          alt={`${film.title} poster`}
          width={352}
          height={528}
          className="aspect-[2/3] object-cover transition-transform duration-200 ease-out group-hover:scale-[1.03]"
        />
      </div>
      <div className="mt-2 px-0.5">
        <p className="font-medium text-cream">{film.title}</p>
        <p className="text-sm text-sage">
          {film.category} · {formatRuntime(film.durationSeconds)} of your time
        </p>
      </div>
    </Link>
  );
}
