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
};

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
              className="nexus-panel flex flex-col justify-between gap-3 p-4 md:flex-row md:items-center"
            >
              <div className="min-w-0 space-y-1">
                <div className="flex items-center gap-2">
                  <span className="rounded bg-warning-soft px-2 py-0.5 text-[10px] font-bold uppercase text-warning">
                    {report.type}
                  </span>
                  <span className="font-code text-xs font-heading text-primary">
                    {report.targetId}
                  </span>
                </div>
                <p className="font-caption text-secondary">{report.reason}</p>
                <p className="font-caption text-faint">
                  {copy.reporter}: {report.reporterId} · {report.targetType} ·{" "}
                  {new Date(report.createdAt).toLocaleDateString(dateLocale)}
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
                {(report.status === "open" || report.status === "under_review") &&
                  (report.targetType === "review" ? (
                    <Link
                      href={`/admin/commerce/reviews/${encodeURIComponent(report.id)}`}
                      className="text-sm text-accent underline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[var(--nexus-accent)]"
                    >
                      {resourceReviewCopy(locale).detail}
                    </Link>
                  ) : (
                    <ReportModerationControls reportId={report.id} />
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
