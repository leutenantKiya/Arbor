import Link from "next/link";
import { notFound } from "next/navigation";
import { films, getFilm } from "@/lib/films";

export function generateStaticParams() {
  return films.map((f) => ({ slug: f.slug }));
}

// Day-1 shell: native controls, no metering yet.
// Day 3 replaces this with the custom player + heartbeat loop + calm gauge.
export default async function WatchPage({
  params,
}: {
  params: Promise<{ slug: string }>;
}) {
  const { slug } = await params;
  const film = getFilm(slug);
  if (!film) notFound();

  return (
    <div className="fixed inset-0 z-40 flex flex-col bg-black">
      <div className="flex h-14 items-center px-4">
        <Link
          href={`/film/${film.slug}`}
          className="rounded-full px-3 py-1.5 text-sm text-sage transition-colors hover:text-cream"
        >
          ← {film.title}
        </Link>
      </div>
      <video
        src={film.videoUrl}
        poster={film.posterUrl}
        controls
        autoPlay
        className="min-h-0 flex-1 object-contain"
      />
    </div>
  );
}
