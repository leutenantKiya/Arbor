// Seeds the catalog: one demo filmmaker per film + film metadata.
// Usage: npm run db:seed   (run db:push first)
import { config as loadEnv } from 'dotenv';
import { neon } from "@neondatabase/serverless";
import { drizzle } from "drizzle-orm/neon-http";
import { films as catalog } from "../lib/films";
import { filmmakers, films } from "../lib/db/schema";

loadEnv({ path: '.env.local' });
loadEnv({ path: '.env' });

async function main() {
  const url = process.env.DATABASE_URL;
  if (!url) {
    console.error("DATABASE_URL not set — skipping seed. See .env.example.");
    process.exit(1);
  }
  const db = drizzle(neon(url));

  for (const film of catalog) {
    const [maker] = await db
      .insert(filmmakers)
      .values({
        name: film.filmmaker,
        // demo payout addresses — replaced with real ones before settlement demo
        walletAddress: "0x0000000000000000000000000000000000000000",
      })
      .returning();

    await db
      .insert(films)
      .values({
        slug: film.slug,
        title: film.title,
        synopsis: film.synopsis,
        category: film.category,
        year: film.year,
        durationSeconds: film.durationSeconds,
        videoUrl: film.videoUrl,
        posterUrl: film.posterUrl,
        filmmakerId: maker.id,
      })
      .onConflictDoNothing({ target: films.slug });

    console.log(`seeded: ${film.title}`);
  }

  console.log("done.");
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
