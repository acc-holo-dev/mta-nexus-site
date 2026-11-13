import { createHash } from "node:crypto";
import type { ResourceDeliveryFinish } from "@nexus/domain";
import { toDownloadWebStream } from "./download-web-stream";

/** Counts only chunks enqueued to the response. No unbounded archive buffer. */
export function resourceDeliveryStream(input: {
  source: NodeJS.ReadableStream;
  expectedBytes: number;
  sha256Hash: string;
  signal: AbortSignal;
  finish: (result: ResourceDeliveryFinish) => Promise<void>;
  recordFailure: (error: unknown) => void;
}): ReadableStream<Uint8Array> {
  const reader = toDownloadWebStream(input.source).getReader(),
    hash = createHash("sha256");
  let bytesSent = 0,
    terminal = false;
  let controller: ReadableStreamDefaultController<Uint8Array>;
  async function complete(result: ResourceDeliveryFinish) {
    if (terminal) return;
    terminal = true;
    input.signal.removeEventListener("abort", abort);
    try {
      await input.finish(result);
    } catch (error) {
      // Recording/logging failure leaves started evidence; never block EOF on logging.
      try {
        input.recordFailure(error);
      } catch {
        /* The stream still needs closing. */
      }
    }
  }
  async function cancel() {
    // Mark terminal before cancelling the underlying read; its error cannot win.
    const finishing = complete({ status: "cancelled", bytesSent, errorCode: null });
    await reader.cancel().catch(() => undefined);
    await finishing;
  }
  function abort() {
    if (terminal) return;
    controller.error(new DOMException("Download cancelled", "AbortError"));
    void cancel();
  }
  async function fail(
    errorCode: "storage_error" | "size_mismatch" | "hash_mismatch",
    error?: unknown,
  ) {
    await complete({ status: "failed", bytesSent, errorCode });
    await reader.cancel().catch(() => undefined);
    controller.error(
      error instanceof Error ? error : new Error("Resource transfer integrity check failed"),
    );
  }
  return new ReadableStream<Uint8Array>(
    {
      start(value) {
        controller = value;
        input.signal.addEventListener("abort", abort, { once: true });
        if (input.signal.aborted) abort();
      },
      async pull() {
        try {
          const chunk = await reader.read();
          if (terminal) return;
          if (input.signal.aborted) {
            abort();
            return;
          }
          if (chunk.done) {
            if (bytesSent !== input.expectedBytes) {
              await fail("size_mismatch");
              return;
            }
            if (hash.digest("hex") !== input.sha256Hash) {
              await fail("hash_mismatch");
              return;
            }
            await complete({ status: "served", bytesSent, errorCode: null });
            controller.close();
            return;
          }
          if (!(chunk.value instanceof Uint8Array)) {
            await fail("storage_error");
            return;
          }
          if (chunk.value.byteLength > input.expectedBytes - bytesSent) {
            await fail("size_mismatch");
            return;
          }
          hash.update(chunk.value);
          controller.enqueue(chunk.value);
          bytesSent += chunk.value.byteLength;
        } catch (error) {
          if (!terminal) await fail("storage_error", error);
        }
      },
      cancel,
    },
    { highWaterMark: 0, size: (chunk) => chunk.byteLength },
  );
}
