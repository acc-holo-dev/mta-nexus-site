import { describe, expect, it } from "vitest";
import { readFileSync } from "node:fs";
import { resolve } from "node:path";

const read = (path: string) =>
  readFileSync(resolve(process.cwd(), path), "utf8");

describe("build moderation control surface", () => {
  it("preserves domain error status codes and keeps build audit ownership in the transactional service", () => {
    const route = read("apps/web/src/app/api/admin/actions/route.ts");

    expect(route).toContain('import { AppError } from "@nexus/domain"');
    expect(route).toContain("error instanceof AppError");
    expect(route).toContain("error.statusCode");
    expect(route).toContain('else if (targetType === "build")');
    expect(route).toContain("productService.reviewBuild({");
    expect(route).not.toContain("auditRepository.record(");
    expect(route).toContain(
      'targetType: z.literal("build")',
    );
    expect(route).toContain("notes: z.string().trim().min(3).max(2000)");
  });

  it("serves reviewer artifacts only to moderators for pending clean builds", () => {
    const route = read(
      "apps/web/src/app/api/admin/builds/[buildId]/download/route.ts",
    );

    expect(route).toContain('can(actor, "admin.moderation")');
    expect(route).toContain('build.status !== "pending_review"');
    expect(route).toContain('build.scanStatus !== "clean"');
    expect(route).toContain("!build.scanner?.trim()");
    expect(route).toContain("!build.scannedAt");
    expect(route).toContain('"Content-Type": "application/octet-stream"');
    expect(route).toContain('"Content-Disposition"');
    expect(route).toContain('"X-Content-SHA256": build.sha256Hash');
    expect(route).toContain('"Cache-Control": "private, no-store"');
    expect(route).toContain('Vary: "Cookie"');
    expect(route).toContain("destroyOpenedStream(stored.stream)");
    expect(route).toContain(
      'action: "build.review_artifact_download_started"',
    );
  });

  it("requires review context and disables approve for non-clean scans in the admin UI", () => {
    const component = read(
      "apps/web/src/components/build-moderation-controls.tsx",
    );
    const page = read("apps/web/src/app/admin/page.tsx");

    expect(component).toContain("notes.trim().length >= 3");
    expect(component).toContain('scanStatus === "clean"');
    expect(component).toContain("hasScanProvenance");
    expect(component).toContain("hasTrustedCleanScan");
    expect(component).toContain("copy.artifactRequiresCleanScan");
    expect(component).toContain('moderate("approve")');
    expect(component).toContain('moderate("reject")');
    expect(page).toContain("{build.sha256Hash}");
    expect(page).toContain("copy.scanProvenance");
    expect(page).toContain("build.scanner");
    expect(page).toContain("<BuildModerationControls");
    expect(page).toContain("hasScanProvenance={Boolean(");
  });
});
