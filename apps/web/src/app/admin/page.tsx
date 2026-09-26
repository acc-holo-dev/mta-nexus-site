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
  Box,
  KeyRound,
  PackageCheck,
  Server,
  ShieldAlert,
  ShoppingBag,
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

export const dynamic = "force-dynamic";

export default async function AdminPage() {
  const locale = await getRequestLocale();
  const dictionary = getDictionary(locale);
  const copy = dictionary.admin;
  const dateLocale = locale === "ru" ? "ru-RU" : "en-US";

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
    reports,
    verificationRequests,
    pendingBuilds,
    pendingContent,
    auditLogs,
  ] = await Promise.all([
    adminService.getSystemHealthMetrics(adminUser),
    adminService.listReports(adminUser),
    verificationRepository.listAll(),
    buildRepository.listPendingReview(),
    contentRepository.listByStatus("draft", 100),
    canViewAudit ? adminService.listAuditLogs(adminUser) : Promise.resolve([]),
  ]);

  const pendingVerifications = verificationRequests.filter(
    (request) => request.status === "pending",
  );

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

      <div className="grid grid-cols-2 gap-4 md:grid-cols-3 lg:grid-cols-6">
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
          label={copy.licenses}
          value={health.counts.licenses}
          tone="purple"
          icon={<KeyRound className="h-4 w-4" />}
        />
        <StatCard
          label={copy.orders}
          value={health.counts.orders}
          icon={<ShoppingBag className="h-4 w-4" />}
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
          description={`${pendingVerifications.length} ${copy.pendingRequests}`}
          action={<BadgeCheck className="h-4 w-4 text-accent" />}
        />
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
                  {request.reviewNotes && (
                    <p className="font-code font-caption text-faint">
                      {copy.review}: {request.reviewNotes}
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
                {copy.noVerificationRequests}
              </p>
            </div>
          )}
        </div>
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
        <SectionHeader
          title={copy.reports}
          description={copy.caseHistory}
        />
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
                  {report.moderatorNotes && (
                    <p className="font-code font-caption text-faint">
                      {copy.notes}: {report.moderatorNotes}
                    </p>
                  )}
                </div>
                <StatusBadge
                  status={report.status}
                  tone={
                    report.status === "resolved"
                      ? "success"
                      : report.status === "dismissed"
                        ? "neutral"
                        : "warning"
                  }
                />
              </div>
            ))
          ) : (
            <div className="nexus-panel py-6 text-center">
              <p className="font-caption text-muted">{copy.noReports}</p>
            </div>
          )}
        </div>
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
