import { AppError } from "@nexus/domain";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { browserMutationHeaders, stubBrowserMutationOrigin } from "../helpers/browser-mutation-headers";

const confirmStaffActionPassword = vi.hoisted(() =>
  vi.fn(async () => ({ expectedPasswordHash: "hash_mod" })),
);
const reviewBuild = vi.hoisted(() =>
  vi.fn(async () => ({ id: "bld_1", productId: "prd_1", status: "published" })),
);
const resolveReport = vi.hoisted(() => vi.fn(async () => ({ id: "rpt_1", status: "resolved" })));

vi.mock("next/server", async () => {
  const actual = await vi.importActual<typeof import("next/server")>("next/server");
  return { ...actual, after: vi.fn() };
});

vi.mock("../../apps/web/src/lib/services/auth-service", () => ({
  authService: {
    getSession: vi.fn(async () => ({
      id: "usr_mod",
      email: "moderator@nexus.test",
      username: "moderator",
      role: "moderator",
    })),
    confirmStaffActionPassword,
  },
}));

vi.mock("../../apps/web/src/lib/services/product-service", () => ({
  productService: {
    reviewBuild,
    quarantineBuild: vi.fn(),
    restoreQuarantinedBuild: vi.fn(),
  },
}));

vi.mock("../../apps/web/src/lib/services/content-service", () => ({
  contentService: { moderateContent: vi.fn() },
}));

vi.mock("../../apps/web/src/lib/services/resource-release-control-service", () => ({
  resourceModerationService: { command: vi.fn() },
}));

vi.mock("@nexus/db", () => ({
  productRepository: { updateWithAudit: vi.fn() },
  reportRepository: { resolve: resolveReport, findById: vi.fn() },
  verificationRepository: { resolveRequest: vi.fn(), findById: vi.fn() },
}));

vi.mock("@nexus/security", async () => {
  const actual = await vi.importActual<typeof import("@nexus/security")>("@nexus/security");
  return {
    ...actual,
    can: vi.fn(() => true),
    consumeRateLimit: vi.fn(async () => ({ success: true })),
    generateId: vi.fn((prefix: string) => `${prefix}_test`),
  };
});

import { NextRequest } from "next/server";
import { POST } from "../../apps/web/src/app/api/admin/actions/route";

function buildBody(overrides: Record<string, unknown> = {}) {
  return {
    targetType: "build",
    targetId: "bld_1",
    action: "approve",
    notes: "Reviewed build",
    expectedRevision: 1,
    currentPassword: "Staff-password-123!",
    ...overrides,
  };
}

function post(body: Record<string, unknown>, cookie = "nexus_session=test-session") {
  return new NextRequest("http://nexus.test/api/admin/actions", {
    method: "POST",
    headers: browserMutationHeaders({
      "content-type": "application/json",
      cookie,
    }),
    body: JSON.stringify(body),
  });
}

describe("admin/actions staff_action fresh-auth HTTP enforcement", () => {
  beforeEach(() => {
    stubBrowserMutationOrigin();
    vi.clearAllMocks();
    confirmStaffActionPassword.mockResolvedValue({ expectedPasswordHash: "hash_mod" });
    reviewBuild.mockResolvedValue({ id: "bld_1", productId: "prd_1", status: "published" });
    resolveReport.mockResolvedValue({ id: "rpt_1", status: "resolved" });
  });
  afterEach(() => {
    vi.unstubAllEnvs();
  });

  it("rejects a critical command when current_password is absent", async () => {
    const { currentPassword: _omit, ...withoutPassword } = buildBody();
    const response = await POST(post(withoutPassword));
    expect(response.status).toBe(400);
    expect(confirmStaffActionPassword).not.toHaveBeenCalled();
    expect(reviewBuild).not.toHaveBeenCalled();
  });

  it("rejects a critical command when current_password is wrong", async () => {
    confirmStaffActionPassword.mockRejectedValueOnce(
      new AppError("Current password is incorrect", 401, "FRESH_AUTH_REQUIRED"),
    );
    const response = await POST(post(buildBody({ currentPassword: "wrong-password" })));
    expect(response.status).toBe(401);
    expect(await response.json()).toMatchObject({ code: "FRESH_AUTH_REQUIRED" });
    expect(reviewBuild).not.toHaveBeenCalled();
  });

  it("passes expectedPasswordHash into build review after a valid password", async () => {
    const response = await POST(post(buildBody()));
    expect(response.status).toBe(200);
    expect(confirmStaffActionPassword).toHaveBeenCalledWith({
      email: "moderator@nexus.test",
      currentPassword: "Staff-password-123!",
    });
    expect(reviewBuild).toHaveBeenCalledWith(
      {
        buildId: "bld_1",
        decision: "approve",
        notes: "Reviewed build",
        expectedRevision: 1,
        expectedPasswordHash: "hash_mod",
      },
      expect.objectContaining({ id: "usr_mod" }),
      "test-session",
    );
    const payload = await response.json();
    expect(JSON.stringify(payload)).not.toContain("Staff-password-123!");
    expect(JSON.stringify(payload)).not.toContain("hash_mod");
  });

  it("requires current_password for non-build critical actions and never audits it", async () => {
    const response = await POST(
      post({
        targetType: "report",
        targetId: "rpt_1",
        action: "resolve",
        notes: "Reviewed evidence",
        currentPassword: "Staff-password-123!",
      }),
    );
    expect(response.status).toBe(200);
    expect(resolveReport).toHaveBeenCalledWith(
      "rpt_1",
      "resolved",
      "Reviewed evidence",
      expect.objectContaining({
        details: { notes: "Reviewed evidence" },
      }),
      "test-session",
    );
    const audit = resolveReport.mock.calls.at(0)?.at(3) as
      | { details?: Record<string, unknown> }
      | undefined;
    expect(audit).toBeDefined();
    expect(audit?.details).not.toHaveProperty("currentPassword");
    expect(JSON.stringify(audit)).not.toContain("Staff-password-123!");
  });
});
