import { expect, it, vi } from "vitest";
import { findTestButton } from "./helpers/flatten-react-test-tree";
import {
  actor,
  createServerDetailsDraftInteractionHelpers,
  latest,
  mockReactHooks,
  response,
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
vi.mock("../apps/web/src/components/locale-context", async () => {
  const { getDictionary } = await import("../apps/web/src/lib/i18n");
  return {
    useNexusLocale: () => ({ locale: harness.locale, dictionary: getDictionary(harness.locale) }),
  };
});

import { ServerDetailsForm } from "../apps/web/src/components/server-details-form";
import { getDictionary } from "../apps/web/src/lib/i18n";

const { render, submit } = createServerDetailsDraftInteractionHelpers(harness, ServerDetailsForm);

it("hides the prior draft when the actor changes during save", async () => {
  harness.locale = "en";
  const copy = getDictionary("en").serverManagement;
  harness.fetch.mockResolvedValueOnce(response({ code: "ACTOR_CHANGED" }, 409));
  await submit();
  expect(render().some((node) => node.type === "form")).toBe(false);
  expect(render().some((node) => node.props.title === copy.actorChanged)).toBe(true);
});

it("closes the draft if the actor changes while saved details are checked", async () => {
  harness.locale = "en";
  const copy = getDictionary("en").serverManagement;
  harness.fetch.mockResolvedValueOnce(response({ code: "SERVER_METADATA_CONFLICT" }, 409));
  await submit();
  harness.fetch
    .mockResolvedValueOnce(response({ profile: actor }))
    .mockResolvedValueOnce(response({ actorId: "usr_other", server: latest }));
  (findTestButton(render(), copy.compareLatest).props.onClick as () => void)();
  await vi.waitFor(() =>
    expect(render().some((node) => node.props.title === copy.actorChanged)).toBe(true),
  );
  expect(render().some((node) => node.type === "form")).toBe(false);
});
