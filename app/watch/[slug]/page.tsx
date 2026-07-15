import Link from 'next/link';
import { notFound, redirect } from 'next/navigation';
import { getFilmBySlug } from '@/lib/db/queries';
import { getSession } from '@/lib/auth/server';
import { VideoPlayer } from '@/components/video-player';

// Metered playback requires a signed-in viewer, so this page is always
// rendered per-request (no generateStaticParams).
export default async function WatchPage({ params }: { params: Promise<{ slug: string }> }) {
  const session = await getSession();
  if (!session) redirect('/auth/sign-in');

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
      <VideoPlayer film={film} />
    </div>
  );
}