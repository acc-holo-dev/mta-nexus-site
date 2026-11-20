"use client";
import { Button, ErrorState } from "@nexus/ui";
import { CheckCircle2, LoaderCircle, XCircle } from "lucide-react";
import { useRouter } from "next/navigation";
import { useState } from "react";
import { communityReportCopy } from "../../community/community-report-copy";
import { confirmAction } from "../../shell/confirm-action";
import { useNexusLocale } from "../../shell/locale";
import { skelH4W4Spin } from "../../shell/skeleton-shell";
import {
  typeFlexWrapGap2,
  typeLabelUpperMuted,
  typeTenFaint,
  typeWFullMaxSmSpace2Md80,
} from "../../shell/type-shell";
import { adminActionClientError } from "../admin-action-client-error";
import { confirmsAdminAction } from "../admin-action-confirmation";

export function ReportModerationControls({ reportId }: { reportId: string }) {
  const router = useRouter();
  const { dictionary, locale } = useNexusLocale();
  const copy = dictionary.admin;
  const [notes, setNotes] = useState("");
  const [pending, setPending] = useState<"resolve" | "dismiss" | null>(null);
  const [error, setError] = useState<string | null>(null);
  const ready = notes.trim().length >= 3;

  async function decide(action: "resolve" | "dismiss") {
    if (!ready || pending) return;
    const labels = communityReportCopy(locale);
    if (
      !(await confirmAction({
        title: action === "resolve" ? copy.resolveReport : copy.dismissReport,
        object: reportId,
        consequences: action === "resolve" ? copy.resolveReportConfirm : copy.dismissReportConfirm,
        confirmLabel: action === "resolve" ? copy.resolveReport : copy.dismissReport,
        cancelLabel: labels.cancel,
        closeLabel: labels.cancel,
        ...(action === "resolve" ? { danger: false } : {}),
      }))
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
        setError(adminActionClientError(locale, data?.code, copy.reportDecisionFailed));
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
    <div className={typeWFullMaxSmSpace2Md80} aria-busy={pending !== null}>
      <label className="block space-y-1">
        <span className={typeLabelUpperMuted}>{copy.reviewNote}</span>
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
      <div className={typeFlexWrapGap2}>
        <Button
          type="button"
          disabled={!ready || pending !== null}
          onClick={() => void decide("resolve")}
          className="min-h-11 gap-1.5 bg-success-soft text-success text-xs"
          variant="outline"
        >
          {pending === "resolve" ? (
            <LoaderCircle className={skelH4W4Spin} aria-hidden="true" />
          ) : (
            <CheckCircle2 className="h-4 w-4" aria-hidden="true" />
          )}
          {copy.resolveReport}
        </Button>
        <Button
          type="button"
          disabled={!ready || pending !== null}
          onClick={() => void decide("dismiss")}
          className="min-h-11 gap-1.5 bg-danger-soft text-danger text-xs"
          variant="outline"
        >
          {pending === "dismiss" ? (
            <LoaderCircle className={skelH4W4Spin} aria-hidden="true" />
          ) : (
            <XCircle className="h-4 w-4" aria-hidden="true" />
          )}
          {copy.dismissReport}
        </Button>
      </div>
      {!ready && <p className={typeTenFaint}>{copy.reviewNoteHint}</p>}
      {error ? (
        <ErrorState title={error} description={copy.reportDecisionFailedDescription} />
      ) : null}
    </div>
  );
}
