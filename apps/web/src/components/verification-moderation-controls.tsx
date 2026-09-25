"use client";

import { BadgeCheck, LoaderCircle, XCircle } from "lucide-react";
import { useRouter } from "next/navigation";
import { useState } from "react";

export function VerificationModerationControls({
  requestId,
}: {
  requestId: string;
}) {
  const router = useRouter();
  const [notes, setNotes] = useState("");
  const [pending, setPending] = useState<"approve" | "reject" | null>(null);
  const [error, setError] = useState<string | null>(null);

  const hasNotes = notes.trim().length >= 3;

  async function decide(action: "approve" | "reject") {
    if (!hasNotes || pending) return;
    const confirmed = window.confirm(
      action === "approve"
        ? "Approve this verification request?"
        : "Reject this verification request?",
    );
    if (!confirmed) return;

    setPending(action);
    setError(null);
    try {
      const response = await fetch("/api/admin/actions", {
        method: "POST",
        cache: "no-store",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          targetType: "verification",
          targetId: requestId,
          action,
          notes: notes.trim(),
        }),
        signal: AbortSignal.timeout(10_000),
      });
      const data = await response.json().catch(() => null);
      if (!response.ok) {
        setError(data?.error || "Verification moderation failed.");
        return;
      }
      setNotes("");
      router.refresh();
    } catch {
      setError("Verification moderation is temporarily unavailable.");
    } finally {
      setPending(null);
    }
  }

  return (
    <div className="w-full max-w-sm space-y-2 md:w-80">
      <label className="block space-y-1">
        <span className="text-[10px] font-bold uppercase tracking-wider text-neutral-500">
          Review note
        </span>
        <textarea
          value={notes}
          onChange={(event) => setNotes(event.target.value)}
          minLength={3}
          maxLength={2000}
          rows={2}
          placeholder="Required for approve or reject"
          className="w-full resize-y rounded-md border border-base bg-neutral-950 px-2.5 py-2 text-xs text-neutral-200 outline-none focus:border-blue-500"
        />
      </label>

      <div className="flex flex-wrap gap-2">
        <button
          type="button"
          disabled={!hasNotes || pending !== null}
          onClick={() => void decide("approve")}
          className="inline-flex min-h-9 items-center gap-1.5 rounded-md border border-emerald-500/30 bg-emerald-500/10 px-3 py-2 text-[11px] font-semibold text-emerald-300 hover:bg-emerald-500/20 disabled:cursor-not-allowed disabled:opacity-40"
        >
          {pending === "approve" ? (
            <LoaderCircle className="h-3.5 w-3.5 animate-spin" aria-hidden="true" />
          ) : (
            <BadgeCheck className="h-3.5 w-3.5" aria-hidden="true" />
          )}
          Approve
        </button>
        <button
          type="button"
          disabled={!hasNotes || pending !== null}
          onClick={() => void decide("reject")}
          className="inline-flex min-h-9 items-center gap-1.5 rounded-md border border-red-500/30 bg-red-500/10 px-3 py-2 text-[11px] font-semibold text-red-300 hover:bg-red-500/20 disabled:cursor-not-allowed disabled:opacity-40"
        >
          {pending === "reject" ? (
            <LoaderCircle className="h-3.5 w-3.5 animate-spin" aria-hidden="true" />
          ) : (
            <XCircle className="h-3.5 w-3.5" aria-hidden="true" />
          )}
          Reject
        </button>
      </div>

      {!hasNotes && (
        <p className="text-[10px] text-neutral-600">
          Enter at least 3 characters of review context.
        </p>
      )}
      {error && (
        <p role="alert" className="text-[11px] text-red-300">
          {error}
        </p>
      )}
    </div>
  );
}
