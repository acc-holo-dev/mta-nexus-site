import { expect, it, vi } from "vitest";
import { findTestButton, flatTreeHasErrorText } from "../helpers/flatten-react-test-tree";
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
vi.mock("../../src/components/locale-context", async () => {
  const { getDictionary } = await import("../../src/lib/i18n");
  return { useNexusLocale: () => ({ locale: h.locale, dictionary: getDictionary(h.locale) }) };
});

import { RegisterServerForm } from "../../src/components/register-server-form";

const { render, mount, submit } = createServerRegistrationRecoveryInteractionHelpers(
  h,
  RegisterServerForm,
);

it("explains an inconclusive recovery in Russian without enabling another creation", async () => {
  h.locale = "ru";
  await mount();
  h.fetch.mockRejectedValueOnce(new Error("lost response"));
  await submit();
  h.fetch.mockResolvedValueOnce(response({ server: null }));
  const check = findTestButton(render(), "Проверить результат");
  await (check.props.onClick as () => Promise<void>)();
  expect(flatTreeHasErrorText(render(), "Запись пока не подтверждена")).toBe(true);
  expect(findTestButton(render(), "Создать карточку").props.disabled).toBe(true);
});
