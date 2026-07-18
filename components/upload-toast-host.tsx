"use client";

import { useEffect, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { useUploadTasks } from "@/lib/uploads/use-upload-tasks";
import { uploadStore } from "@/lib/uploads/store";

// Mounted once at the shell level (components/studio-shell.tsx), independent
// of whether the Upload Film modal is open — this is what lets a completed
// upload show its toast and refresh the dashboard even if the filmmaker
// closed the modal and kept browsing.
export function UploadToastHost() {
  const router = useRouter();
  const tasks = useUploadTasks();
  const [visible, setVisible] = useState<{ id: string; title: string }[]>([]);
  const announced = useRef<Set<string>>(new Set());

  useEffect(() => {
    for (const task of tasks) {
      if (task.status !== "completed" || announced.current.has(task.id)) continue;
      announced.current.add(task.id);

      setVisible((prev) => [...prev, { id: task.id, title: task.fields.title }]);
      router.refresh();

      setTimeout(() => {
        uploadStore.remove(task.id);
        setVisible((prev) => prev.filter((t) => t.id !== task.id));
      }, 4200);
    }
  }, [tasks, router]);

  if (visible.length === 0) return null;

  return (
    <div className="fixed bottom-5 right-5 z-[130] flex flex-col gap-2">
      {visible.map((t) => (
        <div
          key={t.id}
          className="animate-rise flex items-center gap-3 rounded-card border border-line bg-surface-2 px-4 py-3 shadow-xl"
        >
          <span className="h-2 w-2 shrink-0 rounded-full bg-fern" />
          <p className="text-sm text-cream">
            &quot;{t.title}&quot; uploaded and now live.
          </p>
        </div>
      ))}
    </div>
  );
}
