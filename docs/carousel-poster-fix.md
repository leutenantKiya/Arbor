# Carousel & Poster Card Fix

## Problem

In the film carousel (`components/film-carousel.tsx`), clicking a film poster did nothing. The `PosterCard` was wrapped in a Next.js `<Link>`, but the carousel's `setPointerCapture` in `handlePointerDown` stole the pointer events, so the link's click never fired. Additionally, any click anywhere on the poster would navigate, which conflicted with the carousel's drag-to-scroll behavior.

## Desired behavior

- Hovering a poster pauses the carousel and reveals a play button at the top-right.
- Dragging anywhere on the poster still scrolls the carousel.
- Only clicking the play button navigates to the film description page (`/film/:slug`).
- Clicking the poster background does nothing.

## Changes

### `components/poster-card.tsx`

- Removed the outer `<Link>` wrapper so the whole card is no longer navigable.
- Replaced the decorative play `<span>` with an actual `<Link href={\`/film/${film.slug}\`}>` containing the play button.
- The play button keeps the same hover-reveal styling (`opacity-0` → `opacity-100` on `group-hover`).

### `components/film-carousel.tsx`

- In `handlePointerDown`, added a guard: if the press target is (or is inside) an `<a>` element, the handler returns early and does **not** call `setPointerCapture`.
- This lets the play button's `<Link>` receive its click normally, while drags on the poster background continue to work exactly as before.

## Result

| Interaction | Outcome |
|---|---|
| Hover poster | Carousel pauses; play button fades in |
| Drag poster background | Carousel scrolls |
| Click play button | Navigate to `/film/:slug` |
| Click poster background | No navigation |
