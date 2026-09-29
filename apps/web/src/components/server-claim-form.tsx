"use client";

import { useState } from "react";
import Link from "next/link";

interface ServerClaimFormProps {
  serverId: string;
  isAuthenticated: boolean;
  isPending: boolean;
}

export function ServerClaimForm({
  serverId,
  isAuthenticated,
  isPending: initialPending,
}: ServerClaimFormProps) {
  const [proofUrl, setProofUrl] = useState("");
  const [notes, setNotes] = useState("");
  const [pending, setPending] = useState(initialPending);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  if (!isAuthenticated) {
    return (
      <div className="nexus-panel p-5 space-y-2">
        <h2 className="font-heading text-primary">Manage this server?</h2>
        <p className="font-caption text-muted">
          Sign in to submit ownership evidence. Live player data always remains sourced from MTA.
        </p>
        <Link href="/auth/login" className="inline-flex text-xs font-semibold text-accent hover:underline">
          Sign in to request ownership
        </Link>
      </div>
    );
  }

  if (pending) {
    return (
      <div className="nexus-panel p-5 space-y-2 border-amber-500/30">
        <h2 className="font-heading text-primary">Ownership request pending</h2>
        <p className="font-caption text-muted">
          A moderator must review the supplied evidence before editorial control is granted.
        </p>
      </div>
    );
  }

  async function submitClaim(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setSubmitting(true);
    setError(null);

    try {
      const response = await fetch("/api/verification", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          targetType: "server",
          targetId: serverId,
          proofUrl: proofUrl || undefined,
          notes,
        }),
      });
      const payload = (await response.json()) as { error?: string };
      if (!response.ok) throw new Error(payload.error || "Could not submit ownership request");
      setPending(true);
    } catch (cause: unknown) {
      setError(cause instanceof Error ? cause.message : "Could not submit ownership request");
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <form onSubmit={submitClaim} className="nexus-panel p-5 space-y-4">
      <div>
        <h2 className="font-heading text-primary">Claim this server profile</h2>
        <p className="font-caption text-muted mt-1">
          Provide public evidence that you control the server, official site, domain or community.
          Approval grants editorial access, never control over live player statistics.
        </p>
      </div>

      <label className="block space-y-1.5">
        <span className="font-label text-muted uppercase">Evidence URL</span>
        <input
          type="url"
          value={proofUrl}
          onChange={(event) => setProofUrl(event.target.value)}
          placeholder="https://official-site.example/ownership-proof"
          className="w-full nexus-inset px-3 py-2 text-sm"
        />
      </label>

      <label className="block space-y-1.5">
        <span className="font-label text-muted uppercase">Verification notes</span>
        <textarea
          required
          minLength={20}
          maxLength={1000}
          rows={4}
          value={notes}
          onChange={(event) => setNotes(event.target.value)}
          placeholder="Explain what you control and how a moderator can verify it."
          className="w-full nexus-inset px-3 py-2 text-sm"
        />
      </label>

      {error && <p className="font-caption text-danger">{error}</p>}

      <button
        type="submit"
        disabled={submitting}
        className="px-4 py-2 rounded-md bg-accent text-white text-xs font-semibold disabled:opacity-50"
      >
        {submitting ? "Submitting…" : "Submit ownership request"}
      </button>
    </form>
  );
}
