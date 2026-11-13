import { expect, it, vi } from "vitest";
import {
  createNewResourceSubmissionInteractionHelpers,
  mockReactHooks,
  reply,
} from "../helpers/new-resource-submission-interaction-harness";

const h = vi.hoisted(() => ({
  slots: [] as unknown[],
  cursor: 0,
  effects: [] as (() => unknown)[],
  fetch: vi.fn(),
  file: null as File | null,
}));
vi.mock("react", (original) => mockReactHooks(h)(original));
vi.mock("../../site/src/components/locale-context", async () => {
  const { getDictionary } = await import("../../site/src/lib/i18n");
  return { useNexusLocale: () => ({ locale: "en", dictionary: getDictionary("en") }) };
});

import { NewResourceForm } from "../../site/src/components/new-resource-form";

const { render } = createNewResourceSubmissionInteractionHelpers(h, NewResourceForm);

it("does not expose a saved draft when the signed-in actor changed", async () => {
  h.fetch.mockResolvedValueOnce(reply({ authenticated: true, user: { id: "usr_b" } }));
  render();
  for (const effect of h.effects) effect();
  await vi.waitFor(() =>
    expect(render().some((node) => String(node.props.title).includes("Could not verify"))).toBe(
      true,
    ),
  );
  expect(render().find((node) => node.type === "form")?.props.hidden).toBe(true);
});
