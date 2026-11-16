import { describe, expect, it } from "vitest";
import { readBoundedMasterPayload } from "./mta-master-directory-service";

describe("bounded MTA master-list transport", () => {
  it("reassembles a chunked response without using unbounded arrayBuffer()", async () => {
    const response = new Response(
      new ReadableStream<Uint8Array>({
        start(controller) {
          controller.enqueue(new Uint8Array([0, 1]));
          controller.enqueue(new Uint8Array([2, 3]));
          controller.close();
        },
      }),
    );
    response.arrayBuffer = () => {
      throw new Error("Unbounded reader must not be used");
    };

    expect(new Uint8Array(await readBoundedMasterPayload(response, 4))).toEqual(
      new Uint8Array([0, 1, 2, 3]),
    );
  });

  it("streams 20,000 one-byte chunks without retaining an array of chunks", async () => {
    const total = 20_000;
    let next = 0;
    const response = new Response(
      new ReadableStream<Uint8Array>({
        pull(controller) {
          if (next === total) {
            controller.close();
            return;
          }
          controller.enqueue(new Uint8Array([next++ % 251]));
        },
      }),
    );
    const actual = new Uint8Array(await readBoundedMasterPayload(response, total));
    expect(actual.length).toBe(total);
    expect(actual[250]).toBe(250);
    expect(actual[251]).toBe(0);
    expect(actual[total - 1]).toBe((total - 1) % 251);
  });

  it("grows past 64 KiB and returns an exact-length buffer", async () => {
    const first = new Uint8Array(64 * 1024).fill(5);
    const second = new Uint8Array(37).fill(9);
    const response = new Response(
      new ReadableStream<Uint8Array>({
        start(controller) {
          controller.enqueue(first);
          controller.enqueue(second);
          controller.close();
        },
      }),
    );
    const actual = new Uint8Array(
      await readBoundedMasterPayload(response, first.length + second.length),
    );
    expect(actual.length).toBe(first.length + second.length);
    expect(actual[0]).toBe(5);
    expect(actual[first.length]).toBe(9);
    expect(actual.at(-1)).toBe(9);
  });

  it.each([0, -1, Number.NaN, Number.POSITIVE_INFINITY, 8 * 1024 * 1024 + 1])(
    "rejects an invalid stream byte limit %s",
    async (limit) => {
      const response = new Response(new Uint8Array([1]));
      await expect(readBoundedMasterPayload(response, limit)).rejects.toThrow(
        "Invalid MTA master-list payload size limit",
      );
    },
  );

  it("rejects an oversized advertised length and cancels its body", async () => {
    let cancelled = false;
    const response = new Response(
      new ReadableStream<Uint8Array>({
        cancel() {
          cancelled = true;
        },
      }),
      { headers: { "content-length": "17" } },
    );

    await expect(readBoundedMasterPayload(response, 16)).rejects.toThrow(
      "payload exceeds safety limit",
    );
    expect(cancelled).toBe(true);
  });

  it("stops reading and cancels when chunks exceed the limit without a length header", async () => {
    let cancelled = false;
    const response = new Response(
      new ReadableStream<Uint8Array>({
        start(controller) {
          controller.enqueue(new Uint8Array(8));
          controller.enqueue(new Uint8Array(9));
        },
        cancel() {
          cancelled = true;
        },
      }),
    );

    await expect(readBoundedMasterPayload(response, 16)).rejects.toThrow(
      "payload exceeds safety limit",
    );
    expect(cancelled).toBe(true);
  });

  it("rejects malformed advertised lengths before buffering a mirror response", async () => {
    for (const length of ["NaN", "-1", "1e6", "9007199254740992"]) {
      let cancelled = false;
      const body = new ReadableStream<Uint8Array>({
        cancel() {
          cancelled = true;
        },
      });
      await expect(
        readBoundedMasterPayload(new Response(body, { headers: { "content-length": length } }), 16),
      ).rejects.toThrow("payload exceeds safety limit");
      expect(cancelled).toBe(true);
    }
  });

  it("rejects oversized declared content without awaiting a stalled cancel", async () => {
    let cancelled = false;
    const response = new Response(
      new ReadableStream<Uint8Array>({
        cancel() {
          cancelled = true;
          return new Promise<void>(() => {});
        },
      }),
      { headers: { "content-length": "17" } },
    );

    await expect(readBoundedMasterPayload(response, 16)).rejects.toThrow(
      "payload exceeds safety limit",
    );
    expect(cancelled).toBe(true);
  });

  it("rejects oversized stream chunks without awaiting a stalled cancel", async () => {
    let cancelled = false;
    const body = new ReadableStream<Uint8Array>({
      start(controller) {
        controller.enqueue(new Uint8Array(8));
        controller.enqueue(new Uint8Array(9));
      },
      cancel() {
        cancelled = true;
        return new Promise<void>(() => {});
      },
    });

    await expect(readBoundedMasterPayload(new Response(body), 16)).rejects.toThrow(
      "payload exceeds safety limit",
    );
    expect(cancelled).toBe(true);
    expect(body.locked).toBe(false);
  });

  it("aborts a stalled mirror stream even if its cancellation never settles", async () => {
    const active = new AbortController();
    let notifyPull!: () => void;
    const pulling = new Promise<void>((resolve) => {
      notifyPull = resolve;
    });
    let cancelled = false;
    const body = new ReadableStream<Uint8Array>(
      {
        pull() {
          notifyPull();
        },
        cancel() {
          cancelled = true;
          return new Promise<void>(() => {});
        },
      },
      { highWaterMark: 0 },
    );

    const reading = readBoundedMasterPayload(new Response(body), 16, active.signal);
    await pulling;
    active.abort();
    await expect(reading).rejects.toMatchObject({ name: "AbortError" });
    expect(cancelled).toBe(true);
    expect(body.locked).toBe(false);
  });
});
