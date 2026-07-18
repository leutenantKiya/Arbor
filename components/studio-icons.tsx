// Line icons for the Studio sidebar/header — generic feather-style glyphs
// (viewBox 0 0 24 24, stroke="currentColor"), matching the icon convention
// already used elsewhere in the app (FilmSearch, WalletInfo, ApplyCreator).
// Shapes are structural references from Mock UI's nav (grid/film/chart/etc.),
// restyled with Arbor's stroke weight and left to inherit text color.

type IconProps = { className?: string };

const base = "stroke-current fill-none";

export function DashboardIcon({ className }: IconProps) {
  return (
    <svg viewBox="0 0 24 24" strokeWidth="1.7" className={`${base} ${className ?? ""}`} aria-hidden="true">
      <rect x="3" y="3" width="8" height="8" rx="1.5" />
      <rect x="13" y="3" width="8" height="5" rx="1.5" />
      <rect x="13" y="11" width="8" height="10" rx="1.5" />
      <rect x="3" y="14" width="8" height="7" rx="1.5" />
    </svg>
  );
}

export function FilmsIcon({ className }: IconProps) {
  return (
    <svg viewBox="0 0 24 24" strokeWidth="1.7" className={`${base} ${className ?? ""}`} aria-hidden="true">
      <rect x="3" y="4" width="18" height="16" rx="2" />
      <path d="M3 9h18M8 4v5M16 4v5" />
    </svg>
  );
}

export function AnalyticsIcon({ className }: IconProps) {
  return (
    <svg viewBox="0 0 24 24" strokeWidth="1.7" strokeLinecap="round" className={`${base} ${className ?? ""}`} aria-hidden="true">
      <path d="M4 19V10M11 19V5M18 19v-7" />
    </svg>
  );
}

export function EarningsIcon({ className }: IconProps) {
  return (
    <svg viewBox="0 0 24 24" strokeWidth="1.7" className={`${base} ${className ?? ""}`} aria-hidden="true">
      <rect x="2.5" y="6" width="19" height="13" rx="2.5" />
      <path d="M2.5 10h19M17 15h1.5" />
    </svg>
  );
}

export function AudienceIcon({ className }: IconProps) {
  return (
    <svg viewBox="0 0 24 24" strokeWidth="1.7" strokeLinecap="round" className={`${base} ${className ?? ""}`} aria-hidden="true">
      <circle cx="9" cy="8" r="3.2" />
      <path d="M2.8 20c0-3.4 2.7-6.2 6.2-6.2S15.2 16.6 15.2 20" />
      <circle cx="17.5" cy="9" r="2.5" />
      <path d="M15.2 14.3a4.6 4.6 0 0 1 6 4.4" />
    </svg>
  );
}

export function CommentsIcon({ className }: IconProps) {
  return (
    <svg viewBox="0 0 24 24" strokeWidth="1.7" strokeLinejoin="round" className={`${base} ${className ?? ""}`} aria-hidden="true">
      <path d="M4 5h16v11H8l-4 4V5z" />
    </svg>
  );
}

export function SettingsIcon({ className }: IconProps) {
  return (
    <svg viewBox="0 0 24 24" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round" className={`${base} ${className ?? ""}`} aria-hidden="true">
      <circle cx="12" cy="12" r="3" />
      <path d="M19.4 13.5a1.7 1.7 0 0 0 .35 1.9l.06.06a2 2 0 1 1-2.9 2.9l-.06-.06a1.7 1.7 0 0 0-1.9-.35 1.7 1.7 0 0 0-1 1.55V20a2 2 0 1 1-4 0v-.1a1.7 1.7 0 0 0-1.1-1.55 1.7 1.7 0 0 0-1.9.35l-.06.06a2 2 0 1 1-2.9-2.9l.06-.06a1.7 1.7 0 0 0 .35-1.9 1.7 1.7 0 0 0-1.55-1H4a2 2 0 1 1 0-4h.1a1.7 1.7 0 0 0 1.55-1.1 1.7 1.7 0 0 0-.35-1.9l-.06-.06a2 2 0 1 1 2.9-2.9l.06.06a1.7 1.7 0 0 0 1.9.35H10a1.7 1.7 0 0 0 1-1.55V4a2 2 0 1 1 4 0v.1a1.7 1.7 0 0 0 1 1.55 1.7 1.7 0 0 0 1.9-.35l.06-.06a2 2 0 1 1 2.9 2.9l-.06.06a1.7 1.7 0 0 0-.35 1.9V10a1.7 1.7 0 0 0 1.55 1H20a2 2 0 1 1 0 4h-.1a1.7 1.7 0 0 0-1.5 1z" />
    </svg>
  );
}

export function MenuIcon({ className }: IconProps) {
  return (
    <svg viewBox="0 0 24 24" strokeWidth="1.8" strokeLinecap="round" className={`${base} ${className ?? ""}`} aria-hidden="true">
      <path d="M3 6h18M3 12h18M3 18h18" />
    </svg>
  );
}

export function ChevronLeftIcon({ className }: IconProps) {
  return (
    <svg viewBox="0 0 24 24" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className={`${base} ${className ?? ""}`} aria-hidden="true">
      <path d="M15 6l-6 6 6 6" />
    </svg>
  );
}

export function PlusIcon({ className }: IconProps) {
  return (
    <svg viewBox="0 0 24 24" strokeWidth="2" strokeLinecap="round" className={`${base} ${className ?? ""}`} aria-hidden="true">
      <path d="M12 5v14M5 12h14" />
    </svg>
  );
}
