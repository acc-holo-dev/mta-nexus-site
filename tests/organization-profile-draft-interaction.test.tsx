import type { ReactNode } from "react";
import { beforeEach, expect, it, vi } from "vitest";
import { findTestButton, flattenReactTestTree } from "./helpers/flatten-react-test-tree";

const harness = vi.hoisted(() => ({
  slots: [] as unknown[],
  cursor: 0,
  request: vi.fn(),
  onSave: vi.fn(),
  onBusy: vi.fn(),
}));
vi.mock("react", async (original) => ({
  ...(await original<typeof import("react")>()),
  useState: (initial: unknown) => {
    const index = harness.cursor++;
    if (!(index in harness.slots)) harness.slots[index] = initial;
    return [
      harness.slots[index],
      (value: unknown) => {
        harness.slots[index] = typeof value === "function" ? value(harness.slots[index]) : value;
      },
    ];
  },
  useRef: (initial: unknown) => {
    const index = harness.cursor++;
    if (!(index in harness.slots)) harness.slots[index] = { current: initial };
    return harness.slots[index];
  },
  useEffect: () => {},
}));
vi.mock("next/navigation", () => ({ useRouter: () => ({ push: vi.fn(), refresh: vi.fn() }) }));
vi.mock("next/link", () => ({ default: "a" }));
vi.mock("../apps/web/src/lib/organization-workspace-client", () => ({
  organizationRequest: harness.request,
}));

import { OrganizationProfileForm } from "../apps/web/src/components/organization-profile-form";
import { getOrganizationCopy } from "../apps/web/src/lib/organization-workspace-copy";

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
const latest = { ...original, updatedAt: "2026-10-11T00:00:01.000Z" };
const actor = {
  id: "usr_1",
  username: "author",
  displayName: "Author",
  bio: "",
  avatarUrl: "",
  updatedAt: "2026-10-11T00:00:00.000Z",
};
const workspace = (role: "owner" | "member") => ({
  organization: latest,
  role,
  owner: null,
  members: [],
  page: 1,
  hasMore: false,
});
function render(initial = original, canEdit = true, locale: "en" | "ru" = "en") {
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
    }) as ReactNode,
  );
}
function editDraft() {
  const name = render().find((node) => node.props.id === "organization-name");
  if (!name) throw Error("Missing organization name");
  (name.props.onChange as (event: unknown) => void)({ target: { value: "Unsaved draft name" } });
}
function submit(nodes = render()) {
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

it.each(["en", "ru"] as const)(
  "keeps an edit when a team change updates the organization revision in %s",
  async (locale) => {
    const copy = getOrganizationCopy(locale);
    editDraft();
    const updated = render(latest, true, locale);
    expect(updated.find((node) => node.props.id === "organization-name")?.props.value).toBe(
      "Unsaved draft name",
    );
    expect(findTestButton(updated, copy.save).props.disabled).toBe(true);
    await submit(updated);
    expect(harness.request).not.toHaveBeenCalled();
    (
      findTestButton(render(latest, true, locale), copy.profileUseLatest).props
        .onClick as () => void
    )();
    harness.request.mockResolvedValueOnce({
      organization: {
        ...latest,
        name: "Unsaved draft name",
        updatedAt: "2026-10-11T00:00:02.000Z",
      },
    });
    await submit(render(latest, true, locale));
    expect(harness.request.mock.calls[0]?.[3]).toMatchObject({
      name: "Unsaved draft name",
      expectedUpdatedAt: latest.updatedAt,
    });
  },
);

it("checks the current actor and saved version after an unconfirmed update", async () => {
  const copy = getOrganizationCopy("en");
  editDraft();
  harness.request.mockRejectedValueOnce(new Error("response lost"));
  await submit();
  expect(findTestButton(render(), copy.save).props.disabled).toBe(true);
  harness.request
    .mockResolvedValueOnce({ profile: actor })
    .mockResolvedValueOnce(workspace("owner"));
  (findTestButton(render(), copy.profileCheck).props.onClick as () => void)();
  await vi.waitFor(() => expect(findTestButton(render(), copy.profileUseLatest)).toBeDefined());
  expect(render().find((node) => node.props.id === "organization-name")?.props.value).toBe(
    "Unsaved draft name",
  );
  expect(harness.request.mock.calls[1]?.[0]).toBe("/api/account/profile");
  expect(harness.request.mock.calls[2]?.[0]).toBe("/api/workspace/organizations/org_1");
});

it("loads the new fields when there is no local draft to preserve", () => {
  const copy = getOrganizationCopy("en");
  render();
  const changed = { ...latest, name: "Remote organization" };
  (findTestButton(render(changed), copy.profileUseLatest).props.onClick as () => void)();
  expect(render(changed).find((node) => node.props.id === "organization-name")?.props.value).toBe(
    "Remote organization",
  );
});

it("hides a draft after rights are revoked until the original actor is verified", async () => {
  const copy = getOrganizationCopy("en");
  editDraft();
  expect(render(latest, false).some((node) => node.props.value === "Unsaved draft name")).toBe(
    false,
  );
  harness.request
    .mockResolvedValueOnce({ profile: actor })
    .mockResolvedValueOnce(workspace("member"));
  (findTestButton(render(latest, false), copy.profileVerify).props.onClick as () => void)();
  await vi.waitFor(() =>
    expect(render(latest, false).some((node) => node.props.value === "Unsaved draft name")).toBe(
      true,
    ),
  );
  expect(
    render(latest, false).find((node) => node.props.id === "organization-name")?.props.readOnly,
  ).toBe(true);
  expect(
    render(latest, false).some(
      (node) => node.type === "button" && node.props.children === copy.profileUseLatest,
    ),
  ).toBe(false);
});

it("does not disclose the draft to a different actor during verification", async () => {
  const copy = getOrganizationCopy("en");
  editDraft();
  harness.request.mockResolvedValueOnce({ profile: { ...actor, id: "usr_2" } });
  (findTestButton(render(latest, false), copy.profileVerify).props.onClick as () => void)();
  await vi.waitFor(() =>
    expect(
      render(latest, false).some((node) => node.props.title === copy.profileActorChanged),
    ).toBe(true),
  );
  expect(render(latest, false).some((node) => node.props.value === "Unsaved draft name")).toBe(
    false,
  );
  expect(harness.request).toHaveBeenCalledTimes(1);
});

it("retains a hidden draft if identity verification is unreadable and permits retry", async () => {
  const copy = getOrganizationCopy("en");
  editDraft();
  harness.request.mockResolvedValueOnce({ profile: null });
  (findTestButton(render(latest, false), copy.profileVerify).props.onClick as () => void)();
  await vi.waitFor(() =>
    expect(render(latest, false).some((node) => node.props.title === copy.unavailable)).toBe(true),
  );
  expect(render(latest, false).some((node) => node.props.value === "Unsaved draft name")).toBe(
    false,
  );
  harness.request
    .mockResolvedValueOnce({ profile: actor })
    .mockResolvedValueOnce(workspace("member"));
  (findTestButton(render(latest, false), copy.profileVerify).props.onClick as () => void)();
  await vi.waitFor(() =>
    expect(render(latest, false).some((node) => node.props.value === "Unsaved draft name")).toBe(
      true,
    ),
  );
});
