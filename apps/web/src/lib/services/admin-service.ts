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

    const [users, servers, products, publishedContent, reportsOpen] =
      await Promise.all([
        userRepository.countAll(),
        serverRepository.countActivePublic(),
        productRepository.countPublishedFree(),
        contentRepository.countPublished(),
        reportRepository.countOpen(),
      ]);

    return {
      status: "healthy",
      timestamp: new Date().toISOString(),
      uptimeSeconds: process.uptime(),
      memoryUsage: process.memoryUsage(),
      counts: {
        users,
        servers,
        products,
        publishedContent,
        reportsOpen,
      },
    };
  }

  async listAuditLogs(actor: User): Promise<AuditEvent[]> {
    if (!can(actor, "admin.audit")) {
      throw new ForbiddenError("Audit log access required");
    }

    return auditRepository.listRecent(50);
  }

  async listReports(actor: User, view: "pending" | "history" = "pending", page = 1): Promise<{ reports: Report[]; hasMore: boolean }> {
    if (!can(actor, "admin.moderation")) {
      throw new ForbiddenError("Moderator access required");
    }

    return reportRepository.listPage(view, page);
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
      {
        id: generateId("aud"),
        actorId: actor.id,
        actorType: "admin",
        action: input.status === "resolved" ? "admin.resolve" : "admin.dismiss",
        targetId: reportId,
        targetType: "report",
        details: { notes: input.moderatorNotes },
      },
    );
    if (!report) throw new NotFoundError("Report", reportId);

    return report;
  }
}

export const adminService = new AdminService();
