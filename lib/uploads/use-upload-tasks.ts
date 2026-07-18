"use client";

import { useSyncExternalStore } from "react";
import { uploadStore, type UploadTask } from "./store";

// The React binding for the vanilla upload store — kept in its own file so
// lib/uploads/store.ts stays framework-agnostic. useSyncExternalStore is the
// same primitive Zustand/Redux use internally for exactly this: a store that
// lives outside React, observed by whichever components happen to be
// mounted, none of which own its lifecycle.
export function useUploadTasks(): UploadTask[] {
  return useSyncExternalStore(
    uploadStore.subscribe,
    uploadStore.getSnapshot,
    () => [],
  );
}
