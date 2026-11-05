import type { ReactNode } from "react";
import { afterEach, beforeEach, expect, it, vi } from "vitest";
import { findTestButton, flattenReactTestTree } from "./helpers/flatten-react-test-tree";

const h = vi.hoisted(() => ({
  slots: [] as unknown[],
  cursor: 0,
  effects: [] as (() => unknown)[],
  fetch: vi.fn(),
  locale: "en" as "en" | "ru",
}));
vi.mock("react", async (original) => ({
  ...(await original<typeof import("react")>()),
  useState: (initial: unknown) => {
    const i = h.cursor++;
    if (!(i in h.slots)) h.slots[i] = typeof initial === "function" ? initial() : initial;
    return [
      h.slots[i],
      (v: unknown) => {
        h.slots[i] = typeof v === "function" ? v(h.slots[i]) : v;
      },
    ];
  },
  useRef: (initial: unknown) => {
    const i = h.cursor++;
    if (!(i in h.slots)) h.slots[i] = { current: initial };
    return h.slots[i];
  },
  useEffect: (effect: () => unknown) => {
    h.effects.push(effect);
  },
}));
vi.mock("../apps/web/src/components/locale-context", async () => {
  const { getDictionary } = await import("../apps/web/src/lib/i18n");
  return { useNexusLocale: () => ({ locale: h.locale, dictionary: getDictionary(h.locale) }) };
});

import { RegisterServerForm } from "../apps/web/src/components/register-server-form";

const response = (body: unknown, status = 200) =>
  new Response(JSON.stringify(body), { status, headers: { "content-type": "application/json" } });
class TestFormData {
  get(name: string) {
    return (
      (
        { name: "My Server", slug: "my-server", ipAddress: "198.51.100.1" } as Record<
          string,
          string
        >
      )[name] ?? null
    );
  }
  *entries() {
    yield* Object.entries({ name: "My Server", slug: "my-server", ipAddress: "198.51.100.1" });
  }
}
function render() {
  h.cursor = 0;
  h.effects = [];
  return flattenReactTestTree(RegisterServerForm({ actorId: "usr_a" }) as ReactNode);
}
async function mount() {
  h.fetch.mockImplementation(async (url: string) =>
    url === "/api/auth/session"
      ? response({ authenticated: true, user: { id: "usr_a" } })
      : response({ organizations: [] }),
  );
  render();
  for (const effect of h.effects) effect();
  await vi.waitFor(() => expect(render().find((n) => n.type === "form")?.props.hidden).toBe(false));
}
async function submit() {
  const form = render().find((n) => n.type === "form");
  if (!form) throw new Error("Missing form");
  await (form.props.onSubmit as (e: unknown) => Promise<void>)({
    preventDefault() {},
    currentTarget: {},
  });
}
beforeEach(() => {
  h.slots = [];
  h.locale = "en";
  h.cursor = 0;
  h.effects = [];
  h.fetch.mockReset();
  const data = new Map<string, string>();
  vi.stubGlobal("sessionStorage", {
    getItem: (k: string) => data.get(k) ?? null,
    setItem: (k: string, v: string) => data.set(k, v),
    removeItem: (k: string) => data.delete(k),
  });
  vi.stubGlobal("fetch", h.fetch);
  vi.stubGlobal("FormData", TestFormData);
});
afterEach(() => vi.unstubAllGlobals());
it("keeps a lost request blocked across reload and does not retry when recovery is inconclusive", async () => {
  await mount();
  h.fetch.mockRejectedValueOnce(new Error("lost response"));
  await submit();
  const saved = sessionStorage.getItem("nexus:server-registration:v1:usr_a");
  expect(saved).toBeTruthy();
  expect(findTestButton(render(), "Create listing").props.disabled).toBe(true);
  h.slots = [];
  await mount();
  expect(findTestButton(render(), "Create listing").props.disabled).toBe(true);
  h.fetch.mockResolvedValueOnce(response({ server: null }));
  const check = findTestButton(render(), "Check result");
  expect(check.props.disabled).toBe(false);
  await (check.props.onClick as () => Promise<void>)();
  expect(sessionStorage.getItem("nexus:server-registration:v1:usr_a")).toBe(saved);
  expect(findTestButton(render(), "Create listing").props.disabled).toBe(true);
  expect(h.fetch.mock.calls.filter(([url]) => url === "/api/servers")).toHaveLength(1);
});

it("does not display a saved draft to a different signed-in actor", async () => {
  sessionStorage.setItem(
    "nexus:server-registration:v1:usr_a",
    JSON.stringify({ actorId: "usr_a", nonce: "a".repeat(32), fields: { name: "Private draft" } }),
  );
  h.fetch.mockImplementation(async (url: string) =>
    url === "/api/auth/session"
      ? response({ authenticated: true, user: { id: "usr_b" } })
      : response({ organizations: [] }),
  );
  render();
  for (const effect of h.effects) effect();
  await vi.waitFor(() =>
    expect(
      render().some(
        (node) =>
          node.props.role === "status" && String(node.props.children).includes("Could not verify"),
      ),
    ).toBe(true),
  );
  expect(render().find((n) => n.type === "form")?.props.hidden).toBe(true);
  expect(sessionStorage.getItem("nexus:server-registration:v1:usr_a")).toContain("Private draft");
});

it("explains an inconclusive recovery in Russian without enabling another creation", async () => {
  h.locale = "ru";
  await mount();
  h.fetch.mockRejectedValueOnce(new Error("lost response"));
  await submit();
  h.fetch.mockResolvedValueOnce(response({ server: null }));
  const check = findTestButton(render(), "Проверить результат");
  await (check.props.onClick as () => Promise<void>)();
  expect(
    render().some(
      (node) =>
        node.props.role === "status" &&
        String(node.props.children).includes("Запись пока не подтверждена"),
    ),
  ).toBe(true);
  expect(findTestButton(render(), "Создать карточку").props.disabled).toBe(true);
});
