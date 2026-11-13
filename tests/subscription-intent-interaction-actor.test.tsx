import { expect, it, vi } from "vitest";
import {
  createSubscriptionIntentInteractionHelpers,
  mockReactHooks,
} from "./helpers/subscription-intent-interaction-harness";

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
vi.mock("../site/src/components/locale-context", () => ({
  useNexusLocale: () => ({ locale: "en" }),
}));

import { SubscriptionControls } from "../site/src/components/subscription-controls";

const { render, mount } = createSubscriptionIntentInteractionHelpers(h, SubscriptionControls);

it("hides previous account selection immediately after identity change", async () => {
  await mount();
  expect(render("usr_b").find((n) => n.type === "fieldset")?.props.hidden).toBe(true);
});
