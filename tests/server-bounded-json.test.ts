import { describe, expect, it } from "vitest";
import {
  readBoundedJson,
  requireServerJsonContentType,
  SERVER_MUTATION_MAX_BODY_BYTES,
} from "../apps/web/src/lib/bounded-json";

const url = "https://nexus.test/api/servers";
const request = (body: BodyInit, headers: HeadersInit = {}) =>
  new Request(url, { method: "POST", headers, body });

describe("bounded JSON reader for server mutations", () => {
  it.each([
    "application/json",
    "Application/JSON; charset=UTF-8",
    " application/json ; charset=utf-8",
  ])("accepts JSON media type %s", (type) => {
    expect(() =>
      requireServerJsonContentType(
        new Request(url, {
          headers: { "Content-Type": type },
        }),
      ),
    ).not.toThrow();
  });

  it.each([
    null,
    "text/plain",
    "application/x-www-form-urlencoded",
    "multipart/form-data; boundary=x",
    "application/jsonp",
    "application/ld+json",
    `application/json; charset=${"x".repeat(257)}`,
  ])("rejects non-JSON browser mutation media type %s", (type) => {
    const headers: HeadersInit = type === null ? {} : { "Content-Type": type };
    expect(() => requireServerJsonContentType(new Request(url, { headers }))).toThrowError(
      expect.objectContaining({
        statusCode: 415,
        code: "UNSUPPORTED_MEDIA_TYPE",
      }),
    );
  });

  it("accepts small objects and handles missing or malformed JSON", async () => {
    expect(await readBoundedJson(request('{"name":"Nexus"}'))).toEqual({ name: "Nexus" });
    expect(await readBoundedJson(new Request(url, { method: "POST" }))).toBeNull();
    expect(await readBoundedJson(request('{"name":'))).toBeNull();
    expect(await readBoundedJson(request(new Uint8Array([0xff])))).toBeNull();
  });

  it("enforces the actual UTF-8 byte size, not JavaScript string length", async () => {
    const unicode = JSON.stringify({ text: "Ж".repeat(100) });
    expect(unicode.length).toBeLessThan(256);
    expect(Buffer.byteLength(unicode)).toBeGreaterThan(180);
    await expect(readBoundedJson(request(unicode), 180)).rejects.toMatchObject({
      statusCode: 413,
      code: "REQUEST_BODY_TOO_LARGE",
    });
  });

  it("accepts an exactly bounded body and rejects the next byte", async () => {
    const exact = '{"a":"12345"}';
    expect(await readBoundedJson(request(exact), Buffer.byteLength(exact))).toEqual({ a: "12345" });
    await expect(
      readBoundedJson(request(exact), Buffer.byteLength(exact) - 1),
    ).rejects.toMatchObject({ statusCode: 413, code: "REQUEST_BODY_TOO_LARGE" });
  });

  it("does not trust an understated Content-Length", async () => {
    await expect(
      readBoundedJson(request('{"a":"oversize"}', { "Content-Length": "2" }), 10),
    ).rejects.toMatchObject({ statusCode: 413, code: "REQUEST_BODY_TOO_LARGE" });
  });

  it.each(["-1", "1.5", "1000000000000000000000", "unknown"])(
    "rejects invalid Content-Length %s",
    async (length) => {
      await expect(
        readBoundedJson(request("{}", { "Content-Length": length })),
      ).rejects.toMatchObject({ statusCode: 400, code: "INVALID_BODY_LENGTH" });
    },
  );

  it("rejects an oversized declared length without awaiting stalled cancel", async () => {
    let cancelled = false;
    const body = new ReadableStream<Uint8Array>(
      {
        cancel() {
          cancelled = true;
          return new Promise<void>(() => {});
        },
      },
      { highWaterMark: 0 },
    );
    const pending = new Request(url, {
      method: "POST",
      headers: { "Content-Length": "200" },
      body,
      duplex: "half",
    } as RequestInit);
    await expect(readBoundedJson(pending, 100)).rejects.toMatchObject({
      statusCode: 413,
      code: "REQUEST_BODY_TOO_LARGE",
    });
    expect(cancelled).toBe(true);
  });

  it("cancels an oversized streaming response even if cancel never settles", async () => {
    let cancelled = false;
    const body = new ReadableStream<Uint8Array>({
      start(controller) {
        controller.enqueue(new Uint8Array(9));
        controller.enqueue(new Uint8Array(9));
      },
      cancel() {
        cancelled = true;
        return new Promise<void>(() => {});
      },
    });
    const pending = new Request(url, { method: "POST", body, duplex: "half" } as RequestInit);
    await expect(readBoundedJson(pending, 16)).rejects.toMatchObject({
      statusCode: 413,
      code: "REQUEST_BODY_TOO_LARGE",
    });
    expect(cancelled).toBe(true);
    expect(body.locked).toBe(false);
  });

  it("rejects a stalled client body with 408 even when cancellation never settles", async () => {
    let cancelled = false;
    const body = new ReadableStream<Uint8Array>(
      {
        pull() {
          return new Promise<void>(() => {});
        },
        cancel() {
          cancelled = true;
          return new Promise<void>(() => {});
        },
      },
      { highWaterMark: 0 },
    );
    const request = new Request(url, {
      method: "POST",
      body,
      duplex: "half",
    } as RequestInit);

    // Keep an event-loop handle for the weak AbortSignal.timeout timer in Node.
    const keepAlive = setTimeout(() => {}, 250);
    try {
      await expect(readBoundedJson(request, 16, 40)).rejects.toMatchObject({
        statusCode: 408,
        code: "REQUEST_BODY_TIMEOUT",
      });
      expect(cancelled).toBe(true);
      expect(body.locked).toBe(false);
    } finally {
      clearTimeout(keepAlive);
    }
  });

  it("permits fast well-formed bodies with the same timeout contract", async () => {
    await expect(readBoundedJson(request('{"ok":true}'), 1024, 200)).resolves.toEqual({ ok: true });
    await expect(readBoundedJson(request("{}"), 1024, 0)).rejects.toThrow(
      "Invalid JSON request timeout",
    );
  });

  it("fails on a pre-aborted request instead of attempting to parse", async () => {
    const controller = new AbortController();
    controller.abort();
    const aborted = new Request(url, {
      method: "POST",
      body: '{"a":1}',
      signal: controller.signal,
    });
    await expect(readBoundedJson(aborted)).rejects.toMatchObject({ name: "AbortError" });
  });

  it("rejects invalid configured limits and preserves the production ceiling", async () => {
    expect(SERVER_MUTATION_MAX_BODY_BYTES).toBe(32768);
    await expect(readBoundedJson(request("{}"), 0)).rejects.toThrow(
      "Invalid JSON request byte limit",
    );
    await expect(readBoundedJson(request("{}"), Number.NaN)).rejects.toThrow(
      "Invalid JSON request byte limit",
    );
  });
});
