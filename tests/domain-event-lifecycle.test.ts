import { describe, expect, it } from "vitest";
import { readFileSync } from "node:fs";
import { resolve } from "node:path";

const read = (path: string) =>
  readFileSync(resolve(process.cwd(), path), "utf8");

describe("domain event lifecycle contracts", () => {
  it("does not call a pending-review build released", () => {
    const service = read("apps/web/src/lib/services/product-service.ts");
    const releaseStart = service.indexOf("async releaseBuild(");
    const reviewStart = service.indexOf("async reviewBuild(");
    const releaseSection = service.slice(releaseStart, reviewStart);

    expect(releaseSection).toContain(
      'type: "build.submitted_for_review"',
    );
    expect(releaseSection).not.toContain('type: "build.released"');
  });

  it("publishes build.released only after a successful approval result", () => {
    const service = read("apps/web/src/lib/services/product-service.ts");
    const reviewStart = service.indexOf("async reviewBuild(");
    const retireStart = service.indexOf("async retireBuild(");
    const reviewSection = service.slice(reviewStart, retireStart);

    const reviewedGuard = reviewSection.indexOf("if (!reviewed)");
    const releasedEvent = reviewSection.indexOf('type: "build.released"');

    expect(reviewedGuard).toBeGreaterThan(-1);
    expect(releasedEvent).toBeGreaterThan(reviewedGuard);
    expect(reviewSection).toContain(
      'if (input.decision === "approve")',
    );
  });

  it("allows server.created to represent organization-owned servers without a personal owner", () => {
    const events = read("packages/domain/src/events.ts");

    expect(events).toContain("ownerId?: string");
    expect(events).toContain("organizationId?: string");
    expect(events).toContain('"build.submitted_for_review"');
  });
});
