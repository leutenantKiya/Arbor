// Upload orchestration — deliberately a plain module, not a hook or
// component. runUpload() is a fire-and-forget async function: once started,
// its promise chain keeps executing regardless of whether any component is
// mounted to observe it, which is what lets an upload survive the modal
// being closed. Progress/status only ever reach the UI through the store
// (lib/uploads/store.ts) — nothing here depends on React.

import { getUploadSignature } from "@/lib/cloudinary/actions";
import { uploadToCloudinary } from "@/lib/cloudinary/upload";
import { createFilmFromUpload } from "@/lib/films/actions";
import {
  clearDraftFields,
  fileTaskKey,
  uploadStore,
  type UploadFields,
} from "./store";

/**
 * Queues a new film upload. Returns the task id immediately — the actual
 * upload continues in the background. Submitting the exact same file while
 * it's already active is a no-op (returns the existing task's id).
 */
export function startFilmUpload(
  fields: UploadFields,
  videoFile: File,
  thumbnailFile: File | null,
): string {
  const dedupeKey = fileTaskKey(videoFile);

  const active = uploadStore.findActiveByDedupeKey(dedupeKey);
  if (active) {
    return active.id; // already queued/running — never duplicate
  }

  // A fresh id per attempt (even for the same file) so a re-upload after an
  // earlier completed/failed attempt gets its own row/toast instead of
  // silently overwriting the finished task under a reused id.
  const id = `${dedupeKey}:${Date.now()}`;

  uploadStore.upsert({
    id,
    dedupeKey,
    status: "preparing",
    progress: 0,
    speedBytesPerSec: null,
    error: null,
    fields,
    videoFile,
    thumbnailFile,
    createdAt: Date.now(),
  });

  void runUpload(id);
  return id;
}

/** Cancels an in-flight upload. Safe to call on terminal tasks (no-op). */
export function cancelFilmUpload(id: string) {
  const task = uploadStore.get(id);
  if (!task) return;
  if (task.status === "completed" || task.status === "failed") return;
  task.abort?.();
}

/** Re-runs a failed task using its own stored fields/files — no re-entry. */
export function retryFilmUpload(id: string) {
  const task = uploadStore.get(id);
  if (!task) return;
  uploadStore.patch(id, { status: "preparing", progress: 0, error: null });
  void runUpload(id);
}

async function runUpload(id: string) {
  const task = uploadStore.get(id);
  if (!task) return;
  const { fields, videoFile, thumbnailFile } = task;

  const controller = new AbortController();
  // Wire the controller so cancelFilmUpload() can abort mid-upload. Cleared
  // once the task reaches a terminal state so nothing holds a dangling ref.
  uploadStore.patch(id, {
    abort: () => {
      if (
        uploadStore.get(id)?.status !== "completed" &&
        uploadStore.get(id)?.status !== "failed"
      ) {
        controller.abort();
      }
    },
  });

  try {
    uploadStore.patch(id, { status: "preparing" });
    const sig = await getUploadSignature();
    if (!sig.ok) {
      uploadStore.patch(id, { status: "failed", error: sig.error, abort: undefined });
      return;
    }
    const { signature, timestamp, apiKey, cloudName, folder } = sig.data;

    uploadStore.patch(id, { status: "uploading", progress: 0 });
    let lastLoaded = 0;
    let lastTime = Date.now();

    const videoResult = await uploadToCloudinary({
      file: videoFile,
      resourceType: "video",
      cloudName,
      apiKey,
      timestamp,
      signature,
      folder,
      signal: controller.signal,
      onProgress: (loaded, total) => {
        const now = Date.now();
        const dt = (now - lastTime) / 1000;
        const speed = dt > 0.2 ? (loaded - lastLoaded) / dt : null;
        if (speed !== null) {
          lastLoaded = loaded;
          lastTime = now;
        }
        uploadStore.patch(id, {
          progress: Math.round((loaded / total) * 100),
          ...(speed !== null ? { speedBytesPerSec: speed } : {}),
        });
      },
    });

    let posterUrl: string;
    if (thumbnailFile) {
      uploadStore.patch(id, { status: "processing" });
      const thumbResult = await uploadToCloudinary({
        file: thumbnailFile,
        resourceType: "image",
        cloudName,
        apiKey,
        timestamp,
        signature,
        folder,
        signal: controller.signal,
      });
      posterUrl = thumbResult.secure_url;
    } else {
      uploadStore.patch(id, { status: "processing" });
      posterUrl = `https://res.cloudinary.com/${cloudName}/video/upload/so_0/${videoResult.public_id}.jpg`;
    }

    uploadStore.patch(id, { status: "saving" });
    const saved = await createFilmFromUpload({
      title: fields.title,
      synopsis: fields.synopsis,
      category: fields.category,
      year: Number(fields.year),
      cloudinary: {
        secureUrl: videoResult.secure_url,
        publicId: videoResult.public_id,
        duration: videoResult.duration ?? 0,
        format: videoResult.format,
      },
      posterUrl,
    });

    if (!saved.ok) {
      uploadStore.patch(id, { status: "failed", error: saved.error, abort: undefined });
      return;
    }

    clearDraftFields();
    uploadStore.patch(id, { status: "completed", progress: 100, abort: undefined });
  } catch (err) {
    if ((err as Error)?.name === "AbortError") {
      uploadStore.remove(id);
      return;
    }
    uploadStore.patch(id, {
      status: "failed",
      error: (err as Error).message || "Upload failed. Please try again.",
      abort: undefined,
    });
  }
}
