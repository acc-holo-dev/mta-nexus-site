import { ReportEvidenceLinks } from "../../components/report-evidence-links";
import { getFinancialCopy } from "../../lib/financial-i18n";
import { getResourceReleaseControlCopy } from "../../lib/resource-release-control-i18n";
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
import { BuildQuarantineControls } from "../../components/build-quarantine-controls";
import { ContentModerationControls } from "../../components/content-moderation-controls";
import { VerificationModerationControls } from "../../components/verification-moderation-controls";
import { ReportModerationControls } from "../../components/report-moderation-controls";
import { communityReportCopy } from "../../lib/community-report-copy";
import { verificationCopy } from "../../lib/verification-workspace-copy";
import { safeExternalWebUrl } from "@nexus/validation";
import { getCommercialCopy } from "../../lib/commercial-i18n";

export const dynamic = "force-dynamic";

export default async function AdminPage({
  searchParams,
}: {
  searchParams: Promise<{
    reportView?: string;
    reportPage?: string;
    verificationView?: string;
    verificationPage?: string;
    buildPage?: string;
    riskBuildPage?: string;
    contentPage?: string;
  }>;
}) {
  const locale = await getRequestLocale();
  const dictionary = getDictionary(locale);
  const copy = dictionary.admin;
  const dateLocale = locale === "ru" ? "ru-RU" : "en-US";
  const query = await searchParams;
  const parsePage = (value: string | undefined) =>
    typeof value === "string" && /^[1-9]\d{0,4}$/.test(value) ? Number(value) : 1;
  const reportView = query.reportView === "history" ? "history" : "pending";
  const reportPage = parsePage(query.reportPage);
  const verificationView = query.verificationView === "history" ? "history" : "pending";
  const verificationPage = parsePage(query.verificationPage);
  const buildPage = parsePage(query.buildPage);
  const riskBuildPage = parsePage(query.riskBuildPage);
  const contentPage = parsePage(query.contentPage);
  const adminHref = (changes: Record<string, string | number>) => {
    const params = new URLSearchParams({
      reportView, reportPage: String(reportPage),
      verificationView, verificationPage: String(verificationPage),
      buildPage: String(buildPage), riskBuildPage: String(riskBuildPage),
      contentPage: String(contentPage),
    });
    for (const [key, value] of Object.entries(changes)) params.set(key, String(value));
    return `/admin?${params}`;
  };
  const reportHref = (view: "pending" | "history", page: number) =>
    adminHref({ reportView: view, reportPage: page });
  const verificationHref = (view: "pending" | "history", page: number) =>
    adminHref({ verificationView: view, verificationPage: page });

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
    buildPageResult,
    pendingBuildCount,
    riskBuildPageResult,
    quarantinedBuildCount,
    contentPageResult,
    pendingContentCount,
    auditLogs,
  ] = await Promise.all([
    adminService.getSystemHealthMetrics(adminUser),
    adminService.listReports(adminUser, reportView, reportPage),
    verificationRepository.listPage(verificationView, verificationPage),
    verificationRepository.countPending(),
    buildRepository.listPendingReviewPage(buildPage),
    buildRepository.countPendingReview(),
    buildRepository.listRiskReviewPage(riskBuildPage),
    buildRepository.countQuarantined(),
    contentRepository.listDraftPage(contentPage),
    contentRepository.countDrafts(),
    canViewAudit ? adminService.listAuditLogs(adminUser) : Promise.resolve([]),
  ]);

  const { requests: verificationRequests, hasMore: moreVerifications } = verificationPageResult;
  const { reports, hasMore: moreReports } = reportPageResult;
  const { builds: pendingBuilds, hasMore: moreBuilds } = buildPageResult;
  const { builds: riskBuilds, hasMore: moreRiskBuilds } = riskBuildPageResult;
  const { items: pendingContent, hasMore: moreContent } = contentPageResult;

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
        <div className="flex flex-wrap items-center gap-2 self-start sm:self-auto">
          {currentUser.role === "admin" ? <Link href="/admin/commerce/plans" className="rounded-md border border-base bg-surface px-3 py-1.5 text-xs font-semibold text-secondary transition-colors hover:bg-hover hover:text-primary">{getCommercialCopy(locale).admin}</Link> : null}
          <Link href="/admin/resources" className="rounded-md border border-base bg-surface px-3 py-1.5 text-xs font-semibold text-secondary transition-colors hover:bg-hover hover:text-primary">{getResourceReleaseControlCopy(locale).moderation}</Link>
          {currentUser.role === "admin" ? <Link href="/admin/commerce/reconciliation" className="rounded-md border border-base bg-surface px-3 py-1.5 text-xs font-semibold text-secondary transition-colors hover:bg-hover hover:text-primary">{getFinancialCopy(locale).review}</Link> : null}
          <Link
            href="/admin/support"
            className="rounded-md border border-base bg-surface px-3 py-1.5 text-xs font-semibold text-secondary transition-colors hover:bg-hover hover:text-primary"
          >
            {copy.supportQueue}
          </Link>
          <span className="rounded-full border border-base bg-inset px-3 py-1 font-label uppercase text-muted">
            {copy.authorizedSession}
          </span>
        </div>
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
                  {request.targetUsername && (
                    <Link
                      href={`/users/${encodeURIComponent(request.targetUsername)}`}
                      className="block text-xs text-accent underline"
                    >
                      {verificationCopy(locale).publicProfile} · @{request.targetUsername}
                    </Link>
                  )}
                  {request.organizationSlug && (
                    <Link
                      href={`/organizations/${encodeURIComponent(request.organizationSlug)}`}
                      className="block text-xs text-accent underline"
                    >
                      {verificationCopy(locale).organization}
                    </Link>
                  )}
                  {request.currentSpecialties && request.currentSpecialties.length > 0 && (
                    <p className="break-words text-xs text-secondary">
                      {request.currentSpecialties.slice(0, 12).join(" · ")}
                    </p>
                  )}
                  {safeExternalWebUrl(request.currentGithubUrl) && (
                    <a
                      href={safeExternalWebUrl(request.currentGithubUrl)}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="block text-xs text-accent underline"
                    >
                      {verificationCopy(locale).github}
                    </a>
                  )}
                  {safeExternalWebUrl(request.proofUrl) && (
                    <a
                      href={safeExternalWebUrl(request.proofUrl)}
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
          description={`${pendingBuildCount} ${copy.buildsAwaitingReview}`}
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
                  <p className="font-caption text-secondary">
                    {build.productStatus === "published" ? (
                      <Link className="text-accent underline" href={`/market/${encodeURIComponent(build.productSlug)}`}>
                        {build.productTitle}
                      </Link>
                    ) : (
                      <>{build.productTitle} · {copy.resourceNotPublished}</>
                    )}
                  </p>
                  <p className="font-caption text-muted">
                    {copy.resourcePublisher}: <Link className="text-accent underline" href={`/users/${encodeURIComponent(build.publisherUsername)}`}>
                      @{build.publisherUsername}
                    </Link>
                  </p>
                  <p className="font-caption text-faint">
                    {copy.scan}: {build.scanStatus.replace(/_/g, " ")} · SHA-256
                  </p>
                  <code className="block break-all font-code text-[10px] text-faint">
                    {build.sha256Hash}
                  </code>
                  {build.scanner && build.scannedAt && (
                    <p className="font-caption text-faint">
                      {copy.scanProvenance}: {build.scanner} ·{" "}
                      {new Date(build.scannedAt).toLocaleString(dateLocale)}
                    </p>
                  )}
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
        {(buildPage > 1 || moreBuilds) && (
          <nav aria-label={copy.buildPages} className="mt-3 flex items-center gap-3 text-xs">
            {buildPage > 1 && <Link className="text-accent underline" href={adminHref({ buildPage: buildPage - 1 })}>{copy.previous}</Link>}
            <span className="text-muted">{copy.reportPage} {buildPage}</span>
            {moreBuilds && buildPage < 99_999 && <Link className="text-accent underline" href={adminHref({ buildPage: buildPage + 1 })}>{copy.next}</Link>}
          </nav>
        )}
      </section>

      <section>
        <SectionHeader
          title={copy.quarantineQueue}
          description={`${quarantinedBuildCount} ${copy.buildsQuarantined}`}
          action={<ShieldAlert className="h-4 w-4 text-danger" />}
        />
        <p className="mb-3 max-w-3xl font-caption text-muted">
          {copy.quarantineQueueDescription}
        </p>
        <div className="space-y-2.5">
          {riskBuilds.length > 0 ? (
            riskBuilds.map((build) => (
              <div
                key={build.id}
                className="nexus-panel flex flex-col justify-between gap-3 p-4 md:flex-row md:items-center"
              >
                <div className="min-w-0 space-y-1">
                  <div className="flex flex-wrap items-center gap-2">
                    <StatusBadge
                      status={build.status}
                      tone={build.status === "quarantined" ? "danger" : "success"}
                    />
                    <span className="truncate font-code text-xs font-heading text-primary">
                      {build.fileName} · v{build.version}
                    </span>
                  </div>
                  <p className="font-caption text-secondary">
                    {build.productStatus === "published" ? (
                      <Link
                        className="text-accent underline"
                        href={`/market/${encodeURIComponent(build.productSlug)}`}
                      >
                        {build.productTitle}
                      </Link>
                    ) : (
                      <>{build.productTitle} · {copy.resourceNotPublished}</>
                    )}
                  </p>
                  <p className="font-caption text-muted">
                    {copy.resourcePublisher}:{" "}
                    <Link
                      className="text-accent underline"
                      href={`/users/${encodeURIComponent(build.publisherUsername)}`}
                    >
                      @{build.publisherUsername}
                    </Link>
                  </p>
                  <p className="font-caption text-faint">
                    {copy.scan}: {build.scanStatus.replace(/_/g, " ")} · SHA-256
                  </p>
                  <code className="block break-all font-code text-[10px] text-faint">
                    {build.sha256Hash}
                  </code>
                  {build.status === "quarantined" && (
                    <>
                      <p className="whitespace-pre-wrap font-caption text-danger">
                        {copy.quarantineReason}: {build.quarantineReason}
                      </p>
                      {build.quarantinedAt && (
                        <p className="font-caption text-faint">
                          {copy.quarantinedAt}:{" "}
                          {new Date(build.quarantinedAt).toLocaleString(dateLocale)}
                        </p>
                      )}
                    </>
                  )}
                  {build.scanStatus === "clean" &&
                    build.scanner?.trim() &&
                    build.scannedAt && (
                      <a
                        href={`/api/admin/builds/${encodeURIComponent(build.id)}/download`}
                        className="inline-block text-xs font-semibold text-accent underline"
                      >
                        {copy.reviewArtifact}
                      </a>
                    )}
                </div>
                <BuildQuarantineControls
                  buildId={build.id}
                  status={build.status as "published" | "quarantined"}
                />
              </div>
            ))
          ) : (
            <div className="nexus-panel py-6 text-center">
              <p className="font-caption text-muted">{copy.noRiskBuilds}</p>
            </div>
          )}
        </div>
        {(riskBuildPage > 1 || moreRiskBuilds) && (
          <nav
            aria-label={copy.quarantinePages}
            className="mt-3 flex items-center gap-3 text-xs"
          >
            {riskBuildPage > 1 && (
              <Link
                className="text-accent underline"
                href={adminHref({ riskBuildPage: riskBuildPage - 1 })}
              >
                {copy.previous}
              </Link>
            )}
            <span className="text-muted">
              {copy.reportPage} {riskBuildPage}
            </span>
            {moreRiskBuilds && riskBuildPage < 99_999 && (
              <Link
                className="text-accent underline"
                href={adminHref({ riskBuildPage: riskBuildPage + 1 })}
              >
                {copy.next}
              </Link>
            )}
          </nav>
        )}
      </section>

      <section>
        <SectionHeader
          title={copy.communityQueue}
          description={`${pendingContentCount} ${copy.draftsAwaitingModeration}`}
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
                  <details className="max-w-prose font-caption text-muted">
                    <summary className="cursor-pointer text-accent">{copy.readDraft}</summary>
                    <div className="mt-2 max-h-96 overflow-y-auto whitespace-pre-wrap break-words rounded-md border border-base bg-inset p-3 text-xs text-secondary">
                      {item.body}
                    </div>
                  </details>
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
        {(contentPage > 1 || moreContent) && (
          <nav aria-label={copy.contentPages} className="mt-3 flex items-center gap-3 text-xs">
            {contentPage > 1 && <Link className="text-accent underline" href={adminHref({ contentPage: contentPage - 1 })}>{copy.previous}</Link>}
            <span className="text-muted">{copy.reportPage} {contentPage}</span>
            {moreContent && contentPage < 99_999 && <Link className="text-accent underline" href={adminHref({ contentPage: contentPage + 1 })}>{copy.next}</Link>}
          </nav>
        )}
      </section>

      <section>
        <SectionHeader title={copy.reports} description={copy.caseHistory} />
        <Link href="/admin/reports" className="mb-3 inline-block text-sm text-accent underline">{communityReportCopy(locale).queue}</Link>
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
