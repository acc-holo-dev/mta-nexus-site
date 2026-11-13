import { expect, it, vi } from "vitest";
import { findTestButton } from "./helpers/flatten-react-test-tree";
import {
  actor,
  createOrganizationProfileDraftInteractionHelpers,
  latest,
  mockReactHooks,
  workspace,
} from "./helpers/organization-profile-draft-interaction-harness";

const harness = vi.hoisted(() => ({
  slots: [] as unknown[],
  cursor: 0,
  request: vi.fn(),
  onSave: vi.fn(),
  onBusy: vi.fn(),
}));
vi.mock("react", (original) => mockReactHooks(harness)(original));
vi.mock("next/navigation", () => ({ useRouter: () => ({ push: vi.fn(), refresh: vi.fn() }) }));
vi.mock("next/link", () => ({ default: "a" }));
vi.mock("../site/src/lib/organization-workspace-client", () => ({
  organizationRequest: harness.request,
}));

import { OrganizationProfileForm } from "../site/src/components/organization-profile-form";
import { getOrganizationCopy } from "../site/src/lib/organization-workspace-copy";

const { render, edit } = createOrganizationProfileDraftInteractionHelpers(
  harness,
  OrganizationProfileForm,
);

it("hides a draft after rights are revoked until the original actor is verified", async () => {
  const copy = getOrganizationCopy("en");
  edit();
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

it("retains a hidden draft if identity verification is unreadable and permits retry", async () => {
  const copy = getOrganizationCopy("en");
  edit();
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
