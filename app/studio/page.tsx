import { getSession } from "@/lib/auth/server";
import {
  getFilmEarnings,
  getFilmmakerBalances,
  isUserFilmmaker,
} from "@/lib/db/queries";
import { CreatorApplicationView } from "@/components/creator-application-view";
import { FilmmakerDashboard } from "@/components/filmmaker-dashboard";

// The Studio page switches between two views based on users.is_filmmaker:
//   - "1" → FilmmakerDashboard (a real filmmaker's overview)
//   - otherwise → CreatorApplicationView (earnings overview + Apply as Creator)
// Both views share the same underlying data fetches (lib/db/queries.ts) so the
// query logic exists in exactly one place.
export default async function StudioPage() {
  const session = await getSession();

  const [earnings, filmmakerBalances, isFilmmaker] = await Promise.all([
    getFilmEarnings(),
    getFilmmakerBalances(),
    session ? isUserFilmmaker(session.userId) : Promise.resolve(false),
  ]);

  if (isFilmmaker) {
    return (
      <FilmmakerDashboard
        displayName={session?.name || session?.email || "Filmmaker"}
        walletAddress={session?.walletAddress ?? null}
        earnings={earnings}
        filmmakerBalances={filmmakerBalances}
      />
    );
  }

  return (
    <CreatorApplicationView
      earnings={earnings}
      filmmakerBalances={filmmakerBalances}
    />
  );
}
