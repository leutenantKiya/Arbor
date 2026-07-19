// Global upload task store — plain module state, deliberately NOT tied to
// any React component's lifecycle. This is what lets an upload survive the
// modal being closed: the task lives here, in memory, independent of what's
// currently mounted. components/upload-film.tsx (or any other component)
// only ever *observes* this store via the useUploadTasks() hook
// (lib/uploads/use-upload-tasks.ts) — it never owns the upload itself.

export type UploadStatus =
  | "preparing"
  | "uploading"
  | "processing"
  | "saving"
  | "completed"
  | "failed";

export type UploadFields = {
  title: string;
  synopsis: string;
  category: string;
  year: string;
};

export type UploadTask = {
  id: string;
  // Identifies "the same file" (name+size+lastModified) — distinct from id
  // so that re-uploading a file after an earlier attempt already completed
  // gets a fresh id (and thus a fresh toast) instead of silently overwriting
  // the finished task under its old id.
  dedupeKey: string;
  status: UploadStatus;
  progress: number; // 0-100, meaningful during "uploading"
  speedBytesPerSec: number | null;
  error: string | null;
  fields: UploadFields;
  videoFile: File;
  thumbnailFile: File | null;
  createdAt: number;
  abort?: () => void;
};

type Listener = () => void;

class UploadStore {
  private tasks: UploadTask[] = [];
  private listeners = new Set<Listener>();

  // In-memory only (never serialized) — lets the modal restore a picked-but
  // -not-yet-submitted file across a close/reopen within the same page load.
  // Files can't live in sessionStorage, so this is the closest equivalent.
  draftVideoFile: File | null = null;
  draftThumbnailFile: File | null = null;

  subscribe = (listener: Listener): (() => void) => {
    this.listeners.add(listener);
    return () => this.listeners.delete(listener);
  };

  private emit() {
    this.listeners.forEach((l) => l());
  }

  getSnapshot = (): UploadTask[] => this.tasks;

  get(id: string): UploadTask | undefined {
    return this.tasks.find((t) => t.id === id);
  }

  /** An active (non-terminal) task already queued for this exact file, if any. */
  findActiveByDedupeKey(dedupeKey: string): UploadTask | undefined {
    return this.tasks.find(
      (t) =>
        t.dedupeKey === dedupeKey &&
        t.status !== 'completed' &&
        t.status !== 'failed',
    );
  }

  upsert(task: UploadTask) {
    const idx = this.tasks.findIndex((t) => t.id === task.id);
    this.tasks =
      idx === -1
        ? [...this.tasks, task]
        : this.tasks.map((t) => (t.id === task.id ? task : t));
    this.emit();
  }

  patch(id: string, patch: Partial<UploadTask>) {
    this.tasks = this.tasks.map((t) => (t.id === id ? { ...t, ...patch } : t));
    this.emit();
  }

  remove(id: string) {
    this.tasks = this.tasks.filter((t) => t.id !== id);
    this.emit();
  }
}

export const uploadStore = new UploadStore();

/**
 * A stable identity for "the same file" — used both to key a task and to
 * dedupe: submitting the identical file while it's already queued/uploading
 * just returns the existing task instead of starting a second one.
 */
export function fileTaskKey(file: File): string {
  return `${file.name}:${file.size}:${file.lastModified}`;
}

// ── Draft form fields (sessionStorage) ──────────────────────────────────
// Only the text fields — cleared exclusively on a successful DB insert, per
// spec, so a failed upload never silently loses what the filmmaker typed.

const DRAFT_KEY = 'arbor_upload_film_draft';

export const EMPTY_UPLOAD_FIELDS: UploadFields = {
  title: '',
  synopsis: '',
  category: '',
  year: String(new Date().getFullYear()),
};

export function readDraftFields(): UploadFields {
  try {
    const raw = sessionStorage.getItem(DRAFT_KEY);
    if (!raw) return EMPTY_UPLOAD_FIELDS;
    return { ...EMPTY_UPLOAD_FIELDS, ...JSON.parse(raw) };
  } catch {
    return EMPTY_UPLOAD_FIELDS;
  }
}

export function writeDraftFields(fields: UploadFields) {
  try {
    sessionStorage.setItem(DRAFT_KEY, JSON.stringify(fields));
  } catch {
    /* storage unavailable — form still works in-memory */
  }
}

export function clearDraftFields() {
  try {
    sessionStorage.removeItem(DRAFT_KEY);
  } catch {
    /* ignore */
  }
}
