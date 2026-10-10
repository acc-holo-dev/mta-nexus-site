"use client";

import { BadgeCheck, LoaderCircle, XCircle } from "lucide-react";
import { useRouter } from "next/navigation";
import { useEffect, useRef, useState } from "react";
import { z } from "zod";
import { platformRequest } from "../lib/user-platform-client";
import { verificationCopy, verificationDecisionError } from "../lib/verification-workspace-copy";
import {
  buildVerificationDecisionPayload,
  normalizeVerificationReviewNotes,
} from "../lib/verification-moderation";
import { useNexusLocale } from "./locale-context";

export function VerificationModerationControls({ requestId }: { requestId: string }) {
  const router = useRouter();
  const { dictionary, locale } = useNexusLocale();
  const copy = dictionary.admin;
  const [notes, setNotes] = useState("");
  const [pending, setPending] = useState<"approve" | "reject" | null>(null);
  const [error, setError] = useState<string | null>(null);
  const guard = useRef(false),
    controller = useRef<AbortController | null>(null);
  useEffect(() => () => controller.current?.abort(), []);

  const normalizedNotes = normalizeVerificationReviewNotes(notes);
  const hasNotes = normalizedNotes !== null;

  async function decide(action: "approve" | "reject") {
    const payload = buildVerificationDecisionPayload(requestId, action, notes);
    if (!payload || guard.current) return;

    const confirmed = window.confirm(
      action === "approve" ? copy.approveVerificationConfirm : copy.rejectVerificationConfirm,
    );
    if (!confirmed) return;

    guard.current = true;
    controller.current = new AbortController();
    setPending(action);
    setError(null);
    try {
      const decision = action === "approve" ? "approved" : "rejected";
      const data = await platformRequest(
        `/api/admin/verification/${encodeURIComponent(requestId)}`,
        locale,
        "PATCH",
        { decision, reviewNotes: payload.notes },
        controller.current.signal,
        verificationDecisionError,
      );
      if (
        !z.object({ id: z.literal(requestId), status: z.literal(decision) }).safeParse(data).success
      )
        throw new Error(verificationCopy(locale).decisionUnavailable);
      setNotes("");
      router.refresh();
    } catch (caught) {
      setError(
        caught instanceof Error ? caught.message : verificationCopy(locale).decisionUnavailable,
      );
    } finally {
      guard.current = false;
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
          placeholder={copy.reviewNoteDecision}
          className="w-full resize-y rounded-md border border-base bg-inset px-2.5 py-2 text-xs text-primary outline-none transition-colors focus-visible:ring-2 focus-visible:ring-[color:var(--nexus-accent)]"
        />
      </label>

      <div className="flex flex-wrap gap-2">
        <button
          type="button"
          disabled={!hasNotes || pending !== null}
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
          disabled={!hasNotes || pending !== null}
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
    </div>
  );
}
