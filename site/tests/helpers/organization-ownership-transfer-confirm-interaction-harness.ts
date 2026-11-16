import type { ReactNode } from "react";
import { afterEach, beforeEach, type Mock, vi } from "vitest";
import type { OrganizationWorkspace } from "../../src/lib/organization-workspace-contract";
import { type FlatTestElement, flattenReactTestTree } from "./flatten-react-test-tree";

type OrganizationOwnershipTransferConfirmHarness = {
  slots: unknown[];
  cursor: number;
  request: Mock;
  onBusyChange: Mock;
  onCancel: Mock;
  onSaved: Mock;
  onReload: Mock;
};

/** Props match the fixture literals so real OrganizationOwnershipTransfer stays assignable. */
type OrganizationOwnershipTransferComponent = (props: {
  data: typeof workspace;
  target: typeof target;
  actorId: typeof actorId;
  locale: "en";
  busy: false;
  onBusyChange: Mock;
  onCancel: Mock;
  onSaved: Mock;
  onReload: Mock;
}) => ReactNode;

type ConfirmActionMock = Mock<(...args: unknown[]) => Promise<boolean>>;

type Element = FlatTestElement;

const time = "2026-10-11T00:00:00.000Z";
const later = "2026-10-11T00:00:01.000Z";

export const actorId = "usr_owner";

export const organization = {
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

export const target = {
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

export const transferResult = {
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

/** Shared react mock factory for organization-ownership-transfer confirm suites. */
export function mockReactHooks(harness: OrganizationOwnershipTransferConfirmHarness) {
  return async (original: () => Promise<typeof import("react")>) => ({
    ...(await original()),
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
  });
}

function seedTransfer(harness: OrganizationOwnershipTransferConfirmHarness) {
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

export function createOrganizationOwnershipTransferConfirmInteractionHelpers(
  harness: OrganizationOwnershipTransferConfirmHarness,
  OrganizationOwnershipTransfer: OrganizationOwnershipTransferComponent,
  confirmAction: ConfirmActionMock,
) {
  function render() {
    harness.cursor = 0;
    return flattenReactTestTree(
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
    return (form.props.onSubmit as (event: { preventDefault: () => void }) => Promise<void>)({
      preventDefault() {},
    });
  }

  beforeEach(() => {
    vi.clearAllMocks();
    harness.cursor = 0;
    seedTransfer(harness);
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

  return {
    render,
    submit,
  };
}
