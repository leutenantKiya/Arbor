"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { useAccount, useSmartAccount } from "@particle-network/connectkit";
import {
  submitCreatorApplication,
  type CreatorApplicationInput,
} from "@/lib/creators/actions";

// ---------------------------------------------------------------------------
// Apply as Creator — a single self-contained widget: the Studio-page CTA
// button, the multi-step application modal it opens, and the success toast.
//
// Keeping button + modal + toast in one component guarantees there is only
// ever ONE modal instance on the page (the spec's "no duplicate UI" rule) and
// lets the modal share the trigger's open/close state directly.
//
// Submission is handled entirely by the submitCreatorApplication Server Action
// (lib/creators/actions.ts) — this client only collects fields, validates, and
// calls the action. All DB work stays on the server.
//
// Draft persistence: every field + the current step are mirrored to
// sessionStorage under DRAFT_KEY. Reopening the button restores the draft and
// jumps back to the last step the applicant reached. "Start Over" clears it.
// A successful submit clears it too.
// ---------------------------------------------------------------------------

const DRAFT_KEY = "arbor_creator_application_draft";
const TOTAL_STEPS = 3;

type YesNo = "" | "yes" | "no";

type FormData = {
  // step 1 — about you
  fullName: string;
  email: string;
  country: string;
  applicantType: string;
  coOwnerFullName: string;
  // step 2 — your work
  hasReleasedWorkBefore: YesNo;
  experience: string;
  consideredGenre: string;
  consideredGenreOther: string;
  shortBio: string;
  portfolioLinks: string;
  previousFilmsLink: string;
  previousAwardsLink: string;
  // step 3 — rights & payout
  holdsFullRights: boolean;
  paymentWalletAddress: string;
  closingStatement: string;
};

const EMPTY: FormData = {
  fullName: "",
  email: "",
  country: "",
  applicantType: "",
  coOwnerFullName: "",
  hasReleasedWorkBefore: "",
  experience: "",
  consideredGenre: "",
  consideredGenreOther: "",
  shortBio: "",
  portfolioLinks: "",
  previousFilmsLink: "",
  previousAwardsLink: "",
  holdsFullRights: false,
  paymentWalletAddress: "",
  closingStatement: "",
};

// value = the enum code the DB CHECK constraint requires; label = friendly text
const APPLICANT_TYPES = [
  { value: "individual", label: "Individual filmmaker" },
  { value: "production_company", label: "Production company" },
];
// Year-range criteria shown next to the selected level — a reasonable
// industry-convention default (no product spec pins exact numbers yet;
// adjust freely, it's display-only and never sent to the server).
const EXPERIENCE_LEVELS = [
  { value: "beginner", label: "Beginner", years: "Less than 5 years" },
  { value: "intermediate", label: "Intermediate", years: "5-10 years" },
  { value: "professional", label: "Professional", years: "More than 10 years" },
];
const GENRES = [
  "Drama",
  "Documentary",
  "Experimental",
  "Animation",
  "Short film",
  "Horror",
  "Comedy",
  "Other",
];

// Standard ISO 3166-1 short English country names, alphabetical.
const COUNTRIES = [
  "Afghanistan", "Albania", "Algeria", "Andorra", "Angola",
  "Antigua and Barbuda", "Argentina", "Armenia", "Australia", "Austria",
  "Azerbaijan", "Bahamas", "Bahrain", "Bangladesh", "Barbados",
  "Belarus", "Belgium", "Belize", "Benin", "Bhutan",
  "Bolivia", "Bosnia and Herzegovina", "Botswana", "Brazil", "Brunei",
  "Bulgaria", "Burkina Faso", "Burundi", "Cabo Verde", "Cambodia",
  "Cameroon", "Canada", "Central African Republic", "Chad", "Chile",
  "China", "Colombia", "Comoros", "Congo (Brazzaville)", "Congo (Kinshasa)",
  "Costa Rica", "Croatia", "Cuba", "Cyprus", "Czechia",
  "Denmark", "Djibouti", "Dominica", "Dominican Republic", "Ecuador",
  "Egypt", "El Salvador", "Equatorial Guinea", "Eritrea", "Estonia",
  "Eswatini", "Ethiopia", "Fiji", "Finland", "France",
  "Gabon", "Gambia", "Georgia", "Germany", "Ghana",
  "Greece", "Grenada", "Guatemala", "Guinea", "Guinea-Bissau",
  "Guyana", "Haiti", "Honduras", "Hungary", "Iceland",
  "India", "Indonesia", "Iran", "Iraq", "Ireland",
  "Israel", "Italy", "Ivory Coast", "Jamaica", "Japan",
  "Jordan", "Kazakhstan", "Kenya", "Kiribati", "Kuwait",
  "Kyrgyzstan", "Laos", "Latvia", "Lebanon", "Lesotho",
  "Liberia", "Libya", "Liechtenstein", "Lithuania", "Luxembourg",
  "Madagascar", "Malawi", "Malaysia", "Maldives", "Mali",
  "Malta", "Marshall Islands", "Mauritania", "Mauritius", "Mexico",
  "Micronesia", "Moldova", "Monaco", "Mongolia", "Montenegro",
  "Morocco", "Mozambique", "Myanmar", "Namibia", "Nauru",
  "Nepal", "Netherlands", "New Zealand", "Nicaragua", "Niger",
  "Nigeria", "North Korea", "North Macedonia", "Norway", "Oman",
  "Pakistan", "Palau", "Palestine", "Panama", "Papua New Guinea",
  "Paraguay", "Peru", "Philippines", "Poland", "Portugal",
  "Qatar", "Romania", "Russia", "Rwanda", "Saint Kitts and Nevis",
  "Saint Lucia", "Saint Vincent and the Grenadines", "Samoa", "San Marino",
  "Sao Tome and Principe", "Saudi Arabia", "Senegal", "Serbia",
  "Seychelles", "Sierra Leone", "Singapore", "Slovakia", "Slovenia",
  "Solomon Islands", "Somalia", "South Africa", "South Korea",
  "South Sudan", "Spain", "Sri Lanka", "Sudan", "Suriname",
  "Sweden", "Switzerland", "Syria", "Taiwan", "Tajikistan",
  "Tanzania", "Thailand", "Timor-Leste", "Togo", "Tonga",
  "Trinidad and Tobago", "Tunisia", "Turkey", "Turkmenistan", "Tuvalu",
  "Uganda", "Ukraine", "United Arab Emirates", "United Kingdom",
  "United States", "Uruguay", "Uzbekistan", "Vanuatu", "Vatican City",
  "Venezuela", "Vietnam", "Yemen", "Zambia", "Zimbabwe",
];

type StoredDraft = { step: number; data: FormData };

// A draft only counts as "real" once the applicant has typed something or
// moved past step 1 — this avoids restoring an all-empty shell.
function isMeaningful(d: StoredDraft): boolean {
  if (d.step > 0) return true;
  return Object.entries(d.data).some(([k, v]) => {
    if (k === "holdsFullRights") return v === true;
    return String(v).trim() !== "";
  });
}

function readDraft(): StoredDraft | null {
  try {
    const raw = sessionStorage.getItem(DRAFT_KEY);
    if (!raw) return null;
    const parsed = JSON.parse(raw) as StoredDraft;
    const merged = { step: parsed.step ?? 0, data: { ...EMPTY, ...parsed.data } };
    return isMeaningful(merged) ? merged : null;
  } catch {
    return null;
  }
}

const isEmail = (v: string) => /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(v.trim());
const isWallet = (v: string) => /^0x[a-fA-F0-9]{40}$/.test(v.trim());

export function ApplyCreator({ hasApplied }: { hasApplied: boolean }) {
  const [open, setOpen] = useState(false);
  const [step, setStep] = useState(0);
  const [data, setData] = useState<FormData>(EMPTY);
  const [showRestored, setShowRestored] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [submitError, setSubmitError] = useState<string | null>(null);
  const [toast, setToast] = useState(false);

  const triggerRef = useRef<HTMLButtonElement>(null);
  const firstFieldRef = useRef<HTMLInputElement>(null);
  const dirtyRef = useRef(false);

  const set = <K extends keyof FormData>(key: K, value: FormData[K]) => {
    dirtyRef.current = true;
    setSubmitError(null);
    setData((prev) => ({ ...prev, [key]: value }));
  };

  // Connected account → offer "Use this wallet" on the payout step. Prefer the
  // Smart Account address (what actually holds/settles USDC on Arbor), falling
  // back to the connected EOA.
  const { address, isConnected } = useAccount();
  const smartAccount = useSmartAccount();
  const [connectedWallet, setConnectedWallet] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;
    if (!isConnected) {
      setConnectedWallet(null);
      return;
    }
    (async () => {
      try {
        const addr = smartAccount
          ? await smartAccount.getAddress()
          : address ?? null;
        if (!cancelled) setConnectedWallet(addr ?? null);
      } catch {
        if (!cancelled) setConnectedWallet(address ?? null);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [isConnected, smartAccount, address]);

  // ── Persist to sessionStorage whenever the draft is dirty ───────────────
  useEffect(() => {
    if (!dirtyRef.current) return;
    try {
      sessionStorage.setItem(DRAFT_KEY, JSON.stringify({ step, data }));
    } catch {
      /* storage unavailable — form still works in-memory */
    }
  }, [data, step]);

  // ── Open: restore an existing draft, else start fresh ───────────────────
  const openModal = useCallback(() => {
    const draft = readDraft();
    if (draft) {
      setData(draft.data);
      setStep(Math.min(draft.step, TOTAL_STEPS - 1));
      setShowRestored(true);
      dirtyRef.current = true;
    } else {
      setData(EMPTY);
      setStep(0);
      setShowRestored(false);
      dirtyRef.current = false;
    }
    setSubmitError(null);
    setOpen(true);
  }, []);

  const closeModal = useCallback(() => {
    setOpen(false);
    triggerRef.current?.focus();
  }, []);

  const startOver = () => {
    try {
      sessionStorage.removeItem(DRAFT_KEY);
    } catch {
      /* ignore */
    }
    setData(EMPTY);
    setStep(0);
    setShowRestored(false);
    setSubmitError(null);
    dirtyRef.current = false;
  };

  // ── Body scroll lock + Escape + initial focus while open ────────────────
  useEffect(() => {
    if (!open) return;
    const prevOverflow = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") closeModal();
    };
    window.addEventListener("keydown", onKey);
    const t = setTimeout(() => firstFieldRef.current?.focus(), 60);
    return () => {
      document.body.style.overflow = prevOverflow;
      window.removeEventListener("keydown", onKey);
      clearTimeout(t);
    };
  }, [open, closeModal]);

  // ── Per-step validation (mirrors the Server Action's required checks) ───
  const stepValid = (() => {
    if (step === 0)
      return (
        data.fullName.trim() !== "" &&
        isEmail(data.email) &&
        data.country.trim() !== "" &&
        data.applicantType !== ""
      );
    if (step === 1)
      return data.hasReleasedWorkBefore !== "" && data.experience !== "";
    return data.holdsFullRights && isWallet(data.paymentWalletAddress);
  })();

  const next = () => {
    if (!stepValid) return;
    if (step < TOTAL_STEPS - 1) setStep((s) => s + 1);
    else void submit();
  };

  async function submit() {
    setSubmitting(true);
    setSubmitError(null);
    try {
      const payload: CreatorApplicationInput = {
        fullName: data.fullName,
        email: data.email,
        country: data.country,
        applicantType: data.applicantType,
        coOwnerFullName: data.coOwnerFullName,
        hasReleasedWorkBefore: data.hasReleasedWorkBefore === "yes",
        experience: data.experience,
        consideredGenre:
          data.consideredGenre === "Other"
            ? data.consideredGenreOther.trim() || "Other"
            : data.consideredGenre,
        shortBio: data.shortBio,
        portfolioLinks: data.portfolioLinks,
        previousFilmsLink: data.previousFilmsLink,
        previousAwardsLink: data.previousAwardsLink,
        holdsFullRights: data.holdsFullRights,
        paymentWalletAddress: data.paymentWalletAddress,
        closingStatement: data.closingStatement,
      };

      const res = await submitCreatorApplication(payload);
      if (!res.ok) {
        setSubmitError(res.error);
        return;
      }

      // Success: clear draft, close modal, show toast.
      try {
        sessionStorage.removeItem(DRAFT_KEY);
      } catch {
        /* ignore */
      }
      dirtyRef.current = false;
      setOpen(false);
      setToast(true);
      setTimeout(() => setToast(false), 4200);
    } catch (err) {
      console.error("[ApplyCreator] submit failed:", err);
      setSubmitError("Something went wrong. Please try again.");
    } finally {
      setSubmitting(false);
    }
  }

  const field =
    "w-full rounded-lg border border-line bg-bark px-3 py-2 text-sm text-cream placeholder:text-ink-faint transition-colors focus:border-amber focus:outline-none";
  const label =
    "mb-1.5 block font-mono text-[0.62rem] font-medium uppercase tracking-[0.12em] text-sage";
  const optionalTag = (
    <span className="font-normal normal-case tracking-normal text-ink-faint">
      {" "}
      · optional
    </span>
  );

  return (
    <>
      {/* ── CTA (Studio hero) ────────────────────────────────────────── */}
      <div className="mt-7 flex flex-col gap-2 sm:flex-row sm:items-center">
        <button
          ref={triggerRef}
          type="button"
          onClick={openModal}
          disabled={hasApplied}
          className="inline-flex items-center justify-center rounded-full bg-amber px-5 py-2.5 text-sm font-medium text-bark transition-all hover:bg-amber/90 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-amber disabled:cursor-not-allowed disabled:bg-amber/15 disabled:text-amber-soft/50 disabled:hover:bg-amber/15"
        >
          {hasApplied ? "Application submitted" : "Apply as Creator"}
        </button>
        <p className="text-sm text-sage">
          {hasApplied
            ? "We've received your application — we'll be in touch."
            : "Ready to publish your films on Arbor? Apply to become a verified creator."}
        </p>
      </div>

      {/* ── Modal ─────────────────────────────────────────────────────── */}
      {open && !hasApplied && (
        <div
          className="animate-backdrop-in fixed inset-0 z-50 flex items-end justify-center bg-bark/80 p-4 backdrop-blur-md sm:items-center"
          onMouseDown={(e) => {
            if (e.target === e.currentTarget) closeModal();
          }}
        >
          <div
            role="dialog"
            aria-modal="true"
            aria-labelledby="apply-title"
            className="animate-modal-in relative w-full max-w-lg overflow-hidden rounded-card border border-line bg-surface shadow-2xl"
          >
            <button
              type="button"
              onClick={closeModal}
              aria-label="Close"
              className="absolute right-4 top-4 z-10 text-sage transition-colors hover:text-cream"
            >
              <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round">
                <path d="M6 6l12 12M18 6L6 18" />
              </svg>
            </button>

            <div className="max-h-[85vh] overflow-y-auto p-6 sm:p-8">
              <p className="font-mono text-[0.65rem] font-medium uppercase tracking-[0.14em] text-amber">
                Creator application
              </p>
              <h2
                id="apply-title"
                className="mt-1 font-display text-2xl font-semibold text-cream"
              >
                {step === 0 && "Tell us about you"}
                {step === 1 && "Your work"}
                {step === 2 && "Rights & payout"}
              </h2>

              {/* Restored-draft notice */}
              {showRestored && (
                <div className="mt-4 flex items-center justify-between gap-3 rounded-lg border border-amber/25 bg-amber/10 px-3 py-2.5">
                  <p className="text-xs text-amber-soft">
                    Your previous application draft has been restored.
                  </p>
                  <button
                    type="button"
                    onClick={startOver}
                    className="shrink-0 text-xs font-medium text-amber underline-offset-2 hover:underline"
                  >
                    Start Over
                  </button>
                </div>
              )}

              {/* Progress */}
              <div className="mt-5 flex items-center gap-2" aria-hidden>
                {Array.from({ length: TOTAL_STEPS }).map((_, i) => (
                  <span
                    key={i}
                    className={`h-1 flex-1 rounded-full transition-colors ${
                      i <= step ? "bg-amber" : "bg-line"
                    }`}
                  />
                ))}
              </div>
              <p className="mt-2 font-mono text-[0.6rem] uppercase tracking-[0.12em] text-ink-faint">
                Step {step + 1} of {TOTAL_STEPS}
              </p>

              {/* Steps */}
              <div className="mt-5 space-y-4">
                {step === 0 && (
                  <>
                    <div>
                      <label className={label} htmlFor="ac-name">Full name</label>
                      <input
                        id="ac-name"
                        ref={firstFieldRef}
                        className={field}
                        value={data.fullName}
                        onChange={(e) => set("fullName", e.target.value)}
                        placeholder="Ava Mercer"
                      />
                    </div>
                    <div>
                      <label className={label} htmlFor="ac-email">Email</label>
                      <input
                        id="ac-email"
                        type="email"
                        className={field}
                        value={data.email}
                        onChange={(e) => set("email", e.target.value)}
                        placeholder="you@studio.com"
                      />
                    </div>
                    <div>
                      <label className={label} htmlFor="ac-country">Country / region</label>
                      <select
                        id="ac-country"
                        className={`${field} appearance-none`}
                        value={data.country}
                        onChange={(e) => set("country", e.target.value)}
                      >
                        <option value="" disabled>Select…</option>
                        {COUNTRIES.map((c) => (
                          <option key={c} value={c}>{c}</option>
                        ))}
                      </select>
                    </div>
                    <div>
                      <label className={label} htmlFor="ac-type">Applying as</label>
                      <select
                        id="ac-type"
                        className={`${field} appearance-none`}
                        value={data.applicantType}
                        onChange={(e) => set("applicantType", e.target.value)}
                      >
                        <option value="" disabled>Select…</option>
                        {APPLICANT_TYPES.map((t) => (
                          <option key={t.value} value={t.value}>{t.label}</option>
                        ))}
                      </select>
                    </div>
                    <div>
                      <label className={label} htmlFor="ac-coowner">
                        Co-owner full name{optionalTag}
                      </label>
                      <input
                        id="ac-coowner"
                        className={field}
                        value={data.coOwnerFullName}
                        onChange={(e) => set("coOwnerFullName", e.target.value)}
                        placeholder="If the work is co-owned"
                      />
                    </div>
                  </>
                )}

                {step === 1 && (
                  <>
                    <div>
                      <span className={label}>
                        Have you released or distributed work before?
                      </span>
                      <div className="flex gap-2">
                        {(["yes", "no"] as const).map((opt) => (
                          <button
                            key={opt}
                            type="button"
                            onClick={() => set("hasReleasedWorkBefore", opt)}
                            className={`flex-1 rounded-lg border px-3 py-2 text-sm font-medium capitalize transition-colors ${
                              data.hasReleasedWorkBefore === opt
                                ? "border-amber bg-amber/10 text-amber-soft"
                                : "border-line bg-bark text-sage hover:text-cream"
                            }`}
                          >
                            {opt}
                          </button>
                        ))}
                      </div>
                    </div>
                    <div>
                      <div className="mb-1.5 flex items-baseline justify-between gap-3">
                        <label className={`${label} mb-0`} htmlFor="ac-exp">
                          Filmmaking experience
                        </label>
                      </div>
                      <div
                        id="ac-exp"
                        role="radiogroup"
                        aria-label="Filmmaking experience"
                        className="flex flex-col gap-2"
                      >
                        {EXPERIENCE_LEVELS.map((x) => {
                          const selected = data.experience === x.value;
                          return (
                            <button
                              type="button"
                              role="radio"
                              aria-checked={selected}
                              key={x.value}
                              onClick={() => set("experience", x.value)}
                              className={`flex w-full items-center justify-between gap-3 rounded-lg border px-3 py-2.5 text-left transition-colors ${
                                selected
                                  ? "border-amber bg-amber/10 text-cream"
                                  : "border-line bg-bark text-sage hover:text-cream"
                              }`}
                            >
                              <span className="text-sm">{x.label}</span>
                              <span className="shrink-0 text-right text-xs text-ink-faint">
                                {x.years}
                              </span>
                            </button>
                          );
                        })}
                      </div>
                    </div>
                    <div>
                      <label className={label} htmlFor="ac-genre">
                        Primary genre{optionalTag}
                      </label>
                      <select
                        id="ac-genre"
                        className={`${field} appearance-none`}
                        value={data.consideredGenre}
                        onChange={(e) => {
                          set("consideredGenre", e.target.value);
                          if (e.target.value !== "Other") {
                            set("consideredGenreOther", "");
                          }
                        }}
                      >
                        <option value="">Select a genre…</option>
                        {GENRES.map((g) => (
                          <option key={g} value={g}>{g}</option>
                        ))}
                      </select>
                      {data.consideredGenre === "Other" && (
                        <input
                          id="ac-genre-other"
                          className={`${field} mt-2`}
                          value={data.consideredGenreOther}
                          onChange={(e) => set("consideredGenreOther", e.target.value)}
                          placeholder="Tell us your genre"
                          maxLength={200}
                        />
                      )}
                    </div>
                    <div>
                      <label className={label} htmlFor="ac-portfolio">
                        Portfolio or reel link{optionalTag}
                      </label>
                      <input
                        id="ac-portfolio"
                        className={field}
                        value={data.portfolioLinks}
                        onChange={(e) => set("portfolioLinks", e.target.value)}
                        placeholder="https://vimeo.com/…"
                      />
                    </div>
                    <div>
                      <label className={label} htmlFor="ac-prevfilms">
                        Link to previous films{optionalTag}
                      </label>
                      <input
                        id="ac-prevfilms"
                        className={field}
                        value={data.previousFilmsLink}
                        onChange={(e) => set("previousFilmsLink", e.target.value)}
                        placeholder="https://…"
                      />
                    </div>
                    <div>
                      <label className={label} htmlFor="ac-awards">
                        Awards or press link{optionalTag}
                      </label>
                      <input
                        id="ac-awards"
                        className={field}
                        value={data.previousAwardsLink}
                        onChange={(e) => set("previousAwardsLink", e.target.value)}
                        placeholder="https://…"
                      />
                    </div>
                    <div>
                      <label className={label} htmlFor="ac-bio">
                        Short bio{optionalTag}
                      </label>
                      <textarea
                        id="ac-bio"
                        rows={3}
                        className={`${field} resize-none`}
                        value={data.shortBio}
                        onChange={(e) => set("shortBio", e.target.value)}
                        placeholder="A sentence or two about your work."
                      />
                    </div>
                  </>
                )}

                {step === 2 && (
                  <>
                    <div>
                      <div className="mb-1.5 flex items-baseline justify-between gap-3">
                        <label className={`${label} mb-0`} htmlFor="ac-wallet">
                          Payout wallet (USDC)
                        </label>
                        {connectedWallet && (
                          <button
                            type="button"
                            onClick={() =>
                              set("paymentWalletAddress", connectedWallet)
                            }
                            className="shrink-0 font-mono text-[0.62rem] font-medium uppercase tracking-[0.1em] text-amber underline-offset-2 transition-colors hover:text-amber-soft hover:underline"
                          >
                            Use this wallet
                          </button>
                        )}
                      </div>
                      <input
                        id="ac-wallet"
                        ref={firstFieldRef}
                        className={`${field} font-mono`}
                        value={data.paymentWalletAddress}
                        onChange={(e) =>
                          set("paymentWalletAddress", e.target.value)
                        }
                        placeholder="0x…"
                        spellCheck={false}
                      />
                      {connectedWallet &&
                        data.paymentWalletAddress.trim().toLowerCase() ===
                          connectedWallet.toLowerCase() && (
                          <p className="mt-1 text-xs text-sage">
                            Using your connected Arbor wallet.
                          </p>
                        )}
                      {data.paymentWalletAddress.trim() !== "" &&
                        !isWallet(data.paymentWalletAddress) && (
                          <p className="mt-1 text-xs text-brick">
                            Enter a valid 0x wallet address.
                          </p>
                        )}
                    </div>
                    <div>
                      <label className={label} htmlFor="ac-closing">
                        Anything else you&apos;d like us to know?{optionalTag}
                      </label>
                      <textarea
                        id="ac-closing"
                        rows={3}
                        className={`${field} resize-none`}
                        value={data.closingStatement}
                        onChange={(e) => set("closingStatement", e.target.value)}
                        placeholder="A closing note for the review team."
                      />
                    </div>
                    <label className="flex cursor-pointer items-start gap-3 rounded-lg border border-line bg-bark px-3 py-3">
                      <input
                        type="checkbox"
                        className="mt-0.5 h-4 w-4 accent-amber"
                        checked={data.holdsFullRights}
                        onChange={(e) => set("holdsFullRights", e.target.checked)}
                      />
                      <span className="text-xs text-sage">
                        I confirm I hold{" "}
                        <span className="text-cream">full distribution rights</span>{" "}
                        to the films I submit, and I keep 90% of every second
                        watched, settled on-chain to my wallet.
                      </span>
                    </label>
                  </>
                )}
              </div>

              {/* Submit error */}
              {submitError && (
                <p className="mt-4 text-sm text-brick">{submitError}</p>
              )}

              {/* Footer */}
              <div className="mt-7 flex items-center justify-between gap-3">
                {step > 0 ? (
                  <button
                    type="button"
                    onClick={() => setStep((s) => s - 1)}
                    className="rounded-full px-4 py-2.5 text-sm font-medium text-sage transition-colors hover:text-cream"
                  >
                    Back
                  </button>
                ) : (
                  <span />
                )}
                <button
                  type="button"
                  onClick={next}
                  disabled={!stepValid || submitting}
                  className="inline-flex items-center justify-center rounded-full bg-amber px-6 py-2.5 text-sm font-medium text-bark transition-all hover:bg-amber/90 disabled:cursor-not-allowed disabled:bg-amber/15 disabled:text-amber-soft/50"
                >
                  {submitting
                    ? "Submitting…"
                    : step < TOTAL_STEPS - 1
                      ? "Continue"
                      : "Submit application"}
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* ── Success toast ─────────────────────────────────────────────── */}
      {toast && (
        <div className="animate-rise fixed bottom-5 right-5 z-[60] flex items-center gap-3 rounded-card border border-line bg-surface-2 px-4 py-3 shadow-xl">
          <span className="h-2 w-2 shrink-0 rounded-full bg-fern" />
          <p className="text-sm text-cream">
            Application submitted — we&apos;ll be in touch.
          </p>
        </div>
      )}
    </>
  );
}
