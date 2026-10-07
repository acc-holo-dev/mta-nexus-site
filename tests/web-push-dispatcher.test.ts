import { describe, expect, it, vi } from "vitest";
import {
  WebPushDispatcher,
  type WebPushDispatchSummary,
} from "../packages/db/src/repositories/web-push-dispatcher";
import type {
  PreparedWebPushJob,
  WebPushLease,
} from "../packages/db/src/repositories/web-push-worker";

function lease(id: string): WebPushLease {
  return {
    id,
    token: "A".repeat(43),
    attempt: 1,
    expiresAt: new Date(Date.now() + 60_000),
  };
}

function prepared(
  id: string,
  subscriptionId = `wps_${id}`,
): PreparedWebPushJob {
  return {
    id,
    notificationId: `not_${id}`,
    subscriptionId,
    endpoint: `https://push.example.net/${id}`,
    p256dh: "key",
    auth: "auth",
    payload: {
      title: "NEXUS",
      body: "Update",
      url: "/notifications",
      tag: `not_${id}`,
    },
    sendBefore: new Date(Date.now() + 60_000),
  };
}

function worker(ids: string[]) {
  return {
    candidates: vi.fn(async () => ids),
    claim: vi.fn(async (id: string) => lease(id)),
    prepare: vi.fn(async (value: WebPushLease) =>
      prepared(value.id),
    ),
    settle: vi.fn(async () => true),
    discardStaleSubscription: vi.fn(async () => true),
    discardUnavailable: vi.fn(async () => 0),
  };
}

describe("Web Push dispatcher", () => {
  it("maps provider status classes to durable outcomes", async () => {
    const w = worker([
      "wpo_00000000-0000-0000-0000-000000000001",
      "wpo_00000000-0000-0000-0000-000000000002",
      "wpo_00000000-0000-0000-0000-000000000003",
      "wpo_00000000-0000-0000-0000-000000000004",
    ]);
    const sender = vi
      .fn()
      .mockResolvedValueOnce({ statusCode: 201 })
      .mockResolvedValueOnce({ statusCode: 503 })
      .mockResolvedValueOnce({ statusCode: 400 })
      .mockResolvedValueOnce({ statusCode: 410 });

    const result = await new WebPushDispatcher({
      worker: w,
      sender,
    }).runBatch(10);

    expect(result).toEqual<WebPushDispatchSummary>({
      accepted: 1,
      retried: 1,
      discarded: 1,
      stale: 1,
      skipped: 0,
      unsettled: 0,
      cleaned: 0,
    });
    expect(w.settle).toHaveBeenNthCalledWith(
      1,
      expect.anything(),
      "accepted",
      201,
    );
    expect(w.settle).toHaveBeenNthCalledWith(
      2,
      expect.anything(),
      "retry",
      503,
    );
    expect(w.settle).toHaveBeenNthCalledWith(
      3,
      expect.anything(),
      "discard",
      400,
    );
    expect(w.discardStaleSubscription).toHaveBeenCalledOnce();
  });

  it("retries transport exceptions without discarding the subscription", async () => {
    const id =
      "wpo_00000000-0000-0000-0000-000000000005";
    const w = worker([id]);
    const sender = vi.fn(async () => {
      throw new Error("network down");
    });

    await expect(
      new WebPushDispatcher({
        worker: w,
        sender,
      }).runBatch(),
    ).resolves.toMatchObject({
      retried: 1,
      stale: 0,
      discarded: 0,
    });
    expect(w.settle).toHaveBeenCalledWith(
      expect.objectContaining({ id }),
      "retry",
    );
    expect(
      w.discardStaleSubscription,
    ).not.toHaveBeenCalled();
  });

  it("never sends a job whose lease window is already too close to expiry", async () => {
    const id =
      "wpo_00000000-0000-0000-0000-000000000008";
    const w = worker([id]);
    w.prepare.mockResolvedValueOnce({
      ...prepared(id),
      sendBefore: new Date(Date.now() + 500),
    });
    const sender = vi.fn(async () => ({ statusCode: 201 }));

    await expect(
      new WebPushDispatcher({
        worker: w,
        sender,
      }).runBatch(),
    ).resolves.toMatchObject({
      accepted: 0,
      retried: 1,
      unsettled: 0,
    });

    expect(sender).not.toHaveBeenCalled();
    expect(w.settle).toHaveBeenCalledWith(
      expect.objectContaining({ id }),
      "retry",
    );
  });

  it("stops claiming new jobs after shutdown is requested", async () => {
    const controller = new AbortController();
    const ids = [
      "wpo_00000000-0000-0000-0000-000000000006",
      "wpo_00000000-0000-0000-0000-000000000007",
    ];
    const w = worker(ids);
    const sender = vi.fn(async () => {
      controller.abort();
      return { statusCode: 201 };
    });

    const result = await new WebPushDispatcher({
      worker: w,
      sender,
    }).runBatch(20, controller.signal);

    expect(result.accepted).toBe(1);
    expect(w.claim).toHaveBeenCalledTimes(1);
  });
});
