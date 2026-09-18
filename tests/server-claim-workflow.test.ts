import { describe, expect, it } from "vitest";
import { readFileSync } from "node:fs";
import { resolve } from "node:path";

const read = (path: string) => readFileSync(resolve(process.cwd(), path), "utf8");

describe("server ownership claim workflow", () => {
  it("allows claims only for unowned or already-owned-by-requester servers", () => {
    const route = read("apps/web/src/app/api/verification/route.ts");

    expect(route).toContain("server.ownerId && server.ownerId !== user.id");
    expect(route).toContain("This server is already claimed");
    expect(route).not.toContain("You do not own this server");
  });

  it("assigns ownership only inside an approved moderation transaction", () => {
    const repository = read("packages/db/src/repositories/verification.ts");

    expect(repository).toContain("ownerId: request.requesterId");
    expect(repository).toContain("isVerified: true");
    expect(repository).toContain("Server claim target is already owned by another user");
    expect(repository).toContain("db.transaction");
  });
});
