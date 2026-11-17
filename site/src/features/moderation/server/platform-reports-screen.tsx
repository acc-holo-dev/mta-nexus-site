import { EmptyState, ErrorState, SectionHeader, StatusBadge } from "@nexus/ui";
import { Flag } from "lucide-react";
import { cookies } from "next/headers";
import Link from "next/link";
import { getDictionary } from "../../../lib/platform/i18n";
import { getRequestLocale } from "../../../lib/platform/i18n-server";

import { authService } from "../../../lib/services/accounts/auth-service";
import { platformReportService } from "../../../lib/services/moderation/platform-report-service";
import { PlatformSignIn } from "../../shell/guest-auth";
import { PlatformSessionError } from "../../shell/session-error";

import { platformReportCopy } from "../platform-report-i18n";

function statusTone(status: string): "warning" | "success" | "danger" | "neutral" {
  if (status === "resolved") return "success";
  if (status === "dismissed") return "danger";
  if (status === "under_review") return "warning";
  return "neutral";
}

export async function PlatformReportsScreen({
  id,
  searchParams,
}: {
  id?: string;
  searchParams?: Promise<Record<string, string | string[] | undefined>>;
}) {
  const locale = await getRequestLocale();
  const typedLocale: "en" | "ru" = locale === "ru" ? "ru" : "en";
  const copy = platformReportCopy(typedLocale);
  const dateLocale = typedLocale === "ru" ? "ru-RU" : "en-US";
  const token = (await cookies()).get("nexus_session")?.value;
  let user: Awaited<ReturnType<typeof authService.getSession>>;
  try {
    user = await authService.getSession(token);
  } catch {
    return (
      <PlatformSessionError
        locale={typedLocale}
        title={getDictionary(typedLocale).errors.title}
        message={copy.unavailable}
        retryHref={"/workspace/platform-reports"}
      />
    );
  }

  if (!user) {
    return (
      <PlatformSignIn
        locale={typedLocale}
        returnPath={
          id
            ? `/workspace/platform-reports/${encodeURIComponent(id)}`
            : "/workspace/platform-reports"
        }
      />
    );
  }

  if (id) {
    const report = await platformReportService.detailForReporter(user, id).catch(() => null);
    if (!report) {
      return (
        <div className="space-y-4">
          <SectionHeader as="h1" title={copy.detail} description={copy.help} />
          <ErrorState title={copy.notFound} />
          <Link
            href="/workspace/platform-reports"
            className="inline-flex min-h-11 items-center text-sm text-accent underline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[var(--nexus-accent)]"
          >
            {copy.back}
          </Link>
        </div>
      );
    }
    return (
      <div className="space-y-4">
        <SectionHeader as="h1" title={copy.detail} description={copy.help} />
        <div className="nexus-panel space-y-3 p-4">
          <div className="flex flex-wrap items-center gap-2">
            <StatusBadge
              status={copy.statuses[report.status] ?? report.status}
              tone={statusTone(report.status)}
            />
            <span className="rounded bg-warning-soft px-2 py-0.5 text-[10px] font-bold uppercase text-warning">
              {report.type}
            </span>
            <span className="text-xs text-muted">
              {copy.targetTypes[report.targetType] ?? report.targetType}
            </span>
          </div>
          {report.targetPreview?.title ? (
            <p className="text-sm font-semibold text-primary">{report.targetPreview.title}</p>
          ) : null}
          {report.targetPreview?.detail ? (
            <p className="text-sm text-secondary">{report.targetPreview.detail}</p>
          ) : null}
          <p className="text-sm text-secondary">{report.reason}</p>
          <p className="text-xs text-faint">
            {copy.submitted}: {new Date(report.createdAt).toLocaleString(dateLocale)}
          </p>
          {report.resolvedAt ? (
            <p className="text-xs text-faint">
              {copy.decided}: {new Date(report.resolvedAt).toLocaleString(dateLocale)}
            </p>
          ) : null}
          {report.moderatorNotes ? (
            <p className="text-xs text-muted">
              {copy.notes}: {report.moderatorNotes}
            </p>
          ) : null}
          {report.targetPreview?.href ? (
            <Link
              href={report.targetPreview.href}
              className="inline-flex min-h-11 items-center text-sm text-accent underline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[var(--nexus-accent)]"
            >
              {copy.openTarget}
            </Link>
          ) : null}
        </div>
        <Link
          href="/workspace/platform-reports"
          className="inline-flex min-h-11 items-center text-sm text-accent underline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[var(--nexus-accent)]"
        >
          {copy.back}
        </Link>
      </div>
    );
  }

  const params = searchParams ? await searchParams : {};
  const rawPage = typeof params.page === "string" ? params.page : "1";
  const page = /^[1-9]\d{0,4}$/.test(rawPage) ? Number(rawPage) : 1;
  const loaded = await platformReportService.listForReporter(user, page).catch(() => null);
  if (!loaded) {
    return (
      <div className="space-y-4">
        <SectionHeader as="h1" title={copy.title} description={copy.help} />
        <ErrorState
          title={copy.unavailable}
          description={copy.unavailableDescription}
          action={
            <Link
              href="/workspace/platform-reports"
              className="inline-flex min-h-11 items-center text-sm text-accent underline"
            >
              {copy.retry}
            </Link>
          }
        />
      </div>
    );
  }

  return (
    <div className="space-y-4">
      <SectionHeader as="h1" title={copy.title} description={copy.help} />
      {loaded.reports.length === 0 ? (
        <EmptyState
          title={copy.empty}
          description={copy.emptyHint}
          icon={<Flag className="h-6 w-6" aria-hidden="true" />}
        />
      ) : (
        <div className="space-y-2.5">
          {loaded.reports.map((report) => (
            <Link
              key={report.id}
              href={`/workspace/platform-reports/${encodeURIComponent(report.id)}`}
              className="nexus-panel block space-y-1 p-4 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[var(--nexus-accent)]"
            >
              <div className="flex flex-wrap items-center gap-2">
                <StatusBadge
                  status={copy.statuses[report.status] ?? report.status}
                  tone={statusTone(report.status)}
                />
                <span className="text-sm font-semibold text-primary">
                  {report.targetPreview?.title ?? report.targetId}
                </span>
                <span className="text-xs text-muted">
                  {copy.targetTypes[report.targetType] ?? report.targetType}
                </span>
              </div>
              <p className="line-clamp-2 text-sm text-secondary">{report.reason}</p>
              <p className="text-xs text-faint">
                {new Date(report.createdAt).toLocaleString(dateLocale)}
              </p>
            </Link>
          ))}
        </div>
      )}
      {(page > 1 || loaded.hasMore) && (
        <nav aria-label={copy.title} className="flex items-center gap-3 text-xs">
          {page > 1 ? (
            <Link
              href={`/workspace/platform-reports?page=${page - 1}`}
              className="min-h-11 inline-flex items-center text-accent underline"
            >
              {copy.previous}
            </Link>
          ) : null}
          <span className="text-muted">
            {copy.page} {page}
          </span>
          {loaded.hasMore ? (
            <Link
              href={`/workspace/platform-reports?page=${page + 1}`}
              className="min-h-11 inline-flex items-center text-accent underline"
            >
              {copy.next}
            </Link>
          ) : null}
        </nav>
      )}
    </div>
  );
}
