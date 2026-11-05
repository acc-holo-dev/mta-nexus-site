import { afterEach, beforeEach, expect, it, vi } from "vitest";

const harness = vi.hoisted(() => ({
  slots: [] as unknown[],
  cursor: 0,
  cleanups: [] as (() => void)[],
  fetch: vi.fn(),
  acquire: vi.fn(),
  release: vi.fn(),
  failure: vi.fn(),
  committed: vi.fn(),
}));
const confirmAction = vi.hoisted(() => vi.fn(async () => true));
vi.mock("../apps/web/src/components/confirm-action", () => ({ confirmAction }));
vi.mock("react", async (original) => ({
  ...(await original<typeof import("react")>()),
  useState: (initial: unknown) => {
    const index = harness.cursor++;
    if (!(index in harness.slots)) harness.slots[index] = initial;
    return [
      harness.slots[index],
      (value: unknown) => {
        harness.slots[index] =
          typeof value === "function"
            ? (value as (current: unknown) => unknown)(harness.slots[index])
            : value;
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

import { OrganizationTeamBatch } from "../apps/web/src/components/organization-team-batch";
import { organizationBatchCopy } from "../apps/web/src/lib/organization-batch-copy";
import type { OrganizationTeamPage } from "../apps/web/src/lib/organization-team-contract";
import { type FlatTestElement, flattenReactTestTree } from "./helpers/flatten-react-test-tree";

type Element = FlatTestElement;

const time = "2026-10-11T00:00:00.000Z";
const later = "2026-10-11T00:00:00.001Z";
const version = "a".repeat(64);
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
const removePreview = {
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
      after: null,
      changed: true,
    },
  ],
};
const response = (body: unknown, status = 200) =>
  new Response(JSON.stringify(body), { status, headers: { "content-type": "application/json" } });

function render() {
  harness.cursor = 0;
  return flattenReactTestTree(
    OrganizationTeamBatch({
      data,
      actorId: "owner",
      locale: "en",
      disabled: false,
      acquire: harness.acquire,
      release: harness.release,
      onFailure: harness.failure,
      onCommitted: harness.committed,
    }),
  );
}

function button(nodes: Element[], label: string) {
  const node = nodes.find((entry) => entry.type === "button" && entry.props.children === label);
  if (!node) throw Error(`Missing ${label}`);
  return node;
}

function click(label: string) {
  const node = button(render(), label);
  expect(node.props.disabled).not.toBe(true);
  (node.props.onClick as () => void)();
}

function acknowledgeCommit() {
  const confirm = render()
    .filter((node) => node.type === "input")
    .at(-1);
  if (!confirm) throw Error("Missing commit acknowledgement");
  (confirm.props.onChange as (event: unknown) => void)({ target: { checked: true } });
}

async function prepareRemoveReview() {
  click("Select eligible members on this page");
  const action = render().find((node) => node.type === "select");
  if (!action) throw Error("Missing action");
  (action.props.onChange as (event: unknown) => void)({ target: { value: "remove" } });
  harness.fetch.mockResolvedValueOnce(response(removePreview));
  click("Review changes");
  await vi.waitFor(() =>
    expect(button(render(), "Save reviewed changes").props.disabled).toBe(true),
  );
  acknowledgeCommit();
  expect(button(render(), "Save reviewed changes").props.disabled).toBe(false);
}

beforeEach(() => {
  vi.clearAllMocks();
  harness.slots = [];
  harness.cursor = 0;
  harness.cleanups = [];
  harness.acquire.mockReturnValue(true);
  harness.committed.mockResolvedValue(undefined);
  confirmAction.mockResolvedValue(true);
  vi.stubGlobal("fetch", harness.fetch);
});

afterEach(() => {
  for (const cleanup of harness.cleanups) cleanup();
  vi.unstubAllGlobals();
});

it("does not commit organization-team-batch removal when confirmAction is cancelled", async () => {
  const copy = organizationBatchCopy("en");
  await prepareRemoveReview();
  expect(harness.fetch).toHaveBeenCalledTimes(1);
  confirmAction.mockResolvedValueOnce(false);
  click("Save reviewed changes");
  await vi.waitFor(() => expect(confirmAction).toHaveBeenCalledTimes(1));
  expect(confirmAction).toHaveBeenCalledWith({
    title: copy.title,
    object: data.organization.name,
    scope: "1",
    consequences: copy.confirmRemove,
    confirmLabel: copy.confirm,
    cancelLabel: copy.cancel,
    closeLabel: copy.cancel,
  });
  expect(harness.fetch).toHaveBeenCalledTimes(1);
  expect(harness.acquire).toHaveBeenCalledTimes(1);
  expect(harness.committed).not.toHaveBeenCalled();
  expect(harness.failure).not.toHaveBeenCalled();
});

it("commits organization-team-batch removal only after confirmAction approves", async () => {
  const copy = organizationBatchCopy("en");
  await prepareRemoveReview();
  harness.fetch.mockResolvedValueOnce(
    response({
      organization: { ...data.organization, updatedAt: later },
      changedUserIds: ["member"],
      previewRevision: version,
    }),
  );
  acknowledgeCommit();
  click("Save reviewed changes");
  await vi.waitFor(() => expect(harness.committed).toHaveBeenCalled());
  expect(confirmAction).toHaveBeenCalledWith({
    title: copy.title,
    object: data.organization.name,
    scope: "1",
    consequences: copy.confirmRemove,
    confirmLabel: copy.confirm,
    cancelLabel: copy.cancel,
    closeLabel: copy.cancel,
  });
  expect(harness.fetch).toHaveBeenCalledTimes(2);
  expect(JSON.parse(harness.fetch.mock.calls[1][1].body)).toEqual({
    userIds: ["member"],
    change: { action: "remove" },
    expectedUpdatedAt: time,
    previewRevision: version,
  });
  expect(harness.failure).not.toHaveBeenCalled();
});
