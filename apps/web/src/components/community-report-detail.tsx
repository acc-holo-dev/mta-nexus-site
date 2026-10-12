"use client";
import { Button } from "@nexus/ui";
import Link from "next/link";
import { useEffect, useRef, useState } from "react";
import type { z } from "zod";
import {
  type CommunityReportDetail,
  type communityReportDecisionSchema,
  communityReportDetailSchema,
  confirmsReportDecision,
} from "../lib/community-report-contract";
import {
  communityReportCopy,
  communityReportDecisionError,
  communityReportError,
} from "../lib/community-report-copy";
import { reportHistoryCopy } from "../lib/community-report-history-copy";
import { discussionReportsCopy } from "../lib/discussion-reports-copy";
import type { Locale } from "../lib/i18n";
import { platformFieldClass, platformRequest } from "../lib/user-platform-client";
import { ReportEvidenceLinks } from "./report-evidence-links";

type Decision = z.infer<typeof communityReportDecisionSchema>;
export function CommunityReportDetailView({
  id,
  initial,
  locale,
  staff = false,
}: {
  id: string;
  initial: CommunityReportDetail | null;
  locale: Locale;
  staff?: boolean;
}) {
  const copy = communityReportCopy(locale),
    path = `${staff ? "/admin/reports" : "/workspace/reports"}/${encodeURIComponent(id)}`;
  const [report, setReport] = useState(initial),
    [notes, setNotes] = useState("");
  const [pending, setPending] = useState(false),
    [error, setError] = useState(initial ? "" : copy.unavailable);
  const [confirmation, setConfirmation] = useState<Decision | null>(null),
    [success, setSuccess] = useState("");
  const [needsReload, setNeedsReload] = useState(false),
    guard = useRef(false);
  const controller = useRef<AbortController | null>(null);
  useEffect(() => () => controller.current?.abort(), []);
  async function read() {
    const parsed = communityReportDetailSchema.safeParse(
      await platformRequest(
        `/api${path}`,
        locale,
        "GET",
        undefined,
        controller.current?.signal,
        communityReportError,
      ),
    );
    if (!parsed.success || parsed.data.id !== id) throw new Error(copy.unavailable);
    return parsed.data;
  }
  async function reload() {
    if (guard.current) return;
    guard.current = true;
    setPending(true);
    setError("");
    setConfirmation(null);
    controller.current = new AbortController();
    try {
      setReport(await read());
      setNeedsReload(false);
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : copy.unavailable);
    } finally {
      guard.current = false;
      setPending(false);
    }
  }
  function choose(action: Decision["action"]) {
    if (
      !report ||
      pending ||
      needsReload ||
      notes.trim().length < 3 ||
      !["open", "under_review"].includes(report.status)
    )
      return;
    setSuccess("");
    setError("");
    setConfirmation({
      action,
      notes: notes.trim(),
      expectedStatus: report.status as Decision["expectedStatus"],
      ...(action === "remove_comment" && report.target?.revision
        ? { expectedRevision: report.target.revision }
        : {}),
    });
  }
  async function decide() {
    if (!confirmation || guard.current) return;
    const decision = confirmation;
    guard.current = true;
    setPending(true);
    setError("");
    controller.current = new AbortController();
    try {
      const result = await platformRequest(
        `/api${path}`,
        locale,
        "PATCH",
        decision,
        controller.current.signal,
        communityReportDecisionError,
      );
      if (!confirmsReportDecision(result, id, decision.action))
        throw new Error(copy.decisionUnavailable);
      setReport((current) =>
        current
          ? {
              ...current,
              status:
                decision.action === "review"
                  ? "under_review"
                  : decision.action === "dismiss"
                    ? "dismissed"
                    : "resolved",
              moderatorNotes: decision.notes,
              target: decision.action === "remove_comment" ? null : current.target,
            }
          : current,
      );
      setConfirmation(null);
      setNotes("");
      setSuccess(copy.decisionSaved);
      // A later read failure never hides the confirmed decision.
      try {
        setReport(await read());
      } catch {
        setError(copy.unavailable);
      }
    } catch (caught) {
      setConfirmation(null);
      setNeedsReload(true);
      setError(caught instanceof Error ? caught.message : copy.decisionUnavailable);
    } finally {
      guard.current = false;
      setPending(false);
    }
  }
  return (
    <div className="space-y-5" aria-busy={pending}>
      <div className="flex flex-wrap items-center gap-4">
        <Link
          href={staff ? "/admin/reports" : "/workspace/reports"}
          className="text-sm text-accent underline"
        >
          {copy.back}
        </Link>
        <Button type="button" variant="secondary" disabled={pending} onClick={() => void reload()}>
          {pending ? copy.loading : copy.reload}
        </Button>
      </div>
      {error && (
        <p role="alert" className="text-sm text-danger">
          {error}
        </p>
      )}
      {success && (
        <p role="status" className="text-sm text-accent">
          {success}
        </p>
      )}
      {report && (
        <>
          <Link
            href={`${path}/history`}
            className="inline-flex min-h-11 items-center text-sm text-accent underline"
          >
            {reportHistoryCopy(locale).title}
          </Link>
          <section className="nexus-panel space-y-4 p-5">
            <h2 className="break-words text-lg font-semibold text-primary">
              {copy[report.targetType]} · {copy[report.type]}
            </h2>
            <p className="text-sm text-secondary">
              {copy.status}: {copy[report.status]}
            </p>
            <p className="whitespace-pre-wrap break-words text-sm text-secondary">
              {report.reason}
            </p>
            <ReportEvidenceLinks urls={report.evidenceUrls} label={copy.evidence} />
            <dl className="space-y-2 text-xs text-muted">
              <div>
                <dt className="inline">{copy.created}: </dt>
                <dd className="inline">
                  <time dateTime={report.createdAt}>
                    {new Date(report.createdAt).toLocaleString(
                      locale === "ru" ? "ru-RU" : "en-US",
                      { timeZone: "UTC" },
                    )}{" "}
                    UTC
                  </time>
                </dd>
              </div>
              {report.resolvedAt && (
                <div>
                  <dt className="inline">{copy.decided}: </dt>
                  <dd className="inline">
                    <time dateTime={report.resolvedAt}>
                      {new Date(report.resolvedAt).toLocaleString(
                        locale === "ru" ? "ru-RU" : "en-US",
                        { timeZone: "UTC" },
                      )}{" "}
                      UTC
                    </time>
                  </dd>
                </div>
              )}
              {staff && report.reporterId && (
                <div>
                  <dt className="inline">{copy.reporter}: </dt>
                  <dd className="inline break-all">{report.reporterId}</dd>
                </div>
              )}
            </dl>
            {staff && report.moderatorNotes && (
              <div className="space-y-1">
                <h3 className="text-sm font-semibold text-primary">{copy.notes}</h3>
                <p className="whitespace-pre-wrap break-words text-sm text-secondary">
                  {report.moderatorNotes}
                </p>
              </div>
            )}
          </section>
          <section className="nexus-panel space-y-3 p-5">
            <h2 className="text-lg font-semibold text-primary">{copy.currentTarget}</h2>
            <p className="text-xs text-muted">{copy.currentHint}</p>
            {staff && report.moderationHref && (
              <Link
                href={report.moderationHref}
                className="inline-flex min-h-11 items-center text-sm text-accent underline"
              >
                {discussionReportsCopy(locale).link}
              </Link>
            )}
            {report.target ? (
              <>
                <h3 className="break-words text-sm font-semibold text-primary">
                  {report.target.title}
                </h3>
                {report.target.author && (
                  <Link
                    className="text-xs text-accent underline"
                    href={`/users/${encodeURIComponent(report.target.author)}`}
                  >
                    @{report.target.author}
                  </Link>
                )}
                <p className="whitespace-pre-wrap break-words text-sm text-secondary">
                  {report.target.text}
                </p>
                {report.target.truncated && <p className="text-xs text-muted">{copy.truncated}</p>}
                {report.target.href && (
                  <Link className="text-sm text-accent underline" href={report.target.href}>
                    {copy.viewTarget}
                  </Link>
                )}
              </>
            ) : (
              <p className="text-sm text-muted">{copy.missing}</p>
            )}
          </section>
          {staff && (report.status === "open" || report.status === "under_review") && (
            <section className="nexus-panel space-y-4 p-5">
              <label className="block space-y-1 text-sm text-secondary">
                <span>{copy.notes}</span>
                <textarea
                  className={platformFieldClass}
                  value={notes}
                  minLength={3}
                  maxLength={2000}
                  rows={3}
                  disabled={pending || !!confirmation}
                  onChange={(event) => setNotes(event.target.value)}
                />
                <span className="block text-xs text-muted">{copy.notesHint}</span>
              </label>
              {confirmation ? (
                <fieldset
                  className="space-y-3 rounded-lg border border-base p-4"
                  aria-label={copy.confirm}
                >
                  <p className="text-sm text-secondary">
                    {confirmation.action === "remove_comment"
                      ? copy.confirmRemove
                      : copy.confirmDecision}
                  </p>
                  <p className="text-sm font-semibold text-primary">{copy[confirmation.action]}</p>
                  <div className="flex flex-wrap gap-3">
                    <Button
                      type="button"
                      isLoading={pending}
                      disabled={pending}
                      onClick={() => void decide()}
                    >
                      {copy.confirm}
                    </Button>
                    <Button
                      type="button"
                      variant="secondary"
                      disabled={pending}
                      onClick={() => setConfirmation(null)}
                    >
                      {copy.cancel}
                    </Button>
                  </div>
                </fieldset>
              ) : (
                <div className="flex flex-wrap gap-3">
                  {(
                    [
                      ...(report.status === "open" ? ["review" as const] : []),
                      "resolve",
                      "dismiss",
                      ...(report.target?.kind === "comment" &&
                      report.target.revision &&
                      report.moderationHref !== null
                        ? ["remove_comment" as const]
                        : []),
                    ] as Decision["action"][]
                  ).map((action) => (
                    <Button
                      key={action}
                      type="button"
                      variant="secondary"
                      disabled={pending || needsReload || notes.trim().length < 3}
                      onClick={() => choose(action)}
                    >
                      {copy[action]}
                    </Button>
                  ))}
                </div>
              )}
            </section>
          )}
        </>
      )}
    </div>
  );
}
