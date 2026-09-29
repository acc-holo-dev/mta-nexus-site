"use client";

import { FormEvent, useState } from "react";
import Link from "next/link";

type ReportType = "fake_server" | "abuse" | "spam" | "copyright" | "other";

export function ServerReportForm({
  serverId,
  isAuthenticated,
}: {
  serverId: string;
  isAuthenticated: boolean;
}) {
  const [expanded, setExpanded] = useState(false);
  const [type, setType] = useState<ReportType>("fake_server");
  const [reason, setReason] = useState("");
  const [evidenceUrl, setEvidenceUrl] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [submitted, setSubmitted] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const normalizedReason = reason.trim();
    if (submitting || normalizedReason.length < 10) return;

    setSubmitting(true);
    setError(null);
    try {
      const response = await fetch("/api/reports", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          targetType: "server",
          targetId: serverId,
          type,
          reason: normalizedReason,
          evidenceUrls: evidenceUrl ? [evidenceUrl] : [],
        }),
      });
      const payload = (await response.json().catch(() => ({}))) as { error?: string };
      if (!response.ok) {
        throw new Error(payload.error || "Could not submit the report");
      }
      setSubmitted(true);
    } catch (caught: unknown) {
      setError(caught instanceof Error ? caught.message : "Could not submit the report");
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <section className="nexus-panel p-5 space-y-3" aria-labelledby="server-report-title">
      <div className="flex items-start justify-between gap-3">
        <div>
          <h2 id="server-report-title" className="font-heading text-primary">
            Report this server
          </h2>
          <p className="font-caption text-muted mt-1">
            Tell moderators about misleading, abusive or otherwise harmful listings.
          </p>
        </div>
        {isAuthenticated && !submitted && (
          <button
            type="button"
            aria-expanded={expanded}
            aria-controls="server-report-form"
            onClick={() => setExpanded((value) => !value)}
            className="shrink-0 rounded-md border border-base px-3 py-2 text-xs font-semibold text-primary hover:bg-hover"
          >
            {expanded ? "Cancel" : "Report"}
          </button>
        )}
      </div>

      {!isAuthenticated && (
        <Link href="/auth/login" className="inline-flex text-xs font-semibold text-accent hover:underline">
          Sign in to report this listing
        </Link>
      )}

      {submitted && (
        <p role="status" className="text-xs text-success">
          Report sent to moderators. Thank you for helping keep server listings trustworthy.
        </p>
      )}

      {isAuthenticated && expanded && !submitted && (
        <form id="server-report-form" onSubmit={submit} className="space-y-3">
          <label className="block space-y-1.5">
            <span className="font-label text-muted uppercase">Reason</span>
            <select
              value={type}
              onChange={(event) => setType(event.target.value as ReportType)}
              className="w-full nexus-inset px-3 py-2 text-sm"
            >
              <option value="fake_server">Misleading server listing</option>
              <option value="abuse">Abuse or harmful content</option>
              <option value="spam">Spam</option>
              <option value="copyright">Copyright concern</option>
              <option value="other">Other</option>
            </select>
          </label>

          <label className="block space-y-1.5">
            <span className="font-label text-muted uppercase">Details</span>
            <textarea
              required
              minLength={10}
              maxLength={1000}
              rows={4}
              value={reason}
              onChange={(event) => setReason(event.target.value)}
              className="w-full nexus-inset px-3 py-2 text-sm"
            />
            <span className="block text-right text-[11px] text-faint">{reason.length}/1000</span>
          </label>

          <label className="block space-y-1.5">
            <span className="font-label text-muted uppercase">Evidence link (optional)</span>
            <input
              type="url"
              maxLength={2000}
              value={evidenceUrl}
              onChange={(event) => setEvidenceUrl(event.target.value)}
              className="w-full nexus-inset px-3 py-2 text-sm"
            />
          </label>

          {error && <p role="alert" className="text-xs text-danger">{error}</p>}

          <button
            type="submit"
            disabled={submitting || reason.trim().length < 10}
            className="rounded-md bg-accent px-4 py-2 text-xs font-semibold text-white disabled:opacity-50"
          >
            {submitting ? "Sending…" : "Send report"}
          </button>
          <p className="text-[11px] text-muted">
            Reports are reviewed by moderators. Do not include passwords or private account details.
          </p>
        </form>
      )}
    </section>
  );
}
