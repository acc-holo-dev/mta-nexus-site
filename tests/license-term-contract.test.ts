import { expect, it } from "vitest";
import { licenseArchiveQuery, licenseArchiveUrl } from "../apps/web/src/lib/license-archive-query";
import { licenseArchiveCsv } from "../apps/web/src/lib/license-archive-csv";
import { licenseTermNotification } from "../apps/web/src/lib/license-maintenance-i18n";
import { formatNotification } from "../apps/web/src/lib/notification-copy";
import { licenseMaintenanceOptions } from "../packages/db/src/license-maintenance-config";
it("strictly bounds buyer queries and preserves every active filter in navigation", () => {
  const query = licenseArchiveQuery(
    new URLSearchParams(
      "page=2&status=expiring&binding=bound&term=finite&sort=expires_soon&q=100%25_",
    ),
  );
  expect(
    licenseArchiveQuery(new URL(licenseArchiveUrl(query), "https://nexus.test").searchParams),
  ).toEqual(query);
  for (const text of [
    "page=1&page=2",
    "page=01",
    "page=10000",
    "status=other",
    "term=perpetual",
    "binding=srv_other",
    "sort=DROP",
    `q=${"x".repeat(121)}`,
    "buyerId=usr_other",
    "q=%00",
  ])
    expect(() => licenseArchiveQuery(new URLSearchParams(text))).toThrow();
});
it("exports only the displayed safe projection and neutralizes spreadsheet formula cells", () => {
  const date = new Date("2026-10-11T04:00:00.000Z");
  const csv = licenseArchiveCsv([
    {
      id: "lic_a",
      productTitle: ' \t=HYPERLINK("private")',
      effectiveStatus: "expired",
      model: "single_server",
      expiresAt: date,
      createdAt: date,
      serverBound: true,
    },
  ]);
  expect(csv).toContain('"\' \t=HYPERLINK(""private"")"');
  expect(csv).toContain("expires_at_utc");
  expect(csv).not.toMatch(/token_digest|server_id|license_key/u);
  expect(() =>
    licenseArchiveCsv(
      Array.from({ length: 21 }, () => ({
        id: "lic_a",
        productTitle: "Resource",
        effectiveStatus: "active",
        model: "single_server",
        expiresAt: date,
        createdAt: date,
        serverBound: true,
      })),
    ),
  ).toThrow();
});
it("localizes structured notices in RU/EN and fails closed on malformed term data", () => {
  const data = {
    kind: "license_term" as const,
    event: "expired" as const,
    expiresAt: "2026-10-11T04:00:00.000Z",
  };
  for (const locale of ["ru", "en"] as const) {
    const text = licenseTermNotification(data, locale);
    expect(text?.title).toBe(locale === "ru" ? "Срок лицензии истёк" : "License expired");
    expect(
      formatNotification(
        { title: "stored", message: "stored", data },
        { approved: "", rejected: "", version: "", notes: "" },
        locale,
      ),
    ).toEqual(text);
  }
  for (const extra of [
    { event: "renewed" },
    { expiresAt: "infinity" },
    { expiresAt: "2026-10-11" },
    { kind: "other" },
  ])
    expect(licenseTermNotification({ ...data, ...extra }, "en")).toBeNull();
});
it("guards worker opt-in and parses limits before the database import", () => {
  const env = {
    NODE_ENV: "production",
    DATABASE_URL: "postgres://nexus:never-log-this@localhost/mta_nexus",
    NEXUS_LICENSE_MAINTENANCE: "true",
  };
  expect(licenseMaintenanceOptions(env, ["--loop"])).toEqual({
    loop: true,
    limit: 20,
    intervalMs: 60000,
  });
  for (const extra of [
    { NEXUS_LICENSE_MAINTENANCE: "false" },
    { GITHUB_ACTIONS: "true" },
    { NODE_ENV: "unknown" },
    { DATABASE_URL: "https://other" },
    { NEXUS_LICENSE_MAINTENANCE_BATCH_SIZE: "101" },
    { NEXUS_LICENSE_MAINTENANCE_INTERVAL_MS: "0" },
  ]) {
    expect(() => licenseMaintenanceOptions({ ...env, ...extra }, ["--once"])).toThrow();
    try {
      licenseMaintenanceOptions({ ...env, ...extra }, ["--once"]);
    } catch (error) {
      expect(String(error)).not.toContain("never-log-this");
    }
  }
  expect(() => licenseMaintenanceOptions(env, ["--loop", "--once"])).toThrow();
});
