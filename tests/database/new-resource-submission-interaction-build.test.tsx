import { expect, it, vi } from "vitest";
import {
  createNewResourceSubmissionInteractionHelpers,
  type FakeFormData,
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
vi.mock("../../apps/web/src/components/locale-context", async () => {
  const { getDictionary } = await import("../../apps/web/src/lib/i18n");
  return { useNexusLocale: () => ({ locale: "en", dictionary: getDictionary("en") }) };
});

import { NewResourceForm } from "../../apps/web/src/components/new-resource-form";

const { mount, submit } = createNewResourceSubmissionInteractionHelpers(h, NewResourceForm);

it("keeps the exact build intent after upload loss, reload and 429", async () => {
  await mount();
  h.fetch.mockImplementationOnce(async (_path: string, init: RequestInit) => {
    const request = JSON.parse(String(init.body));
    return reply({ product: { ...request, id: "prd_a", authorId: "usr_a", status: "draft" } }, 201);
  });
  h.fetch.mockRejectedValueOnce(new Error("upload response lost"));
  await submit();
  const key = "nexus:resource-submission:v1:usr_a";
  const saved = sessionStorage.getItem(key);
  expect(saved).toContain("prd_a");
  h.slots = [];
  await mount();
  fields.version = "2.0.0";
  fields.releaseNotes = "Changed notes";
  h.fetch.mockResolvedValueOnce(reply({ code: "RATE_LIMIT_EXCEEDED" }, 429));
  await submit();
  expect(sessionStorage.getItem(key)).toBe(saved);
  const uploads = h.fetch.mock.calls.filter(([path]) => path === "/api/products/prd_a/builds");
  expect(uploads).toHaveLength(2);
  const first = uploads[0]?.[1].body as FakeFormData;
  const second = uploads[1]?.[1].body as FakeFormData;
  expect(second.get("version")).toBe(first.get("version"));
  expect(second.get("releaseNotes")).toBe(first.get("releaseNotes"));
  expect(uploads[1]?.[1].headers["x-nexus-actor-id"]).toBe("usr_a");
});
