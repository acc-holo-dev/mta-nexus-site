"use client";

import { CheckCircle2, LoaderCircle, XCircle } from "lucide-react";
import { useRouter } from "next/navigation";
import { useState } from "react";
import { confirmsAdminAction } from "../lib/admin-action-confirmation";
import { useNexusLocale } from "./locale-context";

export function ReportModerationControls({ reportId }: { reportId: string }) {
  const router = useRouter();
  const { dictionary } = useNexusLocale();
  const copy = dictionary.admin;
  const [notes, setNotes] = useState("");
  const [pending, setPending] = useState<"resolve" | "dismiss" | null>(null);
  const [error, setError] = useState<string | null>(null);
  const ready = notes.trim().length >= 3;

  async function decide(action: "resolve" | "dismiss") {
    if (!ready || pending) return;
    if (
      !window.confirm(action === "resolve" ? copy.resolveReportConfirm : copy.dismissReportConfirm)
    )
      return;
    setPending(action);
    setError(null);
    try {
      const response = await fetch("/api/admin/actions", {
        method: "POST",
        cache: "no-store",
        credentials: "same-origin",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          targetType: "report",
          targetId: reportId,
          action,
          notes: notes.trim(),
        }),
        signal: AbortSignal.timeout(10_000),
      });
      const data = await response.json().catch(() => null);
      if (!confirmsAdminAction(response.status, data, reportId, action)) {
        setError(data?.error || copy.reportDecisionFailed);
        return;
      }
      setNotes("");
      router.refresh();
    } catch {
      setError(copy.reportDecisionUnavailable);
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
          placeholder={copy.reviewNoteAudit}
          className="w-full resize-y rounded-md border border-base bg-inset px-2.5 py-2 text-xs text-primary outline-none focus-visible:ring-2 focus-visible:ring-[color:var(--nexus-accent)]"
        />
      </label>
      <div className="flex flex-wrap gap-2">
        <button
          type="button"
          disabled={!ready || pending !== null}
          onClick={() => void decide("resolve")}
          className="inline-flex min-h-9 items-center gap-1.5 rounded-md border border-base bg-success-soft px-3 py-2 text-xs font-semibold text-success disabled:cursor-not-allowed disabled:opacity-40"
        >
          {pending === "resolve" ? (
            <LoaderCircle className="h-4 w-4 animate-spin" aria-hidden="true" />
          ) : (
            <CheckCircle2 className="h-4 w-4" aria-hidden="true" />
          )}
          {copy.resolveReport}
        </button>
        <button
          type="button"
          disabled={!ready || pending !== null}
          onClick={() => void decide("dismiss")}
          className="inline-flex min-h-9 items-center gap-1.5 rounded-md border border-base bg-danger-soft px-3 py-2 text-xs font-semibold text-danger disabled:cursor-not-allowed disabled:opacity-40"
        >
          {pending === "dismiss" ? (
            <LoaderCircle className="h-4 w-4 animate-spin" aria-hidden="true" />
          ) : (
            <XCircle className="h-4 w-4" aria-hidden="true" />
          )}
          {copy.dismissReport}
        </button>
      </div>
      {!ready && <p className="text-[10px] text-faint">{copy.reviewNoteHint}</p>}
      {error && (
        <p role="alert" className="text-xs text-danger">
          {error}
        </p>
      )}
    </div>
  );
}
