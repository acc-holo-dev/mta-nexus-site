import { NextRequest } from "next/server";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { serversApiCopy } from "../../src/features/servers/servers-api-copy";
import {
  browserMutationHeaders,
  stubBrowserMutationOrigin,
} from "../helpers/browser-mutation-headers";

const mocks = vi.hoisted(() => ({
  getSession: vi.fn(),
  rate: vi.fn(),
  listServers: vi.fn(),
  getDirectory: vi.fn(),
  createServer: vi.fn(),
}));

vi.mock("../../src/lib/services/accounts/auth-service", () => ({
  authService: {
    getSession: mocks.getSession,
  },
}));

vi.mock("../../src/lib/services/servers/server-service", () => ({
  serverService: {
    listServers: mocks.listServers,
    createServer: mocks.createServer,
  },
}));

vi.mock("../../src/lib/services/servers/mta-master-directory-service", () => ({
  mtaMasterDirectoryService: {
    getDirectory: mocks.getDirectory,
  },
  indexMtaObservations: () => () => null,
  matchesMtaEndpoint: () => false,
  mtaLiveStatus: () => "unknown",
}));

vi.mock("@nexus/security", () => ({
  consumeRateLimit: mocks.rate,
}));

import { GET, POST } from "../../src/app/api/servers/route";

function listRequest(locale: "en" | "ru") {
  return new NextRequest("https://nexus.test/api/servers", {
    headers: { cookie: `nexus_locale=${locale}` },
  });
}

function createRequest(locale: "en" | "ru", actorId?: string) {
  const headers: Record<string, string> = {
    ...browserMutationHeaders(),
    cookie: `nexus_session=tok;nexus_locale=${locale}`,
    "content-type": "application/json",
    "x-nexus-creation-nonce": "a".repeat(32),
  };
  if (actorId) headers["x-nexus-actor-id"] = actorId;
  return new NextRequest("https://nexus.test/api/servers", {
    method: "POST",
    headers,
    body: JSON.stringify({
      name: "Test Server",
      ipAddress: "127.0.0.1",
      port: 22003,
    }),
  });
}

describe("servers collection API locale envelope", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    stubBrowserMutationOrigin();
    mocks.getSession.mockResolvedValue({ id: "usr_srv" });
    mocks.rate.mockResolvedValue({ success: true });
    mocks.listServers.mockResolvedValue([]);
    mocks.getDirectory.mockResolvedValue({
      fetchedAt: "2099-01-01T00:00:00.000Z",
      isStale: false,
      servers: [],
    });
  });

  it("returns bilingual list unavailable from nexus_locale", async () => {
    mocks.listServers.mockRejectedValueOnce(new Error("db"));
    const ru = await GET(listRequest("ru"));
    expect(ru.status).toBe(503);
    expect(await ru.json()).toMatchObject({
      error: serversApiCopy("ru").listingsUnavailable,
    });
  });

  it("returns bilingual create auth and actor errors from nexus_locale", async () => {
    mocks.getSession.mockResolvedValueOnce(null);
    const unauth = await POST(createRequest("ru"));
    expect(unauth.status).toBe(401);
    expect(await unauth.json()).toMatchObject({
      error: serversApiCopy("ru").authenticationRequired,
    });

    const actor = await POST(createRequest("en"));
    expect(actor.status).toBe(428);
    expect(await actor.json()).toMatchObject({
      code: "ACTOR_ID_REQUIRED",
      error: serversApiCopy("en").actorRequired,
    });

    const changed = await POST(createRequest("ru", "usr_other"));
    expect(changed.status).toBe(409);
    expect(await changed.json()).toMatchObject({
      code: "ACTOR_CHANGED",
      error: serversApiCopy("ru").actorChanged,
    });
    expect(mocks.createServer).not.toHaveBeenCalled();
  });
});
