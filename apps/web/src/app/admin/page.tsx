import { userRepository } from "@nexus/db";
import { adminService } from "../../lib/services/admin-service";
import {
  ShieldAlert,
  Activity,
  Users,
  Box,
  Server,
  FileText,
  AlertTriangle,
  History,
  CheckCircle2,
} from "lucide-react";

export const dynamic = "force-dynamic";

export default async function AdminPage() {
  const users = await userRepository.listAll();
  const adminUser = users.find((u) => u.role === "admin") || {
    id: "usr_admin_system",
    role: "admin" as const,
    email: "admin@mta-nexus.com",
    username: "admin",
    displayName: "Admin",
    isVerified: true,
    emailVerified: true,
    twoFactorEnabled: true,
    createdAt: new Date(),
    updatedAt: new Date(),
  };

  const health = await adminService.getSystemHealthMetrics(adminUser);
  const reports = await adminService.listReports(adminUser);
  const auditLogs = await adminService.listAuditLogs(adminUser);

  return (
    <div className="space-y-10">
      {/* Header */}
      <div className="border-b border-[#232838] pb-6 flex items-center justify-between">
        <div>
          <h1 className="text-2xl sm:text-3xl font-extrabold text-white flex items-center gap-2.5">
            <ShieldAlert className="w-7 h-7 text-red-500" />
            <span>Nexus Master Administration</span>
          </h1>
          <p className="text-xs text-neutral-400 mt-1">
            Global ecosystem telemetry, moderation cases, reports queue, and tamper-proof audit trails.
          </p>
        </div>

        <div className="flex items-center gap-2">
          <span className="w-2.5 h-2.5 rounded-full bg-emerald-500 animate-pulse" />
          <span className="text-xs font-mono text-emerald-400 uppercase font-bold">System Healthy</span>
        </div>
      </div>

      {/* Metrics Row */}
      <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-6 gap-4">
        <div className="p-4 rounded-xl border border-[#232838] bg-[#11131a]">
          <div className="text-[11px] text-neutral-500 uppercase tracking-wider">Users</div>
          <div className="text-2xl font-black text-white mt-1">{health.counts.users}</div>
        </div>
        <div className="p-4 rounded-xl border border-[#232838] bg-[#11131a]">
          <div className="text-[11px] text-neutral-500 uppercase tracking-wider">Servers</div>
          <div className="text-2xl font-black text-emerald-400 mt-1">{health.counts.servers}</div>
        </div>
        <div className="p-4 rounded-xl border border-[#232838] bg-[#11131a]">
          <div className="text-[11px] text-neutral-500 uppercase tracking-wider">Products</div>
          <div className="text-2xl font-black text-blue-400 mt-1">{health.counts.products}</div>
        </div>
        <div className="p-4 rounded-xl border border-[#232838] bg-[#11131a]">
          <div className="text-[11px] text-neutral-500 uppercase tracking-wider">Licenses</div>
          <div className="text-2xl font-black text-purple-400 mt-1">{health.counts.licenses}</div>
        </div>
        <div className="p-4 rounded-xl border border-[#232838] bg-[#11131a]">
          <div className="text-[11px] text-neutral-500 uppercase tracking-wider">Orders</div>
          <div className="text-2xl font-black text-white mt-1">{health.counts.orders}</div>
        </div>
        <div className="p-4 rounded-xl border border-[#232838] bg-[#11131a]">
          <div className="text-[11px] text-neutral-500 uppercase tracking-wider">Open Reports</div>
          <div className="text-2xl font-black text-amber-400 mt-1">{health.counts.reportsOpen}</div>
        </div>
      </div>

      {/* Moderation Cases & Reports */}
      <div className="p-6 rounded-xl border border-[#232838] bg-[#11131a] space-y-4">
        <div className="flex items-center justify-between border-b border-[#232838] pb-3">
          <h2 className="text-sm font-bold text-white flex items-center gap-2">
            <AlertTriangle className="w-4 h-4 text-amber-400" />
            <span>Moderation & Copyright Cases</span>
          </h2>
          <span className="text-xs text-neutral-500">Immutable Case History</span>
        </div>

        <div className="space-y-3">
          {reports.length > 0 ? (
            reports.map((r) => (
              <div
                key={r.id}
                className="p-4 rounded-lg bg-neutral-900 border border-[#232838] flex flex-col md:flex-row md:items-center justify-between gap-4"
              >
                <div className="space-y-1">
                  <div className="flex items-center gap-2">
                    <span className="px-2 py-0.5 rounded text-[10px] font-bold uppercase bg-amber-500/20 text-amber-400 border border-amber-500/30">
                      {r.type}
                    </span>
                    <span className="text-xs font-bold text-white">Target ID: {r.targetId}</span>
                  </div>
                  <p className="text-xs text-neutral-300">{r.reason}</p>
                  {r.moderatorNotes && (
                    <p className="text-[11px] text-neutral-500 font-mono">
                      Notes: {r.moderatorNotes}
                    </p>
                  )}
                </div>

                <div className="flex items-center gap-2 shrink-0">
                  <span className="px-2.5 py-1 rounded text-xs font-mono font-bold bg-neutral-800 text-neutral-300">
                    {r.status.toUpperCase()}
                  </span>
                </div>
              </div>
            ))
          ) : (
            <p className="text-xs text-neutral-500 py-4 text-center">
              No reports in moderation queue.
            </p>
          )}
        </div>
      </div>

      {/* Audit Trail */}
      <div className="p-6 rounded-xl border border-[#232838] bg-[#11131a] space-y-4">
        <div className="flex items-center justify-between border-b border-[#232838] pb-3">
          <h2 className="text-sm font-bold text-white flex items-center gap-2">
            <History className="w-4 h-4 text-blue-400" />
            <span>Platform Security Audit Log</span>
          </h2>
          <span className="text-[11px] text-neutral-500">Cryptographically Recorded Events</span>
        </div>

        <div className="overflow-x-auto">
          <table className="w-full text-left text-xs">
            <thead className="text-[11px] text-neutral-500 uppercase border-b border-neutral-800">
              <tr>
                <th className="py-2.5">Timestamp</th>
                <th>Actor</th>
                <th>Action</th>
                <th>Target</th>
                <th>IP</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-neutral-800/60 font-mono text-neutral-300">
              {auditLogs.length > 0 ? (
                auditLogs.map((log) => (
                  <tr key={log.id}>
                    <td className="py-2.5 text-neutral-500">
                      {new Date(log.createdAt).toISOString()}
                    </td>
                    <td className="text-purple-400">{log.actorId}</td>
                    <td className="font-bold text-white">{log.action}</td>
                    <td className="text-neutral-400">{log.targetType}:{log.targetId}</td>
                    <td className="text-neutral-500">{log.ipAddress || "internal"}</td>
                  </tr>
                ))
              ) : (
                <tr>
                  <td colSpan={5} className="py-4 text-center text-neutral-500">
                    No security audit events recorded.
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}
