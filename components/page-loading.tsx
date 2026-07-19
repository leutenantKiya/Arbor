// Shown instantly by Next.js (via loading.tsx) while a dynamic route's
// Server Components are still fetching — without this, a slow route (DB +
// on-chain reads) gives zero feedback on click, which reads as "the button
// didn't register" and gets clicked again.
export function PageLoading() {
  return (
    <div className="flex min-h-[60vh] flex-col items-center justify-center gap-4">
      <div className="h-8 w-8 animate-spin-fast rounded-full border-2 border-line border-t-amber" />
      <p className="font-mono text-xs uppercase tracking-widest text-ink-faint">
        Loading…
      </p>
    </div>
  );
}
