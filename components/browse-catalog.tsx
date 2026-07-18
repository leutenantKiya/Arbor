import { FilmCarousel } from "@/components/film-carousel";
import type { Film } from "@/lib/films";

const rows: { title: string; filter: (category: string) => boolean }[] = [
  { title: "Featured", filter: () => true },
  { title: "Animation", filter: (category) => category === "Animation" },
  { title: "Beyond the Festival", filter: (category) => category !== "Animation" },
];

export function BrowseCatalog({ films }: { films: Film[] }) {
  return (
    <div className="overflow-hidden bg-bark py-20 sm:py-24">
      <div className="mx-auto max-w-7xl space-y-16 px-6">
        <section aria-labelledby="browse-catalog-heading">
          <div className="flex items-end justify-between gap-4">
            <div>
              <p className="font-mono text-xs uppercase tracking-[0.18em] text-amber">Browse the catalog</p>
              <h2 id="browse-catalog-heading" className="mt-2 font-block text-4xl font-extrabold uppercase leading-none tracking-wide sm:text-5xl">
                Trending tonight
              </h2>
            </div>
            <p className="hidden font-mono text-[0.68rem] uppercase tracking-[0.1em] text-sage-light sm:block">
              Scroll to browse · {films.length} films
            </p>
          </div>
        </section>

        {rows.map((row) => {
          const items = films.filter((film) => row.filter(film.category));
          if (items.length === 0) return null;

          return (
            <section key={row.title}>
              <div className="mb-5 flex items-center gap-4">
                <h2 className="font-block text-2xl font-bold uppercase tracking-wide text-cream">{row.title}</h2>
                <span className="h-px flex-1 bg-line-soft" />
              </div>
              <FilmCarousel films={items} reverse={row.title === "Animation"} />
            </section>
          );
        })}
      </div>
    </div>
  );
}
