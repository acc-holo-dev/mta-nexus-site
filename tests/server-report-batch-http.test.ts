import { AppError } from "@nexus/domain";
import { NextRequest } from "next/server";
import { afterEach, beforeEach, expect, it, vi } from "vitest";
import { browserMutationHeaders, stubBrowserMutationOrigin } from "./browser-mutation-headers";

const state = vi.hoisted(() => ({
  session: vi.fn(),
  previewDiscussionBatch: vi.fn(),
  decideDiscussionBatch: vi.fn(),
  rate: vi.fn(),
  previewMembers: vi.fn(),
  batchMembers: vi.fn(),
  discussion: vi.fn(),
  discussionDetail: vi.fn(),
  removeDiscussion: vi.fn(),
  discussionReports: vi.fn(),
  history: vi.fn(),
  restore: vi.fn(),
}));
vi.mock("../apps/web/src/lib/services/auth-service", () => ({
  authService: { getSession: state.session },
}));
vi.mock("../apps/web/src/lib/services/organization-workspace-service", () => ({
  organizationWorkspaceService: state,
}));
vi.mock("../apps/web/src/lib/services/community-moderation-service", () => ({
  communityModerationService: state,
}));
vi.mock("../apps/web/src/lib/services/organization-content-service", () => ({
  organizationContentService: state,
}));
vi.mock("@nexus/security", () => ({ consumeRateLimit: state.rate }));

vi.mock("../apps/web/src/lib/services/community-report-service", () => ({
  communityReportService: state,
}));
vi.mock("../apps/web/src/lib/services/server-content-service", () => ({
  serverContentService: state,
}));

import { POST as preview } from "../apps/web/src/app/api/admin/community/[id]/discussion/[commentId]/reports/batch/preview/route";
import { POST as batch } from "../apps/web/src/app/api/admin/community/[id]/discussion/[commentId]/reports/batch/route";
import { GET as history } from "../apps/web/src/app/api/workspace/servers/[id]/content/[contentId]/history/route";
import { POST as restore } from "../apps/web/src/app/api/workspace/servers/[id]/content/[contentId]/restore/route";

const discussion = { params: Promise.resolve({ id: "post", commentId: "comment" }) },
  server = { params: Promise.resolve({ id: "srv", contentId: "post" }) };
const request = (
  method = "GET",
  query = "",
  body?: unknown,
  headers: Record<string, string> = {},
) =>
  new NextRequest(`https://nexus.test/api/example${query}`, {
    method,
    headers: {
      ...browserMutationHeaders(),
      cookie: "nexus_session=token; nexus_locale=ru",
      ...(body === undefined ? {} : { "content-type": "application/json" }),
      ...headers,
    },
    ...(body === undefined ? {} : { body: JSON.stringify(body) }),
  });
const input = {
  items: [{ id: "report", expectedStatus: "open" }],
  action: "resolve",
  notes: "Recorded reason",
  previewRevision: "a".repeat(64),
};
afterEach(() => {
  vi.unstubAllEnvs();
});
beforeEach(() => {
  stubBrowserMutationOrigin();
  vi.clearAllMocks();
  state.session.mockResolvedValue({ id: "staff", role: "moderator" });
  state.rate.mockResolvedValue({ success: true });
  state.previewDiscussionBatch.mockResolvedValue({ ok: true });
  state.decideDiscussionBatch.mockResolvedValue({
    contentId: "post",
    commentId: "comment",
    action: "resolve",
    previewRevision: "a".repeat(64),
    items: [{ id: "report", status: "resolved", reporterId: "private-reporter", notes: "private" }],
  });
  state.history.mockResolvedValue({ ok: true });
  state.restore.mockResolvedValue({ ok: true });
});
it("binds private batch review and confirmed commands to the session actor and publication scope", async () => {
  const review = await preview(request("POST", "", input), discussion),
    command = await batch(request("POST", "", input), discussion);
  expect(review.status).toBe(200);
  expect(command.status).toBe(200);
  for (const response of [review, command]) {
    expect(response.headers.get("cache-control")).toBe("private, no-store");
    expect(response.headers.get("vary")).toBe("Cookie");
  }
  expect(state.previewDiscussionBatch).toHaveBeenCalledWith(
    { id: "staff", role: "moderator" },
    "post",
    "comment",
    input,
  );
  expect(state.decideDiscussionBatch).toHaveBeenCalledWith(
    { id: "staff", role: "moderator" },
    "post",
    "comment",
    input,
    "token",
  );
  expect(await command.json()).toEqual({
    contentId: "post",
    commentId: "comment",
    action: "resolve",
    previewRevision: "a".repeat(64),
    items: [{ id: "report", status: "resolved" }],
  });
  expect(state.rate).toHaveBeenCalledWith("moderationAction", "staff");
});
it("rejects injected queries, unsafe request media, cross-site commands and unbounded batches before service writes", async () => {
  for (const route of [preview, batch]) {
    for (const [query, headers, body, status] of [
      ["?actorId=foreign", {}, input, 400],
      ["", { "sec-fetch-site": "cross-site" }, input, 403],
      ["", { "content-type": "text/plain" }, input, 415],
      ["", {}, { text: "x".repeat(8500) }, 413],
    ] as const)
      expect((await route(request("POST", query, body, headers), discussion)).status).toBe(status);
  }
  expect(state.previewDiscussionBatch).not.toHaveBeenCalled();
  expect(state.decideDiscussionBatch).not.toHaveBeenCalled();
});
it.each(["preview", "batch", "history", "restore"])(
  "requires a current session and rate allowance for %s",
  async (name) => {
    const call = () =>
      name === "preview"
        ? preview(request("POST", "", input), discussion)
        : name === "batch"
          ? batch(request("POST", "", input), discussion)
          : name === "history"
            ? history(request(), server)
            : restore(
                request("POST", "", { expectedRevision: "2026-10-11T00:00:00.123456Z" }),
                server,
              );
    state.session.mockResolvedValue(null);
    expect((await call()).status).toBe(401);
    state.session.mockResolvedValue({ id: "staff", role: "moderator" });
    state.rate.mockResolvedValue({ success: false });
    expect((await call()).status).toBe(429);
  },
);
it("returns a localized review conflict without private details", async () => {
  state.decideDiscussionBatch.mockRejectedValue(
    new AppError("PRIVATE_DETAIL", 409, "REPORT_BATCH_CHANGED"),
  );
  const response = await batch(request("POST", "", input), discussion);
  expect(response.status).toBe(409);
  expect(await response.json()).toMatchObject({
    code: "REPORT_BATCH_CHANGED",
    error: expect.stringContaining("изменились"),
  });
});
it("scopes server history and draft restoration, rejects duplicate cursors and authority query injection", async () => {
  const read = await history(request(), server),
    write = await restore(
      request("POST", "", { expectedRevision: "2026-10-11T00:00:00.123456Z" }),
      server,
    );
  expect(read.status).toBe(200);
  expect(write.status).toBe(200);
  expect(state.history).toHaveBeenCalledWith("srv", { id: "staff", role: "moderator" }, "post", {
    cursor: undefined,
  });
  expect(state.restore).toHaveBeenCalledWith("srv", { id: "staff", role: "moderator" }, "post", {
    expectedRevision: "2026-10-11T00:00:00.123456Z",
  });
  for (const query of ["?serverId=foreign", "?cursor=a&cursor=b", "?cursor=bad"])
    expect((await history(request("GET", query), server)).status).toBe(400);
  for (const [query, headers, body, status] of [
    ["?actorId=foreign", {}, {}, 400],
    ["", { "sec-fetch-site": "cross-site" }, {}, 403],
    ["", { "content-type": "text/plain" }, {}, 415],
    ["", {}, { text: "x".repeat(1100) }, 413],
  ] as const)
    expect((await restore(request("POST", query, body, headers), server)).status).toBe(status);
  expect(read.headers.get("cache-control")).toBe("private, no-store");
  expect(write.headers.get("vary")).toBe("Cookie");
});
it("localizes protected server archives and refuses invalid listing identifiers before storage", async () => {
  state.restore.mockRejectedValue(
    new AppError("PRIVATE_DETAIL", 403, "PUBLICATION_RESTORE_DENIED"),
  );
  const response = await restore(
    request("POST", "", { expectedRevision: "2026-10-11T00:00:00.123456Z" }),
    server,
  );
  expect(response.status).toBe(403);
  expect(await response.json()).toMatchObject({
    error: expect.stringContaining("архива"),
    code: "PUBLICATION_RESTORE_DENIED",
  });
  expect(
    (await history(request(), { params: Promise.resolve({ id: "../foreign", contentId: "post" }) }))
      .status,
  ).toBe(404);
});

it("rejects a missing initiating cookie before reading a discussion batch body", async () => {
  const req = request("POST", "", input, { cookie: "nexus_locale=ru" });
  const read = vi.spyOn(req, "body", "get");
  expect((await batch(req, discussion)).status).toBe(401);
  expect(read).not.toHaveBeenCalled();
  expect(state.decideDiscussionBatch).not.toHaveBeenCalled();
});
