import { NextRequest } from "next/server";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import {
  browserMutationHeaders,
  stubBrowserMutationOrigin,
} from "../../../../tests/helpers/browser-mutation-headers";

const mocks = vi.hoisted(() => ({
  session: vi.fn(),
  can: vi.fn(),
  rate: vi.fn(),
  listPage: vi.fn(),
  findProduct: vi.fn(),
  createWithAudit: vi.fn(),
}));

vi.mock("../../../lib/services/auth-service", () => ({
  authService: { getSession: mocks.session },
}));
vi.mock("@nexus/security", () => ({
  can: mocks.can,
  consumeRateLimit: mocks.rate,
  generateId: (prefix: string) => `${prefix}_test`,
}));
vi.mock("@nexus/db", () => ({
  reportRepository: {
    listPage: mocks.listPage,
    createWithAudit: mocks.createWithAudit,
  },
  productRepository: { findById: mocks.findProduct },
  serverRepository: { findById: vi.fn() },
  contentRepository: { findById: vi.fn(), findCommentById: vi.fn() },
  userRepository: { findById: vi.fn() },
}));

import { GET, POST } from "./route";

const privateResponse = (response: Response) => {
  expect(response.headers.get("cache-control")).toBe("private, no-store");
  expect(response.headers.get("vary")).toBe("Cookie");
  expect(response.headers.get("x-request-id")).toBeTruthy();
};

beforeEach(() => {
  stubBrowserMutationOrigin();
  vi.clearAllMocks();
  mocks.session.mockResolvedValue(null);
  mocks.can.mockReturnValue(false);
  mocks.rate.mockResolvedValue({ success: true });
  mocks.listPage.mockResolvedValue({ reports: [], hasMore: false });
  mocks.findProduct.mockResolvedValue({ id: "prd_test" });
  mocks.createWithAudit.mockResolvedValue({
    report: { id: "rpt_test", status: "open" },
    created: true,
  });
});

afterEach(() => {
  vi.unstubAllEnvs();
});

describe("report privacy and durable success", () => {
  it("treats malformed JSON as invalid without creating a report", async () => {
    mocks.session.mockResolvedValue({ id: "member_1" });
    const response = await POST(
      new NextRequest("https://nexus.test/api/reports", {
        method: "POST",
        headers: {
          ...browserMutationHeaders(),
          cookie: "nexus_session=session",
          "content-type": "application/json",
        },
        body: "{",
      }),
    );
    expect(response.status).toBe(400);
    privateResponse(response);
    expect(mocks.createWithAudit).not.toHaveBeenCalled();
  });

  it("rejects unsupported media and oversized bodies before creating a report", async () => {
    mocks.session.mockResolvedValue({ id: "member_1" });
    const request = (type: string, body: string) =>
      new NextRequest("https://nexus.test/api/reports", {
        method: "POST",
        headers: {
          ...browserMutationHeaders(),
          cookie: "nexus_session=session",
          "content-type": type,
        },
        body,
      });
    const unsupported = await POST(request("text/plain", "{}"));
    expect(unsupported.status).toBe(415);
    privateResponse(unsupported);
    expect(mocks.rate).not.toHaveBeenCalled();
    const oversized = await POST(
      request("application/json", JSON.stringify({ reason: "x".repeat(32768) })),
    );
    expect(oversized.status).toBe(413);
    privateResponse(oversized);
    expect(mocks.createWithAudit).not.toHaveBeenCalled();
  });

  it("keeps both denied and authorized moderation reads private", async () => {
    const request = new NextRequest("https://nexus.test/api/reports");
    const denied = await GET(request);
    expect(denied.status).toBe(403);
    privateResponse(denied);

    mocks.session.mockResolvedValue({ id: "mod_1" });
    mocks.can.mockReturnValue(true);
    mocks.listPage.mockResolvedValue({ reports: [{ id: "rpt_test" }], hasMore: true });
    const allowed = await GET(request);
    expect(allowed.status).toBe(200);
    privateResponse(allowed);
    expect(await allowed.json()).toEqual({
      reports: [{ id: "rpt_test" }],
      hasMore: true,
      page: 1,
      view: "pending",
    });
    expect(mocks.listPage).toHaveBeenCalledWith("pending", 1);
  });

  it("rejects invalid pages and scopes authorized history reads", async () => {
    mocks.session.mockResolvedValue({ id: "mod_1" });
    mocks.can.mockReturnValue(true);
    const invalid = await GET(new NextRequest("https://nexus.test/api/reports?page=0"));
    expect(invalid.status).toBe(400);
    privateResponse(invalid);
    expect(mocks.listPage).not.toHaveBeenCalled();
    const history = await GET(
      new NextRequest("https://nexus.test/api/reports?view=history&page=2"),
    );
    expect(history.status).toBe(200);
    expect(mocks.listPage).toHaveBeenCalledWith("history", 2);
  });

  it("confirms a report after the durable report and audit command succeeds", async () => {
    mocks.session.mockResolvedValue({ id: "member_1" });
    const response = await POST(
      new NextRequest("https://nexus.test/api/reports", {
        method: "POST",
        headers: {
          ...browserMutationHeaders(),
          cookie: "nexus_session=session",
          "content-type": "application/json",
        },
        body: JSON.stringify({
          targetType: "product",
          targetId: "prd_test",
          type: "scam",
          reason: "The resource is misrepresented",
        }),
      }),
    );

    expect(response.status).toBe(201);
    privateResponse(response);
    expect((await response.json()).success).toBe(true);
    expect(mocks.createWithAudit).toHaveBeenCalledWith(
      expect.objectContaining({ reporterId: "member_1", targetId: "prd_test" }),
      expect.objectContaining({ actorId: "member_1", action: "report.created" }),
      "session",
    );
  });

  it("returns failure when the report transaction fails", async () => {
    mocks.session.mockResolvedValue({ id: "member_1" });
    mocks.createWithAudit.mockRejectedValue(new Error("DB transaction aborted"));
    const response = await POST(
      new NextRequest("https://nexus.test/api/reports", {
        method: "POST",
        headers: {
          ...browserMutationHeaders(),
          cookie: "nexus_session=session",
          "content-type": "application/json",
        },
        body: JSON.stringify({
          targetType: "product",
          targetId: "prd_test",
          type: "scam",
          reason: "This is a fraudulent resource",
        }),
      }),
    );
    expect(response.status).toBe(500);
    privateResponse(response);
  });

  it("returns a private retryable conflict for a rolled-back deadlock", async () => {
    mocks.session.mockResolvedValue({ id: "member_1" });
    mocks.createWithAudit.mockRejectedValueOnce({ cause: { code: "40P01" } });
    const response = await POST(
      new NextRequest("https://nexus.test/api/reports", {
        method: "POST",
        headers: {
          ...browserMutationHeaders(),
          cookie: "nexus_session=session",
          "content-type": "application/json",
        },
        body: JSON.stringify({
          targetType: "product",
          targetId: "prd_test",
          type: "scam",
          reason: "The resource is misrepresented",
        }),
      }),
    );
    expect(response.status).toBe(409);
    privateResponse(response);
    expect(await response.json()).toMatchObject({ code: "REPORT_RETRY" });
  });

  it("returns a conflict for a concurrent duplicate", async () => {
    mocks.session.mockResolvedValue({ id: "member_1" });
    mocks.createWithAudit.mockResolvedValueOnce({
      report: { id: "rpt_existing", status: "open" },
      created: false,
    });
    const response = await POST(
      new NextRequest("https://nexus.test/api/reports", {
        method: "POST",
        headers: {
          ...browserMutationHeaders(),
          cookie: "nexus_session=session",
          "content-type": "application/json",
        },
        body: JSON.stringify({
          targetType: "product",
          targetId: "prd_test",
          type: "scam",
          reason: "Already reported fraudulent resource",
        }),
      }),
    );
    expect(response.status).toBe(409);
    privateResponse(response);
    expect((await response.json()).reportId).toBe("rpt_existing");
  });

  it("rejects oversized target IDs and evidence lists before reading the target", async () => {
    mocks.session.mockResolvedValue({ id: "member_1" });
    for (const input of [
      { targetId: "x".repeat(129) },
      ...[
        "javascript:alert(1)",
        "data:text/html,bad",
        "https://user:pass@example.com",
        "https://example.com/\npath",
        "https://",
      ].map((url) => ({ evidenceUrls: [url] })),
      { evidenceUrls: Array.from({ length: 6 }, (_, i) => `https://example.test/${i}`) },
    ]) {
      const response = await POST(
        new NextRequest("https://nexus.test/api/reports", {
          method: "POST",
          headers: {
            ...browserMutationHeaders(),
            cookie: "nexus_session=session",
            "content-type": "application/json",
          },
          body: JSON.stringify({
            targetType: "product",
            targetId: "prd_test",
            type: "scam",
            reason: "An unsafe resource submission",
            ...input,
          }),
        }),
      );
      expect(response.status).toBe(400);
      privateResponse(response);
    }
    expect(mocks.findProduct).not.toHaveBeenCalled();
    expect(mocks.createWithAudit).not.toHaveBeenCalled();
  });
});
