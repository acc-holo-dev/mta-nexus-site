"use client";

import { Download, LoaderCircle, ShieldCheck, XCircle } from "lucide-react";
import { useRouter } from "next/navigation";
import { useState } from "react";
import { useNexusLocale } from "./locale-context";

export function BuildModerationControls({
  buildId,
  scanStatus,
  hasScanProvenance,
}: {
  buildId: string;
  scanStatus: string;
  hasScanProvenance: boolean;
}) {
  const router = useRouter();
  const { dictionary } = useNexusLocale();
  const copy = dictionary.admin;
  const [notes, setNotes] = useState("");
  const [pending, setPending] = useState<"approve" | "reject" | null>(null);
  const [error, setError] = useState<string | null>(null);

  const hasNotes = notes.trim().length >= 3;
  const hasTrustedCleanScan = scanStatus === "clean" && hasScanProvenance;
  const canApprove = hasTrustedCleanScan && hasNotes && pending === null;
  const canReject = hasNotes && pending === null;

  async function moderate(action: "approve" | "reject") {
    if (pending || !hasNotes || (action === "approve" && !hasTrustedCleanScan)) {
      return;
    }

    const confirmed = window.confirm(
      action === "approve"
        ? copy.approveBuildConfirm
        : copy.rejectBuildConfirm,
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
        body: JSON.stringify({
          targetType: "build",
          targetId: buildId,
          action,
          notes: notes.trim(),
        }),
        signal: AbortSignal.timeout(10_000),
      });
      const data = await response.json().catch(() => null);
      if (!response.ok || data?.success !== true) {
        setError(data?.error || copy.buildFailed);
        return;
      }
      setNotes("");
      router.refresh();
    } catch {
      setError(copy.buildUnavailable);
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

        <button
          type="button"
          disabled={!canApprove}
          onClick={() => void moderate("approve")}
          className="inline-flex min-h-9 items-center gap-1.5 rounded-md border border-[color:var(--nexus-success)]/25 bg-success-soft px-3 py-2 text-[11px] font-semibold text-success transition-colors hover:opacity-80 disabled:cursor-not-allowed disabled:opacity-40"
        >
          {pending === "approve" ? (
            <LoaderCircle className="h-3.5 w-3.5 animate-spin" aria-hidden="true" />
          ) : (
            <ShieldCheck className="h-3.5 w-3.5" aria-hidden="true" />
          )}
          {copy.approve}
        </button>

        <button
          type="button"
          disabled={!canReject}
          onClick={() => void moderate("reject")}
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

      {error && <p role="alert" className="text-[11px] text-danger">{error}</p>}
      {!hasNotes && (
        <p className="text-[10px] text-faint" aria-live="polite">
          {copy.reviewNoteHint}
        </p>
      )}
    </div>
  );
}
