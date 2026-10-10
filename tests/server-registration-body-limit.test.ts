import { beforeEach, describe, expect, it, vi } from "vitest";
import { NextRequest } from "next/server";

const state = vi.hoisted(() => ({
  create: vi.fn(),
  user: { id: "usr_test", role: "user" } as { id: string; role: string } | null,
}));
vi.mock("@nexus/security", () => ({
  consumeRateLimit: vi.fn(async () => ({ success: true })),
}));
vi.mock("../apps/web/src/lib/services/auth-service", () => ({
  authService: { getSession: vi.fn(async () => state.user) },
}));
vi.mock("../apps/web/src/lib/services/server-service", () => ({
  serverService: { createServer: state.create },
}));
vi.mock("../apps/web/src/lib/services/mta-master-directory-service", () => ({
  mtaMasterDirectoryService: { getDirectory: vi.fn() },
  indexMtaObservations: vi.fn(),
  matchesMtaEndpoint: vi.fn(),
  mtaLiveStatus: vi.fn(),
}));
import { POST } from "../apps/web/src/app/api/servers/route";

beforeEach(() => {
  vi.clearAllMocks();
  state.user = { id: "usr_test", role: "user" };
});

describe("server registration request-body safety", () => {
  const send = (body: unknown) => POST(new NextRequest("https://nexus.test/api/servers", {
    method: "POST",
    headers: { "Content-Type": "application/json", cookie: "nexus_session=valid" },
    body: JSON.stringify(body),
  }));

  it("rejects oversized metadata with a typed 413 and no database write", async () => {
    const response = await send({ name: "Nexus", description: "x".repeat(40_000) });
    expect(response.status).toBe(413);
    expect(response.headers.get("cache-control")).toBe("private, no-store");
    expect(await response.json()).toMatchObject({ code: "REQUEST_BODY_TOO_LARGE" });
    expect(state.create).not.toHaveBeenCalled();
  });

  it("does not accept JSON that attempts to assign another server owner", async () => {
    const response = await send({
      name: "Nexus", slug: "nexus", ipAddress: "203.0.113.7", ownerId: "usr_other",
    });
    expect(response.status).toBe(400);
    expect(state.create).not.toHaveBeenCalled();
  });

  it("rejects invalid organization identifiers without touching persistence", async () => {
    const response = await send({
      name: "Nexus", slug: "nexus", ipAddress: "203.0.113.7",
      organizationId: "../other",
    });
    expect(response.status).toBe(400);
    expect(state.create).not.toHaveBeenCalled();
  });
});
