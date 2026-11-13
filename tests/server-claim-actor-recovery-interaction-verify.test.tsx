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

it("blocks verification retry after a lost response and retains no plaintext token in storage", async () => {
  await mount();
  await waitUntilReady();
  h.fetch.mockResolvedValueOnce(reply(issueResponse, 201));
  click("Create control challenge");
  await vi.waitFor(() => expect(render().some((node) => node.type === "code")).toBe(true));
  h.fetch.mockRejectedValueOnce(new Error("lost"));
  click("Verify control");
  await vi.waitFor(() => expect(hasCopy("verification result is unknown")).toBe(true));
  const key = "nexus:server-claim:v1:usr_a:srv_a";
  expect(sessionStorage.getItem(key)).toBe("verify");
  expect(sessionStorage.getItem(key)).not.toContain("NXCLAIM");
  h.slots = [];
  await mount();
  await vi.waitFor(() => expect(hasCopy("verification result is unknown")).toBe(true));
  expect(
    h.fetch.mock.calls.filter(([url]) => url === "/api/servers/srv_a/claim-challenge/verify"),
  ).toHaveLength(1);
});
