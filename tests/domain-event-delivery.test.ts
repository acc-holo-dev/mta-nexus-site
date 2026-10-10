import { afterEach, describe, expect, it, vi } from "vitest";
import { InMemoryEventBus, type NexusDomainEvent } from "../packages/domain/src/events";

const event = {
  id: "evt_test",
  type: "build.submitted_for_review",
  version: 1,
  timestamp: "2026-10-10T00:00:00.000Z",
  actor: { id: "usr_test", type: "user" },
  aggregateId: "bld_test",
  aggregateType: "build",
  payload: { buildId: "bld_test", productId: "prd_test", version: "1.0.0", hash: "a".repeat(64) },
} as const satisfies NexusDomainEvent;

afterEach(() => vi.restoreAllMocks());

describe("best-effort domain event delivery", () => {
  it("continues other handlers when a subscriber throws synchronously", async () => {
    const bus = new InMemoryEventBus();
    const log = vi.spyOn(console, "error").mockImplementation(() => undefined);
    const received = vi.fn(async () => undefined);
    bus.subscribe("build.submitted_for_review", () => { throw new Error("private failure"); });
    bus.subscribe("build.submitted_for_review", received);
    await expect(bus.publish(event)).resolves.toBeUndefined();
    expect(received).toHaveBeenCalledOnce();
    expect(log).toHaveBeenCalledWith("Nexus domain event handlers failed", {
      eventType: event.type, eventId: event.id, failedHandlers: 1,
    });
  });

  it("settles async failures without leaking exception details", async () => {
    const bus = new InMemoryEventBus();
    const log = vi.spyOn(console, "error").mockImplementation(() => undefined);
    bus.subscribe("build.submitted_for_review", async () => { throw new Error("private async message"); });
    await expect(bus.publish(event)).resolves.toBeUndefined();
    expect(JSON.stringify(log.mock.calls)).not.toContain("private async message");
  });

  it("does not log successful dispatches", async () => {
    const bus = new InMemoryEventBus();
    const log = vi.spyOn(console, "error").mockImplementation(() => undefined);
    bus.subscribe("build.submitted_for_review", async () => undefined);
    await expect(bus.publish(event)).resolves.toBeUndefined();
    expect(log).not.toHaveBeenCalled();
  });
});
