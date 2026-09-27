import { NextRequest } from "next/server";
import { beforeEach, describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({
  user: { id: "u_1", isVerified: false } as { id: string; isVerified: boolean } | null,
  rate: vi.fn(),
  findPending: vi.fn(),
  create: vi.fn(),
  moderators: vi.fn(),
  notify: vi.fn(),
}));

vi.mock("../apps/web/src/lib/services/auth-service", () => ({
  authService: { getSession: async () => mocks.user },
}));
vi.mock("@nexus/security", () => ({
  consumeRateLimit: mocks.rate,
  generateId: (prefix: string) => `${prefix}_test`,
}));
vi.mock("@nexus/db", () => ({
  verificationRepository: { findPendingForTarget: mocks.findPending, createRequest: mocks.create },
  userRepository: { listModeratorIds: mocks.moderators },
  notificationRepository: { create: mocks.notify },
  organizationRepository: {},
}));

import { POST } from "../apps/web/src/app/api/verification/route";

function request(body: unknown = { targetType: "user", targetId: "u_1" }) {
  const req = new NextRequest("https://nexus.test/api/verification", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body),
  });
  req.cookies.set("nexus_session", "session");
  return req;
}

beforeEach(() => {
  vi.clearAllMocks();
  mocks.user = { id: "u_1", isVerified: false };
  mocks.rate.mockResolvedValue({ success: true });
  mocks.findPending.mockResolvedValue(null);
  mocks.create.mockResolvedValue({ id: "ver_test", status: "pending" });
  mocks.moderators.mockResolvedValue(["mod_1", "mod_2"]);
  mocks.notify.mockResolvedValue({});
});

describe("verification notification delivery", () => {
  it("notifies all moderators through an ID-only query after saving the application", async () => {
    const response = await POST(request());
    expect(response.status).toBe(201);
    expect(mocks.create).toHaveBeenCalledWith(
      expect.objectContaining({ requesterId: "u_1", targetId: "u_1" }),
      expect.objectContaining({ action: "verification.requested" }),
    );
    expect(mocks.moderators).toHaveBeenCalledOnce();
    expect(mocks.notify).toHaveBeenCalledTimes(2);
    expect(mocks.notify).toHaveBeenCalledWith(expect.objectContaining({ recipientId: "mod_2" }));
  });

  it("reports a saved application as successful even when notification lookup fails", async () => {
    mocks.moderators.mockRejectedValueOnce(new Error("Delivery database unavailable"));
    const warn = vi.spyOn(console, "warn").mockImplementation(() => {});
    try {
      const response = await POST(request());
      expect(response.status).toBe(201);
      expect(await response.json()).toMatchObject({ success: true, request: { id: "ver_test" } });
      expect(mocks.create).toHaveBeenCalledOnce();
      expect(warn).toHaveBeenCalledOnce();
    } finally {
      warn.mockRestore();
    }
  });

  it("keeps the application successful if one moderator notification fails", async () => {
    mocks.notify.mockResolvedValueOnce({}).mockRejectedValueOnce(new Error("Recipient offline"));
    const warn = vi.spyOn(console, "warn").mockImplementation(() => {});
    try {
      const response = await POST(request());
      expect(response.status).toBe(201);
      expect(mocks.notify).toHaveBeenCalledTimes(2);
      expect(warn).toHaveBeenCalledWith("Verification notification delivery failures:", 1);
    } finally {
      warn.mockRestore();
    }
  });

  it("does not notify if the application was not saved", async () => {
    mocks.create.mockRejectedValueOnce(new Error("Insert failed"));
    const error = vi.spyOn(console, "error").mockImplementation(() => {});
    try {
      expect((await POST(request())).status).toBe(500);
      expect(mocks.moderators).not.toHaveBeenCalled();
    } finally {
      error.mockRestore();
    }
  });

  it("rejects unsafe proof schemes and excessive target IDs before creating a request", async () => {
    expect((await POST(request({ targetType: "user", targetId: "u_1", proofUrl: "javascript:alert(1)" }))).status).toBe(400);
    expect((await POST(request({ targetType: "user", targetId: "x".repeat(129) }))).status).toBe(400);
    expect(mocks.create).not.toHaveBeenCalled();
  });
});
