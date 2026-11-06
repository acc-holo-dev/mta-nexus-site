"use client";
import { Button, ErrorState } from "@nexus/ui";

import { Download, LoaderCircle, ShieldCheck, XCircle } from "lucide-react";
import { useRouter } from "next/navigation";
import { useRef, useState } from "react";
import { confirmsAdminAction } from "../lib/admin-action-confirmation";
import { buildModerationUiState } from "../lib/build-moderation-ui";
import { getResourceBuildWorkspaceCopy } from "../lib/resource-build-workspace-i18n";
import { verificationCopy } from "../lib/verification-workspace-copy";
import { confirmAction } from "./confirm-action";
import { useNexusLocale } from "./locale-context";

export function BuildModerationControls({
  buildId,
  scanStatus,
  hasScanProvenance,
  expectedRevision,
}: {
  buildId: string;
  scanStatus: string;
  hasScanProvenance: boolean;
  expectedRevision?: number;
}) {
  const router = useRouter();
  const { dictionary, locale } = useNexusLocale();
  const versionCopy = getResourceBuildWorkspaceCopy(locale);
  const busy = useRef(false);
  const [uncertain, setUncertain] = useState(false);
  const copy = dictionary.admin;
  const [notes, setNotes] = useState("");
  const [pending, setPending] = useState<"approve" | "reject" | null>(null);
  const [confirmedWrite, setConfirmedWrite] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const { hasNotes, hasTrustedCleanScan, canApprove, canReject } = buildModerationUiState({
    scanStatus,
    hasScanProvenance,
    notes,
    pending,
  });

  async function moderate(action: "approve" | "reject") {
    if (
      busy.current ||
      uncertain ||
      !expectedRevision ||
      confirmedWrite ||
      pending ||
      !hasNotes ||
      (action === "approve" && !hasTrustedCleanScan)
    ) {
      return;
    }

    const labels = verificationCopy(locale);
    if (
      !(await confirmAction({
        title: action === "approve" ? copy.approve : copy.reject,
        object: buildId,
        consequences: action === "approve" ? copy.approveBuildConfirm : copy.rejectBuildConfirm,
        confirmLabel: action === "approve" ? copy.approve : copy.reject,
        cancelLabel: labels.cancel,
        closeLabel: labels.cancel,
        ...(action === "approve" ? { danger: false } : {}),
      }))
    )
      return;

    busy.current = true;
    setPending(action);
    setError(null);
    try {
      const response = await fetch("/api/admin/actions", {
        method: "POST",
        cache: "no-store",
        credentials: "same-origin",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          targetType: "build",
          targetId: buildId,
          action,
          notes: notes.trim(),
          expectedRevision,
        }),
        signal: AbortSignal.timeout(10_000),
      });
      const data = await response.json().catch(() => null);
      if (!confirmsAdminAction(response.status, data, buildId, action)) {
        setError(response.status === 409 ? versionCopy.conflict : copy.buildFailed);
        if (response.status !== 429) setUncertain(true);
        return;
      }
      setConfirmedWrite(true);
      setNotes("");
      router.refresh();
    } catch {
      setError(versionCopy.failed);
      setUncertain(true);
    } finally {
      busy.current = false;
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
          className="w-full resize-y rounded-md border border-base bg-inset px-2.5 py-2 text-xs text-primary transition-colors hover:border-strong focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[color:var(--nexus-accent)] focus-visible:ring-offset-2 focus-visible:ring-offset-[color:var(--nexus-page)]"
        />
      </label>

      {!hasTrustedCleanScan ? (
        <ErrorState
          id="build-moderation-artifact-clean-scan"
          title={copy.artifactRequiresCleanScan}
        />
      ) : null}

      <div className="flex flex-wrap gap-2">
        {hasTrustedCleanScan ? (
          <a
            href={`/api/admin/builds/${encodeURIComponent(buildId)}/download`}
            className="inline-flex min-h-11 items-center gap-1.5 rounded-md border border-base bg-surface px-3 py-2 text-[11px] font-semibold text-secondary transition-colors hover:bg-hover hover:text-primary"
          >
            <Download className="h-3.5 w-3.5" aria-hidden="true" />
            {copy.reviewArtifact}
          </a>
        ) : null}

        <Button
          type="button"
          disabled={uncertain || !expectedRevision || confirmedWrite || !canApprove}
          onClick={() => void moderate("approve")}
          className="min-h-11 gap-1.5 bg-success-soft text-success text-[11px]"
          variant="outline"
        >
          {pending === "approve" ? (
            <LoaderCircle className="h-3.5 w-3.5 animate-spin" aria-hidden="true" />
          ) : (
            <ShieldCheck className="h-3.5 w-3.5" aria-hidden="true" />
          )}
          {copy.approve}
        </Button>

        <Button
          type="button"
          disabled={uncertain || !expectedRevision || confirmedWrite || !canReject}
          onClick={() => void moderate("reject")}
          className="min-h-11 gap-1.5 bg-danger-soft text-danger text-[11px]"
          variant="outline"
        >
          {pending === "reject" ? (
            <LoaderCircle className="h-3.5 w-3.5 animate-spin" aria-hidden="true" />
          ) : (
            <XCircle className="h-3.5 w-3.5" aria-hidden="true" />
          )}
          {copy.reject}
        </Button>
      </div>

      {error ? (
        <ErrorState
          id="build-moderation-controls-unavailable"
          title={error}
          description={versionCopy.failedDescription}
          action={
            uncertain ? (
              <Button
                type="button"
                onClick={() => router.refresh()}
                className="h-auto min-h-11 px-0 text-sm text-accent underline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[var(--nexus-accent)]"
                variant="ghost"
              >
                {versionCopy.reload}
              </Button>
            ) : null
          }
        />
      ) : null}
      {!hasNotes && (
        <p className="text-[10px] text-faint" aria-live="polite">
          {copy.reviewNoteHint}
        </p>
      )}
    </div>
  );
}
