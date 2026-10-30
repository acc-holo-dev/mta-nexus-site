"use client";
import { Button } from "@nexus/ui";

import { Download, LoaderCircle, ShieldCheck, XCircle } from "lucide-react";
import { useRouter } from "next/navigation";
import { useRef, useState } from "react";
import { confirmsAdminAction } from "../lib/admin-action-confirmation";
import { buildModerationUiState } from "../lib/build-moderation-ui";
import { getResourceBuildWorkspaceCopy } from "../lib/resource-build-workspace-i18n";
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

    const confirmed = window.confirm(
      action === "approve" ? copy.approveBuildConfirm : copy.rejectBuildConfirm,
    );
    if (!confirmed) return;

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
          className="w-full resize-y rounded-md border border-base bg-inset px-2.5 py-2 text-xs text-primary outline-none transition-colors focus-visible:ring-2 focus-visible:ring-[color:var(--nexus-accent)]"
        />
      </label>

      <div className="flex flex-wrap gap-2">
        {hasTrustedCleanScan ? (
          <a
            href={`/api/admin/builds/${encodeURIComponent(buildId)}/download`}
            className="inline-flex min-h-9 items-center gap-1.5 rounded-md border border-base bg-surface px-3 py-2 text-[11px] font-semibold text-secondary transition-colors hover:bg-hover hover:text-primary"
          >
            <Download className="h-3.5 w-3.5" aria-hidden="true" />
            {copy.reviewArtifact}
          </a>
        ) : (
          <span className="inline-flex min-h-9 items-center rounded-md border border-[color:var(--nexus-warning)]/20 bg-warning-soft px-3 py-2 text-[11px] text-warning">
            {copy.artifactRequiresCleanScan}
          </span>
        )}

        <Button
          type="button"
          disabled={uncertain || !expectedRevision || confirmedWrite || !canApprove}
          onClick={() => void moderate("approve")}
          className="min-h-9 gap-1.5 bg-success-soft text-success text-[11px]"
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
          className="min-h-9 gap-1.5 bg-danger-soft text-danger text-[11px]"
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

      {error && (
        <p role="alert" className="text-[11px] text-danger">
          {error}
        </p>
      )}
      {uncertain && (
        <Button
          type="button"
          onClick={() => window.location.reload()}
          className="h-auto px-0 text-accent underline"
          variant="ghost"
        >
          {versionCopy.reload}
        </Button>
      )}
      {!hasNotes && (
        <p className="text-[10px] text-faint" aria-live="polite">
          {copy.reviewNoteHint}
        </p>
      )}
    </div>
  );
}
