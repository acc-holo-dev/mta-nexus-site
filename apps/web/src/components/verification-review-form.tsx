"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";

export function VerificationReviewForm({ requestId }: { requestId: string }) {
  const router = useRouter();
  const [notes, setNotes] = useState("");
  const [submitting, setSubmitting] = useState<"approve" | "reject" | null>(null);
  const [error, setError] = useState<string | null>(null);

  async function review(action: "approve" | "reject") {
    setSubmitting(action);
    setError(null);
    try {
      const response = await fetch("/api/admin/actions", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          targetType: "verification",
          targetId: requestId,
          action,
          notes: notes || undefined,
        }),
      });
      const payload = (await response.json()) as { error?: string };
      if (!response.ok) throw new Error(payload.error || "Could not review request");
      router.refresh();
    } catch (cause: unknown) {
      setError(cause instanceof Error ? cause.message : "Could not review request");
    } finally {
      setSubmitting(null);
    }
  }

  return (
    <div className="w-full md:w-72 space-y-2">
      <input
        value={notes}
        onChange={(event) => setNotes(event.target.value)}
        maxLength={2000}
        placeholder="Moderator notes"
        className="w-full nexus-inset px-3 py-2 text-xs"
      />
      <div className="flex gap-2">
        <button
          type="button"
          disabled={submitting !== null}
          onClick={() => review("approve")}
          className="flex-1 rounded-md bg-success-soft px-3 py-2 text-xs font-semibold text-success disabled:opacity-50"
        >
          {submitting === "approve" ? "Approving…" : "Approve"}
        </button>
        <button
          type="button"
          disabled={submitting !== null}
          onClick={() => review("reject")}
          className="flex-1 rounded-md bg-danger-soft px-3 py-2 text-xs font-semibold text-danger disabled:opacity-50"
        >
          {submitting === "reject" ? "Rejecting…" : "Reject"}
        </button>
      </div>
      {error && <p className="font-caption text-danger">{error}</p>}
    </div>
  );
}
