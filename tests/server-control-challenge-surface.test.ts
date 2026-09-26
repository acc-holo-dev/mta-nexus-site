import { describe, expect, it } from "vitest";
import { readFileSync } from "node:fs";
import { resolve } from "node:path";

const read = (path: string) =>
  readFileSync(resolve(process.cwd(), path), "utf8");

describe("server control proof surface", () => {
  it("stores only challenge digest and binds proof to fresh master-list evidence", () => {
    const repository = read(
      "packages/db/src/repositories/server-claim-challenges.ts",
    );
    const service = read(
      "apps/web/src/lib/services/server-claim-service.ts",
    );

    expect(repository).toContain("tokenDigest");
    expect(repository).not.toContain("token: input.token");
    expect(repository).toContain(
      "SERVER_CONTROL_SNAPSHOT_TOO_OLD",
    );
    expect(service).toContain("directory.isStale");
    expect(service).toContain("observed.responding === false");
    expect(service).toContain(
      "observed.name.includes(input.token)",
    );
    expect(repository).toContain(
      'proofMethod: "mta_master_name_challenge"',
    );
    expect(service).toContain(
      'method: "mta_master_name_challenge"',
    );
  });

  it("blocks generic and repository-level server verification bypasses", () => {
    const route = read(
      "apps/web/src/app/api/verification/route.ts",
    );
    const repository = read(
      "packages/db/src/repositories/verification.ts",
    );

    expect(route).toContain(
      "SERVER_CONTROL_CHALLENGE_REQUIRED",
    );
    expect(route).toContain(
      "Server ownership verification requires the MTA control challenge flow.",
    );
    expect(repository).toContain(
      "Server ownership verification requires a verified MTA control challenge.",
    );
    expect(repository).toContain(
      '"SERVER_CONTROL_CHALLENGE_REQUIRED"',
    );
  });

  it("requires consumed durable proof before moderator approval assigns ownership", () => {
    const repository = read(
      "packages/db/src/repositories/verification.ts",
    );

    expect(repository).toContain(
      "serverClaimChallenges.verificationRequestId",
    );
    expect(repository).toContain(
      "serverClaimChallenges.consumedAt",
    );
    expect(repository).toContain(
      "serverClaimChallenges.sourceFetchedAt",
    );
    expect(repository).toContain(
      "Verified MTA server control proof is required before approval",
    );
  });

  it("exposes localized proof UI for eligible listings", () => {
    const publicPage = read(
      "apps/web/src/app/servers/[slug]/page.tsx",
    );
    const workspacePage = read(
      "apps/web/src/app/workspace/servers/[id]/page.tsx",
    );
    const panel = read(
      "apps/web/src/components/server-claim-control-panel.tsx",
    );

    expect(publicPage).toContain(
      "!server.ownerId && !server.isVerified",
    );
    expect(publicPage).toContain("<ServerClaimControlPanel");
    expect(workspacePage).toContain("!server.isVerified");
    expect(workspacePage).toContain("<ServerClaimControlPanel");
    expect(panel).toContain("copy.exactEndpoint");
    expect(panel).toContain("copy.moderationSeparate");
    expect(panel).toContain("dictionary.serverClaim");
  });
});
