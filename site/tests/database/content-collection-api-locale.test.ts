import { NextRequest } from "next/server";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { contentApiCopy } from "../../src/features/community/content-api-copy";
import {
  browserMutationHeaders,
  stubBrowserMutationOrigin,
} from "../helpers/browser-mutation-headers";

const mocks = vi.hoisted(() => ({
  listPublished: vi.fn(),
  getSession: vi.fn(),
  rate: vi.fn(),
}));

vi.mock("@nexus/db", () => ({
  contentRepository: {
    listPublished: mocks.listPublished,
  },
  organizationRepository: {},
  productRepository: {},
}));

vi.mock("../../src/lib/services/accounts/auth-service", () => ({
  authService: {
    getSession: mocks.getSession,
  },
}));

vi.mock("@nexus/security", () => ({
  can: vi.fn(),
  consumeRateLimit: mocks.rate,
  generateId: vi.fn(() => "id_1"),
}));

import { GET, POST } from "../../src/app/api/content/route";

function getRequest(locale: "en" | "ru") {
  return new NextRequest("https://nexus.test/api/content", {
    headers: { cookie: `nexus_locale=${locale}` },
  });
}

function postRequest(locale: "en" | "ru") {
  return new NextRequest("https://nexus.test/api/content", {
    method: "POST",
    headers: {
      ...browserMutationHeaders(),
      cookie: `nexus_session=tok;nexus_locale=${locale}`,
      "content-type": "application/json",
    },
    body: "{}",
  });
}

describe("content collection API locale envelope", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    stubBrowserMutationOrigin();
    mocks.listPublished.mockResolvedValue([]);
    mocks.getSession.mockResolvedValue(null);
    mocks.rate.mockResolvedValue({ success: true });
  });

  it("returns bilingual list 503 and POST auth from nexus_locale", async () => {
    mocks.listPublished.mockRejectedValueOnce(new Error("db"));
    const list = await GET(getRequest("ru"));
    expect(list.status).toBe(503);
    expect(await list.json()).toMatchObject({
      error: contentApiCopy("ru").listUnavailable,
    });

    const unauth = await POST(postRequest("en"));
    expect(unauth.status).toBe(401);
    expect(await unauth.json()).toMatchObject({
      error: contentApiCopy("en").authenticationRequired,
    });
  });
});
