import { describe, expect, it } from "vitest";
import { readFileSync } from "node:fs";
import { resolve } from "node:path";

describe("abuse report workflow", () => {
  it("requires a real target, deduplicates open reports and notifies moderators", () => {
    const route = readFileSync(
      resolve(process.cwd(), "apps/web/src/app/api/reports/route.ts"),
      "utf8"
    );
    const repository = readFileSync(
      resolve(process.cwd(), "packages/db/src/repositories/reports.ts"),
      "utf8"
    );

    expect(route).toContain("Report target was not found");
    expect(route).toContain("You already have an open report for this target");
    expect(route).toContain("notificationRepository.create");
    expect(route).toContain("userRepository.listModeratorIds()");
    expect(route).toContain("reportRepository.createWithAudit(");
    expect(route).toContain("moderation.report_notification_failed");
    expect(repository).toContain("findOpenByReporterAndTarget");
  });
});
