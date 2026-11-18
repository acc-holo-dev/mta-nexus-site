import type { Locale } from "../../lib/i18n";

const en = {
  rate: "Too many resource claims. Please try again later.",
  authenticationRequired: "Authentication required",
  invalidClaim: "Invalid resource claim",
  claimFailed: "Resource claim failed",
};

const ru: Record<keyof typeof en, string> = {
  rate: "Слишком много запросов на получение ресурса. Попробуйте позже.",
  authenticationRequired: "Требуется вход",
  invalidClaim: "Некорректный запрос на получение ресурса",
  claimFailed: "Не удалось получить ресурс",
};

export const resourceClaimApiCopy = (locale: Locale) => (locale === "ru" ? ru : en);
