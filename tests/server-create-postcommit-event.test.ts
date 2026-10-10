import type { User } from "@nexus/domain";
import { beforeEach, describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({
  insert: vi.fn(),
  managedUpdate: vi.fn(),
}));
vi.mock("@nexus/db", () => ({
  serverRepository: {
    createWithAudit: mocks.insert,
    updateManagedWithAudit: mocks.managedUpdate,
  },
  organizationRepository: { findById: vi.fn(), listUserMemberships: vi.fn() },
}));
vi.mock("@nexus/security", () => ({
  can: vi.fn(() => true),
  generateId: vi.fn((prefix: string) => `${prefix}_test`),
}));

import { eventBus } from "@nexus/domain";
import { serverService } from "../apps/web/src/lib/services/server-service";

const actor = { id: "usr_1", role: "user" } as User;
const input = {
  name: "Test Server",
  slug: "test-server",
  ipAddress: "203.0.113.22",
  port: 22003,
  visibility: "private" as const,
  mediaUrls: [],
  gameplayTags: [],
};

beforeEach(() => {
  vi.restoreAllMocks();
  mocks.insert.mockReset();
  mocks.insert.mockImplementation(async (server) => server);
  mocks.managedUpdate.mockReset();
  mocks.managedUpdate.mockImplementation(async (_id, changes) => ({
    id: "srv_1", ...changes,
  }));
});

describe("server creation after durable write", () => {
  it("returns the stored server even when event dispatch rejects", async () => {
    const publish = vi.spyOn(eventBus, "publish").mockRejectedValueOnce(
      new Error("subscriber failed with private payload"),
    );
    const log = vi.spyOn(console, "error").mockImplementation(() => {});
    const stored = await serverService.createServer(input, actor);
    expect(stored).toMatchObject({ id: "srv_test", name: "Test Server" });
    expect(mocks.insert).toHaveBeenCalledTimes(1);
    expect(publish).toHaveBeenCalledOnce();
    expect(log).toHaveBeenCalledWith(
      "Nexus committed write succeeded but event dispatch failed",
      expect.objectContaining({ eventType: "server.created", aggregateId: "srv_test" }),
    );
    expect(JSON.stringify(log.mock.calls)).not.toContain("private payload");
  });

  it.each([
    ["servers_slug_unique", "SERVER_SLUG_TAKEN"],
    ["servers_slug_idx", "SERVER_SLUG_TAKEN"],
    ["servers_endpoint_idx", "SERVER_ENDPOINT_TAKEN"],
  ])("returns a structured 409 on create constraint %s", async (constraint, code) => {
    const publish = vi.spyOn(eventBus, "publish");
    mocks.insert.mockRejectedValueOnce({
      cause: { code: "23505", constraint },
    });
    await expect(serverService.createServer(input, actor))
      .rejects.toMatchObject({ statusCode: 409, code });
    expect(publish).not.toHaveBeenCalled();
  });

  it("handles edit conflicts and delegates authority to the database transaction", async () => {
    const original = new Date("2026-10-10T01:00:00.000Z");
    await expect(serverService.updateServer(
      "srv_1", { description: "New" }, actor, original,
    )).resolves.toMatchObject({ id: "srv_1", description: "New" });
    expect(mocks.managedUpdate).toHaveBeenCalledWith(
      "srv_1",
      { description: "New" },
      expect.objectContaining({
        action: "server.updated", actorId: "usr_1", targetId: "srv_1",
      }),
      actor,
      original,
    );
    mocks.managedUpdate.mockRejectedValueOnce({
      code: "23505", constraint_name: "servers_endpoint_idx",
    });
    await expect(serverService.updateServer("srv_1", { port: 22004 }, actor))
      .rejects.toMatchObject({ statusCode: 409, code: "SERVER_ENDPOINT_TAKEN" });
  });

  it("does not dispatch an event if the durable transaction fails", async () => {
    const publish = vi.spyOn(eventBus, "publish").mockResolvedValue();
    mocks.insert.mockRejectedValueOnce(new Error("database unavailable"));
    await expect(serverService.createServer(input, actor))
      .rejects.toThrow("database unavailable");
    expect(publish).not.toHaveBeenCalled();
  });
});
