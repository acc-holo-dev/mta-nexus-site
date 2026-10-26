import { NextRequest } from "next/server";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

const authService = vi.hoisted(() => ({
  getSession: vi.fn(async () => null),
}));
vi.mock("../apps/web/src/lib/services/auth-service", () => ({ authService }));
vi.mock("@nexus/security", () => ({
  consumeRateLimit: vi.fn(async () => ({ success: true })),
  generateId: (prefix: string) => `${prefix}_new`,
}));
vi.mock("../apps/web/src/lib/services/organization-content-service", () => ({
  organizationContentService: {
    page: vi.fn(),
    get: vi.fn(),
    create: vi.fn(),
    update: vi.fn(),
    restore: vi.fn(),
  },
}));
vi.mock("../apps/web/src/lib/services/organization-workspace-service", () => ({
  organizationWorkspaceService: {
    list: vi.fn(),
    get: vi.fn(),
    create: vi.fn(),
    update: vi.fn(),
    add: vi.fn(),
    change: vi.fn(),
    leave: vi.fn(),
    previewMembers: vi.fn(),
    batchMembers: vi.fn(),
  },
}));
vi.mock("../apps/web/src/lib/services/organization-governance-service", () => ({
  organizationGovernanceService: {
    transfer: vi.fn(),
  },
}));

import { POST as restoreContent } from "../apps/web/src/app/api/workspace/organizations/[id]/content/[contentId]/restore/route";
import {
  DELETE as archiveContent,
  PATCH as editContent,
} from "../apps/web/src/app/api/workspace/organizations/[id]/content/[contentId]/route";
import { POST as createContent } from "../apps/web/src/app/api/workspace/organizations/[id]/content/route";
import { POST as leaveOrganization } from "../apps/web/src/app/api/workspace/organizations/[id]/leave/route";
import {
  PATCH as changeMember,
  DELETE as removeMember,
} from "../apps/web/src/app/api/workspace/organizations/[id]/members/[userId]/route";
import { POST as previewMembers } from "../apps/web/src/app/api/workspace/organizations/[id]/members/batch/preview/route";
import { POST as batchMembers } from "../apps/web/src/app/api/workspace/organizations/[id]/members/batch/route";
import { POST as addMember } from "../apps/web/src/app/api/workspace/organizations/[id]/members/route";
import { POST as transferOwnership } from "../apps/web/src/app/api/workspace/organizations/[id]/ownership/route";
import { PATCH as updateOrganization } from "../apps/web/src/app/api/workspace/organizations/[id]/route";
import { POST as createOrganization } from "../apps/web/src/app/api/workspace/organizations/route";

const context = {
  params: Promise.resolve({ id: "org", contentId: "content", userId: "member" }),
};
const mutations = [
  ["organization create", "POST", createOrganization],
  ["organization profile", "PATCH", updateOrganization],
  ["organization leave", "POST", leaveOrganization],
  ["organization ownership", "POST", transferOwnership],
  ["organization member add", "POST", addMember],
  ["organization member change", "PATCH", changeMember],
  ["organization member remove", "DELETE", removeMember],
  ["organization member batch", "POST", batchMembers],
  ["organization member preview", "POST", previewMembers],
  ["organization publication", "POST", createContent],
  ["organization publication edit", "PATCH", editContent],
  ["organization publication archive", "DELETE", archiveContent],
  ["organization publication restore", "POST", restoreContent],
] as const;

function request(method: string, headers: Record<string, string> = {}) {
  return new NextRequest("https://nexus.test/api/workspace/organizations/org", {
    method,
    headers: {
      cookie: "nexus_session=owner",
      "content-type": "application/json",
      ...headers,
    },
    body: JSON.stringify({ name: "Team" }),
  });
}

beforeEach(() => {
  vi.clearAllMocks();
  vi.stubEnv("NODE_ENV", "production");
  vi.stubEnv("NEXT_PUBLIC_APP_URL", "https://nexus.test");
  vi.spyOn(console, "warn").mockImplementation(() => {});
  authService.getSession.mockResolvedValue(null);
});

afterEach(() => {
  vi.unstubAllEnvs();
  vi.restoreAllMocks();
});

describe("workspace organization writes enforce the browser boundary independently of Proxy", () => {
  it.each(mutations)(
    "rejects a missing Origin on %s before session or body reads",
    async (_name, method, handler) => {
      const input = request(method);
      const response = await handler(input, context);
      expect(response.status).toBe(403);
      expect(await response.json()).toMatchObject({ code: "CSRF_REJECTED" });
      expect(response.headers.get("cache-control")).toBe("private, no-store");
      expect(input.bodyUsed).toBe(false);
      expect(authService.getSession).not.toHaveBeenCalled();
    },
  );

  it.each(mutations)(
    "rejects a cross-site Origin on %s even with a bearer token",
    async (_name, method, handler) => {
      const input = request(method, {
        origin: "https://evil.test",
        authorization: "Bearer forged",
      });
      const response = await handler(input, context);
      expect(response.status).toBe(403);
      expect(await response.json()).toMatchObject({ code: "CSRF_REJECTED" });
      expect(input.bodyUsed).toBe(false);
      expect(authService.getSession).not.toHaveBeenCalled();
    },
  );

  it.each(mutations)(
    "accepts a same-origin %s request and reaches session resolution",
    async (_name, method, handler) => {
      const response = await handler(
        request(method, { origin: "https://nexus.test", "sec-fetch-site": "same-origin" }),
        context,
      );
      expect(authService.getSession).toHaveBeenCalledOnce();
      const body = await response.json();
      expect(body.code).not.toBe("CSRF_REJECTED");
    },
  );
});
