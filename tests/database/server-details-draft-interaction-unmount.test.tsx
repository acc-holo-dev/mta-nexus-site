import { expect, it, vi } from "vitest";
import {
  createServerDetailsDraftInteractionHelpers,
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
vi.mock("../../site/src/components/locale-context", async () => {
  const { getDictionary } = await import("../../site/src/lib/i18n");
  return {
    useNexusLocale: () => ({ locale: harness.locale, dictionary: getDictionary(harness.locale) }),
  };
});

import { ServerDetailsForm } from "../../site/src/components/server-details-form";

const { render, submit } = createServerDetailsDraftInteractionHelpers(harness, ServerDetailsForm);

it("ignores a successful response after the editor is removed", async () => {
  harness.locale = "en";
  const nodes = render();
  const cleanup = harness.effect?.();
  let finish!: (value: Response) => void;
  harness.fetch.mockReturnValueOnce(new Promise<Response>((resolve) => (finish = resolve)));
  const pending = submit(nodes);
  if (typeof cleanup === "function") cleanup();
  finish(response({ server: latest }));
  await pending;
  expect(harness.refresh).not.toHaveBeenCalled();
});
