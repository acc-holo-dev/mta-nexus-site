import Link from "next/link";
import { cookies } from "next/headers";
import { notFound } from "next/navigation";
import { AppError } from "@nexus/domain";
import { getRequestLocale } from "../lib/i18n-server";
import { authService } from "../lib/services/auth-service";
import { resourceReviewService } from "../lib/services/resource-review-service";
import { resourceReviewCopy, resourceReviewState } from "../lib/resource-review-i18n";
import { resourceReviewPageQuery } from "../lib/resource-review-query";
import { ResourceReviewPager } from "./resource-review-list";
import { ResourceReviewDecisionForm } from "./resource-review-controls";
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
    actor = await authService.getSession(cookieStore.get("nexus_session")?.value);
  if (!actor)
    return (
      <section className="py-12">
        <Link href="/auth/login" className="text-accent underline">
          {copy.signIn}
        </Link>
      </section>
    );
  if (staff && !["admin", "moderator"].includes(actor.role)) notFound();
  const base = staff ? "/admin/commerce/reviews" : "/workspace/review-reports";
  if (id) {
    const report = await resourceReviewService.reportDetail(actor, staff, id).catch((error) => {
      if (error instanceof AppError && [403, 404].includes(error.statusCode)) notFound();
      throw error;
    });
    return (
      <section className="mx-auto max-w-3xl space-y-5 py-8">
        <Link href={base} className="text-accent underline">
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
          <p>{copy.unavailable}</p>
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
            locale={locale}
          />
        )}
      </section>
    );
  }
  const filters = resourceReviewPageQuery(query, true),
    result = await resourceReviewService.reportsPage(actor, staff, filters.page, filters.view);
  return (
    <section className="mx-auto max-w-4xl space-y-5 py-8">
      <Link href={staff ? "/admin" : "/workspace/library"} className="text-accent underline">
        {copy.back}
      </Link>
      <h1 className="font-display">{staff ? copy.queue : copy.reports}</h1>
      <nav aria-label={copy.reports} className="flex gap-4">
        {(["pending", "history"] as const).map((view) => (
          <Link
            key={view}
            href={`${base}?view=${view}`}
            aria-current={view === result.view ? "page" : undefined}
            className="text-accent underline"
          >
            {copy[view]}
          </Link>
        ))}
      </nav>
      {result.items.length ? (
        result.items.map((report) => (
          <article key={report.id} className="nexus-panel space-y-2 p-4">
            <Link
              href={`${base}/${encodeURIComponent(report.id)}`}
              className="text-accent underline"
            >
              {copy.detail} · {resourceReviewState(locale, report.status)}
            </Link>
            <p className="line-clamp-3 whitespace-pre-wrap break-words text-sm">{report.reason}</p>
          </article>
        ))
      ) : (
        <p>{copy.reportEmpty}</p>
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
