import {
  type AdminReportTargetPreview,
  auditRepository,
  contentRepository,
  productRepository,
  reportRepository,
  resolveAdminReportTargets,
  serverRepository,
  userRepository,
} from "@nexus/db";
import type { AuditEvent, Report, User } from "@nexus/domain";
import { ForbiddenError, NotFoundError } from "@nexus/domain";
import { can, generateId } from "@nexus/security";

type AdminReportListItem = Report & {
  targetPreview: AdminReportTargetPreview | null;
};

class AdminService {
  async getSystemHealthMetrics(actor: User) {
    if (!can(actor, "admin.access")) {
      throw new ForbiddenError("Admin access required");
    }

    const [users, servers, products, publishedContent, reportsOpen] = await Promise.all([
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

  async listReports(
    actor: User,
    view: "pending" | "history" = "pending",
    page = 1,
  ): Promise<{ reports: AdminReportListItem[]; hasMore: boolean }> {
    if (!can(actor, "admin.moderation")) {
      throw new ForbiddenError("Moderator access required");
    }

    const pageResult = await reportRepository.listPage(view, page);
    const targets = await resolveAdminReportTargets(pageResult.reports);
    return {
      hasMore: pageResult.hasMore,
      reports: pageResult.reports.map((report) => ({
        ...report,
        targetPreview: targets.get(`${report.targetType}:${report.targetId}`) ?? null,
      })),
    };
  }

  async getReport(actor: User, reportId: string): Promise<AdminReportListItem | null> {
    if (!can(actor, "admin.moderation")) {
      throw new ForbiddenError("Moderator access required");
    }
    if (!/^[A-Za-z0-9_-]{1,128}$/u.test(reportId)) return null;
    const report = await reportRepository.findById(reportId);
    if (!report) return null;
    const targets = await resolveAdminReportTargets([report]);
    return {
      ...report,
      targetPreview: targets.get(`${report.targetType}:${report.targetId}`) ?? null,
    };
  }

  async resolveReport(
    reportId: string,
    input: {
      status: "resolved" | "dismissed";
      moderatorNotes: string;
    },
    actor: User,
    currentToken: string,
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
      currentToken,
    );
    if (!report) throw new NotFoundError("Report", reportId);

    return report;
  }
}

export const adminService = new AdminService();
