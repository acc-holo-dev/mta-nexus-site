import type { ReactElement, ReactNode } from "react";
import { afterEach, beforeEach, expect, it, vi } from "vitest";

const harness = vi.hoisted(() => ({
  slots: [] as unknown[],
  cursor: 0,
  request: vi.fn(),
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
  useEffect: () => {
    // Directory lifecycle is seeded below; skip abort wiring for confirm coverage.
  },
}));
vi.mock("next/link", () => ({
  default: ({ children, ...props }: { children: ReactNode; href: string }) => (
    <a {...props}>{children}</a>
  ),
}));
vi.mock("../apps/web/src/lib/organization-workspace-client", () => ({
  organizationRequest: harness.request,
}));

import { OrganizationTeamDirectory } from "../apps/web/src/components/organization-team-directory";
import { organizationBatchCopy } from "../apps/web/src/lib/organization-batch-copy";
import type { OrganizationTeamPage } from "../apps/web/src/lib/organization-team-contract";
import { getOrganizationCopy } from "../apps/web/src/lib/organization-workspace-copy";

type Element = ReactElement<Record<string, unknown>>;

const time = "2026-10-11T00:00:00.000Z";
const later = "2026-10-11T00:00:01.000Z";
const actorId = "usr_owner";
const member = {
  id: "usr_member",
  username: "member",
  displayName: "Member",
  avatarUrl: null,
  role: "member",
  managesServers: false,
  effectiveServerAccess: false,
  joinedAt: time,
};
const organization = {
  id: "org_aaaaaaaaaaaaaaaaaaaaaaaa",
  slug: "nexus-team",
  name: "Nexus Team",
  ownerId: actorId,
  isVerified: false,
  updatedAt: time,
  description: "",
  logoUrl: "",
  websiteUrl: "",
};
const page: OrganizationTeamPage = {
  organization,
  role: "owner",
  owner: { id: actorId, username: "owner", displayName: "Owner", avatarUrl: null },
  members: [member],
  hasMore: false,
  nextCursor: null,
};

function componentName(type: Element["type"]): string | undefined {
  if (typeof type === "string") return type;
  if (typeof type === "function") {
    const fn = type as { displayName?: string; name?: string };
    return fn.displayName ?? fn.name;
  }
  if (typeof type === "object" && type !== null) {
    return (type as { displayName?: string }).displayName;
  }
  return undefined;
}

function descendants(node: ReactNode): Element[] {
  if (Array.isArray(node)) return node.flatMap(descendants);
  if (!node || typeof node !== "object" || !("props" in node)) return [];
  const element = node as Element;
  return [element, ...descendants(element.props.children as ReactNode)];
}

function seedDirectory() {
  // data, pending, blocked, error, message, guard, alive, controller
  harness.slots = [
    page,
    false,
    false,
    "",
    "",
    { current: false },
    { current: true },
    { current: null },
  ];
}

function render() {
  harness.cursor = 0;
  return descendants(
    OrganizationTeamDirectory({
      initial: page,
      filters: { query: "" },
      locale: "en",
      actorId,
    }),
  );
}

function memberEditor(nodes: Element[]) {
  const found = nodes.find((node) => componentName(node.type) === "OrganizationMemberEditor");
  if (!found) throw new Error("Missing OrganizationMemberEditor");
  return found;
}

beforeEach(() => {
  vi.clearAllMocks();
  harness.cursor = 0;
  seedDirectory();
  confirmAction.mockResolvedValue(true);
  harness.request.mockReset();
});

afterEach(() => {
  vi.unstubAllGlobals();
});

it("confirms member removal before DELETE", async () => {
  const team = getOrganizationCopy("en");
  const batch = organizationBatchCopy("en");
  const refreshed = {
    ...page,
    organization: { ...organization, updatedAt: later },
  };
  harness.request
    .mockResolvedValueOnce({
      organization: refreshed.organization,
      userId: member.id,
      removed: true,
    })
    .mockResolvedValueOnce(refreshed);

  await (memberEditor(render()).props.onRemove as () => Promise<void>)();
  await vi.waitFor(() => expect(harness.request).toHaveBeenCalled());

  expect(confirmAction).toHaveBeenCalledWith({
    title: team.remove,
    object: `${member.displayName} (@${member.username})`,
    consequences: team.removeConfirm,
    confirmLabel: team.remove,
    cancelLabel: batch.cancel,
    closeLabel: batch.cancel,
  });
  expect(harness.request).toHaveBeenCalledWith(
    `/api/workspace/organizations/${encodeURIComponent(organization.id)}/members/${encodeURIComponent(member.id)}`,
    "en",
    "DELETE",
    { expectedUpdatedAt: organization.updatedAt },
    expect.any(AbortSignal),
    { "x-nexus-actor-id": actorId },
  );
});

it("does not remove a member when confirmation is cancelled", async () => {
  confirmAction.mockResolvedValueOnce(false);
  await (memberEditor(render()).props.onRemove as () => Promise<void>)();
  await vi.waitFor(() => expect(confirmAction).toHaveBeenCalledTimes(1));
  expect(harness.request).not.toHaveBeenCalled();
});
