import { expect, it } from "vitest";
import type { ResourceDeliveryReceipt } from "@nexus/domain";
import {
  resourceDeliveriesQuery,
  resourceDeliveriesUrl,
  publisherDeliveriesQuery,
  resourceDeliveryId,
  deliverySearchParams,
} from "../apps/web/src/lib/resource-deliveries-query";
import { resourceDeliveriesCsv } from "../apps/web/src/lib/resource-deliveries-csv";
it("preserves bounded private selectors through pagination and exports", () => {
  const query = resourceDeliveriesQuery(
    new URLSearchParams("status=failed&days=30&resourceId=prd_one&page=2"),
  );
  expect(query).toEqual({ status: "failed", days: "30", resourceId: "prd_one", page: 2 });
  expect(resourceDeliveriesUrl(query)).toContain("resourceId=prd_one");
  expect(resourceDeliveriesUrl(query, "/api/library/downloads/export")).toContain(
    "/api/library/downloads/export?page=2",
  );
  expect(publisherDeliveriesQuery(new URLSearchParams("days=365&page=2"))).toEqual({
    days: "365",
    page: 2,
  });
});
it.each([
  "page=0",
  "page=99999",
  "page=1.2",
  "days=14",
  "days=7&days=30",
  "status=complete",
  "resourceId=usr_other",
  "userId=usr_other",
  "pageSize=1000",
  "resourceId=prd_bad%0A",
  "resourceId=",
  "status=served&status=failed",
])("rejects forged or ambiguous selectors: %s", (value) => {
  expect(() => resourceDeliveriesQuery(new URLSearchParams(value))).toThrow();
});
it("retains SSR duplicates for strict rejection and refuses buyer selectors in publisher statistics", () => {
  expect(() => resourceDeliveriesQuery(deliverySearchParams({ days: ["7", "30"] }))).toThrow();
  expect(() => publisherDeliveriesQuery(new URLSearchParams("status=served"))).toThrow();
  expect(resourceDeliveryId("dlv_valid")).toBe("dlv_valid");
  expect(() => resourceDeliveryId("dlv_x/../secret")).toThrow();
});
it("exports a safe bounded evidence snapshot with UTC and no internal fields", () => {
  const row: ResourceDeliveryReceipt = {
    id: "dlv_a",
    resourceId: "prd_a",
    buildId: "bld_a",
    version: "1.0.0",
    title: ' =HYPERLINK("secret")\nline',
    sha256Hash: "a".repeat(64),
    expectedBytes: 7,
    bytesSent: 3,
    status: "cancelled",
    errorCode: null,
    pinned: true,
    startedAt: new Date("2026-10-11T00:00:00Z"),
    finishedAt: new Date("2026-10-11T00:00:01Z"),
    downloadable: false,
  };
  const csv = resourceDeliveriesCsv([row]);
  expect(csv).toContain('"\' =HYPERLINK(""secret"")\nline"');
  expect(csv.startsWith("\ufeff")).toBe(true);
  expect(csv.endsWith("\r\n")).toBe(true);
  expect(csv).toContain("2026-10-11T00:00:00.000Z");
  expect(csv).not.toMatch(/user_id|storage_key|access_source|token/u);
  expect(() => resourceDeliveriesCsv(Array.from({ length: 21 }, () => row))).toThrow("bounded");
});
