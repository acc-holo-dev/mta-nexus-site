import type { ReactNode } from "react";
import { afterEach, beforeEach, type Mock, vi } from "vitest";
import type { OrganizationWorkspace } from "../../src/lib/organization-workspace-contract";
import { getOrganizationCopy } from "../../src/lib/organization-workspace-copy";
import {
  type FlatTestElement,
  findTestButton,
  flattenReactTestTree,
} from "./flatten-react-test-tree";

type OrganizationWorkspaceConfirmHarness = {
  slots: unknown[];
  cursor: number;
  request: Mock;
  push: Mock;
  refresh: Mock;
};

/** Props match the fixture literals so real OrganizationWorkspacePanel stays assignable. */
type OrganizationWorkspacePanelComponent = (props: {
  initial: typeof workspace;
  locale: "en";
  actorId: typeof actorId;
  query: "";
}) => ReactNode;

type ConfirmActionMock = Mock<(...args: unknown[]) => Promise<boolean>>;

type Element = FlatTestElement;

export const time = "2026-10-11T00:00:00.000Z";
export const later = "2026-10-11T00:00:01.000Z";
export const actorId = "usr_member";

export const organization = {
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

/** Shared react mock factory for organization-workspace confirm suites. */
export function mockReactHooks(harness: OrganizationWorkspaceConfirmHarness) {
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
      // Workspace state is seeded below; skip initial sync for confirm coverage.
    },
  });
}

function seedWorkspace(harness: OrganizationWorkspaceConfirmHarness) {
  // data, guard ref, busy, error, message, username, role, servers, ownershipTarget
  harness.slots = [workspace, { current: false }, false, "", "", "", "member", false, null];
}

export function createOrganizationWorkspaceConfirmInteractionHelpers(
  harness: OrganizationWorkspaceConfirmHarness,
  OrganizationWorkspacePanel: OrganizationWorkspacePanelComponent,
  confirmAction: ConfirmActionMock,
) {
  function render() {
    harness.cursor = 0;
    return flattenReactTestTree(
      OrganizationWorkspacePanel({
        initial: workspace,
        locale: "en",
        actorId,
        query: "",
      }),
    );
  }

  function leaveButton(nodes: Element[]) {
    return findTestButton(nodes, getOrganizationCopy("en").leave);
  }

  function clickLeave() {
    (leaveButton(render()).props.onClick as () => void)();
  }

  function memberEditor(nodes: Element[]) {
    const found = nodes.find((node) => componentName(node.type) === "OrganizationMemberEditor");
    if (!found) throw new Error("Missing OrganizationMemberEditor");
    return found;
  }

  beforeEach(() => {
    vi.clearAllMocks();
    harness.cursor = 0;
    seedWorkspace(harness);
    confirmAction.mockResolvedValue(true);
    harness.request.mockReset();
    harness.push.mockReset();
    harness.refresh.mockReset();
  });

  afterEach(() => {
    vi.unstubAllGlobals();
  });

  return {
    render,
    leaveButton,
    clickLeave,
    memberEditor,
  };
}
