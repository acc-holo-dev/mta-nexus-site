import type { ReactNode } from "react";
import { afterEach, beforeEach, expect, it, vi } from "vitest";
import { findTestButton, flattenReactTestTree } from "./helpers/flatten-react-test-tree";

const harness = vi.hoisted(() => ({
  slots: [] as unknown[],
  cursor: 0,
  fetch: vi.fn(),
  refresh: vi.fn(),
  locale: "en" as "en" | "ru",
  effect: null as null | (() => undefined | (() => void)),
}));
vi.mock("react", async (original) => ({
  ...(await original<typeof import("react")>()),
  useState: (initial: unknown) => {
    const index = harness.cursor++;
    if (!(index in harness.slots))
      harness.slots[index] = typeof initial === "function" ? initial() : initial;
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
vi.mock("../apps/web/src/components/locale-context", async () => {
  const { getDictionary } = await import("../apps/web/src/lib/i18n");
  return {
    useNexusLocale: () => ({ locale: harness.locale, dictionary: getDictionary(harness.locale) }),
  };
});

import { ServerDetailsForm } from "../apps/web/src/components/server-details-form";
import { getDictionary } from "../apps/web/src/lib/i18n";

const revision = "2026-10-11T00:00:00.000Z",
  later = "2026-10-11T00:00:01.000Z";
const server = {
  id: "srv_1",
  name: "Original Server",
  updatedAt: revision,
  description: "Old description",
  websiteUrl: "",
  discordUrl: "",
  rulesUrl: "",
  mediaUrls: [],
  language: "",
  region: "",
  gameplayTags: [],
  ipAddress: "203.0.113.7",
  port: 22003,
  httpPort: 22005,
  gameMode: "",
  mapName: "",
  maxPlayers: 128,
  visibility: "public" as const,
};
const latest = { ...server, updatedAt: later, name: "Remote Server" };
const actor = {
  id: "usr_a",
  username: "author",
  displayName: "Author",
  bio: "",
  avatarUrl: "",
  updatedAt: revision,
};
const response = (body: unknown, status = 200) =>
  new Response(JSON.stringify(body), { status, headers: { "content-type": "application/json" } });
class DraftFormData {
  get(name: string) {
    return (
      (
        {
          name: "My draft server",
          description: "My draft description",
          websiteUrl: "",
          discordUrl: "",
          rulesUrl: "",
          mediaUrls: "",
          language: "",
          region: "",
          gameplayTags: "",
          ipAddress: "203.0.113.7",
          port: "22003",
          httpPort: "22005",
          gameMode: "",
          mapName: "",
          maxPlayers: "128",
          visibility: "public",
        } as Record<string, string>
      )[name] ?? null
    );
  }
}
function render(input = server) {
  harness.cursor = 0;
  harness.effect = null;
  return flattenReactTestTree(ServerDetailsForm({ actorId: "usr_a", server: input }) as ReactNode);
}
function submit(nodes = render()) {
  const form = nodes.find((node) => node.type === "form");
  if (!form) throw Error("Missing server form");
  (form.props.onChangeCapture as () => void)();
  return (form.props.onSubmit as (event: unknown) => Promise<void>)({
    preventDefault() {},
    currentTarget: {},
  });
}
beforeEach(() => {
  vi.clearAllMocks();
  harness.slots = [];
  harness.cursor = 0;
  harness.fetch.mockReset();
  harness.refresh.mockReset();
  vi.stubGlobal("fetch", harness.fetch);
  vi.stubGlobal("FormData", DraftFormData);
});
afterEach(() => vi.unstubAllGlobals());

it.each(["en", "ru"] as const)(
  "preserves draft and accepts only the checked revision after a conflict in %s",
  async (locale) => {
    harness.locale = locale;
    const copy = getDictionary(locale).serverManagement;
    harness.fetch.mockResolvedValueOnce(response({ code: "SERVER_METADATA_CONFLICT" }, 409));
    const form = render().find((node) => node.type === "form");
    await submit();
    expect(findTestButton(render(), copy.save).props.disabled).toBe(true);
    harness.fetch
      .mockResolvedValueOnce(response({ profile: actor }))
      .mockResolvedValueOnce(response({ actorId: "usr_a", server: latest }));
    (findTestButton(render(), copy.compareLatest).props.onClick as () => void)();
    await vi.waitFor(() => expect(findTestButton(render(), copy.useLatest)).toBeDefined());
    (findTestButton(render(), copy.useLatest).props.onClick as () => void)();
    expect(render().find((node) => node.type === "form")?.key).toBe(form?.key);
    harness.fetch.mockResolvedValueOnce(response({ code: "SERVER_METADATA_CONFLICT" }, 409));
    await submit();
    const init = harness.fetch.mock.calls[3]?.[1] as RequestInit;
    expect(new Headers(init.headers).get("x-nexus-actor-id")).toBe("usr_a");
    expect(JSON.parse(String(init.body))).toMatchObject({
      name: "My draft server",
      expectedUpdatedAt: later,
    });
  },
);

it("hides the prior draft when the actor changes during save", async () => {
  harness.locale = "en";
  const copy = getDictionary("en").serverManagement;
  harness.fetch.mockResolvedValueOnce(response({ code: "ACTOR_CHANGED" }, 409));
  await submit();
  expect(render().some((node) => node.type === "form")).toBe(false);
  expect(render().some((node) => node.props.title === copy.actorChanged)).toBe(true);
});

it("keeps an unconfirmed draft locked and copyable after access is revoked", async () => {
  harness.locale = "en";
  const copy = getDictionary("en").serverManagement;
  harness.fetch.mockResolvedValueOnce(response({ code: "FORBIDDEN" }, 403));
  await submit();
  harness.fetch
    .mockResolvedValueOnce(response({ profile: actor }))
    .mockResolvedValueOnce(response({ code: "NOT_FOUND" }, 404))
    .mockResolvedValueOnce(response({ profile: actor }));
  (findTestButton(render(), copy.compareLatest).props.onClick as () => void)();
  await vi.waitFor(() =>
    expect(render().some((node) => node.props.title === copy.checkFailed)).toBe(true),
  );
  const form = render().find((node) => node.type === "form");
  expect(form?.props.style).toBeUndefined();
  expect(findTestButton(render(), copy.save).props.disabled).toBe(true);
});

it("closes the draft if the actor changes while saved details are checked", async () => {
  harness.locale = "en";
  const copy = getDictionary("en").serverManagement;
  harness.fetch.mockResolvedValueOnce(response({ code: "SERVER_METADATA_CONFLICT" }, 409));
  await submit();
  harness.fetch
    .mockResolvedValueOnce(response({ profile: actor }))
    .mockResolvedValueOnce(response({ actorId: "usr_other", server: latest }));
  (findTestButton(render(), copy.compareLatest).props.onClick as () => void)();
  await vi.waitFor(() =>
    expect(render().some((node) => node.props.title === copy.actorChanged)).toBe(true),
  );
  expect(render().some((node) => node.type === "form")).toBe(false);
});

it("requires checking after a lost response and never resends automatically", async () => {
  harness.locale = "en";
  const copy = getDictionary("en").serverManagement;
  harness.fetch.mockRejectedValueOnce(new Error("response lost"));
  await submit();
  expect(findTestButton(render(), copy.save).props.disabled).toBe(true);
  expect(findTestButton(render(), copy.compareLatest)).toBeDefined();
  await submit();
  expect(harness.fetch).toHaveBeenCalledTimes(1);
});

it("ignores a successful response after the editor is removed", async () => {
  harness.locale = "en";
  const nodes = render();
  const cleanup = harness.effect?.();
  let finish!: (value: Response) => void;
  harness.fetch.mockReturnValueOnce(new Promise<Response>((resolve) => (finish = resolve)));
  const pending = submit(nodes);
  if (typeof cleanup === "function") cleanup();
  finish(response({ server: latest }));
  await pending;
  expect(harness.refresh).not.toHaveBeenCalled();
});
