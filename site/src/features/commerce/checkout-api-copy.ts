import type { Locale } from "../../lib/i18n";

const en = {
  disabled: "Paid checkout is not available during the open free beta.",
};

const ru: Record<keyof typeof en, string> = {
  disabled: "Платный заказ недоступен в открытой бесплатной бете.",
};

export const checkoutApiCopy = (locale: Locale) => (locale === "ru" ? ru : en);
