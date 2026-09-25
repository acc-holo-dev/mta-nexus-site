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
      "verification:server:",
    );
    expect(repository).toContain(
      "A server ownership request is already pending",
    );
    expect(repository).toContain(
      'throw new ConflictError("Server claim target is already owned by another user")',
    );
    expect(repository).toContain("findPendingForAnyRequester");
    expect(route).toContain(
      "verificationRepository.findPendingForAnyRequester",
    );
    expect(route).toContain("error instanceof AppError");
  });

  it("preserves private cache semantics on the authenticated verification GET", () => {
    const route = read(
      "apps/web/src/app/api/verification/route.ts",
    );

    expect(route).toContain(
      'const privateHeaders = { "Cache-Control": "private, no-store", Vary: "Cookie" }',
    );
    expect(route).toContain(
      'return NextResponse.json({ requests }, { headers: privateHeaders })',
    );
    expect(route).toContain(
      '{ status: 401, headers: privateHeaders }',
    );
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
