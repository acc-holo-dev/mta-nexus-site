import { describe, expect, it } from "vitest";
import {
  parseBoundedJson,
  SUPPORT_JSON_MAX_BYTES,
} from "../apps/web/src/lib/bounded-json";

const url = "https://nexus.test/api/support";
const encode = (text: string) => new TextEncoder().encode(text);

function streamed(parts: Uint8Array[], headers?: Record<string, string>): Request {
  const body = new ReadableStream<Uint8Array>({
    start(controller) {
      for (const part of parts) controller.enqueue(part);
      controller.close();
    },
  });
  return new Request(url, {
    method: "POST",
    body,
    headers,
    duplex: "half",
  } as RequestInit & { duplex: "half" });
}

describe("bounded JSON body parsing", () => {
  it("parses small bodies and protects the exact byte boundary", async () => {
    const body = '"' + "a".repeat(30) + '"';
    expect(await parseBoundedJson(new Request(url, { method: "POST", body }), 32)).toEqual({
      ok: true,
      value: "a".repeat(30),
    });
    expect(await parseBoundedJson(new Request(url, { method: "POST", body: body + " " }), 32)).toEqual({
      ok: false,
      reason: "too_large",
    });
  });

  it("accepts UTF-8 sequences split between streamed chunks", async () => {
    const data = encode(JSON.stringify({ message: "Привет 🌍" }));
    const result = await parseBoundedJson(streamed([
      data.slice(0, 13),
      data.slice(13, 27),
      data.slice(27),
    ]));
    expect(result).toEqual({ ok: true, value: { message: "Привет 🌍" } });
  });

  it("counts real streamed bytes even if Content-Length claims less", async () => {
    const result = await parseBoundedJson(streamed([
      new Uint8Array(12),
      new Uint8Array(30),
    ], { "content-length": "1" }), 32);
    expect(result).toEqual({ ok: false, reason: "too_large" });
  });

  it("fails large declared bodies before reading and rejects malformed inputs", async () => {
    expect(await parseBoundedJson(new Request(url, {
      method: "POST",
      headers: { "content-length": "33" },
      body: "{}",
    }), 32)).toEqual({ ok: false, reason: "too_large" });
    expect(await parseBoundedJson(new Request(url, {
      method: "POST",
      body: "{",
    }))).toEqual({ ok: false, reason: "invalid" });
    expect(await parseBoundedJson(new Request(url, {
      method: "POST",
      body: "{}",
      headers: { "content-length": "invalid" },
    }))).toEqual({ ok: false, reason: "invalid" });
    expect(await parseBoundedJson(new Request(url, { method: "POST" }))).toEqual({
      ok: false,
      reason: "invalid",
    });
  });

  it("rejects malformed UTF-8 before JSON parsing", async () => {
    expect(await parseBoundedJson(streamed([Uint8Array.from([0x22, 0xff, 0x22])]))).toEqual({
      ok: false,
      reason: "invalid",
    });
  });

  it("leaves room for 4,000 four-byte characters plus support metadata", async () => {
    const body = JSON.stringify({
      message: "🌍".repeat(4_000),
      expectedStatus: "open",
    });
    expect(encode(body).byteLength).toBeLessThan(SUPPORT_JSON_MAX_BYTES);
    expect((await parseBoundedJson(new Request(url, { method: "POST", body }))).ok).toBe(true);
  });

  it("rejects invalid limits rather than silently accepting unbounded reads", async () => {
    await expect(parseBoundedJson(new Request(url, { method: "POST", body: "{}" }), 0))
      .rejects.toThrow(RangeError);
    await expect(parseBoundedJson(new Request(url, { method: "POST", body: "{}" }), Number.NaN))
      .rejects.toThrow(RangeError);
  });
});
