import { mkdtemp, readdir, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { NextRequest } from "next/server";
import { checkLocalReadiness } from "../scripts/check-local-readiness.mjs";

const checkDatabaseConnection = vi.hoisted(() => vi.fn());

vi.mock("@nexus/db", () => ({
  checkDatabaseConnection,
}));

import { GET } from "../apps/web/src/app/api/health/route";

function healthResponse(
  status: number,
  body: Record<string, unknown>,
) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { "content-type": "application/json" },
  });
}

describe("production runtime readiness", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("proves database health plus real private-storage publication semantics", async () => {
    const storagePath = await mkdtemp(
      join(tmpdir(), "nexus-readiness-test-"),
    );
    try {
      const result = await checkLocalReadiness({
        storagePath,
        fetchFn: vi.fn(async () =>
          healthResponse(200, {
            status: "ok",
            database: "reachable",
          }),
        ),
      });

      expect(result).toEqual({
        status: "ok",
        database: "reachable",
        storage: "read-write",
        publication: "atomic-no-replace",
      });

      expect(
        (await readdir(storagePath)).filter((name) =>
          name.startsWith(".nexus-readiness-"),
        ),
      ).toEqual([]);
    } finally {
      await rm(storagePath, { recursive: true, force: true });
    }
  });

  it("fails closed before touching storage when application/database health is unavailable", async () => {
    const storagePath = await mkdtemp(
      join(tmpdir(), "nexus-readiness-fail-"),
    );
    try {
      await expect(
        checkLocalReadiness({
          storagePath,
          fetchFn: vi.fn(async () =>
            healthResponse(503, {
              status: "unavailable",
              database: "unreachable",
            }),
          ),
        }),
      ).rejects.toThrow("Application/database is not ready");
      expect(await readdir(storagePath)).toEqual([]);
    } finally {
      await rm(storagePath, { recursive: true, force: true });
    }
  });

  it("fails closed when atomic no-replace publication is unavailable", async () => {
    const storagePath = await mkdtemp(
      join(tmpdir(), "nexus-readiness-link-"),
    );
    try {
      await expect(
        checkLocalReadiness({
          storagePath,
          fetchFn: vi.fn(async () =>
            healthResponse(200, {
              status: "ok",
              database: "reachable",
            }),
          ),
          linkFn: vi.fn(async () => {
            const error = new Error("hard links unsupported");
            Object.assign(error, { code: "EPERM" });
            throw error;
          }),
        }),
      ).rejects.toThrow("hard links unsupported");

      expect(
        (await readdir(storagePath)).filter((name) =>
          name.startsWith(".nexus-readiness-"),
        ),
      ).toEqual([]);
    } finally {
      await rm(storagePath, { recursive: true, force: true });
    }
  });

  it("rejects a relative storage path", async () => {
    await expect(
      checkLocalReadiness({
        storagePath: "relative/uploads",
        fetchFn: vi.fn(),
      }),
    ).rejects.toThrow("An absolute storage path is required");
  });

  it("keeps the public health endpoint database-only and non-cacheable on success", async () => {
    checkDatabaseConnection.mockResolvedValueOnce(undefined);

    const response = await GET(
      new NextRequest("https://nexus.test/api/health"),
    );

    expect(response.status).toBe(200);
    expect(response.headers.get("cache-control")).toBe("no-store");
    await expect(response.json()).resolves.toMatchObject({
      status: "ok",
      database: "reachable",
    });
    expect(checkDatabaseConnection).toHaveBeenCalledOnce();
  });

  it("returns a private non-cacheable 503 when database health fails", async () => {
    checkDatabaseConnection.mockRejectedValueOnce(
      new Error("database offline"),
    );
    const errorLog = vi
      .spyOn(console, "error")
      .mockImplementation(() => {});

    try {
      const response = await GET(
        new NextRequest("https://nexus.test/api/health"),
      );

      expect(response.status).toBe(503);
      expect(response.headers.get("cache-control")).toBe("no-store");
      await expect(response.json()).resolves.toMatchObject({
        status: "unavailable",
        database: "unreachable",
      });
    } finally {
      errorLog.mockRestore();
    }
  });
});
