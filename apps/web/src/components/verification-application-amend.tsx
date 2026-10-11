"use client";
import { useRouter } from "next/navigation";
import { type FormEvent, useEffect, useRef, useState } from "react";
import type { Locale } from "../lib/i18n";
import { platformFieldClass, platformRequest } from "../lib/user-platform-client";
import { getUserPlatformCopy } from "../lib/user-platform-copy";
import {
  confirmedVerificationApplicationAmend,
  verificationApplicationAmendSchema,
} from "../lib/verification-applications-contract";
import {
  verificationApplicationsCopy,
  verificationApplicationsError,
} from "../lib/verification-applications-copy";
import { verificationCopy } from "../lib/verification-workspace-copy";
export function VerificationApplicationAmend({
  id,
  revision,
  proofUrl,
  notes,
  locale,
}: {
  id: string;
  revision: string;
  proofUrl: string | null;
  notes: string | null;
  locale: Locale;
}) {
  const router = useRouter(),
    copy = verificationApplicationsCopy(locale),
    labels = verificationCopy(locale);
  const [proof, setProof] = useState(proofUrl ?? ""),
    [explanation, setExplanation] = useState(notes ?? ""),
    [busy, setBusy] = useState(false),
    [blocked, setBlocked] = useState(false),
    [saved, setSaved] = useState(false),
    [notice, setNotice] = useState("");
  const pending = useRef(false),
    alive = useRef(true),
    controller = useRef<AbortController | null>(null);
  useEffect(() => {
    alive.current = true;
    return () => {
      alive.current = false;
      controller.current?.abort();
    };
  }, []);
  async function amend(event: FormEvent) {
    event.preventDefault();
    if (pending.current || blocked) return;
    const parsed = verificationApplicationAmendSchema.safeParse({
      proofUrl: proof,
      notes: explanation,
      expectedRevision: revision,
    });
    if (!parsed.success) {
      setNotice(copy.invalid);
      return;
    }
    if (!window.confirm(copy.confirm)) return;
    pending.current = true;
    setBusy(true);
    setBlocked(true);
    setNotice("");
    const active = new AbortController();
    controller.current = active;
    try {
      const result = await platformRequest(
        `/api/workspace/verification/${encodeURIComponent(id)}`,
        locale,
        "PATCH",
        parsed.data,
        active.signal,
        verificationApplicationsError,
      );
      if (!alive.current) return;
      if (!confirmedVerificationApplicationAmend(result, id, revision)) throw Error(copy.uncertain);
      setSaved(true);
      setNotice(copy.saved);
      router.refresh();
    } catch (failure) {
      if (alive.current) {
        const message = failure instanceof Error ? failure.message : "";
        setNotice(
          [
            ...Object.values(copy),
            ...Object.values(labels),
            ...Object.values(getUserPlatformCopy(locale)),
          ].includes(message)
            ? message
            : copy.uncertain,
        );
      }
    } finally {
      pending.current = false;
      if (alive.current) setBusy(false);
    }
  }
  return (
    <form
      onSubmit={(event) => void amend(event)}
      aria-busy={busy}
      className="nexus-panel space-y-4 p-5"
    >
      <h2 className="font-semibold text-primary">{copy.amend}</h2>
      <p className="text-xs text-muted">{labels.proofPrivacy}</p>
      <fieldset disabled={busy || blocked} className="space-y-4">
        <label className="block space-y-1 text-sm text-secondary">
          {labels.proof}
          <input
            type="url"
            required
            maxLength={2048}
            value={proof}
            onChange={(event) => setProof(event.target.value)}
            className={`${platformFieldClass} min-h-11`}
          />
        </label>
        <label className="block space-y-1 text-sm text-secondary">
          {labels.notes}
          <textarea
            rows={5}
            required
            minLength={10}
            maxLength={1000}
            value={explanation}
            onChange={(event) => setExplanation(event.target.value)}
            className={`${platformFieldClass} min-h-11`}
          />
        </label>
        <button
          type="submit"
          className="min-h-11 rounded-lg bg-accent px-4 text-sm font-semibold text-white"
        >
          {busy ? labels.loading : copy.amend}
        </button>
      </fieldset>
      {notice && (
        <p
          role={saved ? "status" : "alert"}
          className={saved ? "text-sm text-success" : "text-sm text-danger"}
        >
          {notice}
        </p>
      )}
      {blocked && !busy && (
        <button
          type="button"
          onClick={() => window.location.reload()}
          className="min-h-11 text-sm text-accent underline"
        >
          {labels.reload}
        </button>
      )}
    </form>
  );
}
