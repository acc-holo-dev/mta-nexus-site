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
