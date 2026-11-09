import type { ReactNode } from "react";
import { expect, it, vi } from "vitest";
import { flattenReactTestTree } from "../helpers/flatten-react-test-tree";
import {
  createSubscriptionIntentInteractionHelpers,
  mockReactHooks,
  reply,
} from "../helpers/subscription-intent-interaction-harness";
import { terms } from "../helpers/subscriptions-fixtures";

const h = vi.hoisted(() => ({
  slots: [] as unknown[],
  cursor: 0,
  effects: [] as (() => unknown)[],
  fetch: vi.fn(),
  push: vi.fn(),
  refresh: vi.fn(),
}));
vi.mock("react", (original) => mockReactHooks(h)(original));
vi.mock("next/navigation", () => ({ useRouter: () => ({ push: h.push, refresh: h.refresh }) }));
vi.mock("../../apps/web/src/components/locale-context", () => ({
  useNexusLocale: () => ({ locale: "en" }),
}));

import { SubscriptionControls } from "../../apps/web/src/components/subscription-controls";

const { accountPosts } = createSubscriptionIntentInteractionHelpers(h, SubscriptionControls);

it("recovers a lost cancellation on the dashboard without automatically sending it", async () => {
  const cancellation = {
    actorId: "usr_a",
    action: "cancel" as const,
    planId: "cplan_free",
    planRevision: 2,
    terms,
    subscriptionId: "sub_a",
    organizationId: "org_a",
    startedAt: "2026-10-11T20:00:00.000Z",
    expiresAt: "2026-11-10T20:00:00.000Z",
  };
  function cancelRender() {
    h.cursor = 0;
    h.effects = [];
    return flattenReactTestTree(SubscriptionControls(cancellation) as ReactNode);
  }
  h.fetch.mockResolvedValueOnce(reply({ authenticated: true, user: { id: "usr_a" } }));
  cancelRender();
  for (const effect of h.effects) effect();
  await vi.waitFor(() =>
    expect(cancelRender().find((n) => n.type === "fieldset")?.props.hidden).toBe(false),
  );
  const checkbox = cancelRender().find((n) => n.type === "input");
  if (!checkbox) throw new Error("Missing cancellation confirmation");
  (checkbox.props.onChange as (event: unknown) => void)({ target: { checked: true } });
  h.fetch.mockRejectedValueOnce(new Error("lost"));
  const form = cancelRender().find((n) => n.type === "form");
  if (!form) throw new Error("Missing form");
  await (form.props.onSubmit as (event: unknown) => Promise<void>)({ preventDefault() {} });
  const saved = sessionStorage.getItem("nexus:subscription-intent:v1:usr_a");
  expect(saved).toContain('"subscriptionId":"sub_a"');
  h.slots = [];
  vi.stubGlobal("window", {
    addEventListener: () => {},
    removeEventListener: () => {},
    dispatchEvent: () => true,
  });
  h.fetch.mockResolvedValueOnce(reply({ authenticated: true, user: { id: "usr_a" } }));
  const { SubscriptionRecovery } = await import("../../apps/web/src/components/subscription-recovery");
  function recoveryRender() {
    h.cursor = 0;
    h.effects = [];
    return flattenReactTestTree(SubscriptionRecovery({ actorId: "usr_a" }) as ReactNode);
  }
  recoveryRender();
  for (const effect of h.effects) effect();
  await vi.waitFor(() =>
    expect(recoveryRender().some((n) => n.type === SubscriptionControls)).toBe(true),
  );
  const recovered = recoveryRender().find((n) => n.type === SubscriptionControls);
  expect(recovered?.props).toMatchObject({
    action: "cancel",
    actorId: "usr_a",
    subscriptionId: "sub_a",
    organizationId: "org_a",
  });
  expect(accountPosts()).toHaveLength(1);
});
