import type { ReactNode } from "react";
import { expect, it, vi } from "vitest";
import {
  componentName,
  createSettingsPageClientConfirmInteractionHelpers,
  findNamed,
  mockReactHooks,
  otherSession,
  preferences,
  response,
} from "../helpers/settings-page-client-confirm-interaction-harness";

const harness = vi.hoisted(() => ({
  slots: [] as unknown[],
  cursor: 0,
  cleanups: [] as Array<undefined | (() => void)>,
  effect: null as null | (() => undefined | (() => void)),
  fetch: vi.fn(),
}));
const confirmAction = vi.hoisted(() => vi.fn(async () => true));
vi.mock("../../src/components/confirm-action", () => ({ confirmAction }));
vi.mock("react", (original) => mockReactHooks(harness)(original));
vi.mock("next/navigation", () => ({ usePathname: () => "/settings" }));
vi.mock("next/link", () => ({
  default: ({ children, ...props }: { children: ReactNode; href: string }) => (
    <a {...props}>{children}</a>
  ),
}));
vi.mock("../../src/components/locale-context", async () => {
  const { getDictionary } = await import("../../src/lib/i18n");
  return {
    useNexusLocale: () => ({ locale: "en" as const, dictionary: getDictionary("en") }),
  };
});

import { SettingsPageClient } from "../../src/components/settings-page-client";
import { getDictionary } from "../../src/lib/i18n";

const { render } = createSettingsPageClientConfirmInteractionHelpers(
  harness,
  SettingsPageClient,
  confirmAction,
);

it("does not render recovery email from another account during settings load", async () => {
  harness.fetch
    .mockResolvedValueOnce(response({ actorId: "usr_owner", preferences }))
    .mockResolvedValueOnce(response({ actorId: "usr_owner", sessions: [otherSession] }))
    .mockResolvedValueOnce(
      response({
        actorId: "usr_other",
        email: "other@example.com",
        verified: true,
        verifiedAt: null,
        eligible: true,
      }),
    );
  render();
  if (!harness.effect) throw new Error("Missing settings loading effect");
  harness.cleanups.push(harness.effect());
  await vi.waitFor(() => expect(findNamed(render(), "ErrorState")).toBeDefined());
  expect(render().some((node) => componentName(node.type) === "SettingsRecoveryEmailSection")).toBe(
    false,
  );
});

it("discards a recovery status fetched after an account switch", async () => {
  harness.fetch
    .mockResolvedValueOnce(response({ accepted: false, alreadyVerified: true }))
    .mockResolvedValueOnce(
      response({
        actorId: "usr_other",
        email: "other@example.com",
        verified: true,
        verifiedAt: null,
        eligible: true,
      }),
    );
  const section = findNamed(render(), "SettingsRecoveryEmailSection");
  (section.props.onSubmit as (event: { preventDefault: () => void }) => void)({
    preventDefault() {},
  });
  await vi.waitFor(() => expect(harness.fetch).toHaveBeenCalled());
  expect(harness.fetch.mock.calls[0][1].body).toBe(
    JSON.stringify({ currentPassword: "", expectedActorId: "usr_owner" }),
  );
  await vi.waitFor(() => expect(findNamed(render(), "ErrorState")).toBeDefined());
  expect(render().some((node) => componentName(node.type) === "SettingsRecoveryEmailSection")).toBe(
    false,
  );
  expect(findNamed(render(), "ErrorState").props.title).toBe(
    getDictionary("en").settings.recoveryAccountChanged,
  );
});

it("hides stale settings when recovery email request rejects a switched account", async () => {
  harness.fetch.mockResolvedValueOnce(
    response({ code: "ACTOR_CHANGED", error: "Account changed" }, 409),
  );
  const section = findNamed(render(), "SettingsRecoveryEmailSection");
  (section.props.onSubmit as (event: { preventDefault: () => void }) => void)({
    preventDefault() {},
  });
  await vi.waitFor(() => expect(findNamed(render(), "ErrorState")).toBeDefined());
  expect(render().some((node) => componentName(node.type) === "SettingsRecoveryEmailSection")).toBe(
    false,
  );
  expect(findNamed(render(), "ErrorState").props.title).toBe(
    getDictionary("en").settings.recoveryAccountChanged,
  );
});
