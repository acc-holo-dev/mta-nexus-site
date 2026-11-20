import { AppError } from "@nexus/domain";
import { EmptyState, ErrorState } from "@nexus/ui";
import { Flag } from "lucide-react";
import type { Metadata } from "next";
import { cookies } from "next/headers";
import Link from "next/link";
import { notFound } from "next/navigation";
import type { Locale } from "../../../lib/i18n";
import { getDictionary } from "../../../lib/i18n";
import { getRequestLocale } from "../../../lib/i18n/server";
import { formatUnknown } from "../../../lib/i18n/unknown";
import { authService } from "../../../lib/services/accounts/auth-service";
import { resourceReviewService } from "../../../lib/services/resources/resource-review-service";
import { PlatformSignIn } from "../../shell/guest-auth";
import { linkAccent } from "../../shell/link-shell";
import { pageShellMax4xlCompact } from "../../shell/page-shell";
import { panelMinSpace2P4, panelSpace3P5 } from "../../shell/panel-shell";
import { PlatformSessionError } from "../../shell/session-error";
import { typeFlexWrapGap4, typePrewrapBreakSm } from "../../shell/type-shell";
import { resourceReviewCopy, resourceReviewState } from "../resource-review-i18n";
import { resourceReviewPageQuery } from "../resource-review-query";
import { ResourceReviewDecisionForm } from "../review-controls";
import { ResourceReviewPager } from "../reviews-view";

function reportAccessError(error: unknown): "missing" | "failed" {
  if (error instanceof AppError && [403, 404].includes(error.statusCode)) return "missing";
  return "failed";
}

function ResourceReviewLoadError({
  locale,
  backHref,
  backLabel,
  retryHref,
  staff,
}: {
  locale: Locale;
  backHref: string;
  backLabel: string;
  retryHref: string;
  staff: boolean;
}) {
  const copy = resourceReviewCopy(locale),
    dictionary = getDictionary(locale);
  return (
    <section className={pageShellMax4xlCompact}>
      <Link href={backHref} className={linkAccent}>
        {backLabel}
      </Link>
      <h1 className="font-display">{staff ? copy.queue : copy.reports}</h1>
      <ErrorState
        title={copy.loadUnavailable}
        description={copy.loadUnavailableHint}
        action={
          <Link href={retryHref} className={linkAccent}>
            {dictionary.errors.retry}
          </Link>
        }
      />
    </section>
  );
}

export async function resourceReviewReportMetadata(): Promise<Metadata> {
  return {
    title: `${resourceReviewCopy(await getRequestLocale()).queue} | MTA NEXUS`,
    robots: { index: false, follow: false },
  };
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
  const locale = await getRequestLocale();
  const copy = resourceReviewCopy(locale);
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
  let actor: Awaited<ReturnType<typeof authService.getSession>>;
  try {
    actor = await authService.getSession((await cookies()).get("nexus_session")?.value);
  } catch {
    return (
      <PlatformSessionError
        locale={locale}
        title={copy.reports}
        message={copy.loadUnavailable}
        retryHref={loginReturn}
      />
    );
  }
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
          staff={staff}
        />
      );
    }
    return (
      <section className={pageShellMax4xlCompact}>
        <Link href={base} className={linkAccent}>
          {copy.back}
        </Link>
        <h1 className="font-display">{staff ? copy.queue : copy.reports}</h1>
        <p>{resourceReviewState(locale, report.status)}</p>
        <p className={typePrewrapBreakSm}>{report.reason}</p>
        {report.review ? (
          <article className={panelSpace3P5}>
            <p>{report.review.title}</p>
            <p>
              {resourceReviewState(locale, report.review.status)} · {copy.rating}:{" "}
              {formatUnknown(locale, report.review.rating)}/5
            </p>
            <p className={typePrewrapBreakSm}>{report.review.text}</p>
          </article>
        ) : (
          <ErrorState
            id="resource-review-report-unavailable"
            title={copy.reportReviewUnavailable}
            description={copy.reportReviewUnavailableHint}
          />
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
        staff={staff}
      />
    );
  }
  const alternateView = result.view === "history" ? "pending" : "history";
  return (
    <section className={pageShellMax4xlCompact}>
      <Link href={listBackHref} className={linkAccent}>
        {copy.back}
      </Link>
      <h1 className="font-display">{staff ? copy.queue : copy.reports}</h1>
      <nav aria-label={copy.reports} className={typeFlexWrapGap4}>
        {(["pending", "history"] as const).map((view) => (
          <Link
            key={view}
            href={`${base}?view=${view}`}
            aria-current={view === result.view ? "page" : undefined}
            className={linkAccent}
          >
            {copy[view]}
          </Link>
        ))}
      </nav>
      {result.items.length ? (
        result.items.map((report) => (
          <article key={report.id} className={panelMinSpace2P4}>
            <Link href={`${base}/${encodeURIComponent(report.id)}`} className={linkAccent}>
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
            <Link href={`${base}?view=${alternateView}`} className={linkAccent}>
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

export async function StaffResourceReviewReportsPage({
  searchParams,
}: {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  return ResourceReviewReportScreen({ staff: true, query: await searchParams });
}

export async function WorkspaceResourceReviewReportsPage({
  searchParams,
}: {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  return ResourceReviewReportScreen({ staff: false, query: await searchParams });
}

export async function StaffResourceReviewReportDetailPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  return ResourceReviewReportScreen({ staff: true, id: (await params).id });
}

export async function WorkspaceResourceReviewReportDetailPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  return ResourceReviewReportScreen({ staff: false, id: (await params).id });
}
