# Upload Modal — Progress-Only View

**Scope:** Filmmaker dashboard "Upload Film" flow.
**Date:** 2026-07-20
**Files changed:**
- `components/upload-film.tsx`
- `lib/uploads/manager.ts`
- `lib/uploads/store.ts`
- `lib/cloudinary/upload.ts`

**Goal:** After clicking **Start upload**, the modal must show ONLY the upload
progress and a **Cancel upload** button — no form, no "Uploads" list, no
Close/Start footer — until that upload reaches a terminal state (completed or
failed). Previously the form stayed fully editable and the user could immediately
start typing another film while one was uploading.

---

## 1. Why it was a problem

`handleQueueUpload` validated the form, called `startFilmUpload(...)`, and then
reset the composer fields — but the modal stayed open showing the **same full
form** plus the growing "Uploads" task list and the Cancel/Start footer. Nothing
blocked the user from filling the form again and queuing a second film while the
first was still in flight. The composer was reset only in local component state;
there was no switch to a distinct "watch it upload" view.

---

## 2. Progress-only view (`components/upload-film.tsx`)

### New state
- `activeTask` — the newest non-terminal task from `useUploadTasks()`:
  ```ts
  const activeTask = tasks.find((t) => ACTIVE_STATUSES.includes(t.status));
  const showProgress = !!activeTask;
  ```
- `ACTIVE_STATUSES` already covers `preparing | uploading | processing | saving`.
  As soon as an upload enters any of these, `showProgress` becomes true.

### New component: `ProgressPanel`
Renders a centered view for the active task:
- film title (or video filename)
- a progress bar — exact `%` while `status === "uploading"`, else an indeterminate
  pulsing bar for `preparing | processing | saving`
- status label (`STATUS_LABEL`) + `%` / speed (existing `formatBytesPerSecond`)
- a single **Cancel upload** button → `cancelFilmUpload(task.id)`

### Modal body branches
```tsx
{showProgress && activeTask ? (
  <ProgressPanel key={activeTask.id} task={activeTask} />
) : (
  <>
    {/* existing: Uploads list + full form + fieldError */}
  </>
)}
```

### Hidden while uploading
- **Footer** (Cancel / Start upload) is wrapped in `{!showProgress && (…)}`.
- **Header Close (X)** is wrapped in `{!showProgress && (…)}`.
- Backdrop-click close stays guarded by `activeUploadRunning` (unchanged) — a
  backdrop click during upload is ignored; Esc/X are also effectively unavailable
  because the X is hidden and Esc calls `closeModal()` which is also gated.

Once the task hits `completed`/`failed`, `showProgress` flips false and the form +
footer + Close reappear, ready for the next film. A failed task still shows in the
"Uploads" list with Retry/Dismiss (handled by the existing `TaskRow`).

---

## 3. Making Cancel actually work

The upload was fire-and-forget with no way to abort. Added an `AbortController`
plumbed through to the XHR.

### `lib/cloudinary/upload.ts`
`uploadToCloudinary` now accepts `signal?: AbortSignal`:
- if `signal.aborted` already, rejects immediately with `AbortError`
- adds a one-shot `abort` listener that calls `xhr.abort()` and rejects with a
  `DOMException("Upload cancelled.", "AbortError")`

### `lib/uploads/store.ts`
`UploadTask` gained an optional `abort?: () => void` field — holds the per-task
abort closure while the upload is running.

### `lib/uploads/manager.ts`
- `runUpload` creates `const controller = new AbortController()` and registers
  `abort` on the task:
  ```ts
  uploadStore.patch(id, {
    abort: () => {
      const s = uploadStore.get(id)?.status;
      if (s !== "completed" && s !== "failed") controller.abort();
    },
  });
  ```
- passes `signal: controller.signal` to the video upload and (if present) the
  thumbnail upload.
- on every terminal patch (`completed`/`failed`/early-return) it clears `abort:
  undefined` so nothing holds a dangling reference.
- `catch` now checks `AbortError` and, on cancel, removes the task entirely
  (`uploadStore.remove(id)`) instead of marking it failed.
- new export:
  ```ts
  export function cancelFilmUpload(id: string) {
    const task = uploadStore.get(id);
    if (!task) return;
    if (task.status === "completed" || task.status === "failed") return;
    task.abort?.();
  }
  ```

---

## Notes / caveats for audit

- Cancel only aborts the **current** Cloudinary XHR(s). If a thumbnail upload is in
  flight after the video already finished, cancelling aborts the thumbnail leg too
  (both share the same `controller`). The video already uploaded to Cloudinary is
  **not** rolled back server-side — acceptable for a demo; a production build would
  need a cleanup/delete call. The local task row is removed so the dashboard never
  shows a half-uploaded film.
- The `dedupeKey` mechanism (`fileTaskKey`) still prevents starting a duplicate of
  an already-active file, so re-queueing the same file while uploading is a no-op.
- `startFilmUpload` resets composer state locally; the sessionStorage draft is
  cleared only on DB success (`clearDraftFields` in `manager.ts`), so a cancelled
  upload does NOT lose what was typed (the form reappears pre-filled when the task
  goes terminal).
- Validation (`validate()`) is unchanged and still runs before `startFilmUpload`.
- Verified with `npm run typecheck` only — no automated test exercises the cancel
  path; behavior rests on `AbortController` + XHR semantics.
