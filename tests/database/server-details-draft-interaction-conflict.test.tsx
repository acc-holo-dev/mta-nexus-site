import { expect, it, vi } from "vitest";
import { findTestButton } from "../helpers/flatten-react-test-tree";
import {
  actor,
  createServerDetailsDraftInteractionHelpers,
  later,
  latest,
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
vi.mock("../../apps/web/src/components/locale-context", async () => {
  const { getDictionary } = await import("../../apps/web/src/lib/i18n");
  return {
    useNexusLocale: () => ({ locale: harness.locale, dictionary: getDictionary(harness.locale) }),
  };
});

import { ServerDetailsForm } from "../../apps/web/src/components/server-details-form";
import { getDictionary } from "../../apps/web/src/lib/i18n";

const { render, submit } = createServerDetailsDraftInteractionHelpers(harness, ServerDetailsForm);

it.each(["en", "ru"] as const)(
  "preserves draft and accepts only the checked revision after a conflict in %s",
  async (locale) => {
    harness.locale = locale;
    const copy = getDictionary(locale).serverManagement;
    harness.fetch.mockResolvedValueOnce(response({ code: "SERVER_METADATA_CONFLICT" }, 409));
    const form = render().find((node) => node.type === "form");
    await submit();
    expect(findTestButton(render(), copy.save).props.disabled).toBe(true);
    harness.fetch
      .mockResolvedValueOnce(response({ profile: actor }))
      .mockResolvedValueOnce(response({ actorId: "usr_a", server: latest }));
    (findTestButton(render(), copy.compareLatest).props.onClick as () => void)();
    await vi.waitFor(() => expect(findTestButton(render(), copy.useLatest)).toBeDefined());
    (findTestButton(render(), copy.useLatest).props.onClick as () => void)();
    expect(render().find((node) => node.type === "form")?.key).toBe(form?.key);
    harness.fetch.mockResolvedValueOnce(response({ code: "SERVER_METADATA_CONFLICT" }, 409));
    await submit();
    const init = harness.fetch.mock.calls[3]?.[1] as RequestInit;
    expect(new Headers(init.headers).get("x-nexus-actor-id")).toBe("usr_a");
    expect(JSON.parse(String(init.body))).toMatchObject({
      name: "My draft server",
      expectedUpdatedAt: later,
    });
  },
);
