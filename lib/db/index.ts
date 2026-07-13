import { neon } from "@neondatabase/serverless";
import { drizzle } from "drizzle-orm/neon-http";
import * as schema from "./schema";

// neon-http: each query is a stateless HTTP call — no connection pooling
// failure mode on serverless (ARCHITECTURE.md §5).
export function getDb() {
  const url = process.env.DATABASE_URL;
  if (!url) {
    throw new Error("DATABASE_URL is not set — see .env.example");
  }
  return drizzle(neon(url), { schema });
}

export { schema };
