// Client-side balance signal bus — bridges VideoPlayer (which learns the
// live balance from heartbeat acks) to any UI that displays it (nav pill,
// gauge). Window CustomEvent keeps it dependency-free and works across
// disconnected React trees.
//
// Consumers interpolate: the signal carries the last server-confirmed value
// plus whether playback is running; each subscriber runs its own 1s cosmetic
// countdown while `playing` and resyncs on every signal. The server remains
// the sole authority — these numbers are display-only.

const EVENT_NAME = "arbor:balance";

export type BalanceSignal = {
  /** last server-confirmed balance, seconds */
  remainingSeconds: number;
  /** true while a metered playback session is running */
  playing: boolean;
};

export function emitBalance(signal: BalanceSignal): void {
  window.dispatchEvent(new CustomEvent<BalanceSignal>(EVENT_NAME, { detail: signal }));
}

export function subscribeBalance(
  callback: (signal: BalanceSignal) => void,
): () => void {
  const handler = (event: Event) =>
    callback((event as CustomEvent<BalanceSignal>).detail);
  window.addEventListener(EVENT_NAME, handler);
  return () => window.removeEventListener(EVENT_NAME, handler);
}
