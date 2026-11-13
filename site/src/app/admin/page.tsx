import {
  AdPlacementRepository,
  buildRepository,
  contentRepository,
  verificationRepository,
} from "@nexus/db";
import { can } from "@nexus/security";
import {
  DataTable,
  DataTableBody,
  DataTableCell,
  DataTableEmpty,
  DataTableHeader,
  EmptyState,
  ErrorState,
  SectionHeader,
} from "@nexus/ui";
import { FileText, ShieldAlert } from "lucide-react";
import { cookies } from "next/headers";
import Link from "next/link";
import { AdminAdPlacementSection } from "../../components/admin/admin-ad-placement-section";
import { AdminBuildsQuarantineSection } from "../../components/admin/admin-builds-quarantine-section";
import { AdminHealthStats } from "../../components/admin/admin-health-stats";
import { AdminReportsSection } from "../../components/admin/admin-reports-section";
import { AdminVerificationQueueSection } from "../../components/admin/admin-verification-queue-section";
import { ContentModerationControls } from "../../components/content-moderation-controls";
import { PlatformSignIn } from "../../components/platform-sign-in";
import { getCommercialCopy } from "../../lib/commercial-i18n";
import { moderationCopy } from "../../lib/community-moderation-copy";
import { getFinancialCopy } from "../../lib/financial-i18n";
import { adSlotRendererEnabled, advertisingLifecycleEnabled } from "../../lib/feature-flags";
import { getDictionary } from "../../lib/i18n";
import { getRequestLocale } from "../../lib/i18n-server";
import { getResourceReleaseControlCopy } from "../../lib/resource-release-control-i18n";
import { adminService } from "../../lib/services/admin-service";
import { authService } from "../../lib/services/auth-service";

export const dynamic = "force-dynamic";

export default async function AdminPage({
  searchParams,
}: {
  searchParams: Promise<{
    reportView?: string;
    reportPage?: string;
    reportId?: string;
    verificationView?: string;
    verificationPage?: string;
    verificationId?: string;
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
  const focusedReportId =
    typeof query.reportId === "string" && /^[A-Za-z0-9_-]{1,128}$/u.test(query.reportId)
      ? query.reportId
      : null;
  const verificationView = query.verificationView === "history" ? "history" : "pending";
  const verificationPage = parsePage(query.verificationPage);
  const focusedVerificationId =
    typeof query.verificationId === "string" && /^[A-Za-z0-9_-]{1,128}$/u.test(query.verificationId)
      ? query.verificationId
      : null;
  const buildPage = parsePage(query.buildPage);
  const riskBuildPage = parsePage(query.riskBuildPage);
  const contentPage = parsePage(query.contentPage);
  const adminHref = (changes: Record<string, string | number>) => {
    const params = new URLSearchParams({
      reportView,
      reportPage: String(reportPage),
      verificationView,
      verificationPage: String(verificationPage),
      buildPage: String(buildPage),
      riskBuildPage: String(riskBuildPage),
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

  if (!currentUser) {
    return <PlatformSignIn locale={locale} returnPath="/admin" />;
  }
  if (!can(currentUser, "admin.access")) {
    return (
      <div className="mx-auto min-w-0 max-w-md space-y-4 overflow-x-clip py-20">
        <ErrorState
          title={copy.accessDenied}
          description={copy.accessDeniedDescription}
          icon={<ShieldAlert className="h-5 w-5" aria-hidden="true" />}
          action={
            <Link
              href="/"
              className="inline-flex min-h-11 items-center rounded-md bg-accent px-4 py-2 text-xs font-semibold text-white transition-colors hover:bg-[var(--nexus-accent-hover)] focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[var(--nexus-accent)]"
            >
              {dictionary.errors.home}
            </Link>
          }
        />
      </div>
    );
  }

  const adminUser = currentUser;
  const canViewAudit = can(adminUser, "admin.audit");
  const loaded = await Promise.all([
    adminService.getSystemHealthMetrics(adminUser),
    adminService.listReports(adminUser, reportView, reportPage),
    focusedReportId
      ? adminService.getReport(adminUser, focusedReportId).catch(() => null)
      : Promise.resolve(null),
    verificationRepository.listPage(verificationView, verificationPage),
    focusedVerificationId
      ? verificationRepository.getQueueItem(focusedVerificationId).catch(() => null)
      : Promise.resolve(null),
    verificationRepository.countPending(),
    buildRepository.listPendingReviewPage(buildPage),
    buildRepository.countPendingReview(),
    buildRepository.listRiskReviewPage(riskBuildPage),
    buildRepository.countQuarantined(),
    contentRepository.listDraftPage(contentPage),
    contentRepository.countDrafts(),
    canViewAudit ? adminService.listAuditLogs(adminUser) : Promise.resolve([]),
  ]).catch(() => null);

  if (!loaded) {
    return (
      <div className="min-w-0 space-y-6 overflow-x-clip">
        <ErrorState
          title={copy.hubUnavailable}
          action={
            <Link
              href={adminHref({})}
              className="inline-flex min-h-11 items-center rounded text-sm text-accent underline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[var(--nexus-accent)]"
            >
              {dictionary.errors.retry}
            </Link>
          }
        />
      </div>
    );
  }

  const [
    health,
    reportPageResult,
    focusedReport,
    verificationPageResult,
    focusedVerification,
    pendingVerificationCount,
    buildPageResult,
    pendingBuildCount,
    riskBuildPageResult,
    quarantinedBuildCount,
    contentPageResult,
    pendingContentCount,
    auditLogs,
  ] = loaded;

  const { hasMore: moreVerifications } = verificationPageResult;
  const verificationRequests =
    focusedVerification &&
    !verificationPageResult.requests.some((request) => request.id === focusedVerification.id)
      ? [focusedVerification, ...verificationPageResult.requests]
      : verificationPageResult.requests;
  const { hasMore: moreReports } = reportPageResult;
  const reports =
    focusedReport && !reportPageResult.reports.some((report) => report.id === focusedReport.id)
      ? [focusedReport, ...reportPageResult.reports]
      : reportPageResult.reports;
  const { builds: pendingBuilds, hasMore: moreBuilds } = buildPageResult;
  const { builds: riskBuilds, hasMore: moreRiskBuilds } = riskBuildPageResult;
  const { items: pendingContent, hasMore: moreContent } = contentPageResult;
  // UX-24: advertising placement lifecycle admin surface. Read-only inventory
  // overview gated on the feature switch AND full admin role; hidden otherwise.
  const adLifecycle =
    advertisingLifecycleEnabled && adminUser.role === "admin"
      ? await new AdPlacementRepository()
          .listSlots()
          .then(async (slots) => {
            const repo = new AdPlacementRepository();
            const summaries = await Promise.all(
              slots.map(async (slot) => {
                const placements = await repo.placementsForSlot(slot.id);
                return {
                  slot,
                  pending: placements.filter((pl) => pl.status === "pending_approval").length,
                  active: placements.filter((pl) =>
                    ["scheduled", "live", "paused"].includes(pl.status),
                  ).length,
                };
              }),
            );
            return summaries;
          })
          .catch(() => null)
      : null;
  const chromeLinkClass =
    "inline-flex min-h-11 items-center rounded-md border border-base bg-surface px-3 py-1.5 text-xs font-semibold text-secondary transition-colors hover:bg-hover hover:text-primary focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[var(--nexus-accent)]";

  return (
    <div className="min-w-0 space-y-8 overflow-x-clip">
      <header className="flex flex-col justify-between gap-3 sm:flex-row sm:items-center">
        <div className="min-w-0">
          <h1 className="flex items-center gap-2.5 font-display text-primary">
            <ShieldAlert className="h-6 w-6 shrink-0 text-danger" aria-hidden="true" />
            <span>{copy.title}</span>
          </h1>
          <p className="mt-0.5 font-caption text-muted">{copy.description}</p>
        </div>
        <div className="flex min-w-0 flex-wrap items-center gap-2 self-start sm:self-auto">
          {currentUser.role === "admin" ? (
            <Link href="/admin/commerce/plans" className={chromeLinkClass}>
              {getCommercialCopy(locale).admin}
            </Link>
          ) : null}
          <Link href="/admin/resources" className={chromeLinkClass}>
            {getResourceReleaseControlCopy(locale).moderation}
          </Link>
          <Link href="/admin/reports" className={chromeLinkClass}>
            {copy.reportsQueue}
          </Link>
          {currentUser.role === "admin" ? (
            <Link href="/admin/commerce/reconciliation" className={chromeLinkClass}>
              {getFinancialCopy(locale).review}
            </Link>
          ) : null}
          <Link href="/admin/support" className={chromeLinkClass}>
            {copy.supportQueue}
          </Link>
          <span className="rounded-full border border-base bg-inset px-3 py-1 font-label uppercase text-muted">
            {copy.authorizedSession}
          </span>
        </div>
      </header>

      <AdminHealthStats copy={copy} counts={health.counts} />

      {adLifecycle ? (
        <AdminAdPlacementSection
          locale={locale}
          slots={adLifecycle}
          rendererEnabled={adSlotRendererEnabled}
        />
      ) : null}

      <AdminVerificationQueueSection
        locale={locale}
        copy={copy}
        dateLocale={dateLocale}
        verificationView={verificationView}
        verificationPage={verificationPage}
        pendingVerificationCount={pendingVerificationCount}
        verificationRequests={verificationRequests}
        moreVerifications={moreVerifications}
        verificationHref={verificationHref}
        focusedVerificationId={focusedVerificationId}
      />

      <AdminBuildsQuarantineSection
        locale={locale}
        copy={copy}
        dateLocale={dateLocale}
        buildPage={buildPage}
        pendingBuildCount={pendingBuildCount}
        pendingBuilds={pendingBuilds}
        moreBuilds={moreBuilds}
        riskBuildPage={riskBuildPage}
        quarantinedBuildCount={quarantinedBuildCount}
        riskBuilds={riskBuilds}
        moreRiskBuilds={moreRiskBuilds}
        adminHref={adminHref}
      />

      <section>
        <SectionHeader
          title={copy.communityQueue}
          description={`${pendingContentCount} ${copy.draftsAwaitingModeration}`}
          action={
            <Link
              className="inline-flex min-h-11 items-center text-xs text-accent underline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[var(--nexus-accent)]"
              href="/admin/community"
            >
              {moderationCopy(locale).title}
            </Link>
          }
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
                    <span className="truncate text-xs font-heading text-primary">{item.title}</span>
                  </div>
                  <p className="font-caption text-muted">
                    {copy.author} {item.authorId} •{" "}
                    {new Date(item.createdAt).toLocaleDateString(dateLocale)}
                  </p>
                  {item.excerpt && (
                    <p className="truncate font-caption text-faint">{item.excerpt}</p>
                  )}
                  <details className="max-w-prose font-caption text-muted">
                    <summary className="cursor-pointer text-accent">{copy.readDraft}</summary>
                    <div className="mt-2 max-h-96 overflow-y-auto whitespace-pre-wrap break-words rounded-md border border-base bg-inset p-3 text-xs text-secondary">
                      {item.body}
                    </div>
                  </details>
                </div>
                <ContentModerationControls
                  key={`${item.id}:${item.updatedAt.toISOString()}`}
                  contentId={item.id}
                  expectedUpdatedAt={item.updatedAt.toISOString()}
                />
              </div>
            ))
          ) : (
            <EmptyState
              title={copy.noDrafts}
              description={`${copy.draftsAwaitingModeration}.`}
              icon={<FileText className="h-6 w-6" aria-hidden="true" />}
            />
          )}
        </div>
        {(contentPage > 1 || moreContent) && (
          <nav aria-label={copy.contentPages} className="mt-3 flex items-center gap-3 text-xs">
            {contentPage > 1 && (
              <Link
                className="text-accent underline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[var(--nexus-accent)]"
                href={adminHref({ contentPage: contentPage - 1 })}
              >
                {copy.previous}
              </Link>
            )}
            <span className="text-muted">
              {copy.reportPage} {contentPage}
            </span>
            {moreContent && contentPage < 99_999 && (
              <Link
                className="text-accent underline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[var(--nexus-accent)]"
                href={adminHref({ contentPage: contentPage + 1 })}
              >
                {copy.next}
              </Link>
            )}
          </nav>
        )}
      </section>

      <AdminReportsSection
        locale={locale}
        copy={copy}
        dateLocale={dateLocale}
        reportView={reportView}
        reportPage={reportPage}
        reportsOpenCount={health.counts.reportsOpen}
        reports={reports}
        moreReports={moreReports}
        reportHref={reportHref}
        focusedReportId={focusedReport?.id ?? focusedReportId}
      />

      {canViewAudit && (
        <section>
          <SectionHeader title={copy.auditLog} description={copy.auditDescription} />
          <div className="nexus-panel p-4">
            <DataTable label={copy.auditLog}>
              <DataTableHeader
                columns={[
                  { label: copy.timestamp, type: "datetime" },
                  { label: copy.actor, type: "code" },
                  { label: copy.action, type: "text" },
                  { label: copy.target, type: "code" },
                  { label: copy.ip, type: "code", align: "end" },
                ]}
              />
              <DataTableBody>
                {auditLogs.length > 0 ? (
                  auditLogs.map((log) => (
                    <tr key={log.id}>
                      <DataTableCell type="datetime" className="text-faint">
                        {new Date(log.createdAt).toISOString()}
                      </DataTableCell>
                      <DataTableCell type="code" className="text-purple">
                        {log.actorId}
                      </DataTableCell>
                      <DataTableCell type="text" className="font-semibold text-primary">
                        {log.action}
                      </DataTableCell>
                      <DataTableCell type="code" className="text-muted">
                        {log.targetType}:{log.targetId}
                      </DataTableCell>
                      <DataTableCell type="code" align="end" className="text-faint">
                        {log.ipAddress || copy.internal}
                      </DataTableCell>
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
