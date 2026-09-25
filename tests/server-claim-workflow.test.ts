import { describe, expect, it } from "vitest";
import { readFileSync } from "node:fs";
import { resolve } from "node:path";

const read = (path: string) =>
  readFileSync(resolve(process.cwd(), path), "utf8");

describe("server ownership claim workflow", () => {
  it("requires the dedicated MTA control challenge before server verification", () => {
    const genericRoute = read(
      "apps/web/src/app/api/verification/route.ts",
    );
    const proofService = read(
      "apps/web/src/lib/services/server-claim-service.ts",
    );

    expect(genericRoute).toContain(
      "SERVER_CONTROL_CHALLENGE_REQUIRED",
    );
    expect(proofService).toContain(
      "serverClaimChallengeRepository.assertLive",
    );
    expect(proofService).toContain(
      "mtaMasterDirectoryService.getDirectory()",
    );
    expect(proofService).toContain(
      "observed.name.includes(input.token)",
    );
  });

  it("assigns ownership only inside an approved moderation transaction", () => {
    const repository = read(
      "packages/db/src/repositories/verification.ts",
    );

    expect(repository).toContain("ownerId: request.requesterId");
    expect(repository).toContain("isVerified: true");
    expect(repository).toContain(
      "Server claim target is already owned by another user",
    );
    expect(repository).toContain("db.transaction");
  });
});
