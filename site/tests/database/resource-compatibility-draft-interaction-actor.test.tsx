import { expect, it, vi } from "vitest";
import { findTestButton } from "../helpers/flatten-react-test-tree";
import {
  actor,
  createResourceCompatibilityDraftInteractionHelpers,
  latest,
  mockReactHooks,
  response,
} from "../helpers/resource-compatibility-draft-interaction-harness";

const harness = vi.hoisted(() => ({
  slots: [] as unknown[],
  cursor: 0,
  fetch: vi.fn(),
  refresh: vi.fn(),
  locale: "en" as "en" | "ru",
}));
vi.mock("react", (original) => mockReactHooks(harness)(original));
vi.mock("next/navigation", () => ({ useRouter: () => ({ refresh: harness.refresh }) }));
vi.mock("../../src/components/locale-context", () => ({
  useNexusLocale: () => ({ locale: harness.locale }),
}));

import { ResourceCompatibilityForm } from "../../src/features/resources/components/resource-compatibility-form";
import { getResourceManagementCopy } from "../../src/lib/resource-management-i18n";

const { render, edit, submit } = createResourceCompatibilityDraftInteractionHelpers(
  harness,
  ResourceCompatibilityForm,
);

it("closes the previous draft if either identity check detects a different actor", async () => {
  harness.locale = "en";
  const copy = getResourceManagementCopy("en");
  edit();
  harness.fetch.mockResolvedValueOnce(response({ code: "PRODUCT_METADATA_CONFLICT" }, 409));
  submit();
  await vi.waitFor(() => expect(findTestButton(render(), copy.compatibilityCheck)).toBeDefined());
  harness.fetch
    .mockResolvedValueOnce(response({ profile: actor }))
    .mockResolvedValueOnce(response({ actorId: "usr_other", product: latest }));
  (findTestButton(render(), copy.compatibilityCheck).props.onClick as () => void)();
  await vi.waitFor(() =>
    expect(render().some((node) => node.props.title === copy.compatibilityIdentityChanged)).toBe(
      true,
    ),
  );
  expect(render().some((node) => node.type === "textarea")).toBe(false);
});

it("closes the draft when the server detects an actor change during the write", async () => {
  harness.locale = "en";
  const copy = getResourceManagementCopy("en");
  edit();
  harness.fetch.mockResolvedValueOnce(response({ code: "ACTOR_CHANGED" }, 409));
  submit();
  await vi.waitFor(() =>
    expect(render().some((node) => node.props.title === copy.compatibilityIdentityChanged)).toBe(
      true,
    ),
  );
  expect(render().some((node) => node.type === "textarea")).toBe(false);
  expect(
    render().some(
      (node) => node.type === "button" && node.props.children === copy.compatibilityCheck,
    ),
  ).toBe(false);
});
