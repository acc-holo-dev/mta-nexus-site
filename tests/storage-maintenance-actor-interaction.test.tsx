import type { ReactNode } from "react";
import { afterEach, beforeEach, expect, it, vi } from "vitest";
import { flattenReactTestTree } from "./helpers/flatten-react-test-tree";
const h = vi.hoisted(() => ({
  slots: [] as unknown[],
  cursor: 0,
  fetch: vi.fn(),
  refresh: vi.fn(),
  actor: "usr_a",
}));
vi.mock("react", async (original) => ({
  ...(await original<typeof import("react")>()),
  useState: (initial: unknown) => {
    const i = h.cursor++;
    if (!(i in h.slots)) h.slots[i] = initial;
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
  useEffect: () => {},
}));
vi.mock("next/navigation", () => ({ useRouter: () => ({ refresh: h.refresh }) }));
import {
  StorageCleanupControls,
  StorageDiscoveryControls,
} from "../apps/web/src/components/storage-maintenance-controls";
function renderCleanup() {
  h.cursor = 0;
  return flattenReactTestTree(
    StorageCleanupControls({
      actorId: h.actor,
      id: "smo_a",
      revision: 1,
      locale: "en",
    }) as ReactNode,
  );
}
function renderDiscovery() {
  h.cursor = 0;
  return flattenReactTestTree(
    StorageDiscoveryControls({ actorId: h.actor, locale: "en" }) as ReactNode,
  );
}
const reply = (value: unknown) => new Response(JSON.stringify(value), { status: 200 });
function check() {
  const input = renderCleanup().find((n) => n.type === "input" && n.props.type === "checkbox");
  if (!input) throw Error("Missing confirmation");
  (input.props.onChange as (event: unknown) => void)({ target: { checked: true } });
}
function click(nodes: ReturnType<typeof renderCleanup>, label: string) {
  const button = nodes.find((n) => n.type === "button" && n.props.children === label);
  if (!button) throw Error(`Missing ${label}`);
  (button.props.onClick as () => void)();
}
beforeEach(() => {
  h.slots = [];
  h.actor = "usr_a";
  h.fetch.mockReset();
  h.refresh.mockReset();
  vi.stubGlobal("fetch", h.fetch);
});
afterEach(() => vi.unstubAllGlobals());
it("blocks cleanup after an unconfirmed response and binds the original actor", async () => {
  h.fetch.mockResolvedValueOnce(reply({ actorId: "usr_b", state: "deleted" }));
  check();
  click(renderCleanup(), "Delete this object");
  await vi.waitFor(() => expect(renderCleanup().some((n) => n.props.title)).toBe(true));
  expect(h.fetch.mock.calls[0][1].headers["x-nexus-actor-id"]).toBe("usr_a");
  expect(h.refresh).not.toHaveBeenCalled();
  expect(
    renderCleanup().find((n) => n.type === "button" && n.props.children === "Delete this object")
      ?.props.disabled,
  ).toBe(true);
});
it("ignores a delayed cleanup response after the administrator changes", async () => {
  let complete!: (value: Response) => void;
  h.fetch.mockReturnValueOnce(
    new Promise<Response>((resolve) => {
      complete = resolve;
    }),
  );
  check();
  click(renderCleanup(), "Delete this object");
  h.actor = "usr_b";
  expect(renderCleanup()).toHaveLength(0);
  complete(reply({ actorId: "usr_a", state: "deleted" }));
  await Promise.resolve();
  await Promise.resolve();
  expect(h.refresh).not.toHaveBeenCalled();
});
it("does not show namespaces returned for another administrator", async () => {
  h.fetch.mockResolvedValueOnce(
    reply({ actorId: "usr_b", owners: ["private_owner"], nextOffset: null, limited: false }),
  );
  click(renderDiscovery(), "List directories");
  await vi.waitFor(() => expect(renderDiscovery().some((n) => n.props.title)).toBe(true));
  expect(h.fetch.mock.calls[0][1].headers["x-nexus-actor-id"]).toBe("usr_a");
  expect(renderDiscovery().some((n) => n.props.children === "private_owner")).toBe(false);
});
it("ignores a delayed discovery response after the administrator changes", async () => {
  let complete!: (value: Response) => void;
  h.fetch.mockReturnValueOnce(
    new Promise<Response>((resolve) => {
      complete = resolve;
    }),
  );
  const form = renderDiscovery().find((n) => n.type === "form");
  if (!form) throw Error("Missing discovery form");
  (form.props.onSubmit as (event: unknown) => void)({ preventDefault() {} });
  expect(h.fetch.mock.calls[0][1].headers["x-nexus-actor-id"]).toBe("usr_a");
  h.actor = "usr_b";
  expect(renderDiscovery()).toHaveLength(0);
  complete(reply({ actorId: "usr_a", observed: 1, skipped: 0, nextOffset: null, limited: false }));
  await Promise.resolve();
  await Promise.resolve();
  expect(h.refresh).not.toHaveBeenCalled();
});
