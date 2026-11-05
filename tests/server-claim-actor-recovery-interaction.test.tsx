import type { ReactNode } from "react";
import { afterEach, beforeEach, expect, it, vi } from "vitest";
import { flattenReactTestTree } from "./helpers/flatten-react-test-tree";

const h = vi.hoisted(() => ({
  slots: [] as unknown[],
  cursor: 0,
  effects: [] as (() => unknown)[],
  fetch: vi.fn(),
}));
vi.mock("react", async (original) => ({
  ...(await original<typeof import("react")>()),
  useState: (initial: unknown) => {
    const i = h.cursor++;
    if (!(i in h.slots)) h.slots[i] = typeof initial === "function" ? initial() : initial;
    return [
      h.slots[i],
      (value: unknown) => {
        h.slots[i] = typeof value === "function" ? value(h.slots[i]) : value;
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
vi.mock("next/navigation", () => ({
  usePathname: () => "/servers/demo",
  useRouter: () => ({ refresh: vi.fn() }),
}));
vi.mock("next/link", () => ({ default: ({ children }: { children: ReactNode }) => children }));
vi.mock("../apps/web/src/components/locale-context", async () => {
  const { getDictionary } = await import("../apps/web/src/lib/i18n");
  return { useNexusLocale: () => ({ locale: "en", dictionary: getDictionary("en") }) };
});

import { ServerClaimControlPanel } from "../apps/web/src/components/server-claim-control-panel";

const reply = (body: unknown, status = 200) =>
  new Response(JSON.stringify(body), { status, headers: { "content-type": "application/json" } });
function render(expectedActorId: string | null = "usr_a") {
  h.cursor = 0;
  h.effects = [];
  return flattenReactTestTree(
    ServerClaimControlPanel({
      serverId: "srv_a",
      serverName: "Demo",
      expectedActorId,
    }) as ReactNode,
  );
}
async function mount(expectedActorId: string | null = "usr_a", actor = "usr_a") {
  h.fetch.mockResolvedValueOnce(reply({ authenticated: true, user: { id: actor } }));
  render(expectedActorId);
  for (const effect of h.effects) effect();
  await vi.waitFor(() => expect(h.fetch).toHaveBeenCalled());
}
function click(label: string, expectedActorId: string | null = "usr_a") {
  const button = render(expectedActorId).find(
    (node) => node.type === "button" && node.props.children === label,
  );
  if (!button || typeof button.props.onClick !== "function") throw Error(`Missing ${label}`);
  (button.props.onClick as () => void)();
}
const issueResponse = {
  challenge: {
    challengeId: "scc_00000000-0000-4000-8000-000000000001",
    token: "NXCLAIM-ABCDEF0123456789ABCDEF01",
    expiresAt: "2099-01-01T00:00:00.000Z",
    server: { id: "srv_a" },
  },
};
beforeEach(() => {
  h.slots = [];
  h.cursor = 0;
  h.effects = [];
  h.fetch.mockReset();
  const data = new Map<string, string>();
  vi.stubGlobal("sessionStorage", {
    getItem: (key: string) => data.get(key) ?? null,
    setItem: (key: string, value: string) => data.set(key, value),
    removeItem: (key: string) => data.delete(key),
  });
  vi.stubGlobal("fetch", h.fetch);
});
afterEach(() => vi.unstubAllGlobals());
it("retains an opaque issue marker and blocks retry after lost response and reload", async () => {
  await mount();
  await vi.waitFor(() =>
    expect(
      render().find((node) => node.type === "button" && node.props.onClick)?.props.disabled,
    ).toBe(false),
  );
  h.fetch.mockRejectedValueOnce(new Error("lost"));
  click("Create control challenge");
  await vi.waitFor(() => expect(h.fetch).toHaveBeenCalledTimes(2));
  await vi.waitFor(() =>
    expect(
      render().some(
        (node) =>
          typeof node.props.children === "string" &&
          node.props.children.includes("challenge result is unknown"),
      ),
    ).toBe(true),
  );
  const key = "nexus:server-claim:v1:usr_a:srv_a";
  expect(sessionStorage.getItem(key)).toBe("issue");
  h.slots = [];
  await mount();
  await vi.waitFor(() =>
    expect(
      render().some(
        (node) =>
          typeof node.props.children === "string" &&
          node.props.children.includes("challenge result is unknown"),
      ),
    ).toBe(true),
  );
  expect(
    h.fetch.mock.calls.filter(([url]) => url === "/api/servers/srv_a/claim-challenge"),
  ).toHaveLength(1);
});
it("blocks verification retry after a lost response and retains no plaintext token in storage", async () => {
  await mount();
  await vi.waitFor(() =>
    expect(
      render().find((node) => node.type === "button" && node.props.onClick)?.props.disabled,
    ).toBe(false),
  );
  h.fetch.mockResolvedValueOnce(reply(issueResponse, 201));
  click("Create control challenge");
  await vi.waitFor(() => expect(render().some((node) => node.type === "code")).toBe(true));
  h.fetch.mockRejectedValueOnce(new Error("lost"));
  click("Verify control");
  await vi.waitFor(() =>
    expect(
      render().some(
        (node) =>
          typeof node.props.children === "string" &&
          node.props.children.includes("verification result is unknown"),
      ),
    ).toBe(true),
  );
  const key = "nexus:server-claim:v1:usr_a:srv_a";
  expect(sessionStorage.getItem(key)).toBe("verify");
  expect(sessionStorage.getItem(key)).not.toContain("NXCLAIM");
  h.slots = [];
  await mount();
  await vi.waitFor(() =>
    expect(
      render().some(
        (node) =>
          typeof node.props.children === "string" &&
          node.props.children.includes("verification result is unknown"),
      ),
    ).toBe(true),
  );
  expect(
    h.fetch.mock.calls.filter(([url]) => url === "/api/servers/srv_a/claim-challenge/verify"),
  ).toHaveLength(1);
});
it("does not issue under a different account or when marker storage fails", async () => {
  await mount("usr_a", "usr_b");
  await vi.waitFor(() =>
    expect(
      render("usr_a").some(
        (node) =>
          typeof node.props.title === "string" && node.props.title.includes("Could not check"),
      ),
    ).toBe(true),
  );
  expect(h.fetch).toHaveBeenCalledTimes(1);
  h.slots = [];
  h.fetch.mockReset();
  await mount();
  await vi.waitFor(() =>
    expect(
      render().find((node) => node.type === "button" && node.props.onClick)?.props.disabled,
    ).toBe(false),
  );
  vi.stubGlobal("sessionStorage", {
    getItem: () => null,
    setItem: () => {
      throw Error("denied");
    },
    removeItem: () => {},
  });
  click("Create control challenge");
  expect(h.fetch).toHaveBeenCalledTimes(1);
});
function attachWindowEvents() {
  const listeners = new Map<string, () => void>();
  vi.stubGlobal("window", {
    addEventListener: (name: string, callback: () => void) =>
      listeners.set(`window:${name}`, callback),
    removeEventListener: () => {},
  });
  vi.stubGlobal("document", {
    visibilityState: "visible",
    addEventListener: (name: string, callback: () => void) =>
      listeners.set(`document:${name}`, callback),
    removeEventListener: () => {},
  });
  render();
  const effect = h.effects[1];
  if (!effect) throw Error("Missing identity effect");
  effect();
  return listeners;
}
it("conceals the token on blur and clears it when focus returns under another account", async () => {
  await mount();
  await vi.waitFor(() =>
    expect(
      render().find((node) => node.type === "button" && node.props.onClick)?.props.disabled,
    ).toBe(false),
  );
  h.fetch.mockResolvedValueOnce(reply(issueResponse, 201));
  click("Create control challenge");
  await vi.waitFor(() => expect(render().some((node) => node.type === "code")).toBe(true));
  const listeners = attachWindowEvents();
  const blur = listeners.get("window:blur");
  if (!blur) throw Error("Missing blur");
  blur();
  expect(render().some((node) => node.type === "code")).toBe(false);
  h.fetch.mockResolvedValueOnce(reply({ authenticated: true, user: { id: "usr_b" } }));
  const focus = listeners.get("window:focus");
  if (!focus) throw Error("Missing focus");
  focus();
  await vi.waitFor(() =>
    expect(
      render().some(
        (node) =>
          typeof node.props.children === "string" &&
          node.props.children.includes("challenge result is unknown"),
      ),
    ).toBe(true),
  );
  expect(render().some((node) => node.type === "code")).toBe(false);
  expect(sessionStorage.getItem("nexus:server-claim:v1:usr_a:srv_a")).toBe("issued");
});
it("drops the token after an actor-changed verification response", async () => {
  await mount();
  await vi.waitFor(() =>
    expect(
      render().find((node) => node.type === "button" && node.props.onClick)?.props.disabled,
    ).toBe(false),
  );
  h.fetch.mockResolvedValueOnce(reply(issueResponse, 201));
  click("Create control challenge");
  await vi.waitFor(() => expect(render().some((node) => node.type === "code")).toBe(true));
  h.fetch.mockResolvedValueOnce(reply({ code: "ACTOR_CHANGED" }, 409));
  click("Verify control");
  await vi.waitFor(() =>
    expect(
      render().some(
        (node) =>
          typeof node.props.children === "string" &&
          node.props.children.includes("challenge result is unknown"),
      ),
    ).toBe(true),
  );
  expect(render().some((node) => node.type === "code")).toBe(false);
});
it("does not insert a late issue token after the tab loses focus", async () => {
  await mount();
  await vi.waitFor(() =>
    expect(
      render().find((node) => node.type === "button" && node.props.onClick)?.props.disabled,
    ).toBe(false),
  );
  const listeners = attachWindowEvents();
  let complete!: (value: Response) => void;
  h.fetch.mockReturnValueOnce(
    new Promise<Response>((resolve) => {
      complete = resolve;
    }),
  );
  click("Create control challenge");
  const blur = listeners.get("window:blur");
  if (!blur) throw Error("Missing blur");
  blur();
  complete(reply(issueResponse, 201));
  await vi.waitFor(() =>
    expect(
      render().some(
        (node) =>
          typeof node.props.children === "string" &&
          node.props.children.includes("challenge result is unknown"),
      ),
    ).toBe(true),
  );
  expect(render().some((node) => node.type === "code")).toBe(false);
});
