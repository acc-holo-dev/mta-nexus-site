import { expect, it, vi } from "vitest";
import {
  createNewResourceSubmissionInteractionHelpers,
  fields,
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

const { render, mount, submit } = createNewResourceSubmissionInteractionHelpers(h, NewResourceForm);

it("keeps the original product request after a lost response and a rate-limited retry", async () => {
  await mount();
  const stale = render().find((node) => node.type === "form")?.props.onSubmit as (
    event: unknown,
  ) => Promise<void>;
  h.fetch.mockRejectedValueOnce(new Error("network lost"));
  await submit();
  const key = "nexus:resource-submission:v1:usr_a";
  const saved = sessionStorage.getItem(key);
  expect(saved).toContain("example-script");
  fields.slug = "changed-slug";
  h.fetch.mockResolvedValueOnce(reply({ code: "RATE_LIMIT_EXCEEDED" }, 429));
  await stale({ preventDefault() {}, currentTarget: {} });
  expect(sessionStorage.getItem(key)).toBe(saved);
  const posts = h.fetch.mock.calls.filter(([path]) => path === "/api/products");
  expect(posts).toHaveLength(2);
  expect(posts[1]?.[1].body).toBe(posts[0]?.[1].body);
  expect(posts[1]?.[1].headers["x-nexus-actor-id"]).toBe("usr_a");
  h.file = new File(["print('changed!')"], "resource.lua");
  await submit();
  expect(h.fetch.mock.calls.filter(([path]) => path === "/api/products")).toHaveLength(2);
});
