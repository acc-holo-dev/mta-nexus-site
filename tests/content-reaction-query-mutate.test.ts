import { expect, it, vi } from "vitest";

vi.mock("../packages/db/src/repositories/initiating-session", async () => {
  const { contentReactionQueryState } = await import("./helpers/content-reaction-query-harness");
  return { lockInitiatingSession: contentReactionQueryState.session };
});
vi.mock("../packages/db/src/repositories/content-reaction-notice", async () => {
  const { contentReactionQueryState } = await import("./helpers/content-reaction-query-harness");
  return { contentReactionNotice: contentReactionQueryState.notice };
});
vi.mock("../packages/db/src/client", async () => {
  const { createContentReactionQueryDbMock } = await import(
    "./helpers/content-reaction-query-harness"
  );
  return createContentReactionQueryDbMock();
});

import { contentReactionsRepository as reactions } from "../packages/db/src/repositories/content-reactions";
import {
  installContentReactionQueryHooks,
  contentReactionQueryCommand as command,
  contentReactionQueryFixture as fixture,
  contentReactionQueryState as state,
  contentReactionQueryWrites as writes,
} from "./helpers/content-reaction-query-harness";

installContentReactionQueryHooks();

it("serializes writes on publication, pair and live account, then saves desired state and audit atomically", async () => {
  fixture();
  expect(await reactions.set(command)).toMatchObject({
    contentId: "content",
    reaction: "helpful",
    counts: { helpful: 1, thanks: 0, insight: 0 },
    changed: true,
  });
  expect(state.queries[0].sql).toContain("for update");
  expect(state.queries[1].sql).toContain("pg_advisory_xact_lock");
  expect(state.queries[2].sql).toContain("for share");
  expect(state.queries[3].sql).toContain("for update");
  expect(writes().map((q) => q.sql.split(" ")[0])).toEqual([
    "delete",
    "insert",
    "insert",
    "update",
  ]);
  expect(state.session).toHaveBeenCalledTimes(2);
  expect(state.session.mock.calls[0]?.slice(1)).toEqual(["actor", "actor-token"]);
  expect(state.notice).toHaveBeenCalledOnce();
  expect(writes().at(-1)?.sql).not.toMatch(/updated_at|published_at|status|reputation/u);
  expect(writes()[2].params).toContain("content.reaction_changed");
});

it("treats retries as desired state and repairs only the derived counter", async () => {
  fixture([["existing", "👍"]]);
  expect(await reactions.set(command)).toHaveProperty("changed", false);
  expect(writes()).toHaveLength(1);
  expect(writes()[0].sql).toContain('update "content"');
  expect(state.notice).not.toHaveBeenCalled();
});

it("normalizes legacy duplicates when switching without adding a repeated notice", async () => {
  fixture([
    ["first", "👍"],
    ["second", "💡"],
  ]);
  await reactions.set({ ...command, reaction: "thanks" });
  const deletion = writes()[0];
  expect(deletion.params).toEqual(["actor", "content", "content"]);
  expect(deletion.sql).not.toContain("limit");
  expect(writes()[1].params).toContain("❤️");
  expect(state.notice).not.toHaveBeenCalled();
});

it.each(["draft", "archived"])(
  "denies public mutations of %s publications before any write",
  async (status) => {
    fixture([], status);
    await expect(reactions.set(command)).rejects.toMatchObject({ code: "NOT_FOUND" });
    expect(writes()).toHaveLength(0);
    expect(state.queries).toHaveLength(1);
  },
);

it("denies self reactions and deleted accounts while allowing removal of old self votes", async () => {
  fixture([], "published", "actor");
  await expect(reactions.set(command)).rejects.toMatchObject({ code: "REACTION_SELF" });
  expect(writes()).toHaveLength(0);
  fixture([["old", "👍"]], "published", "actor");
  await expect(reactions.set({ ...command, reaction: null })).resolves.toHaveProperty(
    "changed",
    true,
  );
  state.queries = [];
  fixture();
  state.rows[1] = [];
  await expect(reactions.set(command)).rejects.toMatchObject({ code: "UNAUTHORIZED" });
  expect(writes()).toHaveLength(0);
});

it("allows actor-scoped removal from an archived or missing target", async () => {
  fixture([["old", "❤️"]], "archived");
  expect(
    await reactions.set({
      actorId: "actor",
      currentToken: "actor-token",
      contentId: "content",
      reaction: null,
      reactionId: "new",
      auditId: "audit",
    }),
  ).toMatchObject({ slug: null, reaction: null, changed: true });
  state.queries = [];
  state.rows = [[], [["actor"]], [["orphan", "👍"]]];
  await expect(
    reactions.set({
      actorId: "actor",
      currentToken: "actor-token",
      contentId: "missing",
      reaction: null,
      reactionId: "new",
      auditId: "audit",
    }),
  ).resolves.toMatchObject({ slug: null, changed: true });
  expect(writes().map((q) => q.sql.split(" ")[0])).toEqual(["delete", "insert"]);
});

it("does not touch or report another private target when no own reaction exists", async () => {
  fixture([], "draft");
  expect(
    await reactions.set({
      actorId: "actor",
      currentToken: "actor-token",
      contentId: "content",
      reaction: null,
      reactionId: "new",
      auditId: "audit",
    }),
  ).toEqual({
    contentId: "content",
    slug: null,
    reaction: null,
    counts: { helpful: 0, thanks: 0, insight: 0 },
    changed: false,
  });
  expect(writes()).toHaveLength(0);
  expect(state.notice).not.toHaveBeenCalled();
});

it("propagates audit and inbox failures rather than confirming incomplete persistence", async () => {
  fixture();
  state.failAudit = true;
  await expect(reactions.set(command)).rejects.toMatchObject({
    cause: { message: "audit failure" },
  });
  fixture();
  state.failAudit = false;
  state.notice.mockRejectedValueOnce(new Error("inbox failure"));
  await expect(reactions.set(command)).rejects.toThrow("inbox failure");
});

it("rejects ambiguous scope and adding a reaction via private cleanup", async () => {
  for (const input of [
    { ...command, contentId: "content" },
    { ...command, slug: undefined, contentId: "content" },
    { ...command, slug: undefined },
  ])
    await expect(reactions.set(input)).rejects.toMatchObject({ code: "VALIDATION_ERROR" });
  expect(state.queries).toHaveLength(0);
});

it("rejects a missing initiating token before opening a transaction", async () => {
  await expect(reactions.set({ ...command, currentToken: "" })).rejects.toMatchObject({
    code: "UNAUTHORIZED",
  });
  expect(state.queries).toHaveLength(0);
});
