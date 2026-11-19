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
  updateServer: vi.fn(),
}));

vi.mock("../../src/lib/services/accounts/auth-service", () => ({
  authService: {
    getSession: mocks.getSession,
  },
}));

vi.mock("../../src/lib/services/servers/server-service", () => ({
  serverService: {
    updateServer: mocks.updateServer,
  },
}));

vi.mock("@nexus/security", () => ({
  consumeRateLimit: mocks.rate,
}));

import { PATCH } from "../../src/app/api/servers/[id]/route";

const params = Promise.resolve({ id: "srv_1" });

function patchRequest(locale: "en" | "ru", body: Record<string, unknown> = { name: "Updated" }) {
  return new NextRequest("https://nexus.test/api/servers/srv_1", {
    method: "PATCH",
    headers: {
      ...browserMutationHeaders(),
      cookie: `nexus_session=tok;nexus_locale=${locale}`,
      "content-type": "application/json",
      "x-nexus-actor-id": "usr_owner",
    },
    body: JSON.stringify(body),
  });
}

describe("servers detail PATCH API locale envelope", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    stubBrowserMutationOrigin();
    mocks.getSession.mockResolvedValue({ id: "usr_owner" });
    mocks.rate.mockResolvedValue({ success: true });
  });

  it("returns bilingual auth error from nexus_locale", async () => {
    mocks.getSession.mockResolvedValueOnce(null);
    const unauth = await PATCH(patchRequest("ru"), { params });
    expect(unauth.status).toBe(401);
    expect(await unauth.json()).toMatchObject({
      error: serversApiCopy("ru").authenticationRequired,
    });
    expect(mocks.updateServer).not.toHaveBeenCalled();
  });

  it("returns bilingual update-limit error from nexus_locale", async () => {
    mocks.rate.mockResolvedValueOnce({ success: false });
    const limited = await PATCH(patchRequest("en"), { params });
    expect(limited.status).toBe(429);
    expect(await limited.json()).toMatchObject({
      error: serversApiCopy("en").updateLimitExceeded,
    });
    expect(mocks.updateServer).not.toHaveBeenCalled();
  });

  it("returns bilingual invalid-details error from nexus_locale", async () => {
    const invalid = await PATCH(patchRequest("ru", {}), { params });
    expect(invalid.status).toBe(400);
    expect(await invalid.json()).toMatchObject({
      error: serversApiCopy("ru").invalidServerDetails,
    });
    expect(mocks.updateServer).not.toHaveBeenCalled();
  });
});
