import { cookies } from "next/headers";
import Link from "next/link";
import { buildRepository, verificationRepository } from "@nexus/db";
import { authService } from "../../lib/services/auth-service";
import { adminService } from "../../lib/services/admin-service";
import { can } from "@nexus/security";
import {
  StatCard,
  SectionHeader,
  DataTable,
  DataTableHeader,
  DataTableBody,
  DataTableEmpty,
  StatusBadge,
} from "@nexus/ui";
import {
  ShieldAlert,
  Users,
  Box,
  Server,
  KeyRound,
  ShoppingBag,
  AlertTriangle,
  BadgeCheck,
  PackageCheck,
} from "lucide-react";

export const dynamic = "force-dynamic";

export default async function AdminPage() {
  // Authorization: the page renders only for real admin/moderator sessions
  const cookieStore = await cookies();
  const token = cookieStore.get("nexus_session")?.value;
  const currentUser = await authService.getSession(token);

  if (!currentUser || !can(currentUser, "admin.access")) {
    return (
      <div className="max-w-md mx-auto py-20 text-center space-y-4">
        <div className="w-14 h-14 rounded-xl bg-danger-soft text-danger flex items-center justify-center mx-auto">
          <ShieldAlert className="w-7 h-7" />
        </div>
        <h1 className="font-display text-primary">Access denied</h1>
        <p className="font-caption text-muted">
          Administration requires an admin or moderator account.
        </p>
        <Link
          href="/auth/login"
          className="inline-block px-4 py-2 rounded-md bg-accent hover:bg-[var(--nexus-accent-hover)] text-white text-xs font-semibold transition-colors"
        >
          Sign In
        </Link>
      </div>
    );
  }

  const adminUser = currentUser;
  const health = await adminService.getSystemHealthMetrics(adminUser);
  const reports = await adminService.listReports(adminUser);
  const canViewAudit = can(adminUser, "admin.audit");
  const auditLogs = canViewAudit ? await adminService.listAuditLogs(adminUser) : [];
  const verificationRequests = await verificationRepository.listAll();
  const pendingVerifications = verificationRequests.filter((v) => v.status === "pending");
  const pendingBuilds = await buildRepository.listPendingReview();

  return (
    <div className="space-y-8">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="font-display text-primary flex items-center gap-2.5">
            <ShieldAlert className="w-6 h-6 text-danger" />
            <span>Administration</span>
          </h1>
          <p className="font-caption text-muted mt-0.5">
            Platform moderation, verification queue and audit trail.
          </p>
        </div>

        <div className="flex items-center gap-2">
          <span className="font-label text-muted uppercase">Authorized admin session</span>
        </div>
      </div>

      {/* Metrics (unified StatCard) */}
      <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-6 gap-4">
        <StatCard label="Users" value={health.counts.users} icon={<Users className="w-4 h-4" />} />
        <StatCard label="Servers" value={health.counts.servers} tone="success" icon={<Server className="w-4 h-4" />} />
        <StatCard label="Products" value={health.counts.products} tone="accent" icon={<Box className="w-4 h-4" />} />
        <StatCard label="Licenses" value={health.counts.licenses} tone="purple" icon={<KeyRound className="w-4 h-4" />} />
        <StatCard label="Orders" value={health.counts.orders} icon={<ShoppingBag className="w-4 h-4" />} />
        <StatCard label="Open Reports" value={health.counts.reportsOpen} tone="warning" icon={<AlertTriangle className="w-4 h-4" />} />
      </div>

      {/* Verification Queue */}
      <section>
        <SectionHeader
          title="Verification Queue"
          description={`${pendingVerifications.length} pending request${pendingVerifications.length === 1 ? "" : "s"}`}
          action={<BadgeCheck className="w-4 h-4 text-accent" />}
        />
        <div className="space-y-2.5">
          {verificationRequests.length > 0 ? (
            verificationRequests.map((vr) => (
              <div key={vr.id} className="nexus-panel p-4 flex flex-col md:flex-row md:items-center justify-between gap-3">
                <div className="space-y-1 min-w-0">
                  <div className="flex items-center gap-2">
                    <span className="px-2 py-0.5 rounded text-[10px] font-bold uppercase bg-accent-soft text-accent">
                      {vr.targetType}
                    </span>
                    <span className="text-xs font-heading text-primary font-code truncate">{vr.targetId}</span>
                  </div>
                  <p className="font-caption text-muted">
                    Requester {vr.requesterId} • {new Date(vr.createdAt).toLocaleDateString()}
                  </p>
                  {vr.notes && <p className="font-caption text-faint">{vr.notes}</p>}
                  {vr.reviewNotes && <p className="font-caption text-faint font-code">Review: {vr.reviewNotes}</p>}
                </div>

                <StatusBadge
                  status={vr.status}
                  tone={vr.status === "approved" ? "success" : vr.status === "rejected" ? "danger" : "warning"}
                />
              </div>
            ))
          ) : (
            <div className="py-6 text-center nexus-panel">
              <p className="font-caption text-muted">No verification requests submitted.</p>
            </div>
          )}
        </div>
      </section>

      {/* Resource Build Queue */}
      <section>
        <SectionHeader
          title="Resource Build Queue"
          description={`${pendingBuilds.length} build${pendingBuilds.length === 1 ? "" : "s"} awaiting review`}
          action={<PackageCheck className="w-4 h-4 text-amber-400" />}
        />
        <div className="space-y-2.5">
          {pendingBuilds.length > 0 ? (
            pendingBuilds.map((build) => (
              <div key={build.id} className="nexus-panel p-4 flex flex-col md:flex-row md:items-center justify-between gap-3">
                <div className="space-y-1 min-w-0">
                  <div className="flex items-center gap-2">
                    <span className="px-2 py-0.5 rounded text-[10px] font-bold uppercase bg-warning-soft text-warning">
                      pending review
                    </span>
                    <span className="text-xs font-heading text-primary font-code truncate">
                      {build.fileName} · v{build.version}
                    </span>
                  </div>
                  <p className="font-caption text-muted">
                    Resource {build.productId} • {(build.fileSizeBytes / 1024 / 1024).toFixed(1)} MB
                  </p>
                  <p className="font-caption text-faint">
                    Scan: {build.scanStatus.replace(/_/g, " ")} · SHA-256 {build.sha256Hash.slice(0, 16)}…
                  </p>
                  {build.releaseNotes && <p className="font-caption text-faint">{build.releaseNotes}</p>}
                </div>
                <StatusBadge status={build.scanStatus} tone={build.scanStatus === "malicious" ? "danger" : "warning"} />
              </div>
            ))
          ) : (
            <div className="py-6 text-center nexus-panel">
              <p className="font-caption text-muted">No resource builds are waiting for review.</p>
            </div>
          )}
        </div>
      </section>

      {/* Reports */}
      <section>
        <SectionHeader
          title="Reports & Moderation"
          description="Immutable case history"
        />
        <div className="space-y-2.5">
          {reports.length > 0 ? (
            reports.map((r) => (
              <div key={r.id} className="nexus-panel p-4 flex flex-col md:flex-row md:items-center justify-between gap-3">
                <div className="space-y-1 min-w-0">
                  <div className="flex items-center gap-2">
                    <span className="px-2 py-0.5 rounded text-[10px] font-bold uppercase bg-warning-soft text-warning">
                      {r.type}
                    </span>
                    <span className="text-xs font-heading text-primary font-code">{r.targetId}</span>
                  </div>
                  <p className="font-caption text-secondary">{r.reason}</p>
                  {r.moderatorNotes && (
                    <p className="font-caption text-faint font-code">Notes: {r.moderatorNotes}</p>
                  )}
                </div>

                <StatusBadge
                  status={r.status}
                  tone={r.status === "resolved" ? "success" : r.status === "dismissed" ? "neutral" : "warning"}
                />
              </div>
            ))
          ) : (
            <div className="py-6 text-center nexus-panel">
              <p className="font-caption text-muted">No reports in the moderation queue.</p>
            </div>
          )}
        </div>
      </section>

      {/* Audit Trail — reserved for administrators because it can contain sensitive security context */}
      {canViewAudit && (
        <section>
          <SectionHeader
            title="Security Audit Log"
            description="Most recent platform events"
          />
          <div className="nexus-panel p-4">
            <DataTable>
              <DataTableHeader columns={["Timestamp", "Actor", "Action", "Target", "IP"]} />
              <DataTableBody>
                {auditLogs.length > 0 ? (
                  auditLogs.map((log) => (
                    <tr key={log.id}>
                      <td className="py-2.5 pr-4 text-faint">
                        {new Date(log.createdAt).toISOString()}
                      </td>
                      <td className="pr-4 text-purple">{log.actorId}</td>
                      <td className="pr-4 text-primary font-semibold">{log.action}</td>
                      <td className="pr-4 text-muted">{log.targetType}:{log.targetId}</td>
                      <td className="text-right text-faint">{log.ipAddress || "internal"}</td>
                    </tr>
                  ))
                ) : (
                  <DataTableEmpty colSpan={5} message="No audit events recorded." />
                )}
              </DataTableBody>
            </DataTable>
          </div>
        </section>
      )}
    </div>
  );
}
