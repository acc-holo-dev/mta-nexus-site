import type { ReactElement, ReactNode } from "react";
import { afterEach, beforeEach, expect, it, vi } from "vitest";

const harness = vi.hoisted(() => ({
  slots: [] as unknown[],
  cursor: 0,
  effect: null as null | (() => undefined | (() => void)),
  request: vi.fn(),
  refresh: vi.fn(),
  locale: "en" as "en" | "ru",
}));
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
  useEffect: (effect: () => undefined | (() => void)) => {
    harness.effect = effect;
  },
}));
vi.mock("next/navigation", () => ({ useRouter: () => ({ refresh: harness.refresh }) }));
vi.mock("next/link", () => ({ default: "a" }));
vi.mock("../apps/web/src/components/locale-context", () => ({
  useNexusLocale: () => ({ locale: harness.locale }),
}));
vi.mock("../apps/web/src/lib/user-platform-client", async (original) => ({
  ...(await original<typeof import("../apps/web/src/lib/user-platform-client")>()),
  platformRequest: harness.request,
}));

import { PublicProfileForm } from "../apps/web/src/components/public-profile-form";
import { getUserPlatformCopy } from "../apps/web/src/lib/user-platform-copy";

type Element = ReactElement<Record<string, unknown>>;
function descendants(node: ReactNode): Element[] {
  if (Array.isArray(node)) return node.flatMap(descendants);
  if (!node || typeof node !== "object" || !("props" in node)) return [];
  const element = node as Element;
  const type = element.type as { displayName?: string } | string;
  if (typeof type === "object" && type?.displayName === "Button")
    return [
      { ...element, type: "button" } as Element,
      ...descendants(element.props.children as ReactNode),
    ];
  return [element, ...descendants(element.props.children as ReactNode)];
}
function render() {
  harness.cursor = 0;
  return descendants(PublicProfileForm());
}
function button(nodes: Element[], label: string) {
  const found = nodes.find((node) => node.type === "button" && node.props.children === label);
  if (!found) throw new Error(`Missing ${label}`);
  return found;
}
const original = {
  id: "usr_1",
  username: "author",
  displayName: "Original",
  bio: "Old bio",
  avatarUrl: "",
  updatedAt: "2026-10-11T00:00:00.000Z",
};
const latest = {
  ...original,
  displayName: "Remote name",
  bio: "Remote bio",
  updatedAt: "2026-10-11T00:00:01.000Z",
};
class DraftFormData {
  get(name: string) {
    return (
      ({ displayName: "My draft", bio: "My unsaved bio", avatarUrl: "" } as Record<string, string>)[
        name
      ] ?? null
    );
  }
}
beforeEach(() => {
  vi.clearAllMocks();
  harness.slots = [];
  harness.cursor = 0;
  harness.effect = null;
  harness.request.mockReset();
  vi.stubGlobal("FormData", DraftFormData);
});
afterEach(() => vi.unstubAllGlobals());
async function load() {
  harness.request.mockResolvedValueOnce({ profile: original });
  render();
  const cleanup = harness.effect?.();
  await vi.waitFor(() => expect(render().some((node) => node.type === "form")).toBe(true));
  return cleanup;
}
async function save(nodes: Element[]) {
  const form = nodes.find((node) => node.type === "form");
  if (!form) throw new Error("Missing profile form");
  await (form.props.onSubmit as (event: unknown) => Promise<void>)({
    preventDefault() {},
    currentTarget: {},
  });
}

it.each(["en", "ru"] as const)(
  "keeps the draft until explicitly accepting a checked saved profile in %s",
  async (locale) => {
    harness.locale = locale;
    const copy = getUserPlatformCopy(locale);
    const cleanup = await load();
    harness.request.mockRejectedValueOnce(new Error("response lost"));
    const form = render().find((node) => node.type === "form");
    await save(render());
    expect(button(render(), copy.save).props.disabled).toBe(true);
    harness.request.mockResolvedValueOnce({ profile: latest });
    (button(render(), copy.profileCompare).props.onClick as () => void)();
    await vi.waitFor(() => expect(button(render(), copy.profileUseLatest)).toBeDefined());
    expect(render().find((node) => node.type === "form")?.key).toBe(form?.key);
    (button(render(), copy.profileUseLatest).props.onClick as () => void)();
    expect(render().find((node) => node.type === "form")?.key).toBe(form?.key);
    harness.request.mockRejectedValueOnce(new Error("conflict"));
    await save(render());
    expect(harness.request.mock.calls[3]?.[3]).toMatchObject({
      displayName: "My draft",
      bio: "My unsaved bio",
      expectedUpdatedAt: latest.updatedAt,
    });
    if (typeof cleanup === "function") cleanup();
  },
);

it("keeps the current draft on read failure and closes it if the actor changes", async () => {
  harness.locale = "en";
  const copy = getUserPlatformCopy("en");
  const cleanup = await load();
  harness.request.mockRejectedValueOnce(new Error("response lost"));
  await save(render());
  harness.request.mockRejectedValueOnce(new Error("unauthorized"));
  (button(render(), copy.profileCompare).props.onClick as () => void)();
  await vi.waitFor(() => expect(harness.slots[3]).toMatchObject({ text: "unauthorized" }));
  expect(render().some((node) => node.type === "form")).toBe(true);
  expect(button(render(), copy.save).props.disabled).toBe(true);
  harness.request.mockResolvedValueOnce({ profile: { ...latest, id: "usr_2", username: "other" } });
  (button(render(), copy.profileCompare).props.onClick as () => void)();
  await vi.waitFor(() => expect(render().some((node) => node.type === "form")).toBe(false));
  expect(harness.slots[3]).toMatchObject({ text: copy.profileAccountChanged });
  if (typeof cleanup === "function") cleanup();
});

it("closes the previous draft if a save response identifies a different actor", async () => {
  harness.locale = "en";
  const cleanup = await load();
  harness.request.mockResolvedValueOnce({
    success: true,
    profile: { ...latest, id: "usr_2", username: "other" },
  });
  await save(render());
  expect(render().some((node) => node.type === "form")).toBe(false);
  expect(harness.slots[3]).toMatchObject({ text: getUserPlatformCopy("en").profileAccountChanged });
  if (typeof cleanup === "function") cleanup();
});
