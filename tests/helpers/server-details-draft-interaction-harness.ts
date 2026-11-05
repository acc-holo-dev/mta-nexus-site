import type { ReactNode } from "react";
import { afterEach, beforeEach, type Mock, vi } from "vitest";
import { flattenReactTestTree } from "./flatten-react-test-tree";

type ServerDetailsDraftHarness = {
  slots: unknown[];
  cursor: number;
  fetch: Mock;
  refresh: Mock;
  locale: "en" | "ru";
  effect: null | (() => undefined | (() => void));
};

type ServerDetailsFormComponent = (props: { actorId: string; server: typeof server }) => ReactNode;

const revision = "2026-10-11T00:00:00.000Z";
export const later = "2026-10-11T00:00:01.000Z";

const server = {
  id: "srv_1",
  name: "Original Server",
  updatedAt: revision,
  description: "Old description",
  websiteUrl: "",
  discordUrl: "",
  rulesUrl: "",
  mediaUrls: [] as string[],
  language: "",
  region: "",
  gameplayTags: [] as string[],
  ipAddress: "203.0.113.7",
  port: 22003,
  httpPort: 22005,
  gameMode: "",
  mapName: "",
  maxPlayers: 128,
  visibility: "public" as const,
};

export const latest = { ...server, updatedAt: later, name: "Remote Server" };

export const actor = {
  id: "usr_a",
  username: "author",
  displayName: "Author",
  bio: "",
  avatarUrl: "",
  updatedAt: revision,
};

export const response = (body: unknown, status = 200) =>
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

/** Shared react mock factory for server-details draft suites (use with vi.mock("react", ...)). */
export function mockReactHooks(harness: ServerDetailsDraftHarness) {
  return async (original: () => Promise<typeof import("react")>) => ({
    ...(await original()),
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
  });
}

export function createServerDetailsDraftInteractionHelpers(
  harness: ServerDetailsDraftHarness,
  ServerDetailsForm: ServerDetailsFormComponent,
) {
  function render(input = server) {
    harness.cursor = 0;
    harness.effect = null;
    return flattenReactTestTree(
      ServerDetailsForm({ actorId: "usr_a", server: input }) as ReactNode,
    );
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
    harness.locale = "en";
    harness.effect = null;
    harness.fetch.mockReset();
    harness.refresh.mockReset();
    vi.stubGlobal("fetch", harness.fetch);
    vi.stubGlobal("FormData", DraftFormData);
  });

  afterEach(() => vi.unstubAllGlobals());

  return { render, submit };
}
