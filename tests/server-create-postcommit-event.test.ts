import type { User } from "@nexus/domain";
import { beforeEach, describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({
  insert: vi.fn(),
}));
vi.mock("@nexus/db", () => ({
  serverRepository: { createWithAudit: mocks.insert },
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

  it("does not dispatch an event if the durable transaction fails", async () => {
    const publish = vi.spyOn(eventBus, "publish").mockResolvedValue();
    mocks.insert.mockRejectedValueOnce(new Error("database unavailable"));
    await expect(serverService.createServer(input, actor))
      .rejects.toThrow("database unavailable");
    expect(publish).not.toHaveBeenCalled();
  });
});
