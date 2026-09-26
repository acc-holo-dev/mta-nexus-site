import {
  auditRepository,
  contentRepository,
  productRepository,
  reportRepository,
  serverRepository,
  userRepository,
} from "@nexus/db";
import { can, generateId } from "@nexus/security";
import { ForbiddenError, NotFoundError } from "@nexus/domain";
import type { AuditEvent, Report, User } from "@nexus/domain";

export class AdminService {
  async getSystemHealthMetrics(actor: User) {
    if (!can(actor, "admin.access")) {
      throw new ForbiddenError("Admin access required");
    }

    const [users, servers, products, content, reports] =
      await Promise.all([
        userRepository.listAll(),
        serverRepository.listActivePublic(),
        productRepository.list(),
        contentRepository.listPublished(),
        reportRepository.listAll(),
      ]);

    return {
      status: "healthy",
      timestamp: new Date().toISOString(),
      uptimeSeconds: process.uptime(),
      memoryUsage: process.memoryUsage(),
      counts: {
        users: users.length,
        servers: servers.length,
        products: products.length,
        publishedContent: content.length,
        reportsOpen: reports.filter(
          (report) => report.status === "open",
        ).length,
      },
    };
  }

  async listAuditLogs(actor: User): Promise<AuditEvent[]> {
    if (!can(actor, "admin.audit")) {
      throw new ForbiddenError("Audit log access required");
    }

    return auditRepository.listRecent(50);
  }

  async listReports(actor: User): Promise<Report[]> {
    if (!can(actor, "admin.moderation")) {
      throw new ForbiddenError("Moderator access required");
    }

    return reportRepository.listAll();
  }

  async resolveReport(
    reportId: string,
    input: {
      status: "resolved" | "dismissed";
      moderatorNotes: string;
    },
    actor: User,
  ): Promise<Report> {
    if (!can(actor, "admin.moderation")) {
      throw new ForbiddenError("Moderator access required");
    }

    const report = await reportRepository.resolve(
      reportId,
      input.status,
      input.moderatorNotes,
    );
    if (!report) throw new NotFoundError("Report", reportId);

    await auditRepository.record({
      id: generateId("aud"),
      actorId: actor.id,
      actorType: "admin",
      action: "report.resolved",
      targetId: reportId,
      targetType: "report",
      details: {
        resolution: input.status,
        notes: input.moderatorNotes,
      },
    });

    return report;
  }
}

export const adminService = new AdminService();
