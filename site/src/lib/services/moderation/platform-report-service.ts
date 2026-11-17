import {
  type AdminReportTargetPreview,
  reportRepository,
  resolveAdminReportTargets,
} from "@nexus/db";
import type { Report, User } from "@nexus/domain";
import { UnauthorizedError } from "@nexus/domain";

type PlatformReportListItem = Report & {
  targetPreview: AdminReportTargetPreview | null;
};

class PlatformReportService {
  async listForReporter(
    actor: User | null,
    page: number,
  ): Promise<{ reports: PlatformReportListItem[]; hasMore: boolean; page: number }> {
    if (!actor) throw new UnauthorizedError();
    const result = await reportRepository.listForReporter(actor.id, page);
    const targets = await resolveAdminReportTargets(result.reports);
    return {
      page,
      hasMore: result.hasMore,
      reports: result.reports.map((report) => ({
        ...report,
        targetPreview: targets.get(`${report.targetType}:${report.targetId}`) ?? null,
      })),
    };
  }

  async detailForReporter(
    actor: User | null,
    reportId: string,
  ): Promise<PlatformReportListItem | null> {
    if (!actor) throw new UnauthorizedError();
    if (!/^[A-Za-z0-9_-]{1,128}$/u.test(reportId)) return null;
    const report = await reportRepository.findOwnedByReporter(reportId, actor.id);
    if (!report) return null;
    const targets = await resolveAdminReportTargets([report]);
    return {
      ...report,
      targetPreview: targets.get(`${report.targetType}:${report.targetId}`) ?? null,
    };
  }
}

export const platformReportService = new PlatformReportService();
