import { expect, it, vi } from "vitest";
import {
  createNewResourceSubmissionInteractionHelpers,
  mockReactHooks,
} from "../helpers/new-resource-submission-interaction-harness";

const h = vi.hoisted(() => ({
  slots: [] as unknown[],
  cursor: 0,
  effects: [] as (() => unknown)[],
  fetch: vi.fn(),
  file: null as File | null,
}));
vi.mock("react", (original) => mockReactHooks(h)(original));
vi.mock("../../apps/web/src/components/locale-context", async () => {
  const { getDictionary } = await import("../../apps/web/src/lib/i18n");
  return { useNexusLocale: () => ({ locale: "en", dictionary: getDictionary("en") }) };
});

import { NewResourceForm } from "../../apps/web/src/components/new-resource-form";

const { render, mount, submit } = createNewResourceSubmissionInteractionHelpers(h, NewResourceForm);

it("does not submit when recovery storage is unavailable", async () => {
  await mount();
  vi.stubGlobal("sessionStorage", {
    getItem: () => null,
    setItem: () => {
      throw new Error("blocked");
    },
    removeItem: () => {},
  });
  await submit();
  expect(h.fetch.mock.calls.filter(([path]) => path === "/api/products")).toHaveLength(0);
  expect(
    render().some((node) => String(node.props.title).includes("Submission was not started")),
  ).toBe(true);
});
