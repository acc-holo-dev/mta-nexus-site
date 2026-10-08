import { beforeEach, describe, expect, it, vi } from "vitest";
import { WebPushDispatcher } from "../packages/db/src/repositories/web-push-dispatcher";

const worker = {
  candidates: vi.fn(),
  claim: vi.fn(),
  prepare: vi.fn(),
  settle: vi.fn(),
  discardStaleSubscription: vi.fn(),
  discardUnavailable: vi.fn(),
};

describe("Web Push worker maintenance boundaries", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    worker.candidates.mockResolvedValue([]);
    worker.discardUnavailable.mockResolvedValue(3);
  });

  it("dispatcher always performs unavailable-job cleanup after a configured batch", async () => {
    const dispatcher = new WebPushDispatcher({
      worker,
      sender: vi.fn(async () => ({ statusCode: 201 })),
    });

    await expect(dispatcher.runBatch(20)).resolves.toMatchObject({
      cleaned: 3,
    });
    expect(worker.discardUnavailable).toHaveBeenCalledWith(20);
  });

  it("an aborted dispatcher performs no cleanup after shutdown boundary", async () => {
    const controller = new AbortController();
    controller.abort();

    const dispatcher = new WebPushDispatcher({
      worker,
      sender: vi.fn(async () => ({ statusCode: 201 })),
    });

    await expect(
      dispatcher.runBatch(20, controller.signal),
    ).resolves.toMatchObject({
      cleaned: 0,
    });
    expect(worker.candidates).not.toHaveBeenCalled();
    expect(worker.discardUnavailable).not.toHaveBeenCalled();
  });
});


it("shutdown after claim releases the lease without preparing or sending", async () => {
  const controller = new AbortController();
  const lease = {
    id: "wpo_11111111-1111-1111-1111-111111111111",
    token: "a".repeat(43),
    attempt: 1,
    expiresAt: new Date(Date.now() + 60_000),
  };
  worker.candidates.mockResolvedValue(["job-1"]);
  worker.claim.mockImplementation(async () => {
    controller.abort();
    return lease;
  });
  worker.settle.mockResolvedValue(true);
  const sender = vi.fn(async () => ({ statusCode: 201 }));
  const dispatcher = new WebPushDispatcher({ worker, sender });

  await expect(
    dispatcher.runBatch(20, controller.signal),
  ).resolves.toMatchObject({
    retried: 1,
    accepted: 0,
    cleaned: 0,
  });

  expect(worker.prepare).not.toHaveBeenCalled();
  expect(sender).not.toHaveBeenCalled();
  expect(worker.settle).toHaveBeenCalledWith(
    lease,
    "retry",
  );
  expect(worker.discardUnavailable).not.toHaveBeenCalled();
});

it("shutdown after prepare releases the lease before network delivery", async () => {
  const controller = new AbortController();
  const lease = {
    id: "wpo_22222222-2222-2222-2222-222222222222",
    token: "b".repeat(43),
    attempt: 1,
    expiresAt: new Date(Date.now() + 60_000),
  };
  worker.candidates.mockResolvedValue(["job-2"]);
  worker.claim.mockResolvedValue(lease);
  worker.prepare.mockImplementation(async () => {
    controller.abort();
    return {
      id: lease.id,
      notificationId: "not_1",
      subscriptionId: "wps_1",
      endpoint: "https://push.example.invalid/subscription",
      p256dh: "key",
      auth: "auth",
      payload: { title: "NEXUS", body: "Update" },
      sendBefore: new Date(Date.now() + 60_000),
      sendWithinMs: 60_000,
    };
  });
  worker.settle.mockResolvedValue(true);
  const sender = vi.fn(async () => ({ statusCode: 201 }));
  const dispatcher = new WebPushDispatcher({ worker, sender });

  await expect(
    dispatcher.runBatch(20, controller.signal),
  ).resolves.toMatchObject({
    retried: 1,
    accepted: 0,
    cleaned: 0,
  });

  expect(sender).not.toHaveBeenCalled();
  expect(worker.settle).toHaveBeenCalledWith(
    lease,
    "retry",
  );
  expect(worker.discardUnavailable).not.toHaveBeenCalled();
});
