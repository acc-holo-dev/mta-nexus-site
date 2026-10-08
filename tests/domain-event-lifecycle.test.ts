import { describe, expect, it } from "vitest";
import {
  InMemoryEventBus,
  type BuildSubmittedForReviewEvent,
  type ServerCreatedEvent,
} from "@nexus/domain";

describe("domain event lifecycle contracts", () => {
  it("dispatches a submitted-for-review event as its own event type", async () => {
    const bus = new InMemoryEventBus();
    const received: string[] = [];
    bus.subscribe("build.submitted_for_review", async (event) => {
      received.push(event.type);
      expect(event.payload.buildId).toBe("bld_1");
    });
    bus.subscribe("build.released", async () => {
      received.push("build.released");
    });

    const event: BuildSubmittedForReviewEvent = {
      id: "evt_1",
      type: "build.submitted_for_review",
      version: 1,
      timestamp: "2026-10-08T00:00:00.000Z",
      actor: { id: "usr_1", type: "user" },
      aggregateId: "bld_1",
      aggregateType: "build",
      payload: {
        buildId: "bld_1",
        productId: "prd_1",
        version: "1.0.0",
        hash: "a".repeat(64),
      },
    };

    await bus.publish(event);
    expect(received).toEqual(["build.submitted_for_review"]);
  });

  it("supports organization-owned server.created events without a personal owner", async () => {
    const event = {
      id: "evt_server",
      type: "server.created",
      version: 1,
      timestamp: "2026-10-08T00:00:00.000Z",
      actor: { id: "org_1", type: "organization" },
      aggregateId: "srv_1",
      aggregateType: "server",
      payload: {
        serverId: "srv_1",
        name: "Organization Server",
        organizationId: "org_1",
        ip: "203.0.113.10",
        port: 22003,
      },
    } satisfies ServerCreatedEvent;

    expect(event.payload.organizationId).toBe("org_1");
    expect("ownerId" in event.payload).toBe(false);
  });
});
