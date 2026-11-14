import { createHash } from "node:crypto";
import type { Build, User } from "@nexus/domain";
import { ForbiddenError } from "@nexus/domain";
import { getTableColumns } from "drizzle-orm";
import { beforeEach, describe, expect, it, vi } from "vitest";

const findExactPendingRetry = vi.hoisted(() => vi.fn());
vi.mock("@nexus/db", () => ({
  buildRepository: { findExactPendingRetry },
  productRepository: {},
  organizationRepository: {},
}));

import { ProductService } from "../../src/lib/services/product-service";

describe("pending upload retry authorization", () => {
  beforeEach(() => vi.clearAllMocks());
  const input = {
    productId: "prd_target",
    version: "1.2.3",
    sha256Hash: "a".repeat(64),
    fileSizeBytes: 8,
    fileName: "resource.zip",
    mimeType: "application/zip",
  };
  const actor = { id: "usr_author", role: "developer" } as User;

  it("reauthorizes before looking up the existing build", async () => {
    const service = new ProductService();
    const authorize = vi
      .spyOn(service, "assertCanReleaseBuild")
      .mockResolvedValue({ id: "prd_target" } as never);
    findExactPendingRetry.mockResolvedValue({ id: "bld_original" } as Build);
    expect(await service.recoverPendingBuildUpload(input, actor)).toMatchObject({
      id: "bld_original",
    });
    expect(authorize).toHaveBeenCalledWith("prd_target", actor);
    expect(authorize.mock.invocationCallOrder[0]).toBeLessThan(
      findExactPendingRetry.mock.invocationCallOrder[0],
    );
    expect(findExactPendingRetry).toHaveBeenCalledWith(input);
  });

  it("does not reveal existing uploads to actors who lost management access", async () => {
    const service = new ProductService();
    vi.spyOn(service, "assertCanReleaseBuild").mockRejectedValue(
      new ForbiddenError("Not authorized"),
    );
    await expect(service.recoverPendingBuildUpload(input, actor)).rejects.toBeInstanceOf(
      ForbiddenError,
    );
    expect(findExactPendingRetry).not.toHaveBeenCalled();
  });
});

const submitState = vi.hoisted(() => ({
  queries: [] as { sql: string; params: unknown[] }[],
  rows: [] as unknown[][][],
}));
vi.mock("../../packages/db/src/client", async () => {
  const { drizzle } = await import("drizzle-orm/pg-proxy");
  const database = drizzle(async (sql, params) => {
    submitState.queries.push({ sql, params });
    return { rows: submitState.rows.shift() ?? [] };
  });
  return {
    db: new Proxy(database, {
      get(target, key) {
        if (key === "transaction") return (run: (tx: typeof database) => unknown) => run(database);
        const value = Reflect.get(target, key);
        return typeof value === "function" ? value.bind(target) : value;
      },
    }),
  };
});

import { submitForReview } from "../../packages/db/src/repositories/builds-moderation";
import { builds } from "../../packages/db/src/schema";

describe("build upload final initiating-session gate", () => {
  const pending: Omit<Build, "createdAt"> = {
    id: "pending",
    productId: "product",
    version: "2.0.0",
    status: "pending_review",
    storageKey: "private/pending.zip",
    fileName: "pending.zip",
    mimeType: "application/zip",
    sha256Hash: "a".repeat(64),
    fileSizeBytes: 4,
    scanStatus: "clean",
    scanner: "fixture",
    scannedAt: new Date("2026-10-14T00:00:00Z"),
    isSigned: false,
  };
  const audit = {
    id: "audit",
    actorId: "author",
    actorType: "user" as const,
    action: "build.submitted_for_review",
    targetId: pending.id,
    targetType: "build",
  };
  const token = "upload-initiating-session";
  const writes = (table: string) =>
    submitState.queries.filter((query) =>
      new RegExp(`^(?:insert into|update) "${table}"`).test(query.sql),
    );

  beforeEach(() => {
    submitState.queries = [];
    submitState.rows = [];
  });

  function liveRows(session: unknown[][] = [["ses_author", "2099-01-01T00:00:00.000Z"]]) {
    const values: Record<string, unknown> = { ...pending, createdAt: new Date() };
    const buildRow = Object.keys(getTableColumns(builds)).map((key) => {
      const value = values[key];
      return value instanceof Date ? value.toISOString() : (value ?? null);
    });
    submitState.rows = [
      [["product", "published", "author", null, false]],
      [["author", "developer"]],
      session,
      [buildRow],
      [["approved"]],
      [],
    ];
  }

  it("locks product and actor before the initiating session, then writes the build", async () => {
    liveRows();
    const created = await submitForReview(pending, audit, token);
    expect(created).toMatchObject({ id: pending.id, status: "pending_review" });
    expect(submitState.queries[0].sql).toContain("for no key update");
    expect(submitState.queries[1].sql).toContain("for share");
    expect(submitState.queries[2].sql).toContain('"sessions"');
    expect(submitState.queries[2].sql).toContain("for update");
    expect(submitState.queries[2].params).toContain("author");
    expect(submitState.queries[2].params).toContain(
      createHash("sha256").update(token).digest("hex"),
    );
    expect(submitState.queries[2].params).not.toContain(token);
    expect(submitState.queries[3].sql).toMatch(/^insert into "builds" /u);
    expect(writes("builds")).toHaveLength(1);
    expect(writes("audit_events")).toHaveLength(1);
  });

  it.each([
    { label: "missing", session: [] as unknown[][] },
    { label: "expired", session: [["ses_author", "2000-01-01T00:00:00.000Z"]] as unknown[][] },
  ])("refuses a $label initiating session without a new build or audit", async ({ session }) => {
    liveRows(session);
    await expect(submitForReview(pending, audit, token)).rejects.toMatchObject({
      statusCode: 401,
      code: "UNAUTHORIZED",
    });
    expect(writes("builds")).toHaveLength(0);
    expect(writes("products")).toHaveLength(0);
    expect(writes("audit_events")).toHaveLength(0);
  });

  it("does not accept another live session for the same actor", async () => {
    liveRows([]);
    await expect(submitForReview(pending, audit, "other-live-session")).rejects.toMatchObject({
      statusCode: 401,
      code: "UNAUTHORIZED",
    });
    expect(writes("builds")).toHaveLength(0);
    expect(submitState.queries[2].params).toContain(
      createHash("sha256").update("other-live-session").digest("hex"),
    );
  });
});
