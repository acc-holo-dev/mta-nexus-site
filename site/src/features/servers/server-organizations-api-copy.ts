import type { Locale } from "../../lib/i18n";

const en = {
  authenticationRequired: "Authentication required",
  unavailable: "Organization options temporarily unavailable",
};

const ru: Record<keyof typeof en, string> = {
  authenticationRequired: "Требуется вход",
  unavailable: "Варианты организаций временно недоступны",
};

export const serverOrganizationsApiCopy = (locale: Locale) => (locale === "ru" ? ru : en);
