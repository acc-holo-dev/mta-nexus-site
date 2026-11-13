import type { ReactNode } from "react";
import { expect, it, vi } from "vitest";
import {
  createServerClaimActorRecoveryInteractionHelpers,
  issueResponse,
  mockReactHooks,
  reply,
} from "./helpers/server-claim-actor-recovery-interaction-harness";

const h = vi.hoisted(() => ({
  slots: [] as unknown[],
  cursor: 0,
  effects: [] as (() => unknown)[],
  fetch: vi.fn(),
}));
vi.mock("react", (original) => mockReactHooks(h)(original));
vi.mock("next/navigation", () => ({
  usePathname: () => "/servers/demo",
  useRouter: () => ({ refresh: vi.fn() }),
}));
vi.mock("next/link", () => ({ default: ({ children }: { children: ReactNode }) => children }));
vi.mock("../site/src/components/locale-context", async () => {
  const { getDictionary } = await import("../site/src/lib/i18n");
  return { useNexusLocale: () => ({ locale: "en", dictionary: getDictionary("en") }) };
});

import { ServerClaimControlPanel } from "../site/src/components/server-claim-control-panel";

const { render, mount, click, waitUntilReady, hasCopy } =
  createServerClaimActorRecoveryInteractionHelpers(h, ServerClaimControlPanel);

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
  await waitUntilReady();
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

it("drops the token after an actor-changed verification response", async () => {
  await mount();
  await waitUntilReady();
  h.fetch.mockResolvedValueOnce(reply(issueResponse, 201));
  click("Create control challenge");
  await vi.waitFor(() => expect(render().some((node) => node.type === "code")).toBe(true));
  h.fetch.mockResolvedValueOnce(reply({ code: "ACTOR_CHANGED" }, 409));
  click("Verify control");
  await vi.waitFor(() => expect(hasCopy("challenge result is unknown")).toBe(true));
  expect(render().some((node) => node.type === "code")).toBe(false);
});
