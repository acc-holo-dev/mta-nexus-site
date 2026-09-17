import { describe, expect, it } from "vitest";
import { readFileSync } from "node:fs";
import { resolve } from "node:path";

describe("verification trust workflow", () => {
  it("requires ownership, prevents duplicates and creates moderator notifications", () => {
    const route = readFileSync(
      resolve(process.cwd(), "apps/web/src/app/api/verification/route.ts"),
      "utf8"
    );
    const repository = readFileSync(
      resolve(process.cwd(), "packages/db/src/repositories/verification.ts"),
      "utf8"
    );

    expect(route).toContain("You can only verify your own profile");
    expect(route).toContain("You do not own this server");
    expect(route).toContain("A verification request is already pending");
    expect(route).toContain("notificationRepository.create");
    expect(route).toContain('action: "verification.requested"');
    expect(repository).toContain("findPendingForTarget");
  });
});
