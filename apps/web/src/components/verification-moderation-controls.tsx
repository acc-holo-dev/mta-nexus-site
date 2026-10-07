"use client";

import { BadgeCheck, LoaderCircle, XCircle } from "lucide-react";
import { useRouter } from "next/navigation";
import { useState } from "react";
import { confirmsAdminAction } from "../lib/admin-action-confirmation";
import {
  buildVerificationDecisionPayload,
  normalizeVerificationReviewNotes,
} from "../lib/verification-moderation";
import { useNexusLocale } from "./locale-context";

export function VerificationModerationControls({
  requestId,
}: {
  requestId: string;
}) {
  const router = useRouter();
  const { dictionary } = useNexusLocale();
  const copy = dictionary.admin;
  const [notes, setNotes] = useState("");
  const [pending, setPending] = useState<"approve" | "reject" | null>(null);
  const [error, setError] = useState<string | null>(null);

  const normalizedNotes = normalizeVerificationReviewNotes(notes);
  const hasNotes = normalizedNotes !== null;

  async function decide(action: "approve" | "reject") {
    const payload = buildVerificationDecisionPayload(
      requestId,
      action,
      notes,
    );
    if (!payload || pending) return;

    const confirmed = window.confirm(
      action === "approve"
        ? copy.approveVerificationConfirm
        : copy.rejectVerificationConfirm,
    );
    if (!confirmed) return;

    setPending(action);
    setError(null);
    try {
      const response = await fetch("/api/admin/actions", {
        method: "POST",
        cache: "no-store",
        credentials: "same-origin",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
        signal: AbortSignal.timeout(10_000),
      });
      const data = await response.json().catch(() => null);
      if (!confirmsAdminAction(response.status, data, requestId, action)) {
        setError(data?.error || copy.verificationFailed);
        return;
      }
      setNotes("");
      router.refresh();
    } catch {
      setError(copy.verificationUnavailable);
    } finally {
      setPending(null);
    }
  }

  return (
    <div className="w-full max-w-sm space-y-2 md:w-80" aria-busy={pending !== null}>
      <label className="block space-y-1">
        <span className="font-label uppercase text-muted">{copy.reviewNote}</span>
        <textarea
          value={notes}
          onChange={(event) => setNotes(event.target.value)}
          minLength={3}
          maxLength={2000}
          rows={2}
          placeholder={copy.reviewNoteDecision}
          className="w-full resize-y rounded-md border border-base bg-inset px-2.5 py-2 text-xs text-primary outline-none transition-colors focus-visible:ring-2 focus-visible:ring-[color:var(--nexus-accent)]"
        />
      </label>

      <div className="flex flex-wrap gap-2">
        <button
          type="button"
          disabled={!hasNotes || pending !== null}
          onClick={() => void decide("approve")}
          className="inline-flex min-h-9 items-center gap-1.5 rounded-md border border-[color:var(--nexus-success)]/25 bg-success-soft px-3 py-2 text-[11px] font-semibold text-success transition-colors hover:opacity-80 disabled:cursor-not-allowed disabled:opacity-40"
        >
          {pending === "approve" ? (
            <LoaderCircle className="h-3.5 w-3.5 animate-spin" aria-hidden="true" />
          ) : (
            <BadgeCheck className="h-3.5 w-3.5" aria-hidden="true" />
          )}
          {copy.approve}
        </button>

        <button
          type="button"
          disabled={!hasNotes || pending !== null}
          onClick={() => void decide("reject")}
          className="inline-flex min-h-9 items-center gap-1.5 rounded-md border border-[color:var(--nexus-danger)]/25 bg-danger-soft px-3 py-2 text-[11px] font-semibold text-danger transition-colors hover:opacity-80 disabled:cursor-not-allowed disabled:opacity-40"
        >
          {pending === "reject" ? (
            <LoaderCircle className="h-3.5 w-3.5 animate-spin" aria-hidden="true" />
          ) : (
            <XCircle className="h-3.5 w-3.5" aria-hidden="true" />
          )}
          {copy.reject}
        </button>
      </div>

      {!hasNotes && <p className="text-[10px] text-faint">{copy.reviewNoteHint}</p>}
      {error && <p role="alert" className="text-[11px] text-danger">{error}</p>}
    </div>
  );
}
