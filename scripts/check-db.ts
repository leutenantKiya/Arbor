import { getDb } from '../lib/db/index';
import { sql } from 'drizzle-orm';

async function main() {
  const db = getDb();
  const result = await db.execute(sql`select 1 as ok`);
  console.log(result);
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
