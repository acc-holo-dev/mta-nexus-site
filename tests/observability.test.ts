import { describe, expect, it } from "vitest";

import {
  REQUEST_ID_HEADER,
  createRequestLogContext,
  createStructuredLogEntry,
  errorLogMetadata,
  jsonWithRequestId,
} from "../apps/web/src/lib/observability";

function fakeRequest(path = "/api/example") {
  return {
    method: "POST",
    nextUrl: new URL(`https://nexus.example${path}?token=must-not-appear`),
  };
}

describe("structured observability", () => {
  it("creates a server-generated request id and logs pathname without query data", () => {
    const context = createRequestLogContext(
      fakeRequest("/api/auth/password-reset") as never,
      () => "req-fixed",
    );

    expect(context).toEqual({
      requestId: "req-fixed",
      method: "POST",
      path: "/api/auth/password-reset",
    });
    expect(JSON.stringify(context)).not.toContain("must-not-appear");
  });

  it("adds the request id response header without dropping existing headers", async () => {
    const context = createRequestLogContext(fakeRequest() as never, () => "req-response");
    const response = jsonWithRequestId(
      context,
      { ok: true },
      {
        status: 202,
        headers: { "Cache-Control": "no-store" },
      },
    );

    expect(response.status).toBe(202);
    expect(response.headers.get(REQUEST_ID_HEADER)).toBe("req-response");
    expect(response.headers.get("Cache-Control")).toBe("no-store");
    expect(await response.json()).toEqual({ ok: true });
  });

  it("drops obvious sensitive fields and strips raw error messages/stacks", () => {
    const error = Object.assign(new Error("postgres://user:secret@example/db"), {
      code: "ECONNRESET",
    });
    const context = createRequestLogContext(fakeRequest() as never, () => "req-log");
    const entry = createStructuredLogEntry({
      level: "error",
      event: "auth.login.failed",
      context,
      status: 500,
      error,
      fields: {
        phase: "authenticate",
        email: "person@example.com",
        password: "secret",
        token: "abc",
        clientIp: "203.0.113.2",
        requestId: "attacker-controlled",
        event: "overridden.event",
      },
    });

    expect(entry).toMatchObject({
      level: "error",
      event: "auth.login.failed",
      requestId: "req-log",
      method: "POST",
      path: "/api/example",
      status: 500,
      phase: "authenticate",
      error: { name: "Error", code: "ECONNRESET" },
    });
    const serialized = JSON.stringify(entry);
    expect(serialized).not.toContain("person@example.com");
    expect(serialized).not.toContain("postgres://");
    expect(serialized).not.toContain("203.0.113.2");
    expect(serialized).not.toContain('"token"');
    expect(serialized).not.toContain('"password"');
    expect(entry.requestId).toBe("req-log");
    expect(entry.event).toBe("auth.login.failed");
    expect(serialized).not.toContain("attacker-controlled");
    expect(serialized).not.toContain("overridden.event");
  });

  it("does not echo arbitrary thrown values", () => {
    expect(errorLogMetadata("Bearer very-secret")).toEqual({
      name: "UnknownError",
    });
  });
});
