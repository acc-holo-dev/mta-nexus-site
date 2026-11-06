import { createHash } from "node:crypto";
import { expect, it, vi } from "vitest";

vi.mock("../packages/db/src/repositories/publication-notice", async () => {
  const { serverPublicationHistoryQueryState } = await import(
    "./helpers/server-publication-history-query-harness"
  );
  return { publicationNotice: serverPublicationHistoryQueryState.notice };
});
vi.mock("../packages/db/src/client", async () => {
  const { createServerPublicationHistoryQueryDbMock } = await import(
    "./helpers/server-publication-history-query-harness"
  );
  return createServerPublicationHistoryQueryDbMock();
});

import { authorContentRepository as repo } from "../packages/db/src/repositories/author-content";
import {
  installServerPublicationHistoryQueryHooks,
  serverPublicationHistoryQueryState as state,
  serverPublicationHistoryQueryTime as time,
} from "./helpers/server-publication-history-query-harness";

installServerPublicationHistoryQueryHooks();

it("uses the existing current-server grants inside a private snapshot before a bounded shared editorial history", async () => {
  state.rows = [
    [["srv", "Server", "server"]],
    [["post", "Title", "archived", time, true]],
    Array.from({ length: 21 }, (_, i) => [
      "editor",
      "Editor",
      `event-${i}`,
      "content.archived_by_server",
      time,
      "published",
      "archived",
    ]),
  ];
  const result = await repo.history("post", "actor", undefined, undefined, "srv");
  expect(result.server).toEqual({ id: "srv", name: "Server" });
  expect(result.events).toHaveLength(20);
  expect(state.transactions).toEqual([
    { isolationLevel: "repeatable read", accessMode: "read only" },
  ]);
  expect(state.queries[0].sql).toContain('"organization_members"."permissions" @>');
  expect(state.queries[0].params).toContain('["manage_servers"]');
  const scope = state.queries[1];
  expect(scope.params).toEqual(expect.arrayContaining(["post", "srv", "article", "news"]));
  expect(scope.params.filter((value) => value === "post")).toHaveLength(1);
  expect(scope.sql).toContain('"content"."product_id" is null');
  expect(scope.sql).not.toContain('"content"."author_id" =');
  expect(scope.sql).toContain("content.archived_by_server");
  expect(scope.sql).toContain("staff_archive");
  expect(JSON.parse(result.olderCursor ?? "")).toMatchObject({
    context: createHash("sha256")
      .update(JSON.stringify([1, "server-publication-history", "actor", "srv", "post"]))
      .digest("hex"),
    createdAt: time,
  });
  const selected = state.queries[2].sql.split(" from ")[0];
  expect(selected).not.toMatch(/notes|ip_address|user_agent|email/u);
  expect(selected).toContain("'content.published','content.archived'");
});
it("denies unavailable live server scope before publication/history reads and checks cursor context after authority", async () => {
  await expect(repo.history("post", "revoked", undefined, undefined, "srv")).rejects.toMatchObject({
    code: "NOT_FOUND",
  });
  expect(state.queries).toHaveLength(1);
  state.rows = [[["srv", "Server", "server"]]];
  state.queries = [];
  await expect(
    repo.history(
      "post",
      "actor",
      { id: "audit", createdAt: time, context: "a".repeat(64), direction: "older" },
      undefined,
      "srv",
    ),
  ).rejects.toMatchObject({ code: "INVALID_CURSOR" });
  expect(state.queries).toHaveLength(1);
});
