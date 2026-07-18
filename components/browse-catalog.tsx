import { PosterCard } from "@/components/poster-card";
import type { Film } from "@/lib/films";

const rows: { title: string; filter: (category: string) => boolean }[] = [
  { title: "Featured", filter: () => true },
  { title: "Animation", filter: (category) => category === "Animation" },
  { title: "Beyond the Festival", filter: (category) => category !== "Animation" },
];

export function BrowseCatalog({ films }: { films: Film[] }) {
  return (
    <div className="mx-auto max-w-7xl space-y-10 px-6 pt-10">
      <section aria-labelledby="browse-search-heading">
        <div className="flex items-end justify-between gap-4">
          <div>
            <p className="font-mono text-xs uppercase tracking-[0.18em] text-amber">
              Browse the catalog
            </p>
            <h2 id="browse-search-heading" className="mt-1 font-display text-2xl font-medium">
              Find your next film
            </h2>
          </div>
          <p className="text-sm text-sage">{films.length} films</p>
        </div>
      </section>

      {rows.map((row) => {
          const items = films.filter((film) => row.filter(film.category));
          if (items.length === 0) return null;

          return (
            <section key={row.title}>
              <h2 className="mb-4 font-display text-2xl font-medium">{row.title}</h2>
              <div className="row-scroll flex gap-4 overflow-x-auto pb-2">
                {items.map((film) => (
                  <PosterCard key={film.slug} film={film} />
                ))}
              </div>
            </section>
          );
        })}
    </div>
  );
}
