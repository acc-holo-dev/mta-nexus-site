import type { Locale } from "../../lib/i18n";

const en = {
  disabled:
    "Card and live payment-provider checkout stays disabled. Paid site-wallet create+settle is a separate path when the wallet engine is on.",
};

const ru: Record<keyof typeof en, string> = {
  disabled:
    "Карточный и live checkout платёжного провайдера остаётся выключен. Платный site-wallet create+settle — отдельный путь при включённом wallet engine.",
};

export const checkoutApiCopy = (locale: Locale) => (locale === "ru" ? ru : en);
