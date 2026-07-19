"use client";

import { useEffect, useRef, useState } from "react";
import { createPortal } from "react-dom";
import { formatBytesPerSecond } from "@/lib/format";
import {
  clearDraftFields,
  EMPTY_UPLOAD_FIELDS,
  readDraftFields,
  uploadStore,
  writeDraftFields,
  type UploadFields,
  type UploadTask,
} from "@/lib/uploads/store";
import { useUploadTasks } from "@/lib/uploads/use-upload-tasks";
import { cancelFilmUpload, retryFilmUpload, startFilmUpload } from "@/lib/uploads/manager";
import { PlusIcon } from "@/components/studio-icons";

// "Upload Film" — trigger button + modal in one component (one modal
// instance, guaranteed). The modal is a thin UI layer only: all upload state
// lives in lib/uploads/store.ts and keeps running via lib/uploads/manager.ts
// regardless of whether this component is mounted — closing the modal never
// cancels an in-flight upload, and reopening it restores the live queue.

const CATEGORIES = ["Animation", "Sci-Fi", "Fantasy"] as const;
const MAX_VIDEO_BYTES = 100 * 1024 * 1024; // 100MB — conservative default for signed uploads
const VALID_VIDEO_EXTENSIONS = ["mp4", "mov", "webm", "mkv", "avi", "m4v"];

function extensionOf(filename: string): string {
  return filename.split(".").pop()?.toLowerCase() ?? "";
}

function isValidVideoFile(file: File): boolean {
  if (file.type.startsWith("video/")) return true;
  return VALID_VIDEO_EXTENSIONS.includes(extensionOf(file.name));
}

const STATUS_LABEL: Record<UploadTask["status"], string> = {
  preparing: "Preparing…",
  uploading: "Uploading…",
  processing: "Processing…",
  saving: "Saving…",
  completed: "Completed",
  failed: "Failed",
};

const ACTIVE_STATUSES: UploadTask["status"][] = [
  "preparing",
  "uploading",
  "processing",
  "saving",
];

function TaskRow({ task }: { task: UploadTask }) {
  const isFailed = task.status === "failed";
  const isActive = ACTIVE_STATUSES.includes(task.status);

  return (
    <div className="rounded-lg border border-line-soft bg-bark/40 p-3">
      <div className="flex items-center justify-between gap-3">
        <p className="min-w-0 truncate text-sm text-cream">
          {task.fields.title || task.videoFile.name}
        </p>
        <span
          className={`shrink-0 font-mono text-[0.68rem] ${
            isFailed ? "text-brick" : isActive ? "text-amber" : "text-fern"
          }`}
        >
          {STATUS_LABEL[task.status]}
          {task.status === "uploading" ? ` ${task.progress}%` : ""}
        </span>
      </div>

      {task.status === "uploading" && (
        <>
          <div className="mt-2 h-1.5 overflow-hidden rounded-full bg-line-soft">
            <div
              className="h-full rounded-full bg-amber transition-all"
              style={{ width: `${task.progress}%` }}
            />
          </div>
          {task.speedBytesPerSec !== null && (
            <p className="mt-1 font-mono text-[0.65rem] text-ink-faint">
              {formatBytesPerSecond(task.speedBytesPerSec)}
            </p>
          )}
        </>
      )}

      {isFailed && (
        <div className="mt-2 flex items-center justify-between gap-3">
          <p className="min-w-0 truncate text-xs text-brick">{task.error}</p>
          <div className="flex shrink-0 gap-2">
            <button
              type="button"
              onClick={() => retryFilmUpload(task.id)}
              className="font-mono text-[0.65rem] font-medium uppercase tracking-wide text-amber hover:text-amber-soft"
            >
              Retry
            </button>
            <button
              type="button"
              onClick={() => uploadStore.remove(task.id)}
              className="font-mono text-[0.65rem] uppercase tracking-wide text-ink-faint hover:text-cream"
            >
              Dismiss
            </button>
          </div>
        </div>
      )}
    </div>
  );
}

// Progress-only view shown after "Start upload": no form, just the live
// upload status + a Cancel button, until the upload reaches a terminal state
// (completed/failed) and the form is restored for the next film.
function ProgressPanel({ task }: { task: UploadTask }) {
  const isUploading = task.status === "uploading";

  return (
    <div className="flex flex-col items-center px-6 py-12 text-center sm:px-8">
      <div className="w-full max-w-sm">
        <p className="truncate font-display text-xl font-semibold text-cream">
          {task.fields.title || task.videoFile.name}
        </p>

        {isUploading ? (
          <div className="mt-6 h-2 w-full overflow-hidden rounded-full bg-line-soft">
            <div
              className="h-full rounded-full bg-amber transition-all duration-200"
              style={{ width: `${task.progress}%` }}
            />
          </div>
        ) : (
          <div className="mt-6 h-2 w-full overflow-hidden rounded-full bg-line-soft">
            <div className="h-full w-1/3 animate-pulse rounded-full bg-amber/60" />
          </div>
        )}

        <div className="mt-3 flex items-center justify-between font-mono text-[0.68rem] text-sage">
          <span>{STATUS_LABEL[task.status]}</span>
          {isUploading && <span className="tabular-nums">{task.progress}%</span>}
        </div>
        {isUploading && task.speedBytesPerSec !== null && (
          <p className="mt-1 font-mono text-[0.65rem] text-ink-faint">
            {formatBytesPerSecond(task.speedBytesPerSec)}
          </p>
        )}

        <button
          type="button"
          onClick={() => cancelFilmUpload(task.id)}
          className="mt-8 rounded-full border border-line-soft px-6 py-2.5 text-sm font-medium text-sage transition-colors hover:border-cream/40 hover:text-cream"
        >
          Cancel upload
        </button>
      </div>
    </div>
  );
}

export function UploadFilm() {
  const tasks = useUploadTasks();
  const [open, setOpen] = useState(false);
  const [fields, setFields] = useState<UploadFields>(EMPTY_UPLOAD_FIELDS);
  const [videoFile, setVideoFile] = useState<File | null>(null);
  const [thumbnailFile, setThumbnailFile] = useState<File | null>(null);
  const [fieldError, setFieldError] = useState<string | null>(null);

  // The newest active (non-terminal) upload owns the progress view. While it
  // exists, the form is hidden and only the upload status + Cancel show.
  const activeTask = tasks.find((t) =>
    ACTIVE_STATUSES.includes(t.status),
  );

  const triggerRef = useRef<HTMLButtonElement>(null);
  const videoInputRef = useRef<HTMLInputElement>(null);
  const thumbInputRef = useRef<HTMLInputElement>(null);
  const dirtyRef = useRef(false);

  const activeCount = tasks.filter((t) =>
    ACTIVE_STATUSES.includes(t.status),
  ).length;

  const set = <K extends keyof UploadFields>(key: K, value: UploadFields[K]) => {
    dirtyRef.current = true;
    setFieldError(null);
    setFields((prev) => ({ ...prev, [key]: value }));
  };

  // Persist the draft (text fields only) as it's edited.
  useEffect(() => {
    if (!dirtyRef.current) return;
    writeDraftFields(fields);
  }, [fields]);

  function openModal() {
    setFields(readDraftFields());
    setVideoFile(uploadStore.draftVideoFile);
    setThumbnailFile(uploadStore.draftThumbnailFile);
    setFieldError(null);
    dirtyRef.current = false;
    setOpen(true);
  }

  const activeUploadRunning = activeCount > 0;

  function closeModal(fromBackdrop = false) {
    // Backdrop clicks are ignored while an upload is active (Esc / the X
    // button always work — closing never cancels anything either way).
    if (fromBackdrop && activeUploadRunning) return;
    setOpen(false);
    triggerRef.current?.focus();
  }

  // While an upload is in flight, the modal shows the progress panel only.
  const showProgress = !!activeTask;

  // Escape + body scroll lock while open (never gated on upload state).
  useEffect(() => {
    if (!open) return;
    const prevOverflow = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") closeModal();
    };
    window.addEventListener("keydown", onKey);
    return () => {
      document.body.style.overflow = prevOverflow;
      window.removeEventListener("keydown", onKey);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open]);

  function handleVideoChange(file: File | null) {
    setVideoFile(file);
    uploadStore.draftVideoFile = file;
  }
  function handleThumbnailChange(file: File | null) {
    setThumbnailFile(file);
    uploadStore.draftThumbnailFile = file;
  }

  function validate(): string | null {
    if (!fields.title.trim()) return "Title is required.";
    if (!fields.synopsis.trim()) return "Synopsis is required.";
    if (!fields.category) return "Select a category.";
    const y = Number(fields.year);
    const currentYear = new Date().getFullYear();
    if (!Number.isInteger(y) || y < 1888 || y > currentYear + 1) {
      return "Enter a valid release year.";
    }
    if (!videoFile) return "Select a video file.";
    if (!isValidVideoFile(videoFile)) {
      return "Unsupported video format — use MP4, MOV, WebM, MKV, or AVI.";
    }
    if (videoFile.size > MAX_VIDEO_BYTES) {
      return `Video is too large — max ${MAX_VIDEO_BYTES / (1024 * 1024)}MB.`;
    }
    return null;
  }

  function handleQueueUpload() {
    const validationError = validate();
    setFieldError(validationError);
    if (validationError) return;

    startFilmUpload(fields, videoFile!, thumbnailFile);

    // The task now owns this file+fields snapshot — reset the composer for
    // the next film. The sessionStorage draft is left alone until the task
    // actually finishes (lib/uploads/manager.ts clears it on DB success), so
    // a failure never loses what was typed.
    setFields(EMPTY_UPLOAD_FIELDS);
    setVideoFile(null);
    setThumbnailFile(null);
    uploadStore.draftVideoFile = null;
    uploadStore.draftThumbnailFile = null;
    dirtyRef.current = false;
    if (videoInputRef.current) videoInputRef.current.value = "";
    if (thumbInputRef.current) thumbInputRef.current.value = "";
    clearDraftFields();
  }

  const field =
    "w-full rounded-lg border border-line bg-bark px-3 py-2 text-sm text-cream placeholder:text-ink-faint transition-colors focus:border-amber focus:outline-none";
  const label =
    "mb-1.5 block font-mono text-[0.62rem] font-medium uppercase tracking-[0.12em] text-sage";

  return (
    <>
      <button
        ref={triggerRef}
        type="button"
        onClick={openModal}
        className="inline-flex items-center gap-1.5 rounded-full bg-amber px-4 py-2 text-sm font-medium text-bark transition-all hover:bg-amber/90"
      >
        {activeUploadRunning ? (
          <>
            <span className="h-3.5 w-3.5 shrink-0 animate-spin rounded-full border-2 border-bark/30 border-t-bark" />
            <span className="hidden sm:inline">Uploading ({activeCount})</span>
          </>
        ) : (
          <>
            <PlusIcon className="h-4 w-4" />
            <span className="hidden sm:inline">Upload Film</span>
          </>
        )}
      </button>

      {open && typeof document !== "undefined" &&
        createPortal(
          <>
          {/* Backdrop — same treatment as FilmSearch (components/film-search.tsx) */}
          <div
            aria-hidden="true"
            className="animate-backdrop-in fixed inset-0 z-[140] bg-bark/75 backdrop-blur-md"
            onPointerDown={() => closeModal(true)}
          />

          <div className="pointer-events-none fixed inset-0 z-[141] flex items-center justify-center p-4 sm:p-6">
            <div
              role="dialog"
              aria-modal="true"
              aria-labelledby="upload-film-title"
              onPointerDown={(e) => e.stopPropagation()}
              className="animate-modal-in pointer-events-auto relative flex h-[88dvh] max-h-[calc(100dvh-2rem)] w-full max-w-lg flex-col overflow-hidden rounded-card border border-line bg-surface shadow-2xl sm:max-h-[calc(100dvh-3rem)]"
            >
              {/* Header — fixed */}
              <div className="flex shrink-0 items-center justify-between gap-3 border-b border-line-soft px-6 py-4 sm:px-8">
                <div className="min-w-0">
                  <p className="font-mono text-[0.65rem] font-medium uppercase tracking-[0.14em] text-amber">
                    Upload film
                  </p>
                  <h2
                    id="upload-film-title"
                    className="truncate font-display text-xl font-semibold text-cream"
                  >
                    Publish a new film
                  </h2>
                </div>
                {!showProgress && (
                  <button
                    type="button"
                    onClick={() => closeModal()}
                    aria-label="Close"
                    className="shrink-0 text-sage transition-colors hover:text-cream"
                  >
                    <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round">
                      <path d="M6 6l12 12M18 6L6 18" />
                    </svg>
                  </button>
                )}
              </div>

              {/* Body — scrolls independently */}
              <div className="min-h-0 flex-1 overflow-y-auto px-6 py-5 sm:px-8">
                {showProgress && activeTask ? (
                  <ProgressPanel key={activeTask.id} task={activeTask} />
                ) : (
                  <>
                {tasks.length > 0 && (
                  <div className="mb-6 space-y-2.5">
                    <p className={label}>Uploads</p>
                    {tasks.map((task) => (
                      <TaskRow key={task.id} task={task} />
                    ))}
                  </div>
                )}

                <div className="space-y-4">
                  <div>
                    <label className={label} htmlFor="uf-title">Title</label>
                    <input
                      id="uf-title"
                      className={field}
                      value={fields.title}
                      onChange={(e) => set("title", e.target.value)}
                      placeholder="Midnight Atlas"
                    />
                  </div>
                  <div>
                    <label className={label} htmlFor="uf-synopsis">Synopsis</label>
                    <textarea
                      id="uf-synopsis"
                      rows={3}
                      className={`${field} resize-none`}
                      value={fields.synopsis}
                      onChange={(e) => set("synopsis", e.target.value)}
                      placeholder="A one or two sentence summary."
                    />
                  </div>
                  <div className="grid grid-cols-2 gap-3">
                    <div>
                      <label className={label} htmlFor="uf-category">Category</label>
                      <select
                        id="uf-category"
                        className={`${field} appearance-none`}
                        value={fields.category}
                        onChange={(e) => set("category", e.target.value)}
                      >
                        <option value="" disabled>Select…</option>
                        {CATEGORIES.map((c) => (
                          <option key={c} value={c}>{c}</option>
                        ))}
                      </select>
                    </div>
                    <div>
                      <label className={label} htmlFor="uf-year">Release year</label>
                      <input
                        id="uf-year"
                        type="number"
                        className={`${field} font-mono`}
                        value={fields.year}
                        onChange={(e) => set("year", e.target.value)}
                      />
                    </div>
                  </div>
                  <div>
                    <label className={label} htmlFor="uf-video">Video file</label>
                    <input
                      id="uf-video"
                      ref={videoInputRef}
                      type="file"
                      accept="video/*"
                      className={`${field} file:mr-3 file:rounded-md file:border-0 file:bg-amber/15 file:px-3 file:py-1.5 file:font-mono file:text-xs file:text-amber`}
                      onChange={(e) => handleVideoChange(e.target.files?.[0] ?? null)}
                    />
                    {videoFile && (
                      <p className="mt-1 truncate text-xs text-ink-faint">
                        Selected: {videoFile.name}
                      </p>
                    )}
                    <p className="mt-1 text-xs text-ink-faint">
                      MP4, MOV, WebM, MKV, or AVI — up to 100MB.
                    </p>
                  </div>
                  <div>
                    <label className={label} htmlFor="uf-thumb">
                      Thumbnail{" "}
                      <span className="font-normal normal-case tracking-normal text-ink-faint">
                        · optional, auto-generated if left blank
                      </span>
                    </label>
                    <input
                      id="uf-thumb"
                      ref={thumbInputRef}
                      type="file"
                      accept="image/*"
                      className={`${field} file:mr-3 file:rounded-md file:border-0 file:bg-amber/15 file:px-3 file:py-1.5 file:font-mono file:text-xs file:text-amber`}
                      onChange={(e) => handleThumbnailChange(e.target.files?.[0] ?? null)}
                    />
                  </div>
                </div>

                {fieldError && (
                  <p className="mt-4 text-sm text-brick">{fieldError}</p>
                )}
                </>
                )}
              </div>

              {/* Footer — hidden during an in-flight upload (progress panel
                  owns the only action then: Cancel upload). Restored when the
                  upload reaches a terminal state. */}
              {!showProgress && (
                <div className="flex shrink-0 items-center justify-end gap-3 border-t border-line-soft px-6 py-4 sm:px-8">
                  <button
                    type="button"
                    onClick={() => closeModal()}
                    className="rounded-full px-4 py-2.5 text-sm font-medium text-sage transition-colors hover:text-cream"
                  >
                    Cancel
                  </button>
                  <button
                    type="button"
                    onClick={handleQueueUpload}
                    className="inline-flex items-center justify-center rounded-full bg-amber px-6 py-2.5 text-sm font-medium text-bark transition-all hover:bg-amber/90"
                  >
                    Start upload
                  </button>
                </div>
              )}
            </div>
          </div>
          </>,
          document.body,
        )}
    </>
  );
}
