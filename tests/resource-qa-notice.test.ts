import { beforeEach, expect, it, vi } from "vitest";

const state = vi.hoisted(() => ({
  queries: [] as { sql: string; params: unknown[] }[],
  rows: [] as unknown[][],
  lock: vi.fn(),
  push: vi.fn(),
}));

vi.mock("../packages/db/src/repositories/notification-preference-lock", () => ({
  lockNotificationPreferencesForUsers: state.lock,
}));
vi.mock("../packages/db/src/repositories/web-push-admission-recovery", () => ({
  enqueueWebPushWithRecoveryWithin: state.push,
}));
vi.mock("../packages/db/src/client", async () => {
  const { drizzle } = await import("drizzle-orm/pg-proxy");
  const database = drizzle(async (sql, params) => {
    state.queries.push({ sql, params });
    return { rows: state.rows.shift() ?? [] };
  });
  const proxy = new Proxy(database, {
    get(target, key) {
      if (key === "transaction") return (work: (tx: typeof database) => unknown) => work(proxy);
      const value = Reflect.get(target, key);
      return typeof value === "function" ? value.bind(target) : value;
    },
  });
  return { db: proxy };
});

import { db } from "../packages/db/src/client";
import { notifyResourceQaEvent } from "../packages/db/src/repositories/resource-qa-notice";

type Tx = Parameters<Parameters<typeof db.transaction>[0]>[0];

const product = {
  id: "prd_a",
  title: "Physics Pack",
  slug: "physics-pack",
  authorId: "usr_publisher",
  organizationId: null as string | null,
};

beforeEach(() => {
  vi.clearAllMocks();
  state.queries = [];
  state.rows = [];
  state.push.mockResolvedValue({ queued: 1, reason: "queued" });
});

it("notifies the publisher about a new question with a content-category inbox row", async () => {
  state.rows = [[], [["notice"]]];
  await notifyResourceQaEvent(db as unknown as Tx, {
    kind: "asked",
    product,
    threadId: "rqt_a",
    actorId: "usr_asker",
  });
  expect(state.lock).toHaveBeenCalledWith(db, ["usr_publisher"]);
  const insert = state.queries.find((query) => query.sql.startsWith('insert into "notifications"'));
  expect(insert?.params).toEqual(
    expect.arrayContaining([
      "usr_publisher",
      "New resource question",
      "Someone asked about Physics Pack.",
      "/market/physics-pack#resource-qa",
      "content",
      "content",
    ]),
  );
  expect(state.push).toHaveBeenCalled();
});

it("fans out answer notices to the asker and other followers, never the answering actor", async () => {
  state.rows = [[["usr_asker"]], [["usr_follower"]], [], [["notice"]], [], [["notice"]]];
  await notifyResourceQaEvent(db as unknown as Tx, {
    kind: "answered",
    product,
    threadId: "rqt_a",
    actorId: "usr_publisher",
    answerId: "rqa_a",
  });
  expect(state.lock).toHaveBeenCalledWith(db, ["usr_asker"]);
  expect(state.lock).toHaveBeenCalledWith(db, ["usr_follower"]);
  expect(state.lock).not.toHaveBeenCalledWith(db, ["usr_publisher"]);
  expect(state.push).toHaveBeenCalledTimes(2);
});

it("skips self notices when the publisher asks their own resource", async () => {
  await notifyResourceQaEvent(db as unknown as Tx, {
    kind: "asked",
    product,
    threadId: "rqt_a",
    actorId: "usr_publisher",
  });
  expect(state.queries).toHaveLength(0);
  expect(state.push).not.toHaveBeenCalled();
});
