import { NextRequest } from "next/server";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { serverClaimApiCopy } from "../../src/features/servers/server-claim-api-copy";
import {
  browserMutationHeaders,
  stubBrowserMutationOrigin,
} from "../helpers/browser-mutation-headers";

const mocks = vi.hoisted(() => ({
  getSession: vi.fn(),
  rate: vi.fn(),
  issueChallenge: vi.fn(),
  verifyChallenge: vi.fn(),
}));

vi.mock("../../src/lib/services/accounts/auth-service", () => ({
  authService: {
    getSession: mocks.getSession,
  },
}));

vi.mock("../../src/lib/services/servers/server-claim-service", () => ({
  serverClaimService: {
    issueChallenge: mocks.issueChallenge,
    verifyChallenge: mocks.verifyChallenge,
  },
}));

vi.mock("@nexus/security", () => ({
  consumeRateLimit: mocks.rate,
}));

import { POST as createChallenge } from "../../src/app/api/servers/[id]/claim-challenge/route";
import { POST as verifyChallenge } from "../../src/app/api/servers/[id]/claim-challenge/verify/route";

function createRequest(locale: "en" | "ru", actorId?: string) {
  const headers: Record<string, string> = {
    ...browserMutationHeaders(),
    cookie: `nexus_session=tok;nexus_locale=${locale}`,
  };
  if (actorId) headers["x-nexus-actor-id"] = actorId;
  return new NextRequest("https://nexus.test/api/servers/srv_a/claim-challenge", {
    method: "POST",
    headers,
  });
}

function verifyRequest(locale: "en" | "ru", body: Record<string, unknown>, actorId = "usr_claim") {
  return new NextRequest("https://nexus.test/api/servers/srv_a/claim-challenge/verify", {
    method: "POST",
    headers: {
      ...browserMutationHeaders(),
      cookie: `nexus_session=tok;nexus_locale=${locale}`,
      "content-type": "application/json",
      "x-nexus-actor-id": actorId,
    },
    body: JSON.stringify(body),
  });
}

const params = Promise.resolve({ id: "srv_a" });

describe("server claim API locale envelope", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    stubBrowserMutationOrigin();
    mocks.getSession.mockResolvedValue({ id: "usr_claim" });
    mocks.rate.mockResolvedValue({ success: true });
  });

  it("returns bilingual create auth and actor errors from nexus_locale", async () => {
    mocks.getSession.mockResolvedValueOnce(null);
    const unauth = await createChallenge(createRequest("ru"), { params });
    expect(unauth.status).toBe(401);
    expect(await unauth.json()).toMatchObject({
      error: serverClaimApiCopy("ru").authenticationRequired,
    });

    const actor = await createChallenge(createRequest("en"), { params });
    expect(actor.status).toBe(428);
    expect(await actor.json()).toMatchObject({
      code: "ACTOR_ID_REQUIRED",
      error: serverClaimApiCopy("en").actorRequired,
    });

    const changed = await createChallenge(createRequest("ru", "usr_other"), { params });
    expect(changed.status).toBe(409);
    expect(await changed.json()).toMatchObject({
      code: "ACTOR_CHANGED",
      error: serverClaimApiCopy("ru").accountChanged,
    });
    expect(mocks.issueChallenge).not.toHaveBeenCalled();
  });

  it("returns bilingual verify invalid proof from nexus_locale", async () => {
    const invalid = await verifyChallenge(
      verifyRequest("ru", { challengeId: "bad", token: "bad" }),
      {
        params,
      },
    );
    expect(invalid.status).toBe(400);
    expect(await invalid.json()).toMatchObject({
      error: serverClaimApiCopy("ru").invalidProof,
    });
    expect(mocks.verifyChallenge).not.toHaveBeenCalled();
  });
});
