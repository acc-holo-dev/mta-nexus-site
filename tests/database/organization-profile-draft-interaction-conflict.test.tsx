import { expect, it, vi } from "vitest";
import { findTestButton } from "../helpers/flatten-react-test-tree";
import {
  createOrganizationProfileDraftInteractionHelpers,
  latest,
  mockReactHooks,
  remoteNamed,
} from "../helpers/organization-profile-draft-interaction-harness";

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
vi.mock("../../apps/web/src/lib/organization-workspace-client", () => ({
  organizationRequest: harness.request,
}));

import { OrganizationProfileForm } from "../../apps/web/src/components/organization-profile-form";
import { getOrganizationCopy } from "../../apps/web/src/lib/organization-workspace-copy";

const { render, edit, submit } = createOrganizationProfileDraftInteractionHelpers(
  harness,
  OrganizationProfileForm,
);

it.each(["en", "ru"] as const)(
  "keeps an edit when a team change updates the organization revision in %s",
  async (locale) => {
    const copy = getOrganizationCopy(locale);
    edit();
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

it("loads the new fields when there is no local draft to preserve", () => {
  const copy = getOrganizationCopy("en");
  render();
  (findTestButton(render(remoteNamed), copy.profileUseLatest).props.onClick as () => void)();
  expect(
    render(remoteNamed).find((node) => node.props.id === "organization-name")?.props.value,
  ).toBe("Remote organization");
});
