import { desc, eq } from "drizzle-orm";
import { redirect } from "next/navigation";
import { FilmmakerSettings } from "@/components/filmmaker-settings";
import { StudioShell } from "@/components/studio-shell";
import { getSession } from "@/lib/auth/server";
import { db } from "@/lib/db/client";
import { accounts, applications, filmmakers, users } from "@/lib/db/schema";
import { getFilms, isUserFilmmaker } from "@/lib/db/queries";
import { ensureFilmmakerRecord } from "@/lib/services/filmmaker.service";

export default async function StudioSettingsPage() {
  const session = await getSession();
  if (!session?.userId || !(await isUserFilmmaker(session.userId))) {
    redirect("/studio");
  }

  await ensureFilmmakerRecord(session.userId, {
    walletAddress: session.walletAddress,
    name: session.name,
    email: session.email,
  });

  const [filmmaker, application, account, films] = await Promise.all([
    db
      .select({
        name: filmmakers.name,
        walletAddress: filmmakers.walletAddress,
        bio: filmmakers.bio,
        country: filmmakers.country,
        genre: filmmakers.genre,
      })
      .from(filmmakers)
      .where(eq(filmmakers.userId, session.userId))
      .limit(1)
      .then(([row]) => row),
    db
      .select({
        portfolioLinks: applications.portfolioLinks,
        previousFilmsLink: applications.previousFilmsLink,
        previousAwardsLink: applications.previousAwardsLink,
        coOwnerFullName: applications.coOwnerFullName,
      })
      .from(applications)
      .where(eq(applications.userId, session.userId))
      .orderBy(desc(applications.createdAt))
      .limit(1)
      .then(([row]) => row),
    db
      .select({ email: accounts.email })
      .from(users)
      .leftJoin(accounts, eq(users.accountId, accounts.id))
      .where(eq(users.id, session.userId))
      .limit(1)
      .then(([row]) => row),
    getFilms().catch(() => []),
  ]);

  if (!filmmaker) redirect("/studio");

  return (
    <StudioShell
      displayName={filmmaker.name || session.name || session.email || "Filmmaker"}
      walletAddress={filmmaker.walletAddress || null}
      usdcBalance={null}
      films={films}
    >
      <div className="mx-auto max-w-4xl px-6 pb-16 pt-8 sm:px-8">
        <p className="animate-rise text-sm uppercase tracking-widest text-fern">Filmmaker Studio</p>
        <h1 className="mt-1 animate-rise font-display text-3xl font-semibold tracking-tight sm:text-4xl" style={{ animationDelay: "0.05s" }}>
          Settings
        </h1>
        <p className="mt-2 animate-rise text-sage" style={{ animationDelay: "0.08s" }}>
          Manage the details displayed on your filmmaker profile.
        </p>

        <div className="mt-8 animate-rise" style={{ animationDelay: "0.12s" }}>
          <FilmmakerSettings
            initialValues={{
              fullName: filmmaker.name,
              email: account?.email ?? session.email ?? "",
              country: filmmaker.country ?? "",
              shortBio: filmmaker.bio ?? "",
              preferredGenres: filmmaker.genre ?? "",
              walletAddress: filmmaker.walletAddress,
              portfolioLinks: application?.portfolioLinks ?? "",
              previousFilmsLink: application?.previousFilmsLink ?? "",
              previousAwardsLink: application?.previousAwardsLink ?? "",
              coOwnerFullName: application?.coOwnerFullName ?? "",
            }}
          />
        </div>
      </div>
    </StudioShell>
  );
}
