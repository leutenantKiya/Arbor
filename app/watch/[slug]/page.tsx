import Link from 'next/link';
import { notFound } from 'next/navigation';
import { getFilmBySlug } from '@/lib/db/queries';
import { getSession } from '@/lib/auth/server';
import { VideoPlayer } from '@/components/video-player';
import { WatchSignInGate } from '@/components/watch-sign-in-gate';

// Metered playback requires a signed-in viewer, so this page is always
// rendered per-request (no generateStaticParams).
export default async function WatchPage({ params }: { params: Promise<{ slug: string }> }) {
  const { slug } = await params;
  const session = await getSession();
  const film = await getFilmBySlug(slug);
  if (!film) notFound();

  // Signed-out: show a warning + 5s countdown that then sends the user to a
  // CLEAN home URL (no query string — a query breaks Google OAuth, see §9).
  // This route itself is query-free, so the user can also just sign in via the
  // nav right here; the gate cancels its countdown and re-renders to the player.
  if (!session) return <WatchSignInGate filmTitle={film.title} />;

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