import { renderToStaticMarkup } from "react-dom/server";
import { beforeEach, describe, expect, it, vi } from "vitest";

const state = vi.hoisted(() => ({
  user: { id: "usr_admin", role: "admin" } as { id: string; role: string } | null,
  engine: false,
  locale: "en" as "en" | "ru",
}));

vi.mock("server-only", () => ({}));
vi.mock("next/headers", () => ({
  cookies: async () => ({ get: () => ({ value: "session" }) }),
}));
vi.mock("next/navigation", () => ({
  notFound: () => {
    throw new Error("NEXT_NOT_FOUND");
  },
  useRouter: () => ({ refresh: () => undefined }),
}));
vi.mock("../../src/lib/i18n/server", () => ({
  getRequestLocale: async () => state.locale,
}));
vi.mock("../../src/lib/services/accounts/auth-service", () => ({
  authService: { getSession: async () => state.user },
}));
vi.mock("../../src/lib/services/commerce/wallet-payment-service", () => ({
  isWalletEngineEnabled: () => state.engine,
}));
vi.mock("../../src/features/commerce/components/wallet-fx-form", () => ({
  WalletFxForm: ({ actorId }: { actorId: string }) => <form data-fx-form={actorId} />,
}));

import { WalletFxScreen } from "../../src/features/commerce/server/wallet-fx-screen";

describe("exchange rate admin page", () => {
  beforeEach(() => {
    state.user = { id: "usr_admin", role: "admin" };
    state.engine = false;
    state.locale = "en";
  });

  it("hides the form when the wallet engine is off", async () => {
    const html = renderToStaticMarkup(await WalletFxScreen());
    expect(html).toContain("exchange rates stay unavailable");
    expect(html).not.toContain("data-fx-form");
  });

  it("shows the form when the engine is on", async () => {
    state.engine = true;
    state.locale = "ru";
    const html = renderToStaticMarkup(await WalletFxScreen());
    expect(html).toContain("Курсы обмена");
    expect(html).toContain('data-fx-form="usr_admin"');
  });

  it("hides the page from a non-admin", async () => {
    state.user = { id: "usr_member", role: "user" };
    await expect(WalletFxScreen()).rejects.toThrow("NEXT_NOT_FOUND");
  });
});
