import { describe, expect, it } from "vitest";
import { readFileSync } from "node:fs";
import { resolve } from "node:path";

const read = (path: string) =>
  readFileSync(resolve(process.cwd(), path), "utf8");

describe("verification moderation controls surface", () => {
  it("renders review controls only for pending verification requests", () => {
    const page = read("apps/web/src/app/admin/page.tsx");
    expect(page).toContain(
      'import { VerificationModerationControls } from "../../components/verification-moderation-controls"',
    );
    expect(page).toContain('request.status === "pending"');
    expect(page).toContain(
      "<VerificationModerationControls requestId={request.id} />",
    );
  });

  it("requires review context and uses the shared admin action endpoint", () => {
    const controls = read(
      "apps/web/src/components/verification-moderation-controls.tsx",
    );
    expect(controls).toContain("notes.trim().length >= 3");
    expect(controls).toContain('fetch("/api/admin/actions"');
    expect(controls).toContain('targetType: "verification"');
    expect(controls).toContain('action,');
    expect(controls).toContain("notes: notes.trim()");
    expect(controls).toContain("confirmsAdminAction(");
  });

  it("keeps server proof enforcement on the backend, not in the client", () => {
    const repository = read(
      "packages/db/src/repositories/verification.ts",
    );
    expect(repository).toContain(
      "Verified MTA server control proof is required before approval",
    );
    expect(repository).toContain(
      "serverClaimChallenges.verificationRequestId",
    );
  });
  it("enforces verification review notes at the HTTP boundary", () => {
    const route = read(
      "apps/web/src/app/api/admin/actions/route.ts",
    );
    expect(route).toContain(
      'targetType: z.literal("verification")',
    );
    expect(route).toContain(
      'notes: z.string().trim().min(3).max(2000)',
    );
  });

});
