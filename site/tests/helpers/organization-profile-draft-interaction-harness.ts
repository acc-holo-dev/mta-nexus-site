import type { ReactNode } from "react";
import { beforeEach, type Mock, vi } from "vitest";
import { type FlatTestElement, flattenReactTestTree } from "./flatten-react-test-tree";

type OrganizationProfileDraftHarness = {
  slots: unknown[];
  cursor: number;
  request: Mock;
  onSave: Mock;
  onBusy: Mock;
};

type Element = FlatTestElement;

/** Exact fixture literals so OrganizationProfileForm stays assignable under strictFunctionTypes. */
const original = {
  id: "org_1",
  name: "Original org",
  slug: "original-org",
  ownerId: "usr_1",
  description: "Original description",
  logoUrl: "",
  websiteUrl: "",
  isVerified: false,
  updatedAt: "2026-10-11T00:00:00.000Z",
};

export const latest = { ...original, updatedAt: "2026-10-11T00:00:01.000Z" };

export const remoteNamed = { ...latest, name: "Remote organization" };

export const actor = {
  id: "usr_1",
  username: "author",
  displayName: "Author",
  bio: "",
  avatarUrl: "",
  updatedAt: "2026-10-11T00:00:00.000Z",
};

export const workspace = (role: "owner" | "member") => ({
  organization: latest,
  role,
  owner: null,
  members: [],
  page: 1,
  hasMore: false,
});

type OrganizationSnapshot = typeof original | typeof latest | typeof remoteNamed;

type OrganizationProfileFormComponent = (props: {
  locale: "en" | "ru";
  actorId: "usr_1";
  initial: OrganizationSnapshot;
  canEdit: boolean;
  disabled: boolean;
  onSave: Mock;
  onBusyChange: Mock;
}) => ReactNode;

/** Shared react mock factory for organization-profile draft suites (use with vi.mock("react", ...)). */
export function mockReactHooks(harness: OrganizationProfileDraftHarness) {
  return async (originalModule: () => Promise<typeof import("react")>) => ({
    ...(await originalModule()),
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
    useEffect: () => {},
  });
}

export function createOrganizationProfileDraftInteractionHelpers(
  harness: OrganizationProfileDraftHarness,
  OrganizationProfileForm: OrganizationProfileFormComponent,
) {
  function render(
    initial: OrganizationSnapshot = original,
    canEdit = true,
    locale: "en" | "ru" = "en",
  ) {
    harness.cursor = 0;
    return flattenReactTestTree(
      OrganizationProfileForm({
        locale,
        actorId: "usr_1",
        initial,
        canEdit,
        disabled: !canEdit,
        onSave: harness.onSave,
        onBusyChange: harness.onBusy,
      }),
    );
  }

  function edit() {
    const name = render().find((node) => node.props.id === "organization-name");
    if (!name) throw Error("Missing organization name");
    (name.props.onChange as (event: unknown) => void)({ target: { value: "Unsaved draft name" } });
  }

  function submit(nodes: Element[] = render()) {
    const form = nodes.find((node) => node.type === "form");
    if (!form) throw Error("Missing organization form");
    return (form.props.onSubmit as (event: unknown) => Promise<void>)({ preventDefault() {} });
  }

  beforeEach(() => {
    vi.clearAllMocks();
    harness.slots = [];
    harness.cursor = 0;
    harness.request.mockReset();
  });

  return { render, edit, submit };
}
