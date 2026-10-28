import { describe, expect, it } from "vitest";
import { privateApiRequest } from "../apps/web/src/lib/private-api-request";

describe("private browser API request policy", () => {
  it("defaults to a same-origin non-cacheable GET", () => {
    const request = privateApiRequest();

    expect(request.method).toBe("GET");
    expect(request.cache).toBe("no-store");
    expect(request.credentials).toBe("same-origin");
    expect(request.headers).toBeUndefined();
    expect(request.body).toBeUndefined();
    expect(request.signal).toBeInstanceOf(AbortSignal);
  });

  it("encodes JSON mutations without weakening the privacy boundary", () => {
    const request = privateApiRequest({
      method: "PATCH",
      json: { name: "NEXUS" },
      timeoutMs: 15_000,
    });

    expect(request).toMatchObject({
      method: "PATCH",
      cache: "no-store",
      credentials: "same-origin",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ name: "NEXUS" }),
    });
    expect(request.signal).toBeInstanceOf(AbortSignal);
  });

  it("combines caller cancellation with the bounded timeout", () => {
    const controller = new AbortController();
    const request = privateApiRequest({
      signal: controller.signal,
      timeoutMs: 1_000,
    });

    expect(request.signal?.aborted).toBe(false);
    controller.abort();
    expect(request.signal?.aborted).toBe(true);
  });

  it.each([0, 249, 60_001, 1.5, Number.NaN])("rejects invalid timeout %s", (timeoutMs) => {
    expect(() => privateApiRequest({ timeoutMs })).toThrow("Invalid private API timeout");
  });
});
