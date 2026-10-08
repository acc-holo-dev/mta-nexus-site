import { describe, expect, it } from "vitest";
import { readFileSync } from "node:fs";
import { resolve } from "node:path";

const read = (path: string) =>
  readFileSync(resolve(process.cwd(), path), "utf8");

describe("server ownership hardening surface", () => {
  it("uses trusted request IP for server registration", () => {
    const route = read("apps/web/src/app/api/servers/route.ts");
    expect(route).toContain(
      'import { getTrustedRequestIp } from "../../../lib/request-client-ip"',
    );
    expect(route).toContain("getTrustedRequestIp(request)");
    expect(route).not.toContain("getClientIp(request.headers)");
  });

  it("uses one server management contract in service and workspace page", () => {
    const service = read("apps/web/src/lib/services/server-service.ts");
    const page = read(
      "apps/web/src/app/workspace/servers/[id]/page.tsx",
    );

    expect(service).toContain("async canManageServer(");
    expect(service).toContain("organization?.ownerId === actor.id");
    expect(service).toContain("organizationRepository.listUserMemberships(actor.id)");
    expect(service).toContain('can(actor, "server.manage", server, {');
    expect(service).toContain("await this.canManageServer(server, actor)");
    expect(page).toContain("await serverService.canManageServer(server, user)");
    expect(page).not.toContain(
      'server.ownerId !== user.id && user.role !== "admin"',
    );
  });

  it("serializes server claims in the repository and checks pending claims across requesters", () => {
    const repository = read(
      "packages/db/src/repositories/verification.ts",
    );
    const route = read(
      "apps/web/src/app/api/verification/route.ts",
    );

    expect(repository).toContain(
      "pg_advisory_xact_lock",
    );
    expect(repository).toContain(
      "pg_advisory_xact_lock",
    );
    // Claim serialization keys on the verification target, not a server-only
    // literal: the same contract now covers user/developer/organization targets.
    const dollar = "$";
    expect(repository).toContain(
      `verification:${dollar}{input.targetType}:${dollar}{input.targetId}`,
    );
    expect(repository).toContain(
      "A verification request is already pending",
    );
    expect(repository).toContain(
      'throw new ConflictError("Server claim target is already owned by another user")',
    );
    expect(repository).toContain("findPendingForAnyRequester");
    // Duplicate pending requests are detected per requester before enqueue;
    // cross-requester pending state stays available on the repository for
    // moderation-side checks.
    expect(route).toContain(
      "verificationRepository.findPendingForTarget(",
    );
    expect(route).toContain("error instanceof AppError");
  });

  it("preserves private cache semantics on the authenticated verification GET", () => {
    const route = read(
      "apps/web/src/app/api/verification/route.ts",
    );

    // Every authenticated response (including 401 and rate limits) goes through
    // the json() helper, so the private no-store headers always apply.
    expect(route).toContain('"Cache-Control": "private, no-store"');
    expect(route).toContain("Vary: \"Cookie\"");
    expect(route).toContain("headers: privateHeaders");
    expect(route).toContain("return json(context, { requests });");
    expect(route).toMatch(/return json\(\s*context,\s*\{ error: "Unauthorized" \},\s*401,?\s*\)/u);
  });

  it("does not claim automatic proof or live-ownership acceptance", () => {
    const route = read(
      "apps/web/src/app/api/verification/route.ts",
    );

    expect(route).toContain("proofUrl");
    expect(route).not.toContain("ownershipVerified: true");
    expect(route).not.toContain("liveOwnershipVerified");
  });
});
