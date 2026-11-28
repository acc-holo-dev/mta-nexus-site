import { createHash } from "node:crypto";
import type { User } from "@nexus/domain";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

const dbMocks = vi.hoisted(() => ({
  mutate: vi.fn(),
  findById: vi.fn(),
  moderate: vi.fn(),
  getSession: vi.fn(),
}));

const repositoryState = vi.hoisted(() => ({
  queries: [] as { sql: string; params: unknown[] }[],
  committed: [] as { sql: string; params: unknown[] }[],
  rows: [] as unknown[][],
  sessionReads: 0,
  revokeOnSecondLock: false,
}));

vi.mock("../../src/lib/services/commerce/wallet-payment-service", () => ({
  isWalletEngineEnabled: () => false,
}));

vi.mock("../../src/lib/services/accounts/auth-service", () => ({
  authService: { getSession: dbMocks.getSession },
}));

vi.mock("@nexus/db", () => ({
  authorContentRepository: {},
  contentCommentsRepository: {},
  contentDiscussionRepository: {},
  contentRepository: {
    findById: dbMocks.findById,
    moderateStatusWithAudit: dbMocks.moderate,
  },
  discussionManagementRepository: { mutate: dbMocks.mutate },
  discussionRevision: () => "unused",
  productRepository: {},
  serverRepository: {},
}));

vi.mock("../../packages/db/src/repositories/discussion-moderation-notice", () => ({
  discussionModerationNotice: vi.fn(),
}));

vi.mock("../../packages/db/src/client", async () => {
  const { drizzle } = await import("drizzle-orm/pg-proxy");
  let staging: { sql: string; params: unknown[] }[] = [];
  const database = drizzle(async (sql, params) => {
    const query = { sql, params };
    staging.push(query);
    repositoryState.queries.push(query);
    if (sql.includes('"sessions"')) {
      repositoryState.sessionReads += 1;
      if (repositoryState.revokeOnSecondLock && repositoryState.sessionReads > 1)
        return { rows: [] };
      return { rows: [["session", new Date(Date.now() + 3_600_000)]] };
    }
    return { rows: repositoryState.rows.shift() ?? [] };
  });
  return {
    db: new Proxy(database, {
      get(target, key) {
        if (key === "transaction") {
          return async (callback: (tx: typeof database) => Promise<unknown>) => {
            staging = [];
            repositoryState.queries = [];
            repositoryState.sessionReads = 0;
            try {
              const result = await callback(database);
              repositoryState.committed = staging.slice();
              return result;
            } catch (error) {
              repositoryState.committed = [];
              throw error;
            }
          };
        }
        const value = Reflect.get(target, key);
        return typeof value === "function" ? value.bind(target) : value;
      },
    }),
  };
});

import { NextRequest } from "next/server";
import {
  discussionManagementRepository,
  discussionRevision,
} from "../../packages/db/src/repositories/discussion-management";
import {
  browserMutationHeaders,
  stubBrowserMutationOrigin,
} from "../helpers/browser-mutation-headers";
import { DELETE, PATCH } from "../../src/app/api/content/[slug]/comments/[id]/route";
import { contentService } from "../../src/lib/services/community/content-service";

const tokenDigest = createHash("sha256").update("live-token", "utf8").digest("hex");
const moderator = { id: "usr_mod", role: "moderator" } as User;
const admin = { id: "usr_admin", role: "admin" } as User;
const reader = { id: "usr_reader", role: "user" } as User;

function article(status: "draft" | "published") {
  return {
    id: "cnt_1",
    status,
    type: "article" as const,
    updatedAt: new Date("2026-01-01T00:00:00.000Z"),
  };
}

function commentCommand(extra: Record<string, unknown> = {}) {
  return {
    slug: "article",
    commentId: "comment",
    actorId: "author",
    expectedRevision: discussionRevision("comment", "Original"),
    auditId: "audit",
    currentToken: "live-token",
    ...extra,
  };
}

function commentRows(author = "author", role = "user") {
  repositoryState.rows = [[["content", "published"]], [["comment", "Original", author]], [[role]]];
}

function writes(queries: { sql: string }[]) {
  return queries.filter((query) => /^(update|insert|delete)/u.test(query.sql));
}

function sessionLocks(queries: { sql: string; params: unknown[] }[]) {
  return queries
    .map((query, index) => ({ query, index }))
    .filter(({ query }) => query.sql.includes('"sessions"') && query.sql.includes("for update"));
}

function request(method: "PATCH" | "DELETE", cookie = "nexus_session=comment-token") {
  return new NextRequest("https://nexus.test/api/content/guide/comments/cmt_1", {
    method,
    headers: {
      ...browserMutationHeaders(),
      "content-type": "application/json",
      ...(cookie ? { cookie } : {}),
    },
    body: JSON.stringify(
      method === "PATCH"
        ? { text: "Updated note", expectedRevision: "a".repeat(64) }
        : { expectedRevision: "a".repeat(64) },
    ),
  });
}

const context = { params: Promise.resolve({ slug: "guide", id: "cmt_1" }) };

describe("comment edit and delete session lock", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    stubBrowserMutationOrigin();
    dbMocks.getSession.mockImplementation(async (token?: string) =>
      token === "comment-token"
        ? { id: "author", role: "user", username: "author", displayName: "Author" }
        : null,
    );
    dbMocks.mutate.mockResolvedValue({ contentId: "content", commentId: "cmt_1" });
    repositoryState.queries = [];
    repositoryState.committed = [];
    repositoryState.rows = [];
    repositoryState.sessionReads = 0;
    repositoryState.revokeOnSecondLock = false;
  });

  afterEach(() => {
    vi.unstubAllEnvs();
  });

  it.each(["PATCH", "DELETE"] as const)(
    "passes the initiating cookie from %s into the comment mutation",
    async (method) => {
      const response = await (method === "PATCH" ? PATCH : DELETE)(request(method), context);
      expect(response.status).toBe(200);
      expect(dbMocks.mutate).toHaveBeenCalledWith(
        expect.objectContaining({
          slug: "guide",
          commentId: "cmt_1",
          actorId: "author",
          currentToken: "comment-token",
          expectedRevision: "a".repeat(64),
          ...(method === "PATCH" ? { text: "Updated note" } : {}),
        }),
      );
    },
  );

  it("does not change a comment when the initiating cookie is absent", async () => {
    const response = await PATCH(request("PATCH", ""), context);
    expect(response.status).toBe(401);
    expect(dbMocks.mutate).not.toHaveBeenCalled();
  });

  it("commits an edit and its audit while the initiating session stays live", async () => {
    commentRows();
    const result = await discussionManagementRepository.mutate(commentCommand({ text: "Edited" }));
    expect(result).toMatchObject({ text: "Edited", commentId: "comment" });
    const locks = sessionLocks(repositoryState.committed);
    const committedWrites = writes(repositoryState.committed);
    expect(locks).toHaveLength(2);
    expect(locks[0].index).toBeLessThan(
      repositoryState.committed.findIndex((query) => query.sql.startsWith("update")),
    );
    expect(locks[1].index).toBeGreaterThan(
      repositoryState.committed.findIndex((query) => query.sql.startsWith("insert")),
    );
    for (const lock of locks) {
      expect(lock.query.params).toContain(tokenDigest);
      expect(lock.query.params).not.toContain("live-token");
    }
    expect(committedWrites.some((query) => query.sql.startsWith("update"))).toBe(true);
    expect(JSON.stringify(committedWrites)).toContain("content.comment_edited");
    expect(JSON.stringify(committedWrites)).toContain("Edited");
  });

  it("commits a deletion and its audit while the initiating session stays live", async () => {
    commentRows();
    await expect(discussionManagementRepository.mutate(commentCommand())).resolves.toMatchObject({
      removed: true,
    });
    const locks = sessionLocks(repositoryState.committed);
    expect(locks).toHaveLength(2);
    expect(locks[0].index).toBeLessThan(
      repositoryState.committed.findIndex((query) => query.sql.startsWith("delete")),
    );
    expect(locks[1].index).toBeGreaterThan(
      repositoryState.committed.findIndex((query) => query.sql.startsWith("insert")),
    );
    expect(JSON.stringify(writes(repositoryState.committed))).toContain("content.comment_removed");
  });

  it.each([
    ["edit", { text: "Edited" }, "content.comment_edited"],
    ["delete", {}, "content.comment_removed"],
  ] as const)(
    "rolls back a %s when the initiating session is revoked before commit",
    async (_name, extra, action) => {
      commentRows();
      repositoryState.revokeOnSecondLock = true;
      await expect(
        discussionManagementRepository.mutate(commentCommand(extra)),
      ).rejects.toMatchObject({ code: "UNAUTHORIZED" });
      const locks = sessionLocks(repositoryState.queries);
      const firstWrite = repositoryState.queries.findIndex((query) =>
        /^(update|insert|delete)/u.test(query.sql),
      );
      const auditIndex = repositoryState.queries.findIndex((query) =>
        query.sql.startsWith("insert"),
      );
      expect(locks).toHaveLength(2);
      expect(locks[0].index).toBeLessThan(firstWrite);
      expect(locks[1].index).toBeGreaterThan(auditIndex);
      expect(writes(repositoryState.committed)).toEqual([]);
      expect(JSON.stringify(repositoryState.committed)).not.toContain(action);
      expect(JSON.stringify(repositoryState.committed)).not.toContain("Edited");
    },
  );

  it("rejects a blank initiating token before writing the comment or its audit", async () => {
    commentRows();
    await expect(
      discussionManagementRepository.mutate(commentCommand({ text: "Edited", currentToken: "" })),
    ).rejects.toMatchObject({ code: "UNAUTHORIZED" });
    expect(repositoryState.sessionReads).toBe(0);
    expect(writes(repositoryState.queries)).toEqual([]);
    expect(writes(repositoryState.committed)).toEqual([]);
  });
});

describe("moderator publication actor", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    dbMocks.findById.mockResolvedValue(article("draft"));
    dbMocks.moderate.mockResolvedValue({
      id: "cnt_1",
      status: "published",
      updatedAt: new Date("2026-01-02T00:00:00.000Z"),
    });
  });

  it("records a moderator publication with that role and actor id", async () => {
    await contentService.moderateContent("cnt_1", "publish", moderator, "staff-session", "Ready");
    const audit = dbMocks.moderate.mock.calls[0][3];
    expect(audit).toMatchObject({
      actorId: "usr_mod",
      actorType: "moderator",
      action: "content.published",
      targetId: "cnt_1",
    });
    expect(dbMocks.moderate.mock.calls[0][4]).toBe("staff-session");
  });

  it("records a moderator archive with that role and actor id", async () => {
    dbMocks.findById.mockResolvedValue(article("published"));
    await contentService.moderateContent("cnt_1", "archive", moderator, "staff-session", "Retire");
    expect(dbMocks.moderate.mock.calls[0][3]).toMatchObject({
      actorId: "usr_mod",
      actorType: "moderator",
      action: "content.archived",
    });
  });

  it("records an admin publication as admin with that actor id", async () => {
    await contentService.moderateContent("cnt_1", "publish", admin, "admin-session", "Ready");
    expect(dbMocks.moderate.mock.calls[0][3]).toMatchObject({
      actorId: "usr_admin",
      actorType: "admin",
      action: "content.published",
    });
    expect(dbMocks.moderate.mock.calls[0][4]).toBe("admin-session");
  });

  it("does not record a publication decision without moderator privilege", async () => {
    await expect(
      contentService.moderateContent("cnt_1", "publish", reader, "reader-session", "Ready"),
    ).rejects.toMatchObject({ statusCode: 403 });
    expect(dbMocks.findById).not.toHaveBeenCalled();
    expect(dbMocks.moderate).not.toHaveBeenCalled();
  });
});
