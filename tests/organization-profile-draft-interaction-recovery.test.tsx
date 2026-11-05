import { expect, it, vi } from "vitest";
import { findTestButton } from "./helpers/flatten-react-test-tree";
import {
  actor,
  createOrganizationProfileDraftInteractionHelpers,
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
vi.mock("../apps/web/src/lib/organization-workspace-client", () => ({
  organizationRequest: harness.request,
}));

import { OrganizationProfileForm } from "../apps/web/src/components/organization-profile-form";
import { getOrganizationCopy } from "../apps/web/src/lib/organization-workspace-copy";

const { render, edit, submit } = createOrganizationProfileDraftInteractionHelpers(
  harness,
  OrganizationProfileForm,
);

it("checks the current actor and saved version after an unconfirmed update", async () => {
  const copy = getOrganizationCopy("en");
  edit();
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
