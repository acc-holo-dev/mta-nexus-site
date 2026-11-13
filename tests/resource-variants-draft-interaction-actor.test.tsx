import { expect, it, vi } from "vitest";
import { findTestButton } from "./helpers/flatten-react-test-tree";
import {
  actor,
  createResourceVariantsDraftInteractionHelpers,
  latest,
  mockReactHooks,
  response,
} from "./helpers/resource-variants-draft-interaction-harness";

const harness = vi.hoisted(() => ({
  slots: [] as unknown[],
  cursor: 0,
  fetch: vi.fn(),
  locale: "en" as "en" | "ru",
}));
vi.mock("react", (original) => mockReactHooks(harness)(original));
vi.mock("../site/src/components/locale-context", () => ({
  useNexusLocale: () => ({ locale: harness.locale }),
}));

import { ResourceVariantsForm } from "../site/src/components/resource-variants-form";
import { getResourceManagementCopy } from "../site/src/lib/resource-management-i18n";

const { render, edit, submit } = createResourceVariantsDraftInteractionHelpers(
  harness,
  ResourceVariantsForm,
);

it("hides the prior draft when the active actor changes during the write", async () => {
  harness.locale = "en";
  const copy = getResourceManagementCopy("en");
  edit();
  harness.fetch.mockResolvedValueOnce(response({ code: "ACTOR_CHANGED" }, 409));
  submit();
  await vi.waitFor(() =>
    expect(render().some((node) => node.props.title === copy.variantsIdentityChanged)).toBe(true),
  );
  expect(render().some((node) => node.props.id === "variants-field-title")).toBe(false);
});

it("closes a draft when the actor changes between identity and group reads", async () => {
  harness.locale = "en";
  const copy = getResourceManagementCopy("en");
  edit();
  harness.fetch.mockResolvedValueOnce(response({ code: "RESOURCE_VARIANTS_CONFLICT" }, 409));
  submit();
  await vi.waitFor(() => expect(findTestButton(render(), copy.variantsCheck)).toBeDefined());
  harness.fetch
    .mockResolvedValueOnce(response({ profile: actor }))
    .mockResolvedValueOnce(response(latest, 200, "usr_other"));
  (findTestButton(render(), copy.variantsCheck).props.onClick as () => void)();
  await vi.waitFor(() =>
    expect(render().some((node) => node.props.title === copy.variantsIdentityChanged)).toBe(true),
  );
  expect(render().some((node) => node.props.id === "variants-field-title")).toBe(false);
});

it("does not reveal the draft if the actor changes after access is denied", async () => {
  harness.locale = "en";
  const copy = getResourceManagementCopy("en");
  edit();
  harness.fetch.mockResolvedValueOnce(response({ code: "NOT_FOUND" }, 404));
  submit();
  await vi.waitFor(() => expect(findTestButton(render(), copy.variantsCheck)).toBeDefined());
  harness.fetch
    .mockResolvedValueOnce(response({ profile: actor }))
    .mockResolvedValueOnce(response({ code: "NOT_FOUND" }, 404))
    .mockResolvedValueOnce(response({ profile: { ...actor, id: "usr_other" } }));
  (findTestButton(render(), copy.variantsCheck).props.onClick as () => void)();
  await vi.waitFor(() =>
    expect(render().some((node) => node.props.title === copy.variantsIdentityChanged)).toBe(true),
  );
  expect(render().some((node) => node.props.id === "variants-field-title")).toBe(false);
});
