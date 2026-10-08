import type {
  PreparedWebPushJob,
  WebPushLease,
} from "./web-push-worker";
import { webPushWorkerRepository } from "./web-push-worker";
import {
  WebPushPermanentPayloadError,
  WebPushPermanentSubscriptionError,
} from "../web-push-runtime";
import type {
  WebPushSendResult,
  WebPushSender,
} from "../web-push-runtime";

type Worker = Readonly<{
  candidates(limit?: number): Promise<string[]>;
  claim(id: string): Promise<WebPushLease | null>;
  prepare(
    lease: WebPushLease,
  ): Promise<PreparedWebPushJob | null>;
  settle(
    lease: WebPushLease,
    outcome: "accepted" | "retry" | "discard",
    statusCode?: number,
    retryAfterMs?: number,
  ): Promise<boolean>;
  discardStaleSubscription(
    lease: WebPushLease,
    subscriptionId: string,
  ): Promise<boolean>;
  discardUnavailable(limit?: number): Promise<number>;
}>;

type Sender = WebPushSender;

const SEND_SETTLE_MARGIN_MS = 1_000;

export type WebPushDispatchSummary = Readonly<{
  accepted: number;
  retried: number;
  discarded: number;
  stale: number;
  skipped: number;
  unsettled: number;
  cleaned: number;
}>;

function outcomeForStatus(
  statusCode: number,
): "accepted" | "retry" | "discard" | "stale" {
  if (statusCode >= 200 && statusCode < 300) {
    return "accepted";
  }
  if (statusCode === 404 || statusCode === 410) {
    return "stale";
  }
  if (
    statusCode === 408 ||
    statusCode === 425 ||
    statusCode === 429 ||
    statusCode >= 500
  ) {
    return "retry";
  }
  return "discard";
}

export class WebPushDispatcher {
  #worker: Worker;
  #sender: Sender;

  constructor(input: {
    worker?: Worker;
    sender: WebPushSender;
  }) {
    if (!input?.sender) {
      throw new Error("Invalid Web Push dispatcher");
    }
    this.#worker = input.worker ?? webPushWorkerRepository;
    this.#sender = input.sender;
  }

  async runBatch(
    limit = 20,
    signal?: AbortSignal,
    onProgress?: () => void,
  ): Promise<WebPushDispatchSummary> {
    if (
      !Number.isSafeInteger(limit) ||
      limit < 1 ||
      limit > 100
    ) {
      throw new RangeError("Invalid Web Push dispatch limit");
    }

    const summary = {
      accepted: 0,
      retried: 0,
      discarded: 0,
      stale: 0,
      skipped: 0,
      unsettled: 0,
      cleaned: 0,
    };

    if (signal?.aborted) return Object.freeze(summary);
    const ids = await this.#worker.candidates(limit);
    onProgress?.();

    for (const id of ids) {
      if (signal?.aborted) break;
      const lease = await this.#worker.claim(id);
      if (!lease) {
        summary.skipped += 1;
        onProgress?.();
        continue;
      }

      if (signal?.aborted) {
        const settled = await this.#worker.settle(
          lease,
          "retry",
        );
        if (settled) summary.retried += 1;
        else summary.unsettled += 1;
        onProgress?.();
        break;
      }

      const prepared = await this.#worker.prepare(lease);
      if (!prepared) {
        summary.skipped += 1;
        onProgress?.();
        continue;
      }

      if (signal?.aborted) {
        const settled = await this.#worker.settle(
          lease,
          "retry",
        );
        if (settled) summary.retried += 1;
        else summary.unsettled += 1;
        onProgress?.();
        break;
      }

      const sendWindowMs =
        prepared.sendWithinMs -
        SEND_SETTLE_MARGIN_MS;
      if (sendWindowMs <= 0) {
        const settled = await this.#worker.settle(
          lease,
          "retry",
        );
        if (settled) summary.retried += 1;
        else summary.unsettled += 1;
        onProgress?.();
        continue;
      }

      const deadlineSignal = AbortSignal.timeout(sendWindowMs);
      const sendSignal = signal
        ? AbortSignal.any([signal, deadlineSignal])
        : deadlineSignal;

      let result: WebPushSendResult;
      try {
        result = await this.#sender(
          {
            endpoint: prepared.endpoint,
            p256dh: prepared.p256dh,
            auth: prepared.auth,
          },
          prepared.payload,
          { signal: sendSignal },
        );
      } catch (error) {
        if (error instanceof WebPushPermanentSubscriptionError) {
          const removed =
            await this.#worker.discardStaleSubscription(
              lease,
              prepared.subscriptionId,
            );
          if (removed) summary.stale += 1;
          else summary.unsettled += 1;
          onProgress?.();
          continue;
        }

        if (error instanceof WebPushPermanentPayloadError) {
          const settled = await this.#worker.settle(
            lease,
            "discard",
          );
          if (settled) summary.discarded += 1;
          else summary.unsettled += 1;
          onProgress?.();
          continue;
        }

        const settled = await this.#worker.settle(
          lease,
          "retry",
        );
        if (settled) summary.retried += 1;
        else summary.unsettled += 1;
        onProgress?.();
        continue;
      }

      const outcome = outcomeForStatus(result.statusCode);
      if (outcome === "stale") {
        const removed =
          await this.#worker.discardStaleSubscription(
            lease,
            prepared.subscriptionId,
          );
        if (removed) summary.stale += 1;
        else summary.unsettled += 1;
        onProgress?.();
        continue;
      }

      const settled =
        outcome === "retry"
          ? await this.#worker.settle(
              lease,
              outcome,
              result.statusCode,
              result.retryAfterMs,
            )
          : await this.#worker.settle(
              lease,
              outcome,
              result.statusCode,
            );
      if (!settled) {
        summary.unsettled += 1;
      } else if (outcome === "accepted") {
        summary.accepted += 1;
      } else if (outcome === "retry") {
        summary.retried += 1;
      } else {
        summary.discarded += 1;
      }
      onProgress?.();
    }

    if (!signal?.aborted) {
      summary.cleaned =
        await this.#worker.discardUnavailable(
          Math.min(limit, 100),
        );
      onProgress?.();
    }

    return Object.freeze(summary);
  }
}
