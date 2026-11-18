import { NextRequest } from "next/server";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { resourceInspectMetaApiCopy } from "../../src/features/resources/resource-inspect-meta-api-copy";
import {
  browserMutationHeaders,
  stubBrowserMutationOrigin,
} from "../helpers/browser-mutation-headers";

const mocks = vi.hoisted(() => ({
  getSession: vi.fn(),
  can: vi.fn(),
  rate: vi.fn(),
}));

vi.mock("../../src/lib/services/accounts/auth-service", () => ({
  authService: {
    getSession: mocks.getSession,
  },
}));

vi.mock("@nexus/security", () => ({
  can: mocks.can,
  consumeRateLimit: mocks.rate,
}));

import { POST } from "../../src/app/api/resources/inspect-meta/route";

function postRequest(
  locale: "en" | "ru",
  body = '<meta><info name="NEXUS" /></meta>',
  contentType = "text/plain",
) {
  return new NextRequest("https://nexus.test/api/resources/inspect-meta", {
    method: "POST",
    headers: {
      ...browserMutationHeaders(),
      cookie: `nexus_session=tok;nexus_locale=${locale}`,
      "content-type": contentType,
    },
    body,
  });
}

describe("resource inspect-meta API locale envelope", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    stubBrowserMutationOrigin();
    mocks.getSession.mockResolvedValue({ id: "usr_insp", role: "developer" });
    mocks.can.mockReturnValue(true);
    mocks.rate.mockResolvedValue({ success: true });
  });

  it("returns bilingual auth and developer errors from nexus_locale", async () => {
    mocks.getSession.mockResolvedValueOnce(null);
    const unauth = await POST(postRequest("ru"));
    expect(unauth.status).toBe(401);
    expect(await unauth.json()).toMatchObject({
      error: resourceInspectMetaApiCopy("ru").authenticationRequired,
    });

    mocks.can.mockReturnValueOnce(false);
    const forbidden = await POST(postRequest("en"));
    expect(forbidden.status).toBe(403);
    expect(await forbidden.json()).toMatchObject({
      error: resourceInspectMetaApiCopy("en").developerRequired,
    });
  });

  it("returns bilingual rate and media-type errors from nexus_locale", async () => {
    mocks.rate.mockResolvedValueOnce({ success: false });
    const rate = await POST(postRequest("ru"));
    expect(rate.status).toBe(429);
    expect(await rate.json()).toMatchObject({
      error: resourceInspectMetaApiCopy("ru").rate,
    });

    const wrongType = await POST(postRequest("en", "<meta />", "application/xml"));
    expect(wrongType.status).toBe(415);
    expect(await wrongType.json()).toMatchObject({
      error: resourceInspectMetaApiCopy("en").textPlainRequired,
    });
  });
});
