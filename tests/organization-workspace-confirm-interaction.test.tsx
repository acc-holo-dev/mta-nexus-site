import type { ReactElement, ReactNode } from "react";
import { afterEach, beforeEach, expect, it, vi } from "vitest";

const harness = vi.hoisted(() => ({
  slots: [] as unknown[],
  cursor: 0,
  request: vi.fn(),
  push: vi.fn(),
  refresh: vi.fn(),
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
    // Workspace state is seeded below; skip initial sync for confirm coverage.
  },
}));
vi.mock("next/navigation", () => ({
  useRouter: () => ({ push: harness.push, refresh: harness.refresh }),
}));
vi.mock("next/link", () => ({
  default: ({ children, ...props }: { children: ReactNode; href: string }) => (
    <a {...props}>{children}</a>
  ),
}));
vi.mock("../apps/web/src/lib/organization-workspace-client", () => ({
  organizationRequest: harness.request,
}));

import { OrganizationWorkspacePanel } from "../apps/web/src/components/organization-workspace";
import { organizationGovernanceCopy } from "../apps/web/src/lib/organization-governance-copy";
import type { OrganizationWorkspace } from "../apps/web/src/lib/organization-workspace-contract";
import { getOrganizationCopy } from "../apps/web/src/lib/organization-workspace-copy";

type Element = ReactElement<Record<string, unknown>>;

const time = "2026-10-11T00:00:00.000Z";
const later = "2026-10-11T00:00:01.000Z";
const actorId = "usr_member";
const organization = {
  id: "org_aaaaaaaaaaaaaaaaaaaaaaaa",
  name: "Nexus Team",
  slug: "nexus-team",
  ownerId: "usr_owner",
  description: "",
  logoUrl: "",
  websiteUrl: "",
  isVerified: false,
  updatedAt: time,
};

const workspace: OrganizationWorkspace = {
  organization,
  role: "member",
  owner: { id: "usr_owner", username: "owner", displayName: "Owner", avatarUrl: null },
  members: [
    {
      id: actorId,
      username: "member",
      displayName: "Member",
      avatarUrl: null,
      role: "member",
      managesServers: false,
      joinedAt: time,
    },
  ],
  page: 1,
  hasMore: false,
};

function descendants(node: ReactNode): Element[] {
  if (Array.isArray(node)) return node.flatMap(descendants);
  if (!node || typeof node !== "object" || !("props" in node)) return [];
  const element = node as Element;
  const type = element.type as { displayName?: string } | string;
  if (typeof type === "object" && type?.displayName === "Button") {
    return [
      { ...element, type: "button" } as Element,
      ...descendants(element.props.children as ReactNode),
    ];
  }
  return [element, ...descendants(element.props.children as ReactNode)];
}

function seedWorkspace() {
  // data, guard ref, busy, error, message, username, role, servers, ownershipTarget
  harness.slots = [workspace, { current: false }, false, "", "", "", "member", false, null];
}

function render() {
  harness.cursor = 0;
  return descendants(
    OrganizationWorkspacePanel({
      initial: workspace,
      locale: "en",
      actorId,
      query: "",
    }),
  );
}

function leaveButton(nodes: Element[]) {
  const copy = getOrganizationCopy("en");
  const found = nodes.find((node) => node.type === "button" && node.props.children === copy.leave);
  if (!found) throw new Error("Missing leave organization button");
  return found;
}

beforeEach(() => {
  vi.clearAllMocks();
  harness.cursor = 0;
  seedWorkspace();
  confirmAction.mockResolvedValue(true);
  harness.request.mockReset();
  harness.push.mockReset();
  harness.refresh.mockReset();
});

afterEach(() => {
  vi.unstubAllGlobals();
});

it("confirms leaving an organization before POST", async () => {
  const copy = getOrganizationCopy("en");
  const governance = organizationGovernanceCopy("en");
  harness.request.mockResolvedValueOnce({
    organization: { ...organization, updatedAt: later },
    userId: actorId,
    removed: true,
  });

  (leaveButton(render()).props.onClick as () => void)();
  await vi.waitFor(() => expect(harness.request).toHaveBeenCalled());

  expect(confirmAction).toHaveBeenCalledWith({
    title: copy.leave,
    object: organization.name,
    consequences: copy.leaveConfirm,
    confirmLabel: copy.leave,
    cancelLabel: governance.cancel,
    closeLabel: governance.cancel,
  });
  expect(harness.request).toHaveBeenCalledWith(
    `/api/workspace/organizations/${encodeURIComponent(organization.id)}/leave`,
    "en",
    "POST",
    { expectedUpdatedAt: organization.updatedAt },
  );
  expect(harness.push).toHaveBeenCalledWith("/workspace/organizations");
  expect(harness.refresh).toHaveBeenCalledOnce();
});

it("does not leave the organization when confirmation is cancelled", async () => {
  confirmAction.mockResolvedValueOnce(false);
  (leaveButton(render()).props.onClick as () => void)();
  await vi.waitFor(() => expect(confirmAction).toHaveBeenCalledTimes(1));
  expect(harness.request).not.toHaveBeenCalled();
  expect(harness.push).not.toHaveBeenCalled();
});
