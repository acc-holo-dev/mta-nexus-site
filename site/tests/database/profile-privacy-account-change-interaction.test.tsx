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
vi.mock("next/navigation", () => ({ useRouter: () => ({ refresh: vi.fn() }) }));
vi.mock("next/link", () => ({ default: "a" }));
vi.mock("../../src/lib/user-platform-client", async (original) => ({
  ...(await original<typeof import("../../src/lib/user-platform-client")>()),
  platformRequest: harness.request,
}));

import { ProfilePrivacyEditor } from "../../src/components/profile-privacy-editor";
import { PlatformRequestError } from "../../src/lib/user-platform-client";

const initial = {
  id: "usr_a",
  username: "alice",
  showActivity: false,
  showProfessionalContacts: true,
  updatedAt: "2026-10-10T00:00:00.000Z",
};
type Element = ReactElement<Record<string, unknown>>;
function descendants(node: ReactNode): Element[] {
  if (Array.isArray(node)) return node.flatMap(descendants);
  if (!node || typeof node !== "object" || !("props" in node)) return [];
  const element = node as Element;
  return [element, ...descendants(element.props.children as ReactNode)];
}
function render(locale: "en" | "ru") {
  harness.cursor = 0;
  return descendants(ProfilePrivacyEditor({ initial, locale }));
}
beforeEach(() => {
  harness.slots = [];
  harness.cursor = 0;
  harness.request.mockReset();
});
it.each(["en", "ru"] as const)(
  "sends the loaded account and closes its draft on account change in %s",
  async (locale) => {
    const form = render(locale).find((node) => node.type === "form");
    if (!form) throw new Error("Missing form");
    harness.request.mockRejectedValueOnce(
      new PlatformRequestError("account changed", "ACCOUNT_CHANGED"),
    );
    await (form.props.onSubmit as (event: unknown) => Promise<void>)({ preventDefault() {} });
    expect(harness.request.mock.calls[0][3]).toMatchObject({
      expectedActorId: initial.id,
      expectedUpdatedAt: initial.updatedAt,
    });
    expect(harness.slots[0]).toBeNull();
    expect(render(locale).find((node) => node.type === "fieldset")?.props.disabled).toBe(true);
  },
);
