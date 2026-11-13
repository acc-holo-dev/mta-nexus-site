import type { ReactNode } from "react";
import { expect, it, vi } from "vitest";
import {
  createServerClaimActorRecoveryInteractionHelpers,
  issueResponse,
  mockReactHooks,
  reply,
} from "../helpers/server-claim-actor-recovery-interaction-harness";

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
vi.mock("../../site/src/components/locale-context", async () => {
  const { getDictionary } = await import("../../site/src/lib/i18n");
  return { useNexusLocale: () => ({ locale: "en", dictionary: getDictionary("en") }) };
});

import { ServerClaimControlPanel } from "../../site/src/components/server-claim-control-panel";

const { render, mount, click, waitUntilReady, hasCopy, attachWindowEvents } =
  createServerClaimActorRecoveryInteractionHelpers(h, ServerClaimControlPanel);

it("conceals the token on blur and clears it when focus returns under another account", async () => {
  await mount();
  await waitUntilReady();
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
  await vi.waitFor(() => expect(hasCopy("challenge result is unknown")).toBe(true));
  expect(render().some((node) => node.type === "code")).toBe(false);
  expect(sessionStorage.getItem("nexus:server-claim:v1:usr_a:srv_a")).toBe("issued");
});

it("does not insert a late issue token after the tab loses focus", async () => {
  await mount();
  await waitUntilReady();
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
  await vi.waitFor(() => expect(hasCopy("challenge result is unknown")).toBe(true));
  expect(render().some((node) => node.type === "code")).toBe(false);
});
