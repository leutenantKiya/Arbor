# Neon Postgres Integration

This project already uses Neon Postgres with Drizzle and the `@neondatabase/serverless` HTTP driver.

## What is already set up

- `lib/db/index.ts` creates a Drizzle database instance with `drizzle(neon(url), { schema })`.
- `drizzle.config.ts` uses `process.env.DATABASE_URL` for schema push.
- `package.json` already includes `@neondatabase/serverless`, `drizzle-orm`, and `drizzle-kit`.

## What you need to do

1. Install dependencies if you have not already:

   ```bash
   npm install @neondatabase/neon-js drizzle-orm @neondatabase/serverless
   npm install -D drizzle-kit
   ```

2. Create a local env file from the sample:

   ```bash
   cp .env.example .env.local
   ```

3. Fill in your Neon connection string in `.env.local`:

   ```env
   DATABASE_URL="postgresql://neondb_owner:npg_1dcqZCu6PaOg@ep-divine-lab-aoefk7jo.c-2.ap-southeast-1.aws.neon.tech/neondb?sslmode=require"
   ```

4. Keep these additional Neon variables only if you want Neon Auth integration or Vercel auth middleware.
   The current codebase does not require them for `@neondatabase/serverless` to work.

   ```env
   NEON_AUTH_BASE_URL="https://ep-xxx.neonauth.c-7.us-east-1.aws.neon.tech/neondb/auth"
   NEON_AUTH_COOKIE_SECRET="replace-with-32-char-random-secret"
   ```

   Note: the project now loads `.env.local` and `.env` automatically from `lib/db/index.ts`, so scripts like `npx tsx scripts/check-db.ts` will also find `DATABASE_URL`.

5. Set the app-specific env values:

   - `AUTH_SECRET` — session signing secret
   - `NEXT_PUBLIC_PARTICLE_PROJECT_ID`
   - `NEXT_PUBLIC_PARTICLE_CLIENT_KEY`
   - `NEXT_PUBLIC_PARTICLE_APP_ID`
   - `NEXT_PUBLIC_CHAIN`
   - `NEXT_PUBLIC_ARBORVAULT_ADDRESS`
   - `NEXT_PUBLIC_USDC_ADDRESS`
   - `SETTLEMENT_PRIVATE_KEY`

## Run the database setup

- Create/update the schema:

  ```bash
  npm run db:push
  ```

- Seed initial data if needed:

  ```bash
  npm run db:seed
  ```

## Notes

- Use the direct connection string from Neon as `DATABASE_URL`.
- The `@neondatabase/serverless` driver does not need a connection pooler host in your code; Neon handles that transparently.
- The pooler host in Neon’s dashboard is optional for client-side connection pooling scenarios, but this repo uses the HTTP driver.
- If you want to use Neon Auth later, add `NEON_AUTH_BASE_URL` and `NEON_AUTH_COOKIE_SECRET`.

## References

- `lib/db/index.ts`
- `drizzle.config.ts`
- `.env.example`
