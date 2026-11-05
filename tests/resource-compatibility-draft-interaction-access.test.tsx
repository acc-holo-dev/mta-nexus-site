import { expect, it, vi } from "vitest";
import { findTestButton } from "./helpers/flatten-react-test-tree";
import {
  actor,
  createResourceCompatibilityDraftInteractionHelpers,
  mockReactHooks,
  response,
} from "./helpers/resource-compatibility-draft-interaction-harness";

const harness = vi.hoisted(() => ({
  slots: [] as unknown[],
  cursor: 0,
  fetch: vi.fn(),
  refresh: vi.fn(),
  locale: "en" as "en" | "ru",
}));
vi.mock("react", (original) => mockReactHooks(harness)(original));
vi.mock("next/navigation", () => ({ useRouter: () => ({ refresh: harness.refresh }) }));
vi.mock("../apps/web/src/components/locale-context", () => ({
  useNexusLocale: () => ({ locale: harness.locale }),
}));

import { ResourceCompatibilityForm } from "../apps/web/src/components/resource-compatibility-form";
import { getResourceManagementCopy } from "../apps/web/src/lib/resource-management-i18n";

const { render, edit, submit } = createResourceCompatibilityDraftInteractionHelpers(
  harness,
  ResourceCompatibilityForm,
);

it("keeps a draft available to the verified actor when management access is revoked", async () => {
  harness.locale = "en";
  const copy = getResourceManagementCopy("en");
  edit();
  harness.fetch.mockResolvedValueOnce(response({ code: "NOT_FOUND" }, 404));
  submit();
  await vi.waitFor(() => expect(findTestButton(render(), copy.compatibilityCheck)).toBeDefined());
  harness.fetch
    .mockResolvedValueOnce(response({ profile: actor }))
    .mockResolvedValueOnce(response({ code: "NOT_FOUND" }, 404));
  (findTestButton(render(), copy.compatibilityCheck).props.onClick as () => void)();
  await vi.waitFor(() =>
    expect(render().some((node) => node.props.title === copy.compatibilityCheckFailed)).toBe(true),
  );
  expect(render().find((node) => node.type === "textarea")?.props.value).toBe("my-resource");
  expect(findTestButton(render(), copy.save).props.disabled).toBe(true);
});
