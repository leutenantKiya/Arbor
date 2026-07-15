'use client';

import { useCallback, useEffect, useRef, useState } from 'react';
import type { Film } from '@/lib/films';

const HEARTBEAT_INTERVAL_MS = 10_000;

// Business FSM — what the user is doing.
type BusinessState = 'PAUSED' | 'PLAYING';
// Transport FSM — what the network loop is doing (never mixed with the above).
type NetworkState = 'IDLE' | 'READY' | 'AWAITING_ACK' | 'RECONNECTING';

type Overlay = 'insufficient_balance' | 'balance_exhausted' | 'session_error' | null;

const OVERLAY_COPY: Record<NonNullable<Overlay>, { title: string; body: string }> = {
    insufficient_balance: {
        title: 'Out of watch time',
        body: 'Your balance is empty. Top up to start watching.',
    },
    balance_exhausted: {
        title: 'Watch time used up',
        body: 'Your balance ran out during playback. Top up to keep watching.',
    },
    session_error: {
        title: 'Playback session lost',
        body: 'The billing session was interrupted. Press play to start again.',
    },
};

function formatSeconds(total: number): string {
    const m = Math.floor(total / 60);
    const s = total % 60;
    return `${m}:${String(s).padStart(2, '0')}`;
}

export function VideoPlayer({ film }: { film: Film }) {
    const videoRef = useRef<HTMLVideoElement>(null);
    const intervalRef = useRef<ReturnType<typeof setInterval> | null>(null);
    const sessionIdRef = useRef<string | null>(null);
    // Monotonic per-session sequence. Incremented once per tick; a failed send
    // is retried with the SAME seq on the next tick (the server computes the
    // billed delta from its own clock, so a late beat never over-bills).
    const seqRef = useRef(0);
    const seqAckedRef = useRef(true);
    const startingRef = useRef(false);

    const [networkState, setNetworkState] = useState<NetworkState>('IDLE');
    const [businessState, setBusinessState] = useState<BusinessState>('PAUSED');
    const [remainingSeconds, setRemainingSeconds] = useState<number | null>(null);
    const [overlay, setOverlay] = useState<Overlay>(null);

    const stopLoop = useCallback(() => {
        if (intervalRef.current) {
            clearInterval(intervalRef.current);
            intervalRef.current = null;
        }
        setNetworkState('IDLE');
    }, []);

    const endSession = useCallback(
        (useBeacon = false) => {
            const sessionId = sessionIdRef.current;
            sessionIdRef.current = null;
            stopLoop();
            if (!sessionId) return;
            const payload = JSON.stringify({ sessionId });
            if (useBeacon && typeof navigator.sendBeacon === 'function') {
                navigator.sendBeacon(
                    '/api/session/end',
                    new Blob([payload], { type: 'application/json' }),
                );
            } else {
                fetch('/api/session/end', {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: payload,
                    keepalive: true,
                }).catch(() => { });
            }
        },
        [stopLoop],
    );

    const haltPlayback = useCallback(
        (reason: NonNullable<Overlay>) => {
            videoRef.current?.pause();
            endSession();
            setBusinessState('PAUSED');
            setOverlay(reason);
        },
        [endSession],
    );

    const sendHeartbeat = useCallback(async () => {
        const sessionId = sessionIdRef.current;
        if (!sessionId) return;
        // Advance seq only when the previous beat was acknowledged; otherwise
        // this tick retries the same seq (RECONNECTING branch of the FSM).
        if (seqAckedRef.current) {
            seqRef.current += 1;
            seqAckedRef.current = false;
        }
        setNetworkState('AWAITING_ACK');
        try {
            const res = await fetch('/api/session/heartbeat', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ sessionId, seq: seqRef.current }),
            });
            if (res.status === 409) {
                // Session inactive/stale on the server — stop billing cleanly.
                haltPlayback('session_error');
                return;
            }
            if (!res.ok) throw new Error(`heartbeat ${res.status}`);
            const data: { remainingSeconds: number; sessionEnded: boolean } =
                await res.json();
            seqAckedRef.current = true;
            setRemainingSeconds(data.remainingSeconds);
            if (data.sessionEnded) {
                sessionIdRef.current = null; // server already closed it
                haltPlayback('balance_exhausted');
                return;
            }
            setNetworkState('READY');
        } catch {
            // Network drop: keep playing (ARCHITECTURE §4.1 — playback never
            // blocks on a heartbeat), retry same seq next tick.
            setNetworkState('RECONNECTING');
        }
    }, [haltPlayback]);

    const handlePlay = useCallback(async () => {
        setOverlay(null);
        if (sessionIdRef.current || startingRef.current) {
            setBusinessState('PLAYING');
            return;
        }
        startingRef.current = true;
        try {
            const res = await fetch('/api/session/start', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ slug: film.slug }),
            });
            if (res.status === 403) {
                haltPlayback('insufficient_balance');
                return;
            }
            if (!res.ok) throw new Error(`start ${res.status}`);
            const data: { sessionId: string; remainingSeconds: number } =
                await res.json();
            sessionIdRef.current = data.sessionId;
            seqRef.current = 0;
            seqAckedRef.current = true;
            setRemainingSeconds(data.remainingSeconds);
            setBusinessState('PLAYING');
            setNetworkState('READY');
            if (!intervalRef.current) {
                intervalRef.current = setInterval(sendHeartbeat, HEARTBEAT_INTERVAL_MS);
            }
        } catch {
            haltPlayback('session_error');
        } finally {
            startingRef.current = false;
        }
    }, [film.slug, haltPlayback, sendHeartbeat]);

    const handlePause = useCallback(() => {
        endSession();
        setBusinessState('PAUSED');
    }, [endSession]);

    // Page close / tab kill: beacon out the session end.
    useEffect(() => {
        const onPageHide = () => endSession(true);
        window.addEventListener('pagehide', onPageHide);
        return () => {
            window.removeEventListener('pagehide', onPageHide);
            endSession(true); // unmount (client-side navigation away)
        };
    }, [endSession]);

    return (
        <div className="relative flex min-h-0 flex-1 flex-col">
            <video
                ref={videoRef}
                src={film.videoUrl}
                poster={film.posterUrl}
                controls
                autoPlay
                onPlay={handlePlay}
                onPause={handlePause}
                onEnded={handlePause}
                className="min-h-0 flex-1 object-contain"
            />

            {remainingSeconds !== null && (
                <div className="pointer-events-none absolute right-4 top-4 rounded-full bg-black/60 px-3 py-1.5 text-sm tabular-nums text-cream">
                    {formatSeconds(Math.max(0, remainingSeconds))} left
                    {networkState === 'RECONNECTING' && (
                        <span className="ml-2 text-sage">reconnecting…</span>
                    )}
                </div>
            )}

            {overlay && businessState === 'PAUSED' && (
                <div className="absolute inset-0 flex flex-col items-center justify-center gap-2 bg-black/80 text-center">
                    <p className="text-lg text-cream">{OVERLAY_COPY[overlay].title}</p>
                    <p className="max-w-sm text-sm text-sage">{OVERLAY_COPY[overlay].body}</p>
                </div>
            )}
        </div>
    );
}