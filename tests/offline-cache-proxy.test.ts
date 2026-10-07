import { describe, expect, it } from "vitest";
import { NextRequest } from "next/server";
import { config, proxy } from "../apps/web/proxy";

function request(
  pathname: string,
  options: { cookie?: string; method?: string } = {},
) {
  return new NextRequest(`https://nexus.test${pathname}`, {
    method: options.method ?? "GET",
    headers: options.cookie
      ? { Cookie: options.cookie }
      : undefined,
  });
}

describe("public offline cache proxy contract", () => {
  it("marks only anonymous GET responses for approved paths", () => {
    const response = proxy(request("/articles/release-notes"));

    expect(
      response.headers.get("x-nexus-offline-cache"),
    ).toBe("public-readonly-v1");
    expect(response.headers.get("vary")?.toLowerCase()).toContain(
      "cookie",
    );
  });

  it("fails closed when any session cookie is present", () => {
    const response = proxy(
      request("/articles/release-notes", {
        cookie: "nexus_session=opaque; nexus_locale=ru",
      }),
    );

    expect(
      response.headers.get("x-nexus-offline-cache"),
    ).toBeNull();
  });

  it("does not mark non-GET or non-read-only routes", () => {
    expect(
      proxy(
        request("/articles/release-notes", {
          method: "POST",
        }),
      ).headers.get("x-nexus-offline-cache"),
    ).toBeNull();

    expect(
      proxy(request("/market")).headers.get(
        "x-nexus-offline-cache",
      ),
    ).toBeNull();
  });

  it("keeps the Next.js matcher constrained to the same public surface", () => {
    expect(config.matcher).toEqual([
      "/articles/:path*",
      "/copyright",
      "/privacy",
      "/terms",
    ]);
  });
});
