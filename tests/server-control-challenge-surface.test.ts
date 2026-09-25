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
    expect(repository).toContain("SERVER_CONTROL_SNAPSHOT_TOO_OLD");
    expect(service).toContain("directory.isStale");
    expect(service).toContain("observed.responding === false");
    expect(service).toContain("observed.name.includes(input.token)");
    expect(service).toContain(
      'proofMethod: "mta_master_name_challenge"',
    );
  });

  it("blocks the old generic server verification path", () => {
    const route = read("apps/web/src/app/api/verification/route.ts");

    expect(route).toContain("SERVER_CONTROL_CHALLENGE_REQUIRED");
    expect(route).toContain(
      "Server ownership verification requires the MTA control challenge flow.",
    );
  });

  it("exposes proof UI for unowned public listings and managed unverified listings", () => {
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
    expect(panel).toContain("Master-list presence alone is not treated as proof");
    expect(panel).toContain(
      "Control proof does not assign ownership by itself",
    );
  });
});
