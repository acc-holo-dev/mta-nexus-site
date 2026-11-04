import type { ReactElement, ReactNode } from "react";
import { afterEach, beforeEach, expect, it, vi } from "vitest";

const harness = vi.hoisted(() => ({
  slots: [] as unknown[],
  cursor: 0,
  request: vi.fn(),
  onBusyChange: vi.fn(),
  onCancel: vi.fn(),
  onSaved: vi.fn(),
  onReload: vi.fn(),
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
    // Transfer abort cleanup is out of scope for confirm coverage.
  },
}));
vi.mock("../apps/web/src/lib/user-platform-client", async (original) => {
  const actual = await original<typeof import("../apps/web/src/lib/user-platform-client")>();
  return {
    ...actual,
    platformRequest: harness.request,
  };
});

import { OrganizationOwnershipTransfer } from "../apps/web/src/components/organization-ownership-transfer";
import { organizationGovernanceCopy } from "../apps/web/src/lib/organization-governance-copy";
import type { OrganizationWorkspace } from "../apps/web/src/lib/organization-workspace-contract";

type Element = ReactElement<Record<string, unknown>>;

const time = "2026-10-11T00:00:00.000Z";
const later = "2026-10-11T00:00:01.000Z";
const actorId = "usr_owner";
const organization = {
  id: "org_aaaaaaaaaaaaaaaaaaaaaaaa",
  name: "Nexus Team",
  slug: "nexus-team",
  ownerId: actorId,
  description: "",
  logoUrl: "",
  websiteUrl: "",
  isVerified: false,
  updatedAt: time,
};
const target = {
  id: "usr_target",
  username: "target",
  displayName: "Target",
  avatarUrl: null,
  role: "developer" as const,
  managesServers: true,
  joinedAt: time,
};
const workspace: OrganizationWorkspace = {
  organization,
  role: "owner",
  owner: { id: actorId, username: "owner", displayName: "Owner", avatarUrl: null },
  members: [target],
  page: 1,
  hasMore: false,
};

const transferResult = {
  organization: { ...organization, ownerId: target.id, updatedAt: later },
  role: "member" as const,
  owner: {
    id: target.id,
    username: target.username,
    displayName: target.displayName,
    avatarUrl: null,
  },
  previousOwnerId: actorId,
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

function seedTransfer() {
  // slug, currentPassword, formerRole, error, guard ref, controller ref
  harness.slots = [
    organization.slug,
    "Current-password-123!",
    "member",
    "",
    { current: false },
    { current: null },
  ];
}

function render() {
  harness.cursor = 0;
  return descendants(
    OrganizationOwnershipTransfer({
      data: workspace,
      target,
      actorId,
      locale: "en",
      busy: false,
      onBusyChange: harness.onBusyChange,
      onCancel: harness.onCancel,
      onSaved: harness.onSaved,
      onReload: harness.onReload,
    }),
  );
}

function submit(nodes: Element[]) {
  const form = nodes.find((node) => node.type === "form");
  if (!form) throw new Error("Missing ownership transfer form");
  return (
    form.props.onSubmit as (event: { preventDefault: () => void }) => Promise<void>
  )({
    preventDefault() {},
  });
}

beforeEach(() => {
  vi.clearAllMocks();
  harness.cursor = 0;
  seedTransfer();
  confirmAction.mockResolvedValue(true);
  harness.request.mockReset();
  harness.onBusyChange.mockReset();
  harness.onCancel.mockReset();
  harness.onSaved.mockReset();
  harness.onReload.mockReset();
});

afterEach(() => {
  vi.unstubAllGlobals();
});

it("confirms ownership transfer before POST", async () => {
  const copy = organizationGovernanceCopy("en");
  harness.request.mockResolvedValueOnce(transferResult);

  await submit(render());
  await vi.waitFor(() => expect(harness.request).toHaveBeenCalled());

  expect(confirmAction).toHaveBeenCalledWith({
    title: copy.transfer,
    object: `@${target.username} · ${organization.name}`,
    scope: copy.selected,
    consequences: copy.consequence,
    confirmLabel: copy.submit,
    cancelLabel: copy.cancel,
    closeLabel: copy.cancel,
  });
  expect(harness.request).toHaveBeenCalledWith(
    `/api/workspace/organizations/${encodeURIComponent(organization.id)}/ownership`,
    "en",
    "POST",
    {
      targetId: target.id,
      targetUsername: target.username,
      confirmationSlug: organization.slug,
      currentPassword: "Current-password-123!",
      formerOwnerRole: "member",
      expectedUpdatedAt: organization.updatedAt,
    },
    expect.any(AbortSignal),
    expect.any(Function),
  );
  expect(harness.onSaved).toHaveBeenCalledWith(transferResult);
});

it("does not transfer ownership when confirmation is cancelled", async () => {
  confirmAction.mockResolvedValueOnce(false);
  await submit(render());
  await vi.waitFor(() => expect(confirmAction).toHaveBeenCalledTimes(1));
  expect(harness.request).not.toHaveBeenCalled();
  expect(harness.onSaved).not.toHaveBeenCalled();
});
