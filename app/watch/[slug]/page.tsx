import Link from 'next/link';
import { notFound } from 'next/navigation';
import { getFilmBySlug, getFilms } from '@/lib/db/queries';

export async function generateStaticParams() {
  const films = await getFilms();
  return films.map((film) => ({ slug: film.slug }));
}

// Day-1 shell: native controls, no metering yet.
// Day 3 replaces this with the custom player + heartbeat loop + calm gauge.
export default async function WatchPage({ params }: { params: Promise<{ slug: string }> }) {
  const { slug } = await params;
  const film = await getFilmBySlug(slug);
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
