import { AppError } from "@nexus/domain";
import { cookies } from "next/headers";
import Link from "next/link";
import { reportRateLimit } from "../lib/community-report-api";
import { REPORT_TYPES } from "../lib/community-report-contract";
import { communityReportCopy, communityReportError } from "../lib/community-report-copy";
import {
  publicationReportPageQuery,
  publicationReportsPageSchema,
} from "../lib/community-report-groups-contract";
import { reportGroupsCopy } from "../lib/community-report-groups-copy";
import { getRequestLocale } from "../lib/i18n-server";
import { authService } from "../lib/services/auth-service";
import { communityReportService } from "../lib/services/community-report-service";
import { platformFieldClass } from "../lib/user-platform-client";
import { PlatformSignIn } from "./content-catalog-controls";
import { DiscussionReportBatch } from "./discussion-report-batch";
export async function publicationReportsMetadata() {
  return {
    title: reportGroupsCopy(await getRequestLocale()).publicationTitle,
    robots: { index: false, follow: false },
  };
}
export async function PublicationReportsPage({
  id,
  searchParams,
}: {
  id: string;
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  const locale = await getRequestLocale(),
    copy = reportGroupsCopy(locale),
    labels = communityReportCopy(locale),
    actor = await authService.getSession((await cookies()).get("nexus_session")?.value),
    path = `/admin/community/${encodeURIComponent(id)}/reports`;
  if (!actor) return <PlatformSignIn locale={locale} />;
  try {
    const filters = publicationReportPageQuery(await searchParams);
    if (!filters || (filters.target && filters.target !== "content"))
      throw new AppError("Invalid filters", 400, "VALIDATION_ERROR");
    await reportRateLimit(actor.id, "search");
    const data = publicationReportsPageSchema.parse(
      await communityReportService.publicationReports(actor, id, filters),
    );
    if (data.publication.id !== id || data.page !== filters.page || data.view !== filters.view)
      throw new AppError("Publication scope changed", 503, "INTERNAL_ERROR");
    const href = (page: number) => {
      const params = new URLSearchParams({ view: filters.view, page: String(page) });
      if (filters.query) params.set("q", filters.query);
      if (filters.type) params.set("type", filters.type);
      return `${path}?${params}`;
    };
    return (
      <div className="mx-auto max-w-5xl space-y-5">
        <header className="space-y-2">
          <h1 className="font-display text-primary">{copy.publicationTitle}</h1>
          <p className="break-words text-secondary">{data.publication.title}</p>
          <p className="text-sm text-muted">{copy.publicationDescription}</p>
        </header>
        <div className="flex flex-wrap gap-4">
          <Link
            href="/admin/reports/targets"
            className="inline-flex min-h-11 items-center text-sm text-accent underline"
          >
            {copy.title}
          </Link>
          <Link
            href={`/admin/community/${encodeURIComponent(id)}`}
            className="inline-flex min-h-11 items-center text-sm text-accent underline"
          >
            {copy.context}
          </Link>
        </div>
        <details className="nexus-panel p-5">
          <summary className="cursor-pointer text-sm font-semibold text-primary">
            {copy.publicationBody}
          </summary>
          <p className="mt-2 text-xs text-muted">{copy.publicationCurrent}</p>
          <p className="mt-2 whitespace-pre-wrap break-words text-sm text-secondary">
            {data.publication.text}
          </p>
          {data.publication.truncated && (
            <p className="mt-2 text-xs text-muted">{labels.truncated}</p>
          )}
        </details>
        <form method="get" action={path} className="nexus-panel grid gap-3 p-4 sm:grid-cols-2">
          <label className="space-y-1 text-sm text-secondary">
            <span>{copy.search}</span>
            <input
              name="q"
              type="search"
              maxLength={80}
              defaultValue={filters.query ?? ""}
              className={platformFieldClass}
            />
          </label>
          <label className="space-y-1 text-sm text-secondary">
            <span>{copy.view}</span>
            <select name="view" defaultValue={filters.view} className={platformFieldClass}>
              <option value="pending">{labels.pending}</option>
              <option value="history">{labels.history}</option>
            </select>
          </label>
          <label className="space-y-1 text-sm text-secondary">
            <span>{copy.type}</span>
            <select name="type" defaultValue={filters.type ?? ""} className={platformFieldClass}>
              <option value="">{copy.all}</option>
              {REPORT_TYPES.map((type) => (
                <option key={type} value={type}>
                  {labels[type]}
                </option>
              ))}
            </select>
          </label>
          <button
            type="submit"
            className="min-h-11 rounded-lg border border-base px-4 py-2 text-sm font-semibold text-primary"
          >
            {copy.apply}
          </button>
        </form>
        <DiscussionReportBatch
          key={`${actor.id}:${id}:${JSON.stringify(filters)}:${data.items.map((item) => `${item.id}:${item.status}`).join("|")}`}
          contentId={id}
          commentId={null}
          items={data.items}
          locale={locale}
          allowActions={filters.view === "pending"}
        />
        <nav aria-label={labels.page} className="flex flex-wrap items-center gap-4 text-sm">
          {filters.page > 1 && (
            <Link href={href(filters.page - 1)} className="text-accent underline">
              {labels.previous}
            </Link>
          )}
          <span className="text-muted">
            {labels.page} {filters.page}
          </span>
          {data.hasMore && filters.page < 9999 && (
            <Link href={href(filters.page + 1)} className="text-accent underline">
              {labels.next}
            </Link>
          )}
        </nav>
      </div>
    );
  } catch (error) {
    return (
      <div className="space-y-4">
        <p role="alert" className="nexus-panel p-5 text-danger">
          {communityReportError(locale, error instanceof AppError ? error.code : "INTERNAL_ERROR")}
        </p>
        <Link
          href={path}
          className="inline-flex min-h-11 items-center text-sm text-accent underline"
        >
          {labels.reload}
        </Link>
      </div>
    );
  }
}
