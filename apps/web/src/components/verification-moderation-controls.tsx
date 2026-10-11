"use client";

import { BadgeCheck, LoaderCircle, XCircle } from "lucide-react";
import { useRouter } from "next/navigation";
import { useEffect, useRef, useState } from "react";
import { z } from "zod";
import { platformRequest } from "../lib/user-platform-client";
import {
  buildVerificationDecisionPayload,
  normalizeVerificationReviewNotes,
} from "../lib/verification-moderation";
import { verificationCopy, verificationDecisionError } from "../lib/verification-workspace-copy";
import { useNexusLocale } from "./locale-context";

export function VerificationModerationControls({
  requestId,
  applicationRevision,
}: {
  requestId: string;
  applicationRevision?: string;
}) {
  const router = useRouter();
  const { dictionary, locale } = useNexusLocale();
  const copy = dictionary.admin;
  const [notes, setNotes] = useState("");
  const [pending, setPending] = useState<"approve" | "reject" | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [blocked, setBlocked] = useState(false);
  const guard = useRef(false),
    alive = useRef(true),
    controller = useRef<AbortController | null>(null);
  useEffect(() => {
    alive.current = true;
    return () => {
      alive.current = false;
      controller.current?.abort();
    };
  }, []);

  const normalizedNotes = normalizeVerificationReviewNotes(notes);
  const hasNotes = normalizedNotes !== null;

  async function decide(action: "approve" | "reject") {
    const payload = buildVerificationDecisionPayload(requestId, action, notes);
    if (!payload || guard.current || blocked) return;

    const confirmed = window.confirm(
      action === "approve" ? copy.approveVerificationConfirm : copy.rejectVerificationConfirm,
    );
    if (!confirmed) return;

    guard.current = true;
    setBlocked(true);
    controller.current = new AbortController();
    setPending(action);
    setError(null);
    try {
      const decision = action === "approve" ? "approved" : "rejected";
      const data = await platformRequest(
        `/api/admin/verification/${encodeURIComponent(requestId)}`,
        locale,
        "PATCH",
        {
          decision,
          reviewNotes: payload.notes,
          ...(applicationRevision ? { expectedApplicationRevision: applicationRevision } : {}),
        },
        controller.current.signal,
        verificationDecisionError,
      );
      if (!alive.current) return;
      if (
        !z.object({ id: z.literal(requestId), status: z.literal(decision) }).safeParse(data).success
      )
        throw new Error(verificationCopy(locale).decisionUnavailable);
      setNotes("");
      router.refresh();
    } catch (caught) {
      if (!alive.current) return;
      setError(
        caught instanceof Error ? caught.message : verificationCopy(locale).decisionUnavailable,
      );
    } finally {
      guard.current = false;
      if (alive.current) setPending(null);
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
          disabled={pending !== null || blocked}
          rows={2}
          placeholder={copy.reviewNoteDecision}
          className="w-full resize-y rounded-md border border-base bg-inset px-2.5 py-2 text-xs text-primary outline-none transition-colors focus-visible:ring-2 focus-visible:ring-[color:var(--nexus-accent)]"
        />
      </label>

      <div className="flex flex-wrap gap-2">
        <button
          type="button"
          disabled={!hasNotes || pending !== null || blocked}
          onClick={() => void decide("approve")}
          className="inline-flex min-h-9 items-center gap-1.5 rounded-md border border-[color:var(--nexus-success)]/25 bg-success-soft px-3 py-2 text-[11px] font-semibold text-success transition-colors hover:opacity-80 disabled:cursor-not-allowed disabled:opacity-40"
        >
          {pending === "approve" ? (
            <LoaderCircle className="h-3.5 w-3.5 animate-spin" aria-hidden="true" />
          ) : (
            <BadgeCheck className="h-3.5 w-3.5" aria-hidden="true" />
          )}
          {copy.approve}
        </button>

        <button
          type="button"
          disabled={!hasNotes || pending !== null || blocked}
          onClick={() => void decide("reject")}
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

      {!hasNotes && <p className="text-[10px] text-faint">{copy.reviewNoteHint}</p>}
      {error && (
        <p role="alert" className="text-[11px] text-danger">
          {error}
        </p>
      )}
      {blocked && pending === null && (
        <button
          type="button"
          onClick={() => window.location.reload()}
          className="min-h-11 text-sm text-accent underline"
        >
          {verificationCopy(locale).reload}
        </button>
      )}
    </div>
  );
}
