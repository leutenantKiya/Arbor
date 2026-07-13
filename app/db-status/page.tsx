import { getFilms } from '@/lib/db/queries';

export default async function DbStatusPage() {
  const films = await getFilms();

  return (
    <div className="mx-auto max-w-4xl px-6 py-24 text-cream">
      <div className="rounded-3xl border border-line/60 bg-surface p-12">
        <h1 className="text-4xl font-semibold">Database Status</h1>
        <p className="mt-4 text-sage">
          This page proves the app can query Neon Postgres successfully.
        </p>

        <div className="mt-10 space-y-4">
          <div className="rounded-2xl bg-bark/50 p-6">
            <p className="text-sm uppercase tracking-[0.24em] text-amber">Connection</p>
            <p className="mt-2 text-lg">Connected to Neon Postgres</p>
          </div>

          <div className="rounded-2xl bg-bark/50 p-6">
            <p className="text-sm uppercase tracking-[0.24em] text-amber">Films</p>
            <p className="mt-2 text-lg">{films.length} film{films.length === 1 ? '' : 's'} found in the database.</p>
          </div>

          <div className="rounded-2xl bg-bark/50 p-6">
            <p className="text-sm uppercase tracking-[0.24em] text-amber">Sample titles</p>
            <ul className="mt-2 list-disc pl-5 text-cream/85">
              {films.slice(0, 5).map((film) => (
                <li key={film.slug}>{film.title}</li>
              ))}
            </ul>
          </div>
        </div>
      </div>
    </div>
  );
}
