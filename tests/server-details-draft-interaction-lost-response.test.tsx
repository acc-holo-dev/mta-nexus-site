import { expect, it, vi } from "vitest";
import { findTestButton } from "./helpers/flatten-react-test-tree";
import {
  createServerDetailsDraftInteractionHelpers,
  mockReactHooks,
} from "./helpers/server-details-draft-interaction-harness";

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
vi.mock("../site/src/components/locale-context", async () => {
  const { getDictionary } = await import("../site/src/lib/i18n");
  return {
    useNexusLocale: () => ({ locale: harness.locale, dictionary: getDictionary(harness.locale) }),
  };
});

import { ServerDetailsForm } from "../site/src/components/server-details-form";
import { getDictionary } from "../site/src/lib/i18n";

const { render, submit } = createServerDetailsDraftInteractionHelpers(harness, ServerDetailsForm);

it("requires checking after a lost response and never resends automatically", async () => {
  harness.locale = "en";
  const copy = getDictionary("en").serverManagement;
  harness.fetch.mockRejectedValueOnce(new Error("response lost"));
  await submit();
  expect(findTestButton(render(), copy.save).props.disabled).toBe(true);
  expect(findTestButton(render(), copy.compareLatest)).toBeDefined();
  await submit();
  expect(harness.fetch).toHaveBeenCalledTimes(1);
});
