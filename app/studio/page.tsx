import { getSession } from "@/lib/auth/server";
import {
  getFilmEarnings,
  getFilmmakerBalances,
  isUserFilmmaker,
} from "@/lib/db/queries";
import { ensureFilmmakerRecord } from "@/lib/services/filmmaker.service";
import { CreatorApplicationView } from "@/components/creator-application-view";
import { FilmmakerDashboard } from "@/components/filmmaker-dashboard";

// The Studio page switches between two views based on users.is_filmmaker:
//   - "1" → FilmmakerDashboard, scoped entirely to this filmmaker's own data.
//           The underlying filmmakers row is auto-provisioned on first visit
//           (lib/services/filmmaker.service.ts) — idempotent, so refreshing
//           never creates a duplicate.
//   - otherwise → CreatorApplicationView (site-wide earnings overview + Apply
//           as Creator), unchanged from before.
export default async function StudioPage() {
  const session = await getSession();
  const isFilmmaker = session ? await isUserFilmmaker(session.userId) : false;

  if (isFilmmaker && session) {
    const filmmakerId = await ensureFilmmakerRecord(session.userId, {
      walletAddress: session.walletAddress,
      name: session.name,
      email: session.email,
    });

    return (
      <FilmmakerDashboard
        filmmakerId={filmmakerId}
        displayName={session.name || session.email || "Filmmaker"}
        walletAddress={session.walletAddress ?? null}
      />
    );
  }

  const [earnings, filmmakerBalances] = await Promise.all([
    getFilmEarnings(),
    getFilmmakerBalances(),
  ]);

  return (
    <CreatorApplicationView
      earnings={earnings}
      filmmakerBalances={filmmakerBalances}
    />
  );
}
