import { NextRequest } from "next/server";
import { expect, it, vi } from "vitest";

vi.mock("@nexus/db", async () => {
  const { createLicenseControlHttpDbMock } = await import("./helpers/license-control-http-harness");
  return createLicenseControlHttpDbMock();
});
vi.mock("@nexus/security", async (importOriginal) => {
  const { licenseControlHttpState } = await import("./helpers/license-control-http-harness");
  return {
    ...(await importOriginal<typeof import("@nexus/security")>()),
    consumeRateLimit: vi.fn(async () => ({ success: licenseControlHttpState.allowed })),
  };
});
vi.mock("../site/src/lib/services/auth-service", async () => {
  const { licenseControlHttpState } = await import("./helpers/license-control-http-harness");
  return {
    authService: { getSession: async () => licenseControlHttpState.user },
  };
});
vi.mock("../site/src/lib/request-client-ip", () => ({ getTrustedRequestIp: () => "unknown" }));

import { GET as maintenance } from "../site/src/app/api/admin/licenses/maintenance/route";
import { GET as archiveExport } from "../site/src/app/api/licenses/export/route";
import { GET as archive } from "../site/src/app/api/licenses/route";
import {
  installLicenseControlHttpLifecycle,
  revision,
  licenseControlHttpState as state,
} from "./helpers/license-control-http-harness";

installLicenseControlHttpLifecycle();

it("authenticates archive/export, preserves private filters and rate limits inspection", async () => {
  const date = new Date(revision);
  state.archive.mockResolvedValue({
    licenses: [
      {
        id: "lic_a",
        productTitle: "Resource",
        effectiveStatus: "expired",
        model: "single_server",
        expiresAt: date,
        createdAt: date,
        serverBound: true,
      },
    ],
    page: 2,
    totalPages: 3,
  });
  const query = "?page=2&status=expired&binding=bound&term=finite&sort=expires_soon&q=Resource";
  expect((await archive(new NextRequest(`https://nexus.test/api/licenses${query}`))).status).toBe(
    200,
  );
  expect(state.archive).toHaveBeenCalledWith("usr_a", 2, {
    page: 2,
    status: "expired",
    binding: "bound",
    term: "finite",
    sort: "expires_soon",
    q: "Resource",
  });
  const response = await archiveExport(
    new NextRequest(`https://nexus.test/api/licenses/export${query}`),
  );
  expect(response.status).toBe(200);
  expect(response.headers.get("content-type")).toContain("text/csv");
  expect(response.headers.get("cache-control")).toBe("private, no-store");
  expect(response.headers.get("vary")).toBe("Cookie");
  expect(response.headers.get("content-disposition")).toContain("licenses-page-2.csv");
  const csv = await response.text();
  expect(csv).toContain("Resource");
  expect(csv).not.toContain("usr_a");
  state.allowed = false;
  expect(
    (await archiveExport(new NextRequest("https://nexus.test/api/licenses/export"))).status,
  ).toBe(429);
});

it("denies guest archive requests and refuses unbounded or foreign-account filters", async () => {
  state.user = null;
  expect((await archive(new NextRequest("https://nexus.test/api/licenses"))).status).toBe(401);
  state.user = { id: "usr_a", role: "user" };
  for (const query of ["page=1&page=2", "userId=usr_other", `q=${"x".repeat(121)}`, "limit=100000"])
    expect(
      (await archiveExport(new NextRequest(`https://nexus.test/api/licenses/export?${query}`)))
        .status,
    ).toBe(400);
  expect(state.archive).not.toHaveBeenCalled();
});

it("restricts term maintenance inspection to admins while rechecking database authority", async () => {
  const request = new NextRequest("https://nexus.test/api/admin/licenses/maintenance?page=2");
  expect((await maintenance(request)).status).toBe(403);
  state.user = { id: "usr_a", role: "moderator" };
  expect((await maintenance(request)).status).toBe(403);
  expect(state.preview).not.toHaveBeenCalled();
  state.user = { id: "usr_a", role: "admin" };
  state.preview.mockResolvedValue({ items: [], page: 2, totalPages: 2 });
  expect((await maintenance(request)).status).toBe(200);
  expect(state.preview).toHaveBeenCalledWith("usr_a", 2);
});
