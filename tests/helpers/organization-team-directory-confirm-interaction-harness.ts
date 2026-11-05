import type { ReactNode } from "react";
import { afterEach, beforeEach, type Mock, vi } from "vitest";
import type { OrganizationTeamPage } from "../../apps/web/src/lib/organization-team-contract";
import {
  type FlatTestElement,
  flattenReactTestTree,
} from "./flatten-react-test-tree";

type OrganizationTeamDirectoryConfirmHarness = {
  slots: unknown[];
  cursor: number;
  request: Mock;
};

/** Props match the fixture literals so real OrganizationTeamDirectory stays assignable. */
type OrganizationTeamDirectoryComponent = (props: {
  initial: typeof page;
  filters: { query: "" };
  locale: "en";
  actorId: typeof actorId;
}) => ReactNode;

type ConfirmActionMock = Mock<(...args: unknown[]) => Promise<boolean>>;

type Element = FlatTestElement;

export const time = "2026-10-11T00:00:00.000Z";
export const later = "2026-10-11T00:00:01.000Z";
export const actorId = "usr_owner";

export const member = {
  id: "usr_member",
  username: "member",
  displayName: "Member",
  avatarUrl: null,
  role: "member",
  managesServers: false,
  effectiveServerAccess: false,
  joinedAt: time,
};

export const organization = {
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

export const page: OrganizationTeamPage = {
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

/** Shared react mock factory for organization-team-directory confirm suites. */
export function mockReactHooks(harness: OrganizationTeamDirectoryConfirmHarness) {
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
      // Directory lifecycle is seeded below; skip abort wiring for confirm coverage.
    },
  });
}

function seedDirectory(harness: OrganizationTeamDirectoryConfirmHarness) {
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

export function createOrganizationTeamDirectoryConfirmInteractionHelpers(
  harness: OrganizationTeamDirectoryConfirmHarness,
  OrganizationTeamDirectory: OrganizationTeamDirectoryComponent,
  confirmAction: ConfirmActionMock,
) {
  function render() {
    harness.cursor = 0;
    return flattenReactTestTree(
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
    seedDirectory(harness);
    confirmAction.mockResolvedValue(true);
    harness.request.mockReset();
  });

  afterEach(() => {
    vi.unstubAllGlobals();
  });

  return {
    render,
    memberEditor,
  };
}
