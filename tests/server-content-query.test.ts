import { expect, it, vi } from "vitest";

vi.mock("../packages/db/src/repositories/publication-notice", async () => {
  const { createServerContentQueryPublicationNoticeMock } = await import(
    "./helpers/server-content-query-harness"
  );
  return createServerContentQueryPublicationNoticeMock();
});
vi.mock("../packages/db/src/client", async () => {
  const { createServerContentQueryDbMock } = await import("./helpers/server-content-query-harness");
  return createServerContentQueryDbMock();
});

import { serverContentRepository as repository } from "../packages/db/src/repositories/server-content";
import {
  installServerContentQueryHooks,
  serverContentQueryState as state,
} from "./helpers/server-content-query-harness";

installServerContentQueryHooks();

it("reads all authors in the same live-access snapshot with bounded filters and no private columns", async () => {
  state.rows = [[["srv", "Server", "server"]], []];
  await repository.page("srv", "actor", { page: 2, query: "%_", status: "draft", type: "news" });
  expect(state.snapshots).toEqual([{ isolationLevel: "repeatable read", accessMode: "read only" }]);
  expect(state.queries[0].sql).toContain('"users"."role" =');
  expect(state.queries[0].params).not.toContain("owner");
  expect(state.queries[1].params).toEqual(["srv", "draft", "news", "%\\%\\_%", "%\\%\\_%", 21, 20]);
  expect(state.queries[1].sql.split(" from ")[0]).not.toMatch(/body|password|email/u);
  expect(state.queries[1].sql).not.toContain('"content"."author_id" =');
});
it("does not query drafts without current access and rejects foreign-server detail", async () => {
  await expect(repository.get("srv", "actor", "foreign")).rejects.toMatchObject({
    code: "NOT_FOUND",
  });
  expect(state.queries).toHaveLength(1);
  state.rows = [[["srv", "Server", "server"]], []];
  await expect(repository.get("srv", "actor", "foreign")).rejects.toMatchObject({
    code: "NOT_FOUND",
  });
  expect(state.queries.at(-1)?.params).toEqual(["foreign", "srv", 1]);
});
