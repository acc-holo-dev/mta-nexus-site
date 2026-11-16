import { afterEach, beforeEach, expect, it, vi } from "vitest";
import { flattenReactTestTree } from "../helpers/flatten-react-test-tree";

const harness = vi.hoisted(() => ({ slots: [] as unknown[], cursor: 0, fetch: vi.fn() }));
vi.mock("react", async (original) => ({
  ...(await original<typeof import("react")>()),
  useState: (initial: unknown) => {
    const index = harness.cursor++;
    if (!(index in harness.slots)) harness.slots[index] = initial;
    return [
      harness.slots[index],
      (value: unknown) => {
        harness.slots[index] = typeof value === "function" ? value(harness.slots[index]) : value;
      },
    ];
  },
  useEffect: () => {},
}));
vi.mock("next/navigation", () => ({ useRouter: () => ({ refresh: vi.fn() }) }));
vi.mock("../../src/components/locale-context", async () => {
  const { getDictionary } = await import("../../src/lib/i18n");
  return { useNexusLocale: () => ({ dictionary: getDictionary("en") }) };
});

import { ContextSwitcher } from "../../src/components/context-switcher";

function render() {
  harness.cursor = 0;
  return flattenReactTestTree(ContextSwitcher());
}

beforeEach(() => {
  harness.slots = [
    [
      { id: "personal", type: "personal", name: "Alice", role: "personal" },
      { id: "org_shared", type: "organization", name: "Shared", role: "member" },
    ],
    "personal",
    "usr_alice",
    false,
    false,
    null,
    0,
  ];
  harness.fetch.mockReset();
  vi.stubGlobal("fetch", harness.fetch);
});
afterEach(() => vi.unstubAllGlobals());

it("binds a context switch to the account that supplied the choices", async () => {
  harness.fetch.mockResolvedValueOnce(
    new Response(JSON.stringify({ code: "ACTOR_CHANGED" }), { status: 409 }),
  );
  const select = render().find((node) => node.type === "select");
  if (!select) throw new Error("Missing context selector");
  (select.props.onChange as (event: unknown) => void)({ target: { value: "org_shared" } });
  await vi.waitFor(() => expect(harness.fetch).toHaveBeenCalledOnce());
  expect(harness.fetch.mock.calls[0][1].body).toBe(
    JSON.stringify({ contextId: "org_shared", expectedActorId: "usr_alice" }),
  );
  await vi.waitFor(() => expect(render().some((node) => node.type === "select")).toBe(false));
});
