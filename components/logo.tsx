// Arbor mark — a play triangle growing into a tree canopy.
export function Logo({ className }: { className?: string }) {
  return (
    <svg
      viewBox="0 0 32 32"
      fill="none"
      className={className}
      aria-hidden="true"
    >
      <circle cx="16" cy="13" r="9" className="fill-moss" opacity="0.35" />
      <circle cx="11" cy="15" r="6.5" className="fill-fern" opacity="0.45" />
      <circle cx="21" cy="15" r="6.5" className="fill-fern" opacity="0.45" />
      <path d="M13 9.5 22 15l-9 5.5v-11Z" className="fill-amber" />
      <path
        d="M15.25 20v7M12 29h6.5"
        className="stroke-cream"
        strokeWidth="1.6"
        strokeLinecap="round"
      />
    </svg>
  );
}
