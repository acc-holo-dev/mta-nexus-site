import { cookies } from "next/headers";
import Link from "next/link";
import {
  buildRepository,
  contentRepository,
  verificationRepository,
} from "@nexus/db";
import { can } from "@nexus/security";
import {
  AlertTriangle,
  BadgeCheck,
  BookOpen,
  Box,
  PackageCheck,
  Server,
  ShieldAlert,
  Users,
} from "lucide-react";
import {
  DataTable,
  DataTableBody,
  DataTableEmpty,
  DataTableHeader,
  SectionHeader,
  StatCard,
  StatusBadge,
} from "@nexus/ui";
import { adminService } from "../../lib/services/admin-service";
import { authService } from "../../lib/services/auth-service";
import { getDictionary } from "../../lib/i18n";
import { getRequestLocale } from "../../lib/i18n-server";
import { BuildModerationControls } from "../../components/build-moderation-controls";
import { ContentModerationControls } from "../../components/content-moderation-controls";
import { VerificationModerationControls } from "../../components/verification-moderation-controls";
import { ReportModerationControls } from "../../components/report-moderation-controls";

export const dynamic = "force-dynamic";

export default async function AdminPage({
  searchParams,
}: {
  searchParams: Promise<{
    reportView?: string;
    reportPage?: string;
    verificationView?: string;
    verificationPage?: string;
  }>;
}) {
  const locale = await getRequestLocale();
  const dictionary = getDictionary(locale);
  const copy = dictionary.admin;
  const dateLocale = locale === "ru" ? "ru-RU" : "en-US";
  const query = await searchParams;
  const reportView = query.reportView === "history" ? "history" : "pending";
  const reportPage =
    typeof query.reportPage === "string" && /^[1-9]\d{0,4}$/.test(query.reportPage)
      ? Number(query.reportPage)
      : 1;
  const verificationView = query.verificationView === "history" ? "history" : "pending";
  const verificationPage =
    typeof query.verificationPage === "string" && /^[1-9]\d{0,4}$/.test(query.verificationPage)
      ? Number(query.verificationPage)
      : 1;
  const reportHref = (view: "pending" | "history", page: number) =>
    `/admin?reportView=${view}&reportPage=${page}&verificationView=${verificationView}&verificationPage=${verificationPage}`;
  const verificationHref = (view: "pending" | "history", page: number) =>
    `/admin?reportView=${reportView}&reportPage=${reportPage}&verificationView=${view}&verificationPage=${page}`;

  const cookieStore = await cookies();
  const token = cookieStore.get("nexus_session")?.value;
  const currentUser = await authService.getSession(token);

  if (!currentUser || !can(currentUser, "admin.access")) {
    return (
      <div className="mx-auto max-w-md space-y-4 py-20 text-center">
        <div className="mx-auto flex h-14 w-14 items-center justify-center rounded-xl bg-danger-soft text-danger">
          <ShieldAlert className="h-7 w-7" aria-hidden="true" />
        </div>
        <h1 className="font-display text-primary">{copy.accessDenied}</h1>
        <p className="font-caption text-muted">
          {copy.accessDeniedDescription}
        </p>
        <Link
          href="/auth/login"
          className="inline-block rounded-md bg-accent px-4 py-2 text-xs font-semibold text-white transition-colors hover:bg-[var(--nexus-accent-hover)]"
        >
          {copy.signIn}
        </Link>
      </div>
    );
  }

  const adminUser = currentUser;
  const canViewAudit = can(adminUser, "admin.audit");
  const [
    health,
    reportPageResult,
    verificationPageResult,
    pendingVerificationCount,
    pendingBuilds,
    pendingContent,
    auditLogs,
  ] = await Promise.all([
    adminService.getSystemHealthMetrics(adminUser),
    adminService.listReports(adminUser, reportView, reportPage),
    verificationRepository.listPage(verificationView, verificationPage),
    verificationRepository.countPending(),
    buildRepository.listPendingReview(),
    contentRepository.listByStatus("draft", 100),
    canViewAudit ? adminService.listAuditLogs(adminUser) : Promise.resolve([]),
  ]);

  const { requests: verificationRequests, hasMore: moreVerifications } = verificationPageResult;
  const { reports, hasMore: moreReports } = reportPageResult;

  return (
    <div className="space-y-8">
      <header className="flex flex-col justify-between gap-3 sm:flex-row sm:items-center">
        <div>
          <h1 className="flex items-center gap-2.5 font-display text-primary">
            <ShieldAlert className="h-6 w-6 text-danger" aria-hidden="true" />
            <span>{copy.title}</span>
          </h1>
          <p className="mt-0.5 font-caption text-muted">{copy.description}</p>
        </div>
        <span className="self-start rounded-full border border-base bg-inset px-3 py-1 font-label uppercase text-muted sm:self-auto">
          {copy.authorizedSession}
        </span>
      </header>

      <div className="grid grid-cols-2 gap-4 md:grid-cols-3 xl:grid-cols-5">
        <StatCard
          label={copy.users}
          value={health.counts.users}
          icon={<Users className="h-4 w-4" />}
        />
        <StatCard
          label={copy.servers}
          value={health.counts.servers}
          tone="success"
          icon={<Server className="h-4 w-4" />}
        />
        <StatCard
          label={copy.products}
          value={health.counts.products}
          tone="accent"
          icon={<Box className="h-4 w-4" />}
        />
        <StatCard
          label={copy.publishedContent}
          value={health.counts.publishedContent}
          tone="purple"
          icon={<BookOpen className="h-4 w-4" />}
        />
        <StatCard
          label={copy.openReports}
          value={health.counts.reportsOpen}
          tone="warning"
          icon={<AlertTriangle className="h-4 w-4" />}
        />
      </div>

      <section>
        <SectionHeader
          title={copy.verificationQueue}
          description={`${pendingVerificationCount} ${copy.pendingRequests}`}
          action={<BadgeCheck className="h-4 w-4 text-accent" />}
        />
        <nav aria-label={copy.verificationQueue} className="mb-3 flex gap-2">
          <Link
            href={verificationHref("pending", 1)}
            aria-current={verificationView === "pending" ? "page" : undefined}
            className={`rounded-md border border-base px-3 py-2 text-xs ${verificationView === "pending" ? "bg-accent-soft text-accent" : "text-muted"}`}
          >
            {copy.verificationPending} ({pendingVerificationCount})
          </Link>
          <Link
            href={verificationHref("history", 1)}
            aria-current={verificationView === "history" ? "page" : undefined}
            className={`rounded-md border border-base px-3 py-2 text-xs ${verificationView === "history" ? "bg-accent-soft text-accent" : "text-muted"}`}
          >
            {copy.verificationHistory}
          </Link>
        </nav>
        <div className="space-y-2.5">
          {verificationRequests.length > 0 ? (
            verificationRequests.map((request) => (
              <div
                key={request.id}
                className="nexus-panel flex flex-col justify-between gap-3 p-4 md:flex-row md:items-center"
              >
                <div className="min-w-0 space-y-1">
                  <div className="flex items-center gap-2">
                    <span className="rounded bg-accent-soft px-2 py-0.5 text-[10px] font-bold uppercase text-accent">
                      {request.targetType}
                    </span>
                    <span className="truncate font-code text-xs font-heading text-primary">
                      {request.targetId}
                    </span>
                  </div>
                  <p className="font-caption text-muted">
                    {copy.requester} {request.requesterId} •{" "}
                    {new Date(request.createdAt).toLocaleDateString(dateLocale)}
                  </p>
                  {request.notes && (
                    <p className="font-caption text-faint">{request.notes}</p>
                  )}
                  {request.proofUrl && /^https?:\/\//i.test(request.proofUrl) && (
                    <a
                      href={request.proofUrl}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="block break-all font-caption text-accent underline"
                    >
                      {copy.verificationProof}
                    </a>
                  )}
                  {request.reviewNotes && (
                    <p className="font-code font-caption text-faint">
                      {copy.review}: {request.reviewNotes}
                    </p>
                  )}
                  {request.resolvedAt && (
                    <p className="font-caption text-faint">
                      {copy.reportDecidedAt}: {new Date(request.resolvedAt).toLocaleString(dateLocale)}
                    </p>
                  )}
                </div>

                <div className="flex w-full flex-col items-start gap-3 md:w-auto md:items-end">
                  <StatusBadge
                    status={request.status}
                    tone={
                      request.status === "approved"
                        ? "success"
                        : request.status === "rejected"
                          ? "danger"
                          : "warning"
                    }
                  />
                  {request.status === "pending" && (
                    <VerificationModerationControls requestId={request.id} />
                  )}
                </div>
              </div>
            ))
          ) : (
            <div className="nexus-panel py-6 text-center">
              <p className="font-caption text-muted">
                {verificationView === "pending"
                  ? copy.noVerificationRequests
                  : copy.noVerificationHistory}
              </p>
            </div>
          )}
        </div>
        {(verificationPage > 1 || moreVerifications) && (
          <nav
            aria-label={copy.verificationPages}
            className="mt-3 flex items-center gap-3 text-xs"
          >
            {verificationPage > 1 && (
              <Link className="text-accent underline" href={verificationHref(verificationView, verificationPage - 1)}>{copy.previous}</Link>
            )}
            <span className="text-muted">{copy.reportPage} {verificationPage}</span>
            {moreVerifications && verificationPage < 99_999 && (
              <Link className="text-accent underline" href={verificationHref(verificationView, verificationPage + 1)}>{copy.next}</Link>
            )}
          </nav>
        )}
      </section>

      <section>
        <SectionHeader
          title={copy.resourceBuildQueue}
          description={`${pendingBuilds.length} ${copy.buildsAwaitingReview}`}
          action={<PackageCheck className="h-4 w-4 text-warning" />}
        />
        <div className="space-y-2.5">
          {pendingBuilds.length > 0 ? (
            pendingBuilds.map((build) => (
              <div
                key={build.id}
                className="nexus-panel flex flex-col justify-between gap-3 p-4 md:flex-row md:items-center"
              >
                <div className="min-w-0 space-y-1">
                  <div className="flex items-center gap-2">
                    <span className="rounded bg-warning-soft px-2 py-0.5 text-[10px] font-bold uppercase text-warning">
                      {copy.pendingReview}
                    </span>
                    <span className="truncate font-code text-xs font-heading text-primary">
                      {build.fileName} · v{build.version}
                    </span>
                  </div>
                  <p className="font-caption text-muted">
                    {copy.resource} {build.productId} •{" "}
                    {(build.fileSizeBytes / 1024 / 1024).toFixed(1)} MB
                  </p>
                  <p className="font-caption text-faint">
                    {copy.scan}: {build.scanStatus.replace(/_/g, " ")} · SHA-256{" "}
                    {build.sha256Hash.slice(0, 16)}…
                  </p>
                  {build.releaseNotes && (
                    <p className="font-caption text-faint">
                      {build.releaseNotes}
                    </p>
                  )}
                </div>
                <div className="flex w-full flex-col items-start gap-3 md:w-auto md:items-end">
                  <StatusBadge
                    status={build.scanStatus}
                    tone={
                      build.scanStatus === "clean"
                        ? "success"
                        : build.scanStatus === "malicious"
                          ? "danger"
                          : "warning"
                    }
                  />
                  <BuildModerationControls
                    buildId={build.id}
                    scanStatus={build.scanStatus}
                    hasScanProvenance={Boolean(
                      build.scanner?.trim() && build.scannedAt,
                    )}
                  />
                </div>
              </div>
            ))
          ) : (
            <div className="nexus-panel py-6 text-center">
              <p className="font-caption text-muted">{copy.noBuilds}</p>
            </div>
          )}
        </div>
      </section>

      <section>
        <SectionHeader
          title={copy.communityQueue}
          description={`${pendingContent.length} ${copy.draftsAwaitingModeration}`}
        />
        <div className="space-y-2.5">
          {pendingContent.length > 0 ? (
            pendingContent.map((item) => (
              <div
                key={item.id}
                className="nexus-panel flex flex-col justify-between gap-3 p-4 md:flex-row md:items-center"
              >
                <div className="min-w-0 space-y-1">
                  <div className="flex items-center gap-2">
                    <span className="rounded bg-warning-soft px-2 py-0.5 text-[10px] font-bold uppercase text-warning">
                      {item.type}
                    </span>
                    <span className="truncate text-xs font-heading text-primary">
                      {item.title}
                    </span>
                  </div>
                  <p className="font-caption text-muted">
                    {copy.author} {item.authorId} •{" "}
                    {new Date(item.createdAt).toLocaleDateString(dateLocale)}
                  </p>
                  {item.excerpt && (
                    <p className="truncate font-caption text-faint">
                      {item.excerpt}
                    </p>
                  )}
                </div>
                <ContentModerationControls contentId={item.id} />
              </div>
            ))
          ) : (
            <div className="nexus-panel py-6 text-center">
              <p className="font-caption text-muted">{copy.noDrafts}</p>
            </div>
          )}
        </div>
      </section>

      <section>
        <SectionHeader title={copy.reports} description={copy.caseHistory} />
        <nav aria-label={copy.reports} className="mb-3 flex gap-2">
          <Link
            href={reportHref("pending", 1)}
            aria-current={reportView === "pending" ? "page" : undefined}
            className={`rounded-md border border-base px-3 py-2 text-xs ${reportView === "pending" ? "bg-accent-soft text-accent" : "text-muted"}`}
          >
            {copy.reportQueue} ({health.counts.reportsOpen})
          </Link>
          <Link
            href={reportHref("history", 1)}
            aria-current={reportView === "history" ? "page" : undefined}
            className={`rounded-md border border-base px-3 py-2 text-xs ${reportView === "history" ? "bg-accent-soft text-accent" : "text-muted"}`}
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
                  {report.evidenceUrls.length > 0 && (
                    <div className="flex flex-wrap gap-2 font-caption text-faint">
                      <span>{copy.reportEvidence}:</span>
                      {report.evidenceUrls
                        .filter((url) => /^https?:\/\//i.test(url))
                        .map((url, index) => (
                          <a key={`${index}-${url}`} href={url} target="_blank" rel="noopener noreferrer" className="break-all text-accent underline">
                            {index + 1}
                          </a>
                        ))}
                    </div>
                  )}
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
                    status={report.status}
                    tone={report.status === "resolved" ? "success" : report.status === "dismissed" ? "neutral" : "warning"}
                  />
                  {(report.status === "open" || report.status === "under_review") && (
                    <ReportModerationControls reportId={report.id} />
                  )}
                </div>
              </div>
            ))
          ) : (
            <div className="nexus-panel py-6 text-center">
              <p className="font-caption text-muted">
                {reportView === "pending" ? copy.noReports : copy.noReportHistory}
              </p>
            </div>
          )}
        </div>
        {(reportPage > 1 || moreReports) && (
          <nav aria-label={copy.reportPages} className="mt-3 flex items-center gap-3 text-xs">
            {reportPage > 1 && <Link className="text-accent underline" href={reportHref(reportView, reportPage - 1)}>{copy.previous}</Link>}
            <span className="text-muted">{copy.reportPage} {reportPage}</span>
            {moreReports && reportPage < 99_999 && <Link className="text-accent underline" href={reportHref(reportView, reportPage + 1)}>{copy.next}</Link>}
          </nav>
        )}
      </section>

      {canViewAudit && (
        <section>
          <SectionHeader
            title={copy.auditLog}
            description={copy.auditDescription}
          />
          <div className="nexus-panel p-4">
            <DataTable>
              <DataTableHeader
                columns={[
                  copy.timestamp,
                  copy.actor,
                  copy.action,
                  copy.target,
                  copy.ip,
                ]}
              />
              <DataTableBody>
                {auditLogs.length > 0 ? (
                  auditLogs.map((log) => (
                    <tr key={log.id}>
                      <td className="py-2.5 pr-4 text-faint">
                        {new Date(log.createdAt).toISOString()}
                      </td>
                      <td className="pr-4 text-purple">{log.actorId}</td>
                      <td className="pr-4 font-semibold text-primary">
                        {log.action}
                      </td>
                      <td className="pr-4 text-muted">
                        {log.targetType}:{log.targetId}
                      </td>
                      <td className="text-right text-faint">
                        {log.ipAddress || copy.internal}
                      </td>
                    </tr>
                  ))
                ) : (
                  <DataTableEmpty colSpan={5} message={copy.auditDescription} />
                )}
              </DataTableBody>
            </DataTable>
          </div>
        </section>
      )}
    </div>
  );
}
