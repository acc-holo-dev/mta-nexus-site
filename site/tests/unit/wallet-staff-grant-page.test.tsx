vi.mock("server-only", () => ({}));

import { renderToStaticMarkup } from "react-dom/server";
import { beforeEach, expect, it, vi } from "vitest";
import { getWalletCopy } from "../../src/features/commerce/wallet-i18n";

const state = vi.hoisted(() => ({
  user: { id: "usr_admin", role: "admin" } as { id: string; role: string } | null,
  locale: "en" as "en" | "ru",
  engine: false,
  sessionError: false,
}));

vi.mock("next/headers", () => ({
  cookies: async () => ({ get: () => ({ value: "session" }) }),
}));
vi.mock("next/navigation", () => ({
  notFound: () => {
    throw new Error("NEXT_NOT_FOUND");
  },
}));
vi.mock("../../src/lib/i18n/server", () => ({
  getRequestLocale: async () => state.locale,
}));
vi.mock("../../src/lib/services/accounts/auth-service", () => ({
  authService: {
    getSession: async () => {
      if (state.sessionError) throw new Error("session down");
      return state.user;
    },
  },
}));
vi.mock("../../src/lib/services/commerce/wallet-payment-service", () => ({
  isWalletEngineEnabled: () => state.engine,
}));
vi.mock("../../src/features/commerce/components/wallet-staff-grant-form", () => ({
  WalletStaffGrantForm: ({ actorId }: { actorId: string }) => <form data-staff-grant={actorId} />,
}));

import Page from "../../src/app/admin/commerce/wallet-grants/page";

beforeEach(() => {
  state.user = { id: "usr_admin", role: "admin" };
  state.locale = "en";
  state.engine = false;
  state.sessionError = false;
});

it("tells an admin the engine is off instead of showing a grant form", async () => {
  const html = renderToStaticMarkup(await Page());
  const copy = getWalletCopy("en");
  expect(html).toContain(copy.grantEngineOff);
  expect(html).not.toContain("data-staff-grant");
});

it("shows the grant form when the engine is on", async () => {
  state.engine = true;
  state.locale = "ru";
  const html = renderToStaticMarkup(await Page());
  expect(html).toContain(getWalletCopy("ru").grantTitle);
  expect(html).toContain('data-staff-grant="usr_admin"');
});

it("hides the page from a non-admin", async () => {
  state.user = { id: "usr_user", role: "user" };
  await expect(Page()).rejects.toThrow("NEXT_NOT_FOUND");
});

it("keeps a session failure distinct from signed-out", async () => {
  state.sessionError = true;
  const html = renderToStaticMarkup(await Page());
  expect(html).toContain('role="alert"');
  expect(html).not.toContain("data-staff-grant");
});
