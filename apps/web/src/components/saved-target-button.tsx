"use client";

import { useState } from "react";
import Link from "next/link";
import { Bookmark } from "lucide-react";

type SavedTargetType = "server" | "product";

export function SavedTargetButton({
  targetType,
  targetId,
  label,
  isAuthenticated,
  initialSaved,
}: {
  targetType: SavedTargetType;
  targetId: string;
  label: string;
  isAuthenticated: boolean;
  initialSaved: boolean;
}) {
  const [saved, setSaved] = useState(initialSaved);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  if (!isAuthenticated) {
    return (
      <Link
        href="/auth/login"
        className="inline-flex items-center gap-2 rounded-lg border border-base px-4 py-3 text-sm font-semibold text-primary hover:bg-hover"
      >
        <Bookmark className="h-4 w-4" />
        Save {label}
      </Link>
    );
  }

  async function toggleSaved() {
    if (submitting) return;
    setSubmitting(true);
    setError(null);

    try {
      const response = await fetch("/api/follow", {
        method: saved ? "DELETE" : "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ targetType, targetId }),
      });
      const payload = (await response.json().catch(() => ({}))) as { error?: string };
      if (!response.ok && !(response.status === 409 && !saved)) {
        throw new Error(payload.error || `Could not update saved ${label}s`);
      }
      setSaved(!saved || response.status === 409);
    } catch (caught: unknown) {
      setError(caught instanceof Error ? caught.message : `Could not update saved ${label}s`);
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <div className="space-y-1">
      <button
        type="button"
        aria-pressed={saved}
        onClick={toggleSaved}
        disabled={submitting}
        className="inline-flex items-center gap-2 rounded-lg border border-base px-4 py-3 text-sm font-semibold text-primary hover:bg-hover disabled:cursor-wait disabled:opacity-60"
      >
        <Bookmark className={`h-4 w-4 ${saved ? "fill-current text-accent" : ""}`} />
        {submitting ? "Saving…" : saved ? "Saved" : `Save ${label}`}
      </button>
      {error && <p role="alert" className="max-w-48 text-[11px] text-danger">{error}</p>}
    </div>
  );
}
