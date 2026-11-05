import { expect, it, vi } from "vitest";
import { flatTreeHasErrorText } from "./helpers/flatten-react-test-tree";
import {
  createServerRegistrationRecoveryInteractionHelpers,
  mockReactHooks,
  response,
} from "./helpers/server-registration-recovery-interaction-harness";

const h = vi.hoisted(() => ({
  slots: [] as unknown[],
  cursor: 0,
  effects: [] as (() => unknown)[],
  fetch: vi.fn(),
  locale: "en" as "en" | "ru",
}));
vi.mock("react", (original) => mockReactHooks(h)(original));
vi.mock("../apps/web/src/components/locale-context", async () => {
  const { getDictionary } = await import("../apps/web/src/lib/i18n");
  return { useNexusLocale: () => ({ locale: h.locale, dictionary: getDictionary(h.locale) }) };
});

import { RegisterServerForm } from "../apps/web/src/components/register-server-form";

const { render } = createServerRegistrationRecoveryInteractionHelpers(h, RegisterServerForm);

it("does not display a saved draft to a different signed-in actor", async () => {
  sessionStorage.setItem(
    "nexus:server-registration:v1:usr_a",
    JSON.stringify({ actorId: "usr_a", nonce: "a".repeat(32), fields: { name: "Private draft" } }),
  );
  h.fetch.mockImplementation(async (url: string) =>
    url === "/api/auth/session"
      ? response({ authenticated: true, user: { id: "usr_b" } })
      : response({ organizations: [] }),
  );
  render();
  for (const effect of h.effects) effect();
  await vi.waitFor(() =>
    expect(flatTreeHasErrorText(render(), "Could not verify")).toBe(true),
  );
  expect(render().find((n) => n.type === "form")?.props.hidden).toBe(true);
  expect(sessionStorage.getItem("nexus:server-registration:v1:usr_a")).toContain("Private draft");
});
