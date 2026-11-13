import { expect, it, vi } from "vitest";
import { findTestButton } from "../helpers/flatten-react-test-tree";
import {
  actor,
  createServerDetailsDraftInteractionHelpers,
  mockReactHooks,
  response,
} from "../helpers/server-details-draft-interaction-harness";

const harness = vi.hoisted(() => ({
  slots: [] as unknown[],
  cursor: 0,
  fetch: vi.fn(),
  refresh: vi.fn(),
  locale: "en" as "en" | "ru",
  effect: null as null | (() => undefined | (() => void)),
}));
vi.mock("react", (original) => mockReactHooks(harness)(original));
vi.mock("next/navigation", () => ({ useRouter: () => ({ refresh: harness.refresh }) }));
vi.mock("../../src/components/locale-context", async () => {
  const { getDictionary } = await import("../../src/lib/i18n");
  return {
    useNexusLocale: () => ({ locale: harness.locale, dictionary: getDictionary(harness.locale) }),
  };
});

import { ServerDetailsForm } from "../../src/components/server-details-form";
import { getDictionary } from "../../src/lib/i18n";

const { render, submit } = createServerDetailsDraftInteractionHelpers(harness, ServerDetailsForm);

it("keeps an unconfirmed draft locked and copyable after access is revoked", async () => {
  harness.locale = "en";
  const copy = getDictionary("en").serverManagement;
  harness.fetch.mockResolvedValueOnce(response({ code: "FORBIDDEN" }, 403));
  await submit();
  harness.fetch
    .mockResolvedValueOnce(response({ profile: actor }))
    .mockResolvedValueOnce(response({ code: "NOT_FOUND" }, 404))
    .mockResolvedValueOnce(response({ profile: actor }));
  (findTestButton(render(), copy.compareLatest).props.onClick as () => void)();
  await vi.waitFor(() =>
    expect(render().some((node) => node.props.title === copy.checkFailed)).toBe(true),
  );
  const form = render().find((node) => node.type === "form");
  expect(form?.props.style).toBeUndefined();
  expect(findTestButton(render(), copy.save).props.disabled).toBe(true);
});
