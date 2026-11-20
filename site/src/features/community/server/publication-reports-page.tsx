import { AppError } from "@nexus/domain";
import { Button, ErrorState } from "@nexus/ui";
import { cookies } from "next/headers";
import Link from "next/link";
import { getRequestLocale } from "../../../lib/i18n/server";
import { authService } from "../../../lib/services/accounts/auth-service";
import { communityReportService } from "../../../lib/services/community/community-report-service";
import { PlatformSignIn } from "../../shell/guest-auth";
import { linkAccent, linkAccentSm, linkAccentSmRounded } from "../../shell/link-shell";
import { pageShellMax5xlCompactTight } from "../../shell/page-shell";
import { panelP5 } from "../../shell/panel-shell";
import { PlatformSessionError } from "../../shell/session-error";
import {
  typeBreakSecondary,
  typeDisplayPrimary,
  typeFlexWrapCenterGap4Sm,
  typeFlexWrapEndGap3,
  typeFlexWrapGap4,
  typeMt2XsMuted,
  typeSmMuted,
  typeSpace1SmSecondary,
} from "../../shell/type-shell";
import { reportRateLimit } from "../community-report-api";
import { REPORT_TYPES } from "../community-report-contract";
import { communityReportCopy, communityReportError } from "../community-report-copy";
import {
  publicationReportPageQuery,
  publicationReportsPageSchema,
} from "../community-report-groups-contract";
import { reportGroupsCopy } from "../community-report-groups-copy";
import { DiscussionReportBatch } from "../components/discussion-report-batch";
import { platformFieldClass } from "../user-platform-client";
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
    path = `/admin/community/${encodeURIComponent(id)}/reports`;
  const search = await searchParams;
  const query = new URLSearchParams();
  for (const [key, value] of Object.entries(search)) {
    if (Array.isArray(value)) for (const part of value) query.append(key, part);
    else if (value !== undefined) query.append(key, value);
  }
  let actor: Awaited<ReturnType<typeof authService.getSession>>;
  try {
    actor = await authService.getSession((await cookies()).get("nexus_session")?.value);
  } catch {
    return (
      <PlatformSessionError
        locale={locale}
        title={copy.publicationTitle}
        message={labels.unavailable}
        retryHref={query.size ? `${path}?${query}` : path}
      />
    );
  }
  if (!actor) return <PlatformSignIn locale={locale} returnPath={path} />;
  try {
    const filters = publicationReportPageQuery(search);
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
      <div className={pageShellMax5xlCompactTight}>
        <header className="space-y-2">
          <h1 className={typeDisplayPrimary}>{copy.publicationTitle}</h1>
          <p className={typeBreakSecondary}>{data.publication.title}</p>
          <p className={typeSmMuted}>{copy.publicationDescription}</p>
        </header>
        <div className={typeFlexWrapGap4}>
          <Link href="/admin/reports/targets" className={linkAccentSmRounded}>
            {copy.title}
          </Link>
          <Link href={`/admin/community/${encodeURIComponent(id)}`} className={linkAccentSmRounded}>
            {copy.context}
          </Link>
        </div>
        <details className={panelP5}>
          <summary className="cursor-pointer text-sm font-semibold text-primary">
            {copy.publicationBody}
          </summary>
          <p className={typeMt2XsMuted}>{copy.publicationCurrent}</p>
          <p className="mt-2 whitespace-pre-wrap break-words text-sm text-secondary">
            {data.publication.text}
          </p>
          {data.publication.truncated && <p className={typeMt2XsMuted}>{labels.truncated}</p>}
        </details>
        <search aria-label={copy.search}>
          <form method="get" action={path} className="nexus-panel grid gap-3 p-4 sm:grid-cols-2">
            <label className={typeSpace1SmSecondary}>
              <span>{copy.search}</span>
              <input
                name="q"
                type="search"
                maxLength={80}
                defaultValue={filters.query ?? ""}
                className={platformFieldClass}
              />
            </label>
            <label className={typeSpace1SmSecondary}>
              <span>{copy.view}</span>
              <select name="view" defaultValue={filters.view} className={platformFieldClass}>
                <option value="pending">{labels.pending}</option>
                <option value="history">{labels.history}</option>
              </select>
            </label>
            <label className={typeSpace1SmSecondary}>
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
            <div className={typeFlexWrapEndGap3}>
              <Button type="submit" className="min-h-11" variant="outline">
                {copy.apply}
              </Button>
              <Link href={path} className={linkAccentSm}>
                {copy.reset}
              </Link>
            </div>
          </form>
        </search>
        <DiscussionReportBatch
          key={`${actor.id}:${id}:${JSON.stringify(filters)}:${data.items.map((item) => `${item.id}:${item.status}`).join("|")}`}
          contentId={id}
          commentId={null}
          items={data.items}
          locale={locale}
          allowActions={filters.view === "pending"}
        />
        <nav aria-label={labels.page} className={typeFlexWrapCenterGap4Sm}>
          {filters.page > 1 && (
            <Link href={href(filters.page - 1)} className={linkAccent}>
              {labels.previous}
            </Link>
          )}
          <span className="text-muted">
            {labels.page} {filters.page}
          </span>
          {data.hasMore && filters.page < 9999 && (
            <Link href={href(filters.page + 1)} className={linkAccent}>
              {labels.next}
            </Link>
          )}
        </nav>
      </div>
    );
  } catch (error) {
    return (
      <div className={pageShellMax5xlCompactTight}>
        <h1 className={typeDisplayPrimary}>{copy.publicationTitle}</h1>
        <ErrorState
          title={communityReportError(
            locale,
            error instanceof AppError ? error.code : "INTERNAL_ERROR",
          )}
          description={labels.formErrorHint}
          action={
            <Link href={path} className={linkAccentSmRounded}>
              {labels.reload}
            </Link>
          }
        />
      </div>
    );
  }
}

export async function AdminPublicationReportsRoutePage({
  params,
  searchParams,
}: {
  params: Promise<{ id: string }>;
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  return PublicationReportsPage({ id: (await params).id, searchParams });
}
