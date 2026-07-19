"use client";

import { useEffect, useRef, useState } from "react";
import { PosterCard } from "@/components/poster-card";
import type { Film } from "@/lib/films";

export function FilmCarousel({ films, reverse = false }: { films: Film[]; reverse?: boolean }) {
  const trackRef = useRef<HTMLDivElement>(null);
  const frameRef = useRef<number | null>(null);
  const positionRef = useRef(0);
  const lastTimeRef = useRef<number | null>(null);
  const dragStartRef = useRef({ x: 0, position: 0, moved: false });
  const [isPaused, setIsPaused] = useState(false);
  const [isDragging, setIsDragging] = useState(false);

  useEffect(() => {
    const reduceMotion = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
    const speed = reverse ? -24 : 28;

    const tick = (time: number) => {
      const track = trackRef.current;
      if (track) {
        if (lastTimeRef.current !== null && !isPaused && !isDragging && !reduceMotion) {
          positionRef.current += ((time - lastTimeRef.current) / 1000) * speed;
        }
        lastTimeRef.current = time;
        const halfWidth = track.scrollWidth / 2;
        if (halfWidth > 0) {
          positionRef.current = ((positionRef.current % halfWidth) + halfWidth) % halfWidth;
          track.style.transform = `translate3d(${-positionRef.current}px, 0, 0)`;
        }
      }
      frameRef.current = requestAnimationFrame(tick);
    };

    frameRef.current = requestAnimationFrame(tick);
    return () => {
      if (frameRef.current !== null) cancelAnimationFrame(frameRef.current);
    };
  }, [isDragging, isPaused, reverse]);

  function handlePointerDown(event: React.PointerEvent<HTMLDivElement>) {
    const target = event.target as HTMLElement;
    if (target.closest("a")) return;
    event.currentTarget.setPointerCapture(event.pointerId);
    dragStartRef.current = { x: event.clientX, position: positionRef.current, moved: false };
    setIsDragging(true);
  }

  function handlePointerMove(event: React.PointerEvent<HTMLDivElement>) {
    if (!isDragging) return;
    const delta = event.clientX - dragStartRef.current.x;
    if (Math.abs(delta) > 5) dragStartRef.current.moved = true;
    positionRef.current = dragStartRef.current.position - delta;
    lastTimeRef.current = null;
  }

  function handlePointerUp(event: React.PointerEvent<HTMLDivElement>) {
    if (!isDragging) return;
    event.currentTarget.releasePointerCapture(event.pointerId);
    setIsDragging(false);
    lastTimeRef.current = null;
  }

  return (
    <div
      className={`film-carousel -mx-6 overflow-hidden px-6 ${isDragging ? "cursor-grabbing" : "cursor-grab"}`}
      style={{ touchAction: "pan-y", userSelect: "none", WebkitUserSelect: "none" }}
      onPointerDown={(event) => {
        event.preventDefault();
        handlePointerDown(event);
      }}
      onPointerMove={handlePointerMove}
      onPointerUp={handlePointerUp}
      onPointerCancel={handlePointerUp}
      onPointerEnter={() => {setIsPaused(true); }}
      onPointerLeave={() => {
        setIsPaused(false);
        setIsDragging(false);
      }}
      onDragStart={(event) => event.preventDefault()}
      onClickCapture={(event) => {
        if (dragStartRef.current.moved) {
          event.preventDefault();
          event.stopPropagation();
          dragStartRef.current.moved = false;
        }
      }}
      aria-label="Film carousel. Hover to pause or drag to browse."
    >
      <div ref={trackRef} className="flex w-max gap-4 py-2 sm:gap-[18px]">
        {[...films, ...films].map((film, index) => (
          <PosterCard key={`${film.slug}-${index}`} film={film} />
        ))}
      </div>
    </div>
  );
} 
