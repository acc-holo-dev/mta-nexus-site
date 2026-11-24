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
vi.mock("../../src/features/commerce/components/wallet-promo-form", () => ({
  WalletPromoForm: ({ actorId }: { actorId: string }) => <form data-promo-form={actorId} />,
}));

import { WalletPromoScreen } from "../../src/features/commerce/server/wallet-promo-screen";

describe("promo admin page", () => {
  beforeEach(() => {
    state.user = { id: "usr_admin", role: "admin" };
    state.engine = false;
    state.locale = "en";
  });

  it("hides the form when the wallet engine is off", async () => {
    const html = renderToStaticMarkup(await WalletPromoScreen());
    expect(html).toContain("promo codes stay unavailable");
    expect(html).not.toContain("data-promo-form");
  });

  it("shows the form when the engine is on", async () => {
    state.engine = true;
    state.locale = "ru";
    const html = renderToStaticMarkup(await WalletPromoScreen());
    expect(html).toContain("Промокоды");
    expect(html).toContain('data-promo-form="usr_admin"');
  });

  it("hides the page from a non-admin", async () => {
    state.user = { id: "usr_member", role: "user" };
    await expect(WalletPromoScreen()).rejects.toThrow("NEXT_NOT_FOUND");
  });
});
