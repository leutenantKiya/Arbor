"use client";

import { FormEvent, useEffect, useRef, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import {
  leaveFilmmakerProgram,
  updateFilmmakerProfile,
  type FilmmakerSettingsInput,
} from "@/lib/creators/settings-actions";

export type FilmmakerSettingsValues = FilmmakerSettingsInput & {
  email: string;
};

export function FilmmakerSettings({
  initialValues,
}: {
  initialValues: FilmmakerSettingsValues;
}) {
  const router = useRouter();
  const [values, setValues] = useState(initialValues);
  const [confirmLeave, setConfirmLeave] = useState(false);
  const [toast, setToast] = useState<{ type: "success" | "error"; message: string } | null>(null);
  const [isSaving, startSaving] = useTransition();
  const [isLeaving, startLeaving] = useTransition();
  const cancelLeaveRef = useRef<HTMLButtonElement>(null);

  useEffect(() => {
    setValues(initialValues);
  }, [initialValues]);

  useEffect(() => {
    if (!toast) return;
    const timeout = window.setTimeout(() => setToast(null), 4200);
    return () => window.clearTimeout(timeout);
  }, [toast]);

  useEffect(() => {
    if (!confirmLeave) return;
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === "Escape" && !isLeaving) setConfirmLeave(false);
    };
    window.addEventListener("keydown", onKeyDown);
    const timeout = window.setTimeout(() => cancelLeaveRef.current?.focus(), 0);
    return () => {
      window.removeEventListener("keydown", onKeyDown);
      window.clearTimeout(timeout);
    };
  }, [confirmLeave, isLeaving]);

  const setValue = <K extends keyof FilmmakerSettingsValues>(
    key: K,
    value: FilmmakerSettingsValues[K],
  ) => setValues((current) => ({ ...current, [key]: value }));

  const save = (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    startSaving(async () => {
      const result = await updateFilmmakerProfile({
        fullName: values.fullName,
        country: values.country,
        shortBio: values.shortBio,
        preferredGenres: values.preferredGenres,
        walletAddress: values.walletAddress,
        portfolioLinks: values.portfolioLinks,
        previousFilmsLink: values.previousFilmsLink,
        previousAwardsLink: values.previousAwardsLink,
        coOwnerFullName: values.coOwnerFullName,
      });

      if (!result.ok) {
        setToast({ type: "error", message: result.error });
        return;
      }

      setToast({ type: "success", message: "Profile settings saved." });
      router.refresh();
    });
  };

  const leave = () => {
    startLeaving(async () => {
      const result = await leaveFilmmakerProgram();
      if (!result.ok) {
        setToast({ type: "error", message: result.error });
        return;
      }
      router.replace("/studio");
      router.refresh();
    });
  };

  const field = "w-full rounded-lg border border-line bg-bark px-3 py-2 text-sm text-cream placeholder:text-ink-faint transition-colors focus:border-amber focus:outline-none";
  const label = "mb-1.5 block font-mono text-[0.62rem] font-medium uppercase tracking-[0.12em] text-sage";

  return (
    <>
      <form onSubmit={save} className="space-y-5">
        <section className="rounded-card border border-line bg-surface p-5 sm:p-6">
          <div className="flex flex-col gap-1 sm:flex-row sm:items-start sm:justify-between sm:gap-6">
            <div>
              <h2 className="font-display text-2xl font-semibold text-cream">Profile settings</h2>
              <p className="mt-1 text-sm text-sage">Keep your public filmmaker profile and payout details up to date.</p>
            </div>
            <p className="shrink-0 font-mono text-[0.65rem] uppercase tracking-[0.14em] text-ink-faint">Account email: {values.email || "Unavailable"}</p>
          </div>

          <div className="mt-6 grid gap-5 sm:grid-cols-2">
            <Field label="Full name">
              <input className={field} value={values.fullName} onChange={(event) => setValue("fullName", event.target.value)} required maxLength={400} />
            </Field>
            <Field label="Country">
              <input className={field} value={values.country} onChange={(event) => setValue("country", event.target.value)} required maxLength={60} />
            </Field>
            <Field label="Preferred genres">
              <input className={field} value={values.preferredGenres} onChange={(event) => setValue("preferredGenres", event.target.value)} maxLength={200} placeholder="e.g. Animation, documentary" />
            </Field>
            <Field label="Payout wallet address">
              <input className={field} value={values.walletAddress} onChange={(event) => setValue("walletAddress", event.target.value)} required maxLength={100} spellCheck={false} placeholder="0x…" />
            </Field>
          </div>

          <div className="mt-5">
            <Field label="Short bio">
              <textarea className={`${field} min-h-28 resize-y`} value={values.shortBio} onChange={(event) => setValue("shortBio", event.target.value)} maxLength={3000} placeholder="Tell viewers a little about your work." />
            </Field>
          </div>
        </section>

        <section className="rounded-card border border-line bg-surface p-5 sm:p-6">
          <h2 className="font-display text-2xl font-semibold text-cream">Portfolio & credits</h2>
          <p className="mt-1 text-sm text-sage">These details support your filmmaker profile and application history.</p>

          <div className="mt-6 grid gap-5 sm:grid-cols-2">
            <Field label="Portfolio links">
              <textarea className={`${field} min-h-24 resize-y`} value={values.portfolioLinks} onChange={(event) => setValue("portfolioLinks", event.target.value)} maxLength={4000} placeholder="https://…" />
            </Field>
            <Field label="Previous films link">
              <input className={field} value={values.previousFilmsLink} onChange={(event) => setValue("previousFilmsLink", event.target.value)} maxLength={4000} placeholder="https://…" />
            </Field>
            <Field label="Previous awards link">
              <input className={field} value={values.previousAwardsLink} onChange={(event) => setValue("previousAwardsLink", event.target.value)} maxLength={4000} placeholder="https://…" />
            </Field>
            <Field label="Co-owner name">
              <input className={field} value={values.coOwnerFullName} onChange={(event) => setValue("coOwnerFullName", event.target.value)} maxLength={400} />
            </Field>
          </div>
        </section>

        <div className="flex justify-end">
          <button type="submit" disabled={isSaving} className="inline-flex items-center justify-center rounded-full bg-amber px-6 py-2.5 text-sm font-medium text-bark transition-all hover:bg-amber/90 disabled:cursor-not-allowed disabled:bg-amber/15 disabled:text-amber-soft/50">
            {isSaving ? "Saving…" : "Save changes"}
          </button>
        </div>
      </form>

      <section className="mt-10 rounded-card border border-brick/50 bg-surface p-5 sm:p-6">
        <p className="font-mono text-[0.68rem] uppercase tracking-[0.15em] text-brick">Danger zone</p>
        <h2 className="mt-2 font-display text-2xl font-semibold text-cream">Leave Filmmaker Program</h2>
        <p className="mt-2 max-w-2xl text-sm leading-6 text-sage">Your filmmaker dashboard will no longer be available. Your profile, films, earnings, settlements, analytics, and wallet data will remain intact. You can rejoin only by submitting a new application.</p>
        <button type="button" onClick={() => setConfirmLeave(true)} className="mt-5 inline-flex items-center justify-center rounded-full border border-brick/70 px-5 py-2.5 text-sm font-medium text-brick transition-colors hover:bg-brick/10 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-brick">
          Leave Filmmaker Program
        </button>
      </section>

      {confirmLeave && (
        <div className="animate-backdrop-in fixed inset-0 z-[120] flex items-center justify-center bg-bark/80 p-4 backdrop-blur-md" onPointerDown={(event) => { if (event.target === event.currentTarget && !isLeaving) setConfirmLeave(false); }}>
          <section role="dialog" aria-modal="true" aria-labelledby="leave-program-title" className="animate-modal-in w-full max-w-md rounded-card border border-line bg-surface p-6 shadow-2xl shadow-black/60" onPointerDown={(event) => event.stopPropagation()}>
            <p className="font-mono text-[0.68rem] uppercase tracking-[0.15em] text-brick">Danger zone</p>
            <h2 id="leave-program-title" className="mt-2 font-display text-2xl font-semibold text-cream">Leave Filmmaker Program?</h2>
            <p className="mt-3 text-sm leading-6 text-sage">Your filmmaker dashboard will no longer be available. This does not delete your films, earnings, settlements, analytics, or wallet data. Rejoining requires a new application.</p>
            <div className="mt-7 flex flex-col-reverse gap-3 sm:flex-row sm:justify-end">
              <button ref={cancelLeaveRef} type="button" disabled={isLeaving} onClick={() => setConfirmLeave(false)} className="rounded-full border border-line px-5 py-2.5 text-sm text-sage transition-colors hover:border-sage hover:text-cream disabled:cursor-not-allowed">
                Cancel
              </button>
              <button type="button" disabled={isLeaving} onClick={leave} className="rounded-full bg-brick px-5 py-2.5 text-sm font-medium text-bark transition-colors hover:bg-brick/90 disabled:cursor-not-allowed disabled:opacity-60">
                {isLeaving ? "Leaving…" : "Leave program"}
              </button>
            </div>
          </section>
        </div>
      )}

      {toast && (
        <div className="animate-rise fixed bottom-5 right-5 z-[130] flex max-w-sm items-center gap-3 rounded-card border border-line bg-surface-2 px-4 py-3 shadow-xl" role="status">
          <span className={`h-2 w-2 shrink-0 rounded-full ${toast.type === "success" ? "bg-fern" : "bg-brick"}`} />
          <p className="text-sm text-cream">{toast.message}</p>
        </div>
      )}
    </>
  );
}

function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <label>
      <span className="mb-1.5 block font-mono text-[0.62rem] font-medium uppercase tracking-[0.12em] text-sage">{label}</span>
      {children}
    </label>
  );
}
