import { AppError } from "@nexus/domain";
import { EmptyState, ErrorState } from "@nexus/ui";
import { Flag } from "lucide-react";
import { cookies } from "next/headers";
import Link from "next/link";
import { notFound } from "next/navigation";
import type { Locale } from "../lib/i18n";
import { getDictionary } from "../lib/i18n";
import { getRequestLocale } from "../lib/i18n-server";
import { resourceReviewCopy, resourceReviewState } from "../lib/resource-review-i18n";
import { resourceReviewPageQuery } from "../lib/resource-review-query";
import { authService } from "../lib/services/auth-service";
import { resourceReviewService } from "../lib/services/resource-review-service";
import { PlatformSignIn } from "./platform-sign-in";
import { ResourceReviewDecisionForm } from "./resource-review-controls";
import { ResourceReviewPager } from "../features/resources/reviews-view";

const pageShellClass = "mx-auto min-w-0 max-w-4xl space-y-5 overflow-x-clip py-8";
const navLinkClass =
  "inline-flex min-h-11 items-center text-accent underline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[var(--nexus-accent)]";

function reportAccessError(error: unknown): "missing" | "failed" {
  if (error instanceof AppError && [403, 404].includes(error.statusCode)) return "missing";
  return "failed";
}

function ResourceReviewLoadError({
  locale,
  backHref,
  backLabel,
  retryHref,
}: {
  locale: Locale;
  backHref: string;
  backLabel: string;
  retryHref: string;
}) {
  const copy = resourceReviewCopy(locale),
    dictionary = getDictionary(locale);
  return (
    <section className={pageShellClass}>
      <Link href={backHref} className={navLinkClass}>
        {backLabel}
      </Link>
      <ErrorState
        title={copy.loadUnavailable}
        description={copy.loadUnavailableHint}
        action={
          <Link href={retryHref} className={navLinkClass}>
            {dictionary.errors.retry}
          </Link>
        }
      />
    </section>
  );
}

export async function ResourceReviewReportScreen({
  staff,
  id,
  query = {},
}: {
  staff: boolean;
  id?: string;
  query?: Record<string, string | string[] | undefined>;
}) {
  const [locale, cookieStore] = await Promise.all([getRequestLocale(), cookies()]);
  const copy = resourceReviewCopy(locale),
    actor = await authService.getSession(cookieStore.get("nexus_session")?.value).catch(() => null);
  const base = staff ? "/admin/commerce/reviews" : "/workspace/review-reports";
  const returnParams = new URLSearchParams();
  for (const [key, value] of Object.entries(query)) {
    if (value === undefined) continue;
    for (const part of Array.isArray(value) ? value : [value]) returnParams.append(key, part);
  }
  const loginReturn = id
    ? `${base}/${encodeURIComponent(id)}`
    : returnParams.size
      ? `${base}?${returnParams}`
      : base;
  const listBackHref = staff ? "/admin" : "/workspace/library";
  if (!actor) return <PlatformSignIn locale={locale} returnPath={loginReturn} />;
  if (staff && !["admin", "moderator"].includes(actor.role)) notFound();
  if (id) {
    const retryHref = loginReturn;
    const report = await resourceReviewService.reportDetail(actor, staff, id).catch((error) => {
      if (reportAccessError(error) === "missing") notFound();
      return null;
    });
    if (!report) {
      return (
        <ResourceReviewLoadError
          locale={locale}
          backHref={base}
          backLabel={copy.back}
          retryHref={retryHref}
        />
      );
    }
    return (
      <section className={pageShellClass}>
        <Link href={base} className={navLinkClass}>
          {copy.back}
        </Link>
        <h1 className="font-display">{staff ? copy.queue : copy.reports}</h1>
        <p>{resourceReviewState(locale, report.status)}</p>
        <p className="whitespace-pre-wrap break-words text-sm">{report.reason}</p>
        {report.review ? (
          <article className="nexus-panel space-y-3 p-5">
            <p>{report.review.title}</p>
            <p>
              {resourceReviewState(locale, report.review.status)} · {copy.rating}:{" "}
              {report.review.rating ?? "—"}/5
            </p>
            <p className="whitespace-pre-wrap break-words text-sm">{report.review.text}</p>
          </article>
        ) : (
          <ErrorState id="resource-review-report-unavailable" title={copy.unavailable} />
        )}
        {staff && "moderatorNotes" in report && report.moderatorNotes && (
          <p className="whitespace-pre-wrap text-sm">
            {copy.reason}: {String(report.moderatorNotes)}
          </p>
        )}
        {staff && (
          <ResourceReviewDecisionForm
            id={report.id}
            status={report.status}
            revision={report.review?.status === "published" ? report.review.revision : null}
            reviewText={report.review?.text}
            locale={locale}
          />
        )}
      </section>
    );
  }
  const filters = resourceReviewPageQuery(query, true);
  const result = await resourceReviewService
    .reportsPage(actor, staff, filters.page, filters.view)
    .catch((error) => {
      if (reportAccessError(error) === "missing") notFound();
      return null;
    });
  if (!result) {
    return (
      <ResourceReviewLoadError
        locale={locale}
        backHref={listBackHref}
        backLabel={copy.back}
        retryHref={loginReturn}
      />
    );
  }
  const alternateView = result.view === "history" ? "pending" : "history";
  return (
    <section className={pageShellClass}>
      <Link href={listBackHref} className={navLinkClass}>
        {copy.back}
      </Link>
      <h1 className="font-display">{staff ? copy.queue : copy.reports}</h1>
      <nav aria-label={copy.reports} className="flex flex-wrap gap-4">
        {(["pending", "history"] as const).map((view) => (
          <Link
            key={view}
            href={`${base}?view=${view}`}
            aria-current={view === result.view ? "page" : undefined}
            className={navLinkClass}
          >
            {copy[view]}
          </Link>
        ))}
      </nav>
      {result.items.length ? (
        result.items.map((report) => (
          <article key={report.id} className="nexus-panel min-w-0 space-y-2 p-4">
            <Link href={`${base}/${encodeURIComponent(report.id)}`} className={navLinkClass}>
              {copy.detail} · {resourceReviewState(locale, report.status)}
            </Link>
            <p className="line-clamp-3 whitespace-pre-wrap break-words text-sm">{report.reason}</p>
          </article>
        ))
      ) : (
        <EmptyState
          title={copy.reportEmpty}
          description={copy[alternateView]}
          icon={<Flag className="h-6 w-6" aria-hidden="true" />}
          action={
            <Link href={`${base}?view=${alternateView}`} className={navLinkClass}>
              {copy[alternateView]}
            </Link>
          }
        />
      )}
      <ResourceReviewPager
        base={base}
        page={result.page}
        totalPages={result.totalPages}
        locale={locale}
        view={result.view}
      />
    </section>
  );
}
