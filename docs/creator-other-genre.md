# Creator Application — "Other" Primary Genre

**Scope:** Creator application form (Studio → apply), Primary genre field.
**Date:** 2026-07-20
**File changed:** `components/apply-creator.tsx`

**Goal:** When an applicant selects **Other** in the "Primary genre" dropdown, the
form reveals a new text input so they can type their actual genre. On submit the
backend receives the typed genre — never the literal string `"Other"`.

---

## 1. Before

`Primary genre` was a plain `<select>` over `GENRES` (which includes `"Other"` as a
final option). Selecting "Other" sent the literal value `"Other"` to the backend —
there was no way to capture the real genre the applicant meant.

---

## 2. Changes (`components/apply-creator.tsx`)

### Form state
- Added `consideredGenreOther: string` to the `FormData` type and to `EMPTY`
  (default `""`), so it is a first-class draft field alongside `consideredGenre`.

### Genre field UI
- The `<select>` `onChange` now also resets `consideredGenreOther` to `""` whenever
  the selection is anything other than `"Other"`.
- When `data.consideredGenre === "Other"`, a conditional text `<input>`
  (`#ac-genre-other`) appears directly below the select with placeholder
  "Tell us your genre" and `maxLength={200}` (matching the DB `varchar(200)`).
- Typing updates `data.consideredGenreOther` via `set(...)`.

### Submit payload
The submitted `consideredGenre` is now resolved (around line 311):
```ts
consideredGenre:
  data.consideredGenre === "Other"
    ? data.consideredGenreOther.trim() || "Other"
    : data.consideredGenre,
```
So the backend stores the **typed genre**. Only if the user leaves the box blank
does it fall back to `"Other"` (defensive — shouldn't normally happen since the
field is optional and the select default is empty).

---

## 3. Backend / persistence notes

- `lib/creators/actions.ts` stores `consideredGenre` with
  `optional(input.consideredGenre, 200)` — it is a free-text `varchar(200)`,
  **not** an enum, so the custom genre string is accepted as-is. No server-side
  change was required.
- The form draft (`DRAFT_KEY` in `sessionStorage`) serializes the whole `data`
  object and restores it via `{ ...EMPTY, ...parsed.data }`. Because
  `consideredGenreOther` is part of `EMPTY`, the typed genre survives a
  close/reopen of the modal.

---

## 4. Caveats for audit

- The "Other" text input is **not** required by validation — `consideredGenre` is
  optional (`optionalTag`), and the submit fallback preserves `"Other"` if empty.
  If a required free-text genre is ever wanted, add a check in `submit()` when
  `consideredGenre === "Other" && !consideredGenreOther.trim()`.
- No new index/constraint added; the value is just storage text. If analytics
  later need normalized genres, a mapping layer would be needed.
- Verified with `npm run typecheck` only — no automated test covers this branch.
