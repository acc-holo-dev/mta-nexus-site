import { expect, it } from "vitest";
import { resourceReleaseWatchCommandSchema } from "@nexus/validation";
import {
  resourceReleaseWatchesQuery,
  resourceReleaseWatchesUrl,
} from "../apps/web/src/lib/resource-release-watches-query";
import { resourceReleaseNotification } from "../apps/web/src/lib/resource-release-watches-i18n";
import { resourceReleaseWorkerOptions } from "../packages/db/src/resource-release-worker-config";
import { formatNotification } from "../apps/web/src/lib/notification-copy";
it("accepts only explicit revision-scoped opt-in commands without worker or account selectors", () => {
  expect(resourceReleaseWatchCommandSchema.parse({ enabled: true, expectedRevision: 0 })).toEqual({
    enabled: true,
    expectedRevision: 0,
  });
  for (const value of [
    { enabled: "true", expectedRevision: 0 },
    { enabled: true },
    { enabled: false, expectedRevision: -1 },
    { enabled: true, expectedRevision: 0, userId: "other" },
    { enabled: true, expectedRevision: 0, lastSequence: 999 },
    { enabled: false, expectedRevision: Number.MAX_SAFE_INTEGER },
  ])
    expect(resourceReleaseWatchCommandSchema.safeParse(value).success).toBe(false);
});
it("strictly bounds queries and preserves filtered navigation", () => {
  const value = resourceReleaseWatchesQuery(new URLSearchParams("filter=disabled&page=2"));
  expect(
    resourceReleaseWatchesQuery(
      new URL(resourceReleaseWatchesUrl(value.filter, value.page), "https://nexus.test")
        .searchParams,
    ),
  ).toEqual(value);
  for (const query of [
    "page=0",
    "page=01",
    "page=10000",
    "filter=private",
    "filter=all&filter=enabled",
    "userId=other",
    "pageSize=1000",
  ])
    expect(() => resourceReleaseWatchesQuery(new URLSearchParams(query))).toThrow();
});
it.each(["en", "ru"] as const)(
  "localizes structured release notices through the existing formatter (%s)",
  (locale) => {
    const data = { kind: "resource_release", resourceTitle: "Resource", version: "2.0.0" } as const;
    const result = formatNotification(
      { title: "fallback", message: "fallback", data },
      { approved: "", rejected: "", version: "", notes: "" },
      locale,
    );
    expect(result).toEqual(resourceReleaseNotification(data, locale));
    expect(result.title).toContain(locale === "ru" ? "Опубликована" : "published");
    expect(resourceReleaseNotification({ ...data, version: 1 }, locale)).toBeNull();
    expect(
      resourceReleaseNotification({ ...data, resourceTitle: "x".repeat(201) }, locale),
    ).toBeNull();
  },
);
it("worker requires explicit authorization and bounded configuration before importing the database", () => {
  const env = {
    NODE_ENV: "test",
    NEXUS_RESOURCE_RELEASE_WORKER: "true",
    DATABASE_URL: "postgres://nexus:unused@localhost/mta_nexus_test",
  };
  expect(resourceReleaseWorkerOptions(env, ["--once"])).toEqual({
    loop: false,
    limit: 20,
    intervalMs: 60000,
  });
  expect(
    resourceReleaseWorkerOptions(
      {
        ...env,
        NEXUS_RESOURCE_RELEASE_WORKER_BATCH_SIZE: "100",
        NEXUS_RESOURCE_RELEASE_WORKER_INTERVAL_MS: "1000",
      },
      ["--loop"],
    ),
  ).toEqual({ loop: true, limit: 100, intervalMs: 1000 });
  for (const value of [
    { ...env, NEXUS_RESOURCE_RELEASE_WORKER: "false" },
    { ...env, GITHUB_ACTIONS: "true" },
    { ...env, NODE_ENV: "" },
    { ...env, DATABASE_URL: "https://example.invalid" },
    { ...env, NEXUS_RESOURCE_RELEASE_WORKER_BATCH_SIZE: "101" },
    { ...env, NEXUS_RESOURCE_RELEASE_WORKER_INTERVAL_MS: "999" },
  ])
    expect(() => resourceReleaseWorkerOptions(value, ["--once"])).toThrow();
  expect(() => resourceReleaseWorkerOptions(env, ["--dry-run"])).toThrow();
});
