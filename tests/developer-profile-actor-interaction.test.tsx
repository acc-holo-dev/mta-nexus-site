import type { ReactElement, ReactNode } from "react";
import { beforeEach, expect, it, vi } from "vitest";

const harness = vi.hoisted(() => ({ slots: [] as unknown[], cursor: 0, request: vi.fn() }));
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
  useRef: (initial: unknown) => {
    const index = harness.cursor++;
    if (!(index in harness.slots)) harness.slots[index] = { current: initial };
    return harness.slots[index];
  },
  useEffect: () => {},
}));
vi.mock("next/link", () => ({ default: "a" }));
vi.mock("../site/src/lib/user-platform-client", async (original) => ({
  ...(await original<typeof import("../site/src/lib/user-platform-client")>()),
  platformRequest: harness.request,
}));

import { DeveloperProfileEditor } from "../site/src/components/developer-profile-editor";

type Element = ReactElement<Record<string, unknown>>;
function descendants(node: ReactNode): Element[] {
  if (Array.isArray(node)) return node.flatMap(descendants);
  if (!node || typeof node !== "object" || !("props" in node)) return [];
  const element = node as Element;
  return [element, ...descendants(element.props.children as ReactNode)];
}
const original = {
  id: "user_a",
  specialties: ["Lua"],
  githubUrl: "",
  discordTag: "",
  verifiedDeveloper: false,
  updatedAt: "2026-10-10T00:00:00.000Z",
};
function render() {
  harness.cursor = 0;
  return descendants(
    DeveloperProfileEditor({ initial: original, actorId: "user_a", locale: "en" }),
  );
}
beforeEach(() => {
  harness.slots = [];
  harness.cursor = 0;
  harness.request.mockReset();
});
it("binds the save to the actor whose profile was edited", async () => {
  harness.request.mockRejectedValueOnce(new Error("The signed-in account changed"));
  const form = render().find((node) => node.type === "form");
  if (!form) throw new Error("Missing form");
  await (form.props.onSubmit as (event: unknown) => Promise<void>)({ preventDefault() {} });
  expect(harness.request.mock.calls[0]?.[3]).toMatchObject({
    expectedActorId: "user_a",
    expectedUpdatedAt: original.updatedAt,
  });
});
