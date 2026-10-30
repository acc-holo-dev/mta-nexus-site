"use client";
import { Button } from "@nexus/ui";
import Link from "next/link";
import { type FormEvent, useEffect, useRef, useState } from "react";
import { z } from "zod";
import { communityReportCreateSchema, REPORT_TYPES } from "../lib/community-report-contract";
import { communityReportCopy, communityReportMutationError } from "../lib/community-report-copy";
import type { Locale } from "../lib/i18n";
import { platformFieldClass, platformRequest } from "../lib/user-platform-client";
export function CommunityReportForm({
  targetType,
  targetId,
  locale,
  authenticated,
}: {
  targetType: "content" | "comment";
  targetId: string;
  locale: Locale;
  authenticated: boolean;
}) {
  const copy = communityReportCopy(locale);
  const [open, setOpen] = useState(false),
    [pending, setPending] = useState(false);
  const [type, setType] = useState<(typeof REPORT_TYPES)[number]>("abuse");
  const [reason, setReason] = useState(""),
    [evidence, setEvidence] = useState("");
  const [error, setError] = useState(""),
    [result, setResult] = useState<{ id: string; created: boolean } | null>(null);
  const guard = useRef(false);
  const controller = useRef<AbortController | null>(null);
  useEffect(() => () => controller.current?.abort(), []);
  async function submit(event: FormEvent) {
    event.preventDefault();
    if (guard.current) return;
    const parsed = communityReportCreateSchema.safeParse({
      targetType,
      targetId,
      type,
      reason,
      evidenceUrls: evidence
        .split(/\r?\n/u)
        .map((line) => line.trim())
        .filter(Boolean),
    });
    if (!parsed.success) {
      setError(copy.invalid);
      return;
    }
    guard.current = true;
    setPending(true);
    setError("");
    controller.current = new AbortController();
    try {
      const data = await platformRequest(
        "/api/workspace/reports",
        locale,
        "POST",
        parsed.data,
        controller.current.signal,
        communityReportMutationError,
      );
      const confirmed = z
        .object({
          id: z.string().regex(/^[a-zA-Z0-9_-]{1,128}$/u),
          created: z.boolean(),
          targetType: z.literal(targetType),
          targetId: z.literal(targetId),
        })
        .safeParse(data);
      if (!confirmed.success) throw new Error(copy.mutationUnavailable);
      setResult(confirmed.data);
      setReason("");
      setEvidence("");
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : copy.mutationUnavailable);
    } finally {
      guard.current = false;
      setPending(false);
    }
  }
  if (!open)
    return (
      <Button
        type="button"
        variant="ghost"
        onClick={() => setOpen(true)}
        className="h-auto min-h-9 px-0 text-xs text-muted underline"
      >
        {copy.report}
      </Button>
    );
  return (
    <section
      className="w-full space-y-3 rounded-lg border border-base bg-inset p-4"
      aria-label={copy.reportTitle}
    >
      <div className="flex flex-wrap items-center justify-between gap-3">
        <h3 className="text-sm font-semibold text-primary">{copy.reportTitle}</h3>
        <Button
          type="button"
          variant="ghost"
          className="h-auto min-h-9 px-0 text-xs text-accent underline"
          disabled={pending}
          onClick={() => setOpen(false)}
        >
          {copy.cancel}
        </Button>
      </div>
      {!authenticated ? (
        <Link className="text-sm text-accent underline" href="/auth/login">
          {copy.signIn}
        </Link>
      ) : result ? (
        <div className="space-y-2">
          <p role="status" className="text-sm text-accent">
            {result.created ? copy.saved : copy.duplicate}
          </p>
          <Link
            className="text-sm text-accent underline"
            href={`/workspace/reports/${encodeURIComponent(result.id)}`}
          >
            {copy.track}
          </Link>
        </div>
      ) : (
        <form className="space-y-3" onSubmit={submit} aria-busy={pending}>
          <label className="block space-y-1 text-sm text-secondary">
            <span>{copy.category}</span>
            <select
              className={platformFieldClass}
              value={type}
              disabled={pending}
              onChange={(event) => setType(event.target.value as typeof type)}
            >
              {REPORT_TYPES.map((value) => (
                <option key={value} value={value}>
                  {copy[value]}
                </option>
              ))}
            </select>
          </label>
          <label className="block space-y-1 text-sm text-secondary">
            <span>{copy.reason}</span>
            <textarea
              className={platformFieldClass}
              value={reason}
              required
              minLength={10}
              maxLength={1000}
              rows={4}
              disabled={pending}
              onChange={(event) => setReason(event.target.value)}
            />
          </label>
          <label className="block space-y-1 text-sm text-secondary">
            <span>{copy.evidence}</span>
            <textarea
              className={platformFieldClass}
              value={evidence}
              maxLength={10_000}
              rows={2}
              disabled={pending}
              onChange={(event) => setEvidence(event.target.value)}
            />
          </label>
          <div className="flex flex-wrap items-center gap-3">
            <Button type="submit" isLoading={pending} disabled={reason.trim().length < 10}>
              {pending ? copy.submitting : copy.submit}
            </Button>
            <Link className="text-xs text-accent underline" href="/workspace/reports">
              {copy.myReports}
            </Link>
          </div>
          {error && (
            <p role="alert" className="text-sm text-danger">
              {error}
            </p>
          )}
        </form>
      )}
    </section>
  );
}
