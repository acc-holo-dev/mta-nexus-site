import { expect, it, vi } from "vitest";
import { findTestButton } from "../helpers/flatten-react-test-tree";
import {
  actor,
  createResourceVariantsDraftInteractionHelpers,
  latestOtherAnchor,
  mockReactHooks,
  response,
} from "../helpers/resource-variants-draft-interaction-harness";

const harness = vi.hoisted(() => ({
  slots: [] as unknown[],
  cursor: 0,
  fetch: vi.fn(),
  locale: "en" as "en" | "ru",
}));
vi.mock("react", (original) => mockReactHooks(harness)(original));
vi.mock("../../src/components/locale-context", () => ({
  useNexusLocale: () => ({ locale: harness.locale }),
}));

import { ResourceVariantsForm } from "../../src/features/resources/components/resource-variants-form";
import { getResourceManagementCopy } from "../../src/lib/resource-management-i18n";

const { render, edit, submit } = createResourceVariantsDraftInteractionHelpers(
  harness,
  ResourceVariantsForm,
);

it("keeps the draft for the verified actor when group access is revoked", async () => {
  harness.locale = "en";
  const copy = getResourceManagementCopy("en");
  edit();
  harness.fetch.mockResolvedValueOnce(response({ code: "NOT_FOUND" }, 404));
  submit();
  await vi.waitFor(() => expect(findTestButton(render(), copy.variantsCheck)).toBeDefined());
  harness.fetch
    .mockResolvedValueOnce(response({ profile: actor }))
    .mockResolvedValueOnce(response({ code: "NOT_FOUND" }, 404))
    .mockResolvedValueOnce(response({ profile: actor }));
  (findTestButton(render(), copy.variantsCheck).props.onClick as () => void)();
  await vi.waitFor(() =>
    expect(render().some((node) => node.props.title === copy.variantsCheckFailed)).toBe(true),
  );
  expect(render().find((node) => node.props.id === "variants-field-title")?.props.value).toBe(
    "My draft group",
  );
  expect(findTestButton(render(), copy.save).props.disabled).toBe(true);
});

it("keeps the draft but does not accept a group whose anchor changed", async () => {
  harness.locale = "en";
  const copy = getResourceManagementCopy("en");
  edit();
  harness.fetch.mockResolvedValueOnce(response({ code: "RESOURCE_VARIANTS_CONFLICT" }, 409));
  submit();
  await vi.waitFor(() => expect(findTestButton(render(), copy.variantsCheck)).toBeDefined());
  harness.fetch
    .mockResolvedValueOnce(response({ profile: actor }))
    .mockResolvedValueOnce(response(latestOtherAnchor, 200, "usr_a"));
  (findTestButton(render(), copy.variantsCheck).props.onClick as () => void)();
  await vi.waitFor(() =>
    expect(render().some((node) => node.props.children === copy.variantsAnchorChanged)).toBe(true),
  );
  expect(
    render().some(
      (node) => node.type === "button" && node.props.children === copy.variantsUseLatest,
    ),
  ).toBe(false);
  expect(render().find((node) => node.props.id === "variants-field-title")?.props.value).toBe(
    "My draft group",
  );
});
