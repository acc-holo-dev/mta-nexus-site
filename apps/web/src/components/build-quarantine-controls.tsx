"use client";

import { LoaderCircle, RotateCcw, ShieldOff } from "lucide-react";
import { useRouter } from "next/navigation";
import { useState } from "react";
import { useNexusLocale } from "./locale-context";

export function BuildQuarantineControls({
  buildId,
  status,
}: {
  buildId: string;
  status: "published" | "quarantined";
}) {
  const router = useRouter();
  const { dictionary } = useNexusLocale();
  const copy = dictionary.admin;
  const [reason, setReason] = useState("");
  const [pending, setPending] = useState<"quarantine" | "restore" | null>(null);
  const [error, setError] = useState<string | null>(null);
  const hasReason = reason.trim().length >= 3;

  async function act(action: "quarantine" | "restore") {
    if (pending || !hasReason) return;
    const confirmed = window.confirm(
      action === "quarantine"
        ? copy.quarantineBuildConfirm
        : copy.restoreBuildConfirm,
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
          notes: reason.trim(),
        }),
        signal: AbortSignal.timeout(10_000),
      });
      const data = await response.json().catch(() => null);
      if (!response.ok || data?.success !== true) {
        setError(data?.error || copy.quarantineBuildFailed);
        return;
      }
      setReason("");
      router.refresh();
    } catch {
      setError(copy.quarantineBuildUnavailable);
    } finally {
      setPending(null);
    }
  }

  const action = status === "quarantined" ? "restore" : "quarantine";

  return (
    <div className="w-full max-w-sm space-y-2 md:w-80" aria-busy={pending !== null}>
      <label className="block space-y-1">
        <span className="font-label uppercase text-muted">
          {status === "quarantined"
            ? copy.restoreReason
            : copy.quarantineReason}
        </span>
        <textarea
          value={reason}
          onChange={(event) => setReason(event.target.value)}
          minLength={3}
          maxLength={2000}
          rows={2}
          placeholder={copy.quarantineReasonHint}
          className="w-full resize-y rounded-md border border-base bg-inset px-2.5 py-2 text-xs text-primary outline-none transition-colors focus-visible:ring-2 focus-visible:ring-[color:var(--nexus-accent)]"
        />
      </label>
      <button
        type="button"
        disabled={!hasReason || pending !== null}
        onClick={() => void act(action)}
        className={`inline-flex min-h-9 items-center gap-1.5 rounded-md border px-3 py-2 text-[11px] font-semibold transition-colors disabled:cursor-not-allowed disabled:opacity-40 ${
          action === "quarantine"
            ? "border-[color:var(--nexus-danger)]/25 bg-danger-soft text-danger"
            : "border-[color:var(--nexus-success)]/25 bg-success-soft text-success"
        }`}
      >
        {pending ? (
          <LoaderCircle className="h-3.5 w-3.5 animate-spin" aria-hidden="true" />
        ) : action === "quarantine" ? (
          <ShieldOff className="h-3.5 w-3.5" aria-hidden="true" />
        ) : (
          <RotateCcw className="h-3.5 w-3.5" aria-hidden="true" />
        )}
        {action === "quarantine"
          ? copy.quarantineBuild
          : copy.restoreBuild}
      </button>
      {error && <p role="alert" className="text-[11px] text-danger">{error}</p>}
    </div>
  );
}
