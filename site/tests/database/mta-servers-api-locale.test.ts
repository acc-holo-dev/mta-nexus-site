import { NextRequest } from "next/server";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { serversDirectoryApiCopy } from "../../src/features/servers/servers-directory-api-copy";

const mocks = vi.hoisted(() => ({
  getDirectory: vi.fn(),
}));

vi.mock("../../src/lib/services/servers/mta-master-directory-service", () => ({
  mtaMasterDirectoryService: {
    getDirectory: mocks.getDirectory,
  },
}));

import { GET } from "../../src/app/api/mta/servers/route";

function request(locale: "en" | "ru") {
  return new NextRequest("https://nexus.test/api/mta/servers", {
    headers: { cookie: `nexus_locale=${locale}` },
  });
}

describe("mta servers API locale envelope", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("returns bilingual 503 from nexus_locale when master directory fails", async () => {
    mocks.getDirectory.mockRejectedValueOnce(new Error("upstream"));
    const ru = await GET(request("ru"));
    expect(ru.status).toBe(503);
    expect(ru.headers.get("Retry-After")).toBe("30");
    expect(await ru.json()).toMatchObject({
      error: serversDirectoryApiCopy("ru").mtaUnavailable,
    });

    mocks.getDirectory.mockRejectedValueOnce(new Error("upstream"));
    const en = await GET(request("en"));
    expect(en.status).toBe(503);
    expect(await en.json()).toMatchObject({
      error: serversDirectoryApiCopy("en").mtaUnavailable,
    });
  });
});
