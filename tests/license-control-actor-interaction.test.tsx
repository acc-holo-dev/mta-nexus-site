import type { ReactNode } from "react";
import { afterEach, beforeEach, expect, it, vi } from "vitest";
import { flattenReactTestTree } from "./helpers/flatten-react-test-tree";
const h = vi.hoisted(() => ({
  slots: [] as unknown[],
  cursor: 0,
  fetch: vi.fn(),
  refresh: vi.fn(),
  actor: "usr_a",
  effects: [] as (() => unknown)[],
  blur: undefined as undefined | (() => void),
  visibility: undefined as undefined | (() => void),
  owner: false,
  unbound: false,
}));
vi.mock("react", async (original) => ({
  ...(await original<typeof import("react")>()),
  useId: () => "control",
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
vi.mock("next/navigation", () => ({ useRouter: () => ({ refresh: h.refresh }) }));
vi.mock("../apps/web/src/components/locale-context", () => ({
  useNexusLocale: () => ({ locale: "en" }),
}));
import { LicenseControlPanel } from "../apps/web/src/components/license-control-panel";
const license = {
  id: "lic_a",
  status: "active",
  effectiveStatus: "active",
  updatedAt: "2026-10-10T00:00:00.000Z",
  expiresAt: "2099-01-01T00:00:00.000Z",
  canActivate: true,
  bindingReady: true,
  boundServerId: "srv_a",
};
function render() {
  h.cursor = 0;
  h.effects = [];
  return flattenReactTestTree(
    LicenseControlPanel({
      actorId: h.actor,
      license: h.unbound ? { ...license, boundServerId: null } : license,
      moderation: !h.owner,
    }) as ReactNode,
  );
}
function prepare() {
  const text = render().find((n) => n.type === "textarea");
  if (!text) throw new Error("Missing reason");
  (text.props.onChange as (event: unknown) => void)({ target: { value: "Valid reason" } });
  const checkbox = render().find((n) => n.type === "input" && n.props.type === "checkbox");
  if (!checkbox) throw new Error("Missing confirmation");
  (checkbox.props.onChange as (event: unknown) => void)({ target: { checked: true } });
}
function submit() {
  const form = render().find((n) => n.type === "form");
  if (!form) throw new Error("Missing form");
  return (form.props.onSubmit as (event: unknown) => Promise<void>)({ preventDefault() {} });
}
beforeEach(() => {
  h.slots = [];
  h.actor = "usr_a";
  h.effects = [];
  h.blur = undefined;
  h.visibility = undefined;
  h.owner = false;
  h.unbound = false;
  h.fetch.mockReset();
  h.refresh.mockReset();
  vi.stubGlobal("fetch", h.fetch);
  vi.stubGlobal("document", {
    visibilityState: "hidden",
    addEventListener: (_: string, callback: () => void) => {
      h.visibility = callback;
    },
    removeEventListener: () => {},
  });
  vi.stubGlobal("window", {
    addEventListener: (name: string, callback: () => void) => {
      if (name === "blur") h.blur = callback;
    },
    removeEventListener: () => {},
    location: { reload: () => {} },
  });
});
afterEach(() => vi.unstubAllGlobals());
it("uses the original actor and rejects a late response after a different actor appears", async () => {
  let complete!: (value: unknown) => void;
  h.fetch.mockReturnValueOnce(
    new Promise((resolve) => {
      complete = resolve;
    }),
  );
  prepare();
  const pending = submit();
  expect(h.fetch.mock.calls[0][1].headers["x-nexus-actor-id"]).toBe("usr_a");
  h.actor = "usr_b";
  expect(render()).toHaveLength(0);
  complete({
    ok: true,
    status: 200,
    json: async () => ({
      actorId: "usr_a",
      license: {
        id: "lic_a",
        status: "suspended",
        serverBound: true,
        updatedAt: "2026-10-10T01:00:00.000Z",
      },
    }),
  });
  await pending;
  expect(h.refresh).not.toHaveBeenCalled();
});
it("does not confirm a valid receipt for another actor", async () => {
  h.fetch.mockResolvedValueOnce({
    ok: true,
    status: 200,
    json: async () => ({
      actorId: "usr_b",
      license: {
        id: "lic_a",
        status: "suspended",
        serverBound: true,
        updatedAt: "2026-10-10T01:00:00.000Z",
      },
    }),
  });
  prepare();
  await submit();
  expect(h.refresh).not.toHaveBeenCalled();
});

it("conceals an in-flight result on blur and asks to refresh the uncertain state", async () => {
  let complete!: (value: unknown) => void;
  h.fetch.mockReturnValueOnce(
    new Promise((resolve) => {
      complete = resolve;
    }),
  );
  render();
  for (const effect of h.effects) effect();
  prepare();
  const pending = submit();
  if (!h.blur) throw new Error("Missing blur handler");
  h.blur();
  complete({
    ok: true,
    status: 200,
    json: async () => ({
      actorId: "usr_a",
      license: {
        id: "lic_a",
        status: "suspended",
        serverBound: true,
        updatedAt: "2026-10-10T01:00:00.000Z",
      },
    }),
  });
  await pending;
  expect(h.refresh).not.toHaveBeenCalled();
  expect(
    render().some(
      (n) => n.props.title === "The change could not be confirmed. Refresh before trying again.",
    ),
  ).toBe(true);
});
it("conceals a displayed owner runtime token when the document becomes hidden", async () => {
  h.owner = true;
  render();
  for (const effect of h.effects) effect();
  const updatedAt = new Date().toISOString();
  const expiresAt = new Date(Date.now() + 86_400_000).toISOString();
  const token = `nxlt_${"A".repeat(43)}`;
  h.fetch.mockResolvedValueOnce({
    ok: true,
    status: 200,
    json: async () => ({
      actorId: "usr_a",
      license: { id: "lic_a", status: "active", serverBound: true, updatedAt },
      token: { value: token, expiresAt },
    }),
  });
  prepare();
  await submit();
  expect(render().some((n) => n.type === "input" && n.props.value === token)).toBe(true);
  if (!h.visibility) throw new Error("Missing visibility handler");
  h.visibility();
  expect(render().some((n) => n.type === "input" && n.props.value === token)).toBe(false);
});
it("does not show a late owner runtime token after another identity renders", async () => {
  h.owner = true;
  let complete!: (value: unknown) => void;
  h.fetch.mockReturnValueOnce(
    new Promise((resolve) => {
      complete = resolve;
    }),
  );
  prepare();
  const pending = submit();
  h.actor = "usr_b";
  render();
  complete({
    ok: true,
    status: 200,
    json: async () => ({
      actorId: "usr_a",
      license: {
        id: "lic_a",
        status: "active",
        serverBound: true,
        updatedAt: new Date().toISOString(),
      },
      token: {
        value: `nxlt_${"A".repeat(43)}`,
        expiresAt: new Date(Date.now() + 86_400_000).toISOString(),
      },
    }),
  });
  await pending;
  expect(render().some((n) => n.type === "input" && n.props.type === "password")).toBe(false);
});

it("does not display a server list returned for another actor", async () => {
  h.owner = true;
  h.unbound = true;
  h.fetch.mockResolvedValueOnce({
    ok: true,
    status: 200,
    json: async () => ({
      actorId: "usr_b",
      servers: [{ id: "srv_foreign", name: "Private B server" }],
      page: 1,
      totalPages: 1,
    }),
  });
  const button = render().find((n) => n.type === "button" && n.props.children === "Refresh");
  if (!button) throw new Error("Missing server refresh");
  (button.props.onClick as () => void)();
  await vi.waitFor(() => expect(h.fetch).toHaveBeenCalledOnce());
  await vi.waitFor(() => expect(render().some((n) => n.props.title)).toBe(true));
  expect(h.fetch.mock.calls[0][1].headers["x-nexus-actor-id"]).toBe("usr_a");
  expect(render().some((n) => n.props.children === "Private B server")).toBe(false);
});
