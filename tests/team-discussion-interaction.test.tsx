import { Button } from "@nexus/ui";
import type { ReactElement, ReactNode } from "react";
import { beforeEach, expect, it, vi } from "vitest";

const harness = vi.hoisted(() => ({
  slots: [] as unknown[],
  cursor: 0,
  cleanups: [] as (() => void)[],
  refresh: vi.fn(),
  fetch: vi.fn(),
  confirm: vi.fn(),
  acquire: vi.fn(),
  release: vi.fn(),
  failure: vi.fn(),
  committed: vi.fn(),
}));
vi.mock("react", async (original) => ({
  ...(await original<typeof import("react")>()),
  useState: (initial: unknown) => {
    const index = harness.cursor++;
    if (!(index in harness.slots)) harness.slots[index] = initial;
    return [
      harness.slots[index],
      (value: unknown) => {
        harness.slots[index] = value;
      },
    ];
  },
  useRef: (initial: unknown) => {
    const index = harness.cursor++;
    if (!(index in harness.slots)) harness.slots[index] = { current: initial };
    return harness.slots[index];
  },
  useEffect: (effect: () => () => void) => {
    const index = harness.cursor++;
    if (!(index in harness.slots)) {
      harness.slots[index] = true;
      harness.cleanups.push(effect());
    }
  },
}));
vi.mock("next/navigation", () => ({ useRouter: () => ({ refresh: harness.refresh }) }));

import { ModeratedDiscussionRemoval } from "../apps/web/src/components/moderated-discussion-removal";
import { OrganizationTeamBatch } from "../apps/web/src/components/organization-team-batch";
import type { OrganizationTeamPage } from "../apps/web/src/lib/organization-team-contract";

type Element = ReactElement<Record<string, unknown>>;
function descendants(node: ReactNode): Element[] {
  if (Array.isArray(node)) return node.flatMap(descendants);
  if (!node || typeof node !== "object" || !("props" in node)) return [];
  const element = node as Element;
  return [element, ...descendants(element.props.children as ReactNode)];
}
const time = "2026-10-11T00:00:00.000Z",
  later = "2026-10-11T00:00:00.001Z",
  version = "a".repeat(64);
const data: OrganizationTeamPage = {
  organization: {
    id: "org",
    name: "Team",
    slug: "team",
    description: "",
    logoUrl: "",
    websiteUrl: "",
    ownerId: "owner",
    isVerified: false,
    updatedAt: time,
  },
  role: "owner",
  owner: null,
  members: [
    {
      id: "member",
      username: "writer",
      displayName: "Writer",
      avatarUrl: null,
      role: "member",
      managesServers: false,
      effectiveServerAccess: false,
      joinedAt: time,
    },
    {
      id: "owner",
      username: "owner",
      displayName: "Owner",
      avatarUrl: null,
      role: "owner",
      managesServers: true,
      effectiveServerAccess: true,
      joinedAt: time,
    },
  ],
  hasMore: false,
  nextCursor: null,
};
const preview = {
  organizationId: "org",
  expectedUpdatedAt: time,
  previewRevision: version,
  changedCount: 1,
  members: [
    {
      userId: "member",
      username: "writer",
      displayName: "Writer",
      before: { role: "member", managesServers: false, effectiveServerAccess: false },
      after: { role: "developer", managesServers: false, effectiveServerAccess: false },
      changed: true,
    },
  ],
};
const response = (body: unknown, status = 200) =>
  new Response(JSON.stringify(body), { status, headers: { "content-type": "application/json" } });
function render(kind: "team" | "comment") {
  harness.cursor = 0;
  return descendants(
    kind === "team"
      ? OrganizationTeamBatch({
          data,
          actorId: "owner",
          locale: "en",
          disabled: false,
          acquire: harness.acquire,
          release: harness.release,
          onFailure: harness.failure,
          onCommitted: harness.committed,
        })
      : ModeratedDiscussionRemoval({
          contentId: "post",
          commentId: "comment",
          revision: version,
          locale: "en",
        }),
  );
}
function button(nodes: Element[], label: string) {
  const node = nodes.find(
    (node) => (node.type === "button" || node.type === Button) && node.props.children === label,
  );
  if (!node) throw Error(`Missing ${label}`);
  return node;
}
function click(kind: "team" | "comment", label: string) {
  const node = button(render(kind), label);
  expect(node.props.disabled).not.toBe(true);
  (node.props.onClick as () => void)();
}
function prepareTeam() {
  click("team", "Select eligible members on this page");
  const fields = render("team").filter((node) => node.type === "select");
  (fields[1].props.onChange as (event: unknown) => void)({ target: { value: "developer" } });
}
function prepareComment() {
  const field = render("comment").find((node) => node.type === "textarea");
  if (!field) throw Error("Missing reason");
  (field.props.onChange as (event: unknown) => void)({ target: { value: "  Reviewed reason  " } });
}
beforeEach(() => {
  vi.clearAllMocks();
  harness.slots = [];
  harness.cursor = 0;
  harness.cleanups = [];
  harness.acquire.mockReturnValue(true);
  harness.committed.mockResolvedValue(undefined);
  harness.confirm.mockReturnValue(true);
  vi.stubGlobal("fetch", harness.fetch);
  vi.stubGlobal("window", { confirm: harness.confirm });
});
it("selects eligible page members, performs server review and commits only the reviewed command", async () => {
  prepareTeam();
  harness.fetch.mockResolvedValueOnce(response(preview));
  click("team", "Review changes");
  await vi.waitFor(() =>
    expect(button(render("team"), "Save reviewed changes").props.disabled).toBe(false),
  );
  expect(JSON.parse(harness.fetch.mock.calls[0][1].body)).toEqual({
    userIds: ["member"],
    change: { action: "role", role: "developer" },
    expectedUpdatedAt: time,
  });
  harness.fetch.mockResolvedValueOnce(
    response({
      organization: { ...data.organization, updatedAt: later },
      changedUserIds: ["member"],
      previewRevision: version,
    }),
  );
  click("team", "Save reviewed changes");
  await vi.waitFor(() => expect(harness.committed).toHaveBeenCalled());
  expect(JSON.parse(harness.fetch.mock.calls[1][1].body).previewRevision).toBe(version);
  expect(harness.failure).not.toHaveBeenCalled();
  expect(harness.release).toHaveBeenCalledTimes(2);
});
it("rejects mismatched reviews and acknowledgments without applying client state", async () => {
  prepareTeam();
  harness.fetch.mockResolvedValueOnce(response({ ...preview, organizationId: "foreign" }));
  click("team", "Review changes");
  await vi.waitFor(() => expect(harness.failure).toHaveBeenCalled());
  expect(harness.committed).not.toHaveBeenCalled();
  expect(render("team").some((node) => node.props.children === "Save reviewed changes")).toBe(
    false,
  );
});
it("coalesces simultaneous reviews and aborts on unmount without later state or parent callbacks", async () => {
  prepareTeam();
  let resolve!: (value: Response) => void;
  harness.fetch.mockImplementationOnce(
    () =>
      new Promise<Response>((done) => {
        resolve = done;
      }),
  );
  const clickHandler = button(render("team"), "Review changes").props.onClick as () => void;
  clickHandler();
  clickHandler();
  expect(harness.fetch).toHaveBeenCalledTimes(1);
  for (const cleanup of harness.cleanups) cleanup();
  expect(harness.fetch.mock.calls[0][1].signal.aborted).toBe(true);
  resolve(response(preview));
  await vi.waitFor(() => expect(harness.release).toHaveBeenCalled());
  expect(harness.failure).not.toHaveBeenCalled();
  expect(harness.committed).not.toHaveBeenCalled();
});
it("submits trimmed scoped moderation reason, confirms exact removal and blocks repeat writes", async () => {
  prepareComment();
  harness.fetch.mockResolvedValueOnce(
    response({ contentId: "post", commentId: "comment", removed: true }),
  );
  click("comment", "Remove comment");
  await vi.waitFor(() => expect(harness.refresh).toHaveBeenCalledOnce());
  expect(harness.fetch.mock.calls[0][0]).toBe("/api/admin/community/post/discussion/comment");
  expect(JSON.parse(harness.fetch.mock.calls[0][1].body)).toEqual({
    reason: "Reviewed reason",
    expectedRevision: version,
  });
  expect(button(render("comment"), "Remove comment").props.disabled).toBe(true);
});
it.each([
  response({ contentId: "post", commentId: "foreign", removed: true }),
  response({ code: "COMMENT_CHANGED" }, 409),
])("blocks unconfirmed moderation result with a reload link", async (result) => {
  prepareComment();
  harness.fetch.mockResolvedValueOnce(result);
  click("comment", "Remove comment");
  await vi.waitFor(() =>
    expect(render("comment").some((node) => node.props.role === "alert")).toBe(true),
  );
  expect(harness.refresh).not.toHaveBeenCalled();
  expect(button(render("comment"), "Remove comment").props.disabled).toBe(true);
  expect(
    render("comment").some(
      (node) => node.type === "a" && node.props.href === "/admin/community/post/discussion/comment",
    ),
  ).toBe(true);
});
it("cancels removal before requests when explicit confirmation is declined", () => {
  prepareComment();
  harness.confirm.mockReturnValue(false);
  click("comment", "Remove comment");
  expect(harness.fetch).not.toHaveBeenCalled();
});
