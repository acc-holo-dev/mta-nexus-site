import type { ReactNode } from "react";
import { afterEach, beforeEach, expect, type Mock, vi } from "vitest";
import type { OrganizationTeamPage } from "../../apps/web/src/lib/organization-team-contract";
import {
  type FlatTestElement,
  findTestButton,
  flattenReactTestTree,
} from "./flatten-react-test-tree";

type TeamDiscussionInteractionHarness = {
  slots: unknown[];
  cursor: number;
  cleanups: (() => void)[];
  refresh: Mock;
  fetch: Mock;
  confirm: Mock;
  acquire: Mock;
  release: Mock;
  failure: Mock;
  committed: Mock;
};

type Element = FlatTestElement;

export const time = "2026-10-11T00:00:00.000Z";
export const later = "2026-10-11T00:00:00.001Z";
export const version = "a".repeat(64);

export const data: OrganizationTeamPage = {
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

export const preview = {
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

/** Props match the fixture literals so real OrganizationTeamBatch stays assignable. */
type OrganizationTeamBatchComponent = (props: {
  data: typeof data;
  actorId: "owner";
  locale: "en";
  disabled: false;
  acquire: Mock;
  release: Mock;
  onFailure: Mock;
  onCommitted: Mock;
}) => ReactNode;

/** Props match the fixture literals so real ModeratedDiscussionRemoval stays assignable. */
type ModeratedDiscussionRemovalComponent = (props: {
  contentId: "post";
  commentId: "comment";
  revision: typeof version;
  locale: "en";
}) => ReactNode;

type ConfirmActionMock = Mock<(...args: unknown[]) => Promise<boolean>>;

export const response = (body: unknown, status = 200) =>
  new Response(JSON.stringify(body), { status, headers: { "content-type": "application/json" } });

/** Shared react mock factory for team-discussion interaction suites (use with vi.mock("react", ...)). */
export function mockReactHooks(harness: TeamDiscussionInteractionHarness) {
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
    useEffect: (effect: () => () => void) => {
      const index = harness.cursor++;
      if (!(index in harness.slots)) {
        harness.slots[index] = true;
        harness.cleanups.push(effect());
      }
    },
  });
}

function resetHarness(harness: TeamDiscussionInteractionHarness) {
  vi.clearAllMocks();
  harness.slots = [];
  harness.cursor = 0;
  harness.cleanups = [];
  harness.acquire.mockReturnValue(true);
  harness.committed.mockResolvedValue(undefined);
  harness.confirm.mockReturnValue(true);
  vi.stubGlobal("fetch", harness.fetch);
  vi.stubGlobal("window", { confirm: harness.confirm });
}

export function createTeamBatchInteractionHelpers(
  harness: TeamDiscussionInteractionHarness,
  OrganizationTeamBatch: OrganizationTeamBatchComponent,
) {
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
    return findTestButton(nodes, label);
  }

  function click(label: string) {
    const node = button(render(), label);
    expect(node.props.disabled).not.toBe(true);
    (node.props.onClick as () => void)();
  }

  function acknowledgeTeamCommit() {
    const confirm = render()
      .filter((node) => node.type === "input")
      .at(-1);
    if (!confirm) throw Error("Missing commit acknowledgement");
    (confirm.props.onChange as (event: unknown) => void)({ target: { checked: true } });
  }

  function prepareTeam() {
    click("Select eligible members on this page");
    const fields = render().filter((node) => node.type === "select");
    (fields[1].props.onChange as (event: unknown) => void)({ target: { value: "developer" } });
  }

  beforeEach(() => {
    resetHarness(harness);
  });

  afterEach(() => {
    vi.unstubAllGlobals();
  });

  return {
    render,
    button,
    click,
    acknowledgeTeamCommit,
    prepareTeam,
  };
}

export function createModerationRemovalInteractionHelpers(
  harness: TeamDiscussionInteractionHarness,
  ModeratedDiscussionRemoval: ModeratedDiscussionRemovalComponent,
  confirmAction: ConfirmActionMock,
) {
  function render() {
    harness.cursor = 0;
    return flattenReactTestTree(
      ModeratedDiscussionRemoval({
        contentId: "post",
        commentId: "comment",
        revision: version,
        locale: "en",
      }),
    );
  }

  function button(nodes: Element[], label: string) {
    return findTestButton(nodes, label);
  }

  function click(label: string) {
    const node = button(render(), label);
    expect(node.props.disabled).not.toBe(true);
    (node.props.onClick as () => void)();
  }

  function prepareComment() {
    const field = render().find((node) => node.type === "textarea");
    if (!field) throw Error("Missing reason");
    (field.props.onChange as (event: unknown) => void)({
      target: { value: "  Reviewed reason  " },
    });
  }

  beforeEach(() => {
    resetHarness(harness);
    confirmAction.mockResolvedValue(true);
  });

  afterEach(() => {
    vi.unstubAllGlobals();
  });

  return {
    render,
    button,
    click,
    prepareComment,
  };
}
