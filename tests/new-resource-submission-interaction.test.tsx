import type { ReactNode } from "react";
import { afterEach, beforeEach, expect, it, vi } from "vitest";
import { flattenReactTestTree } from "./helpers/flatten-react-test-tree";

const h = vi.hoisted(() => ({
  slots: [] as unknown[],
  cursor: 0,
  effects: [] as (() => unknown)[],
  fetch: vi.fn(),
  file: null as File | null,
}));
vi.mock("react", async (original) => ({
  ...(await original<typeof import("react")>()),
  useState: (initial: unknown) => {
    const index = h.cursor++;
    if (!(index in h.slots)) h.slots[index] = typeof initial === "function" ? initial() : initial;
    return [
      h.slots[index],
      (value: unknown) => {
        h.slots[index] = typeof value === "function" ? value(h.slots[index]) : value;
      },
    ];
  },
  useRef: (value: unknown) => {
    const index = h.cursor++;
    if (!(index in h.slots)) h.slots[index] = { current: value };
    return h.slots[index];
  },
  useEffect: (effect: () => unknown) => {
    h.effects.push(effect);
  },
}));
vi.mock("../apps/web/src/components/locale-context", async () => {
  const { getDictionary } = await import("../apps/web/src/lib/i18n");
  return { useNexusLocale: () => ({ locale: "en", dictionary: getDictionary("en") }) };
});

import { NewResourceForm } from "../apps/web/src/components/new-resource-form";

const reply = (value: unknown, status = 200) =>
  new Response(JSON.stringify(value), { status, headers: { "content-type": "application/json" } });
const fields: Record<string, string> = {
  title: "Example script",
  slug: "example-script",
  shortDescription: "Summary",
  description: "A detailed resource description.",
  type: "script",
  tags: "lua",
  mtaMinVersion: "1.6.0",
  dependencies: "",
  version: "1.0.0",
  releaseNotes: "Original notes",
};
class FakeFormData {
  private values = new Map<string, unknown>();
  constructor(form?: unknown) {
    if (form) {
      for (const [key, value] of Object.entries(fields)) this.values.set(key, value);
      this.values.set("file", h.file);
    }
  }
  get(name: string) {
    return this.values.get(name) ?? null;
  }
  set(name: string, value: unknown) {
    this.values.set(name, value);
  }
}
function render() {
  h.cursor = 0;
  h.effects = [];
  return flattenReactTestTree(NewResourceForm({ actorId: "usr_a" }) as ReactNode);
}
async function mount() {
  h.fetch.mockResolvedValueOnce(reply({ authenticated: true, user: { id: "usr_a" } }));
  render();
  for (const effect of h.effects) effect();
  await vi.waitFor(() =>
    expect(render().find((node) => node.type === "form")?.props.hidden).toBe(false),
  );
}
async function submit() {
  const form = render().find((node) => node.type === "form");
  if (!form) throw Error("Missing form");
  await (form.props.onSubmit as (event: unknown) => Promise<void>)({
    preventDefault() {},
    currentTarget: {},
  });
}
beforeEach(() => {
  h.slots = [];
  h.effects = [];
  h.fetch.mockReset();
  h.file = new File(["print('original')"], "resource.lua");
  const data = new Map<string, string>();
  vi.stubGlobal("sessionStorage", {
    getItem: (key: string) => data.get(key) ?? null,
    setItem: (key: string, value: string) => data.set(key, value),
    removeItem: (key: string) => data.delete(key),
  });
  vi.stubGlobal("fetch", h.fetch);
  vi.stubGlobal("FormData", FakeFormData);
});
afterEach(() => vi.unstubAllGlobals());
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
  fields.slug = "example-script";
});
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
  fields.version = "1.0.0";
  fields.releaseNotes = "Original notes";
});

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
