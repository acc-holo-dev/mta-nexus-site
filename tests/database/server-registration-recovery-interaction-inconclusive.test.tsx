import { expect, it, vi } from "vitest";
import { findTestButton } from "../helpers/flatten-react-test-tree";
import {
  createServerRegistrationRecoveryInteractionHelpers,
  mockReactHooks,
  response,
} from "../helpers/server-registration-recovery-interaction-harness";

const h = vi.hoisted(() => ({
  slots: [] as unknown[],
  cursor: 0,
  effects: [] as (() => unknown)[],
  fetch: vi.fn(),
  locale: "en" as "en" | "ru",
}));
vi.mock("react", (original) => mockReactHooks(h)(original));
vi.mock("../../site/src/components/locale-context", async () => {
  const { getDictionary } = await import("../../site/src/lib/i18n");
  return { useNexusLocale: () => ({ locale: h.locale, dictionary: getDictionary(h.locale) }) };
});

import { RegisterServerForm } from "../../site/src/components/register-server-form";

const { render, mount, submit } = createServerRegistrationRecoveryInteractionHelpers(
  h,
  RegisterServerForm,
);

it("keeps a lost request blocked across reload and does not retry when recovery is inconclusive", async () => {
  await mount();
  h.fetch.mockRejectedValueOnce(new Error("lost response"));
  await submit();
  const saved = sessionStorage.getItem("nexus:server-registration:v1:usr_a");
  expect(saved).toBeTruthy();
  expect(findTestButton(render(), "Create listing").props.disabled).toBe(true);
  h.slots = [];
  await mount();
  expect(findTestButton(render(), "Create listing").props.disabled).toBe(true);
  h.fetch.mockResolvedValueOnce(response({ server: null }));
  const check = findTestButton(render(), "Check result");
  expect(check.props.disabled).toBe(false);
  await (check.props.onClick as () => Promise<void>)();
  expect(sessionStorage.getItem("nexus:server-registration:v1:usr_a")).toBe(saved);
  expect(findTestButton(render(), "Create listing").props.disabled).toBe(true);
  expect(h.fetch.mock.calls.filter(([url]) => url === "/api/servers")).toHaveLength(1);
});
