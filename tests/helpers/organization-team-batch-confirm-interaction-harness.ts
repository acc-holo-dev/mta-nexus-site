import type { ReactNode } from "react";
import { afterEach, beforeEach, expect, type Mock, vi } from "vitest";
import type { OrganizationTeamPage } from "../../apps/web/src/lib/organization-team-contract";
import {
  type FlatTestElement,
  findTestButton,
  flattenReactTestTree,
} from "./flatten-react-test-tree";

type OrganizationTeamBatchConfirmHarness = {
  slots: unknown[];
  cursor: number;
  cleanups: (() => void)[];
  fetch: Mock;
  acquire: Mock;
  release: Mock;
  failure: Mock;
  committed: Mock;
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

type ConfirmActionMock = Mock<(...args: unknown[]) => Promise<boolean>>;

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

export const response = (body: unknown, status = 200) =>
  new Response(JSON.stringify(body), { status, headers: { "content-type": "application/json" } });

/** Shared react mock factory for organization-team-batch confirm suites. */
export function mockReactHooks(harness: OrganizationTeamBatchConfirmHarness) {
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

export function createOrganizationTeamBatchConfirmInteractionHelpers(
  harness: OrganizationTeamBatchConfirmHarness,
  OrganizationTeamBatch: OrganizationTeamBatchComponent,
  confirmAction: ConfirmActionMock,
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

  return {
    click,
    acknowledgeCommit,
    prepareRemoveReview,
  };
}
