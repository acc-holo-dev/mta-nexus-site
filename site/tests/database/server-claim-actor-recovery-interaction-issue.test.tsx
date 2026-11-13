import type { ReactNode } from "react";
import { expect, it, vi } from "vitest";
import {
  createServerClaimActorRecoveryInteractionHelpers,
  mockReactHooks,
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
vi.mock("../../src/components/locale-context", async () => {
  const { getDictionary } = await import("../../src/lib/i18n");
  return { useNexusLocale: () => ({ locale: "en", dictionary: getDictionary("en") }) };
});

import { ServerClaimControlPanel } from "../../src/components/server-claim-control-panel";

const { mount, click, waitUntilReady, hasCopy } = createServerClaimActorRecoveryInteractionHelpers(
  h,
  ServerClaimControlPanel,
);

it("retains an opaque issue marker and blocks retry after lost response and reload", async () => {
  await mount();
  await waitUntilReady();
  h.fetch.mockRejectedValueOnce(new Error("lost"));
  click("Create control challenge");
  await vi.waitFor(() => expect(h.fetch).toHaveBeenCalledTimes(2));
  await vi.waitFor(() => expect(hasCopy("challenge result is unknown")).toBe(true));
  const key = "nexus:server-claim:v1:usr_a:srv_a";
  expect(sessionStorage.getItem(key)).toBe("issue");
  h.slots = [];
  await mount();
  await vi.waitFor(() => expect(hasCopy("challenge result is unknown")).toBe(true));
  expect(
    h.fetch.mock.calls.filter(([url]) => url === "/api/servers/srv_a/claim-challenge"),
  ).toHaveLength(1);
});
