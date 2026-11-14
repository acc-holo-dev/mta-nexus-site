import { EmptyState, SectionHeader, StatusBadge } from "@nexus/ui";
import { Flag } from "lucide-react";
import Link from "next/link";
import { adminStatusLabel, adminStatusTone } from "../../app/admin/status-labels";
import { communityReportCopy } from "../../lib/community-report-copy";
import type { getDictionary, Locale } from "../../lib/i18n";
import { orderCaseCopy } from "../../lib/order-case-i18n";
import { resourceReviewCopy } from "../../lib/resource-review-i18n";
import { storageMaintenanceCopy } from "../../lib/storage-maintenance-i18n";
import { ReportEvidenceLinks } from "../report-evidence-links";
import { ReportModerationControls } from "../report-moderation-controls";
import { AdminResourceQaReportActions } from "../../features/resources/qa-report-actions";

type AdminCopy = ReturnType<typeof getDictionary>["admin"];

type AdminReport = {
  id: string;
  type: string;
  targetId: string;
  reason: string;
  reporterId: string;
  targetType: string;
  createdAt: Date | string;
  evidenceUrls: string[];
  moderatorNotes?: string | null;
  resolvedAt?: Date | string | null;
  status: string;
  targetPreview?: {
    title: string | null;
    href: string | null;
    detail: string | null;
    moderationHref?: string | null;
    productId?: string | null;
    revision?: number | null;
    removable?: boolean;
  } | null;
};

function targetTypeLabel(copy: AdminCopy, targetType: string) {
  const labels = copy.targetTypes as Record<string, string>;
  return labels[targetType] ?? targetType;
}

export function AdminReportsSection({
  locale,
  copy,
  dateLocale,
  reportView,
  reportPage,
  reportsOpenCount,
  reports,
  moreReports,
  reportHref,
  focusedReportId = null,
}: {
  locale: Locale;
  copy: AdminCopy;
  dateLocale: string;
  reportView: "pending" | "history";
  reportPage: number;
  reportsOpenCount: number;
  reports: AdminReport[];
  moreReports: boolean;
  reportHref: (view: "pending" | "history", page: number) => string;
  focusedReportId?: string | null;
}) {
  return (
    <section>
      <SectionHeader title={copy.reports} description={copy.caseHistory} />
      <Link
        href="/admin/storage"
        className="mb-3 mr-4 inline-block text-sm text-accent underline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[var(--nexus-accent)]"
      >
        {storageMaintenanceCopy(locale).title}
      </Link>
      <Link
        href="/admin/commerce/order-cases"
        className="mb-3 mr-4 inline-block text-sm text-accent underline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[var(--nexus-accent)]"
      >
        {orderCaseCopy(locale).queue}
      </Link>
      <Link
        href="/admin/commerce/reviews"
        className="mb-3 mr-4 inline-block text-sm text-accent underline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[var(--nexus-accent)]"
      >
        {resourceReviewCopy(locale).queue}
      </Link>
      <Link
        href="/admin/reports"
        className="mb-3 inline-block text-sm text-accent underline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[var(--nexus-accent)]"
      >
        {communityReportCopy(locale).queue}
      </Link>
      <nav aria-label={copy.reports} className="mb-3 flex gap-2">
        <Link
          href={reportHref("pending", 1)}
          aria-current={reportView === "pending" ? "page" : undefined}
          className={`inline-flex min-h-11 items-center rounded-md border border-base px-3 py-2 text-xs focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[var(--nexus-accent)] ${reportView === "pending" ? "bg-accent-soft text-accent" : "text-muted"}`}
        >
          {copy.reportQueue} ({reportsOpenCount})
        </Link>
        <Link
          href={reportHref("history", 1)}
          aria-current={reportView === "history" ? "page" : undefined}
          className={`inline-flex min-h-11 items-center rounded-md border border-base px-3 py-2 text-xs focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[var(--nexus-accent)] ${reportView === "history" ? "bg-accent-soft text-accent" : "text-muted"}`}
        >
          {copy.reportHistory}
        </Link>
      </nav>
      <div className="space-y-2.5">
        {reports.length > 0 ? (
          reports.map((report) => (
            <div
              key={report.id}
              id={`report-${report.id}`}
              data-report-focus={focusedReportId === report.id ? "true" : undefined}
              className={`nexus-panel flex flex-col justify-between gap-3 p-4 md:flex-row md:items-center${
                focusedReportId === report.id
                  ? " ring-2 ring-[color:var(--nexus-accent)] ring-offset-2 ring-offset-[var(--nexus-page)]"
                  : ""
              }`}
            >
              <div className="min-w-0 space-y-1">
                <div className="flex flex-wrap items-center gap-2">
                  <span className="rounded bg-warning-soft px-2 py-0.5 text-[10px] font-bold uppercase text-warning">
                    {report.type}
                  </span>
                  {report.targetPreview?.title ? (
                    <span className="min-w-0 break-words text-sm font-semibold text-primary">
                      {report.targetPreview.title}
                    </span>
                  ) : null}
                  <span className="font-code text-xs font-heading text-muted">
                    {report.targetId}
                  </span>
                </div>
                {report.targetPreview?.detail ? (
                  <p className="line-clamp-3 font-caption text-secondary">
                    {report.targetPreview.detail}
                  </p>
                ) : null}
                <p className="font-caption text-secondary">{report.reason}</p>
                <p className="font-caption text-faint">
                  {copy.reporter}: {report.reporterId} · {targetTypeLabel(copy, report.targetType)}{" "}
                  · {new Date(report.createdAt).toLocaleDateString(dateLocale)}
                </p>
                <ReportEvidenceLinks urls={report.evidenceUrls} label={copy.reportEvidence} />
                {report.moderatorNotes && (
                  <p className="font-code font-caption text-faint">
                    {copy.notes}: {report.moderatorNotes}
                  </p>
                )}
                {report.resolvedAt && (
                  <p className="font-caption text-faint">
                    {copy.reportDecidedAt}: {new Date(report.resolvedAt).toLocaleString(dateLocale)}
                  </p>
                )}
              </div>
              <div className="flex w-full flex-col items-start gap-3 md:w-auto md:items-end">
                <StatusBadge
                  status={adminStatusLabel(locale, report.status)}
                  tone={adminStatusTone(report.status)}
                />
                {report.targetPreview?.href ? (
                  <Link
                    href={report.targetPreview.href}
                    className="text-sm text-accent underline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[var(--nexus-accent)]"
                  >
                    {copy.openReportedTarget}
                  </Link>
                ) : null}
                {report.targetPreview?.moderationHref ? (
                  <Link
                    href={report.targetPreview.moderationHref}
                    className="text-sm text-accent underline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[var(--nexus-accent)]"
                  >
                    {copy.openStaffModeration}
                  </Link>
                ) : null}
                {(report.status === "open" || report.status === "under_review") &&
                  (report.targetType === "review" ? (
                    <Link
                      href={`/admin/commerce/reviews/${encodeURIComponent(report.id)}`}
                      className="text-sm text-accent underline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[var(--nexus-accent)]"
                    >
                      {resourceReviewCopy(locale).detail}
                    </Link>
                  ) : (
                    <>
                      {report.targetType === "resource_qa_thread" &&
                      report.targetPreview?.removable &&
                      report.targetPreview.productId &&
                      typeof report.targetPreview.revision === "number" ? (
                        <AdminResourceQaReportActions
                          reportId={report.id}
                          productId={report.targetPreview.productId}
                          threadId={report.targetId}
                          revision={report.targetPreview.revision}
                        />
                      ) : null}
                      <ReportModerationControls reportId={report.id} />
                    </>
                  ))}
              </div>
            </div>
          ))
        ) : (
          <EmptyState
            title={reportView === "pending" ? copy.noReports : copy.noReportHistory}
            description={copy.caseHistory}
            icon={<Flag className="h-6 w-6" aria-hidden="true" />}
          />
        )}
      </div>
      {(reportPage > 1 || moreReports) && (
        <nav aria-label={copy.reportPages} className="mt-3 flex items-center gap-3 text-xs">
          {reportPage > 1 && (
            <Link
              className="text-accent underline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[var(--nexus-accent)]"
              href={reportHref(reportView, reportPage - 1)}
            >
              {copy.previous}
            </Link>
          )}
          <span className="text-muted">
            {copy.reportPage} {reportPage}
          </span>
          {moreReports && reportPage < 99_999 && (
            <Link
              className="text-accent underline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[var(--nexus-accent)]"
              href={reportHref(reportView, reportPage + 1)}
            >
              {copy.next}
            </Link>
          )}
        </nav>
      )}
    </section>
  );
}
