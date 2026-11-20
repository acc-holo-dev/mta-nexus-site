import type { Locale } from "../../lib/i18n";

const en = {
  rate: "Too many resource claims. Please try again later.",
  authenticationRequired: "Authentication required",
  forbidden: "Forbidden",
  notFound: "Resource not found",
  unsupportedMediaType: "Request must use application/json",
  requestBodyTooLarge: "Request body is too large",
  invalidBodyLength: "Request body length is invalid",
  requestBodyTimeout: "Request body timed out",
  invalidClaim: "Invalid resource claim",
  claimFailed: "Resource claim failed",
};

const ru: Record<keyof typeof en, string> = {
  rate: "Слишком много запросов на получение ресурса. Попробуйте позже.",
  authenticationRequired: "Требуется вход",
  forbidden: "Запрещено",
  notFound: "Ресурс не найден",
  unsupportedMediaType: "Запрос должен использовать application/json",
  requestBodyTooLarge: "Тело запроса слишком большое",
  invalidBodyLength: "Некорректная длина тела запроса",
  requestBodyTimeout: "Истекло время ожидания тела запроса",
  invalidClaim: "Некорректный запрос на получение ресурса",
  claimFailed: "Не удалось получить ресурс",
};

export const resourceClaimApiCopy = (locale: Locale) => (locale === "ru" ? ru : en);
