import { store } from "./store";
import { generateId, can } from "@nexus/security";
import { ForbiddenError, NotFoundError } from "@nexus/domain";
import type { Report, AuditEvent, User } from "@nexus/domain";

export class AdminService {
  async getSystemHealthMetrics(actor: User) {
    if (!can(actor, "admin.access")) {
      throw new ForbiddenError("Admin access required");
    }

    return {
      status: "healthy",
      timestamp: new Date().toISOString(),
      uptimeSeconds: process.uptime(),
      memoryUsage: process.memoryUsage(),
      counts: {
        users: store.users.size,
        servers: store.servers.size,
        products: store.products.size,
        licenses: store.licenses.size,
        orders: store.orders.size,
        articles: store.content.size,
        reportsOpen: Array.from(store.reports.values()).filter((r) => r.status === "open").length,
      },
    };
  }

  async listAuditLogs(actor: User): Promise<AuditEvent[]> {
    if (!can(actor, "admin.audit")) {
      throw new ForbiddenError("Audit log access required");
    }

    return [...store.auditEvents].reverse();
  }

  async listReports(actor: User): Promise<Report[]> {
    if (!can(actor, "admin.moderation")) {
      throw new ForbiddenError("Moderator access required");
    }

    return Array.from(store.reports.values()).sort(
      (a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime()
    );
  }

  async resolveReport(
    reportId: string,
    input: { status: "resolved" | "dismissed"; moderatorNotes: string },
    actor: User
  ): Promise<Report> {
    if (!can(actor, "admin.moderation")) {
      throw new ForbiddenError("Moderator access required");
    }

    const report = store.reports.get(reportId);
    if (!report) throw new NotFoundError("Report", reportId);

    report.status = input.status;
    report.moderatorNotes = input.moderatorNotes;
    report.resolvedAt = new Date();
    store.reports.set(reportId, report);

    const auditEvent: AuditEvent = {
      id: generateId("aud"),
      actorId: actor.id,
      actorType: "admin",
      action: "report.resolved",
      targetId: reportId,
      targetType: "report",
      details: { resolution: input.status, notes: input.moderatorNotes },
      createdAt: new Date(),
    };
    store.auditEvents.push(auditEvent);

    return report;
  }
}

export const adminService = new AdminService();
