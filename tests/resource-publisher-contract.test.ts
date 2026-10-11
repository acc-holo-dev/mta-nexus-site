import { expect, it } from "vitest";
import {
  resourcePublisherQuery,
  resourcePublisherUrl,
  resourcePublisherHistoryQuery,
  publisherSearchParams,
} from "../apps/web/src/lib/resource-publisher-query";
it("roundtrips every publisher criterion without arbitrary owner identifiers", () => {
  const query = resourcePublisherQuery(
    new URLSearchParams(
      "page=2&q=100%25_&status=draft&type=script&scope=organization&readiness=ready&sort=title",
    ),
  );
  expect(
    resourcePublisherQuery(new URL(resourcePublisherUrl(query), "https://nexus.test").searchParams),
  ).toEqual(query);
  for (const raw of [
    "page=0",
    "page=01",
    "page=10000",
    "q=x&q=y",
    "status=other",
    "type=DROP",
    "scope=org_foreign",
    "ownerId=usr_other",
    "readiness=all&readiness=ready",
    "q=%00",
    `q=${"x".repeat(121)}`,
    "sort=other",
  ])
    expect(() => resourcePublisherQuery(new URLSearchParams(raw))).toThrow();
});
it("keeps ambiguous SSR arrays visible to strict query validation", () => {
  expect(() =>
    resourcePublisherQuery(publisherSearchParams({ status: ["draft", "published"] })),
  ).toThrow();
  expect(resourcePublisherHistoryQuery(new URLSearchParams("kind=changes&page=2"))).toEqual({
    kind: "changes",
    page: 2,
  });
  for (const raw of ["kind=all&kind=changes", "kind=private", "actorId=usr_other", "page=-1"])
    expect(() => resourcePublisherHistoryQuery(new URLSearchParams(raw))).toThrow();
});
