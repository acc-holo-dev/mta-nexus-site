import type { Locale } from "../../lib/i18n";

const en = {
  forbidden: "Forbidden: Admin or moderator privilege required",
  rate: "Too many admin actions",
  invalidAction: "Invalid moderation action",
  authenticationRequired: "Authentication required",
  notFound: "Target was not found",
  conflict: "Moderation state changed. Reload and retry.",
  unsupportedMediaType: "Request must use application/json",
  requestBodyTooLarge: "Request body is too large",
  invalidBodyLength: "Request body length is invalid",
  requestBodyTimeout: "Request body timed out",
  productNotFound: "Product not found",
  reportNotFound: "Report not found",
  verificationNotFound: "Verification request not found",
  executeFailed: "Failed to execute administrative action",
};

const ru: Record<keyof typeof en, string> = {
  forbidden: "Запрещено: нужны права администратора или модератора",
  rate: "Слишком много административных действий",
  invalidAction: "Некорректное действие модерации",
  authenticationRequired: "Требуется вход",
  notFound: "Цель не найдена",
  conflict: "Состояние модерации изменилось. Обновите и повторите.",
  unsupportedMediaType: "Запрос должен использовать application/json",
  requestBodyTooLarge: "Тело запроса слишком большое",
  invalidBodyLength: "Некорректная длина тела запроса",
  requestBodyTimeout: "Истекло время ожидания тела запроса",
  productNotFound: "Продукт не найден",
  reportNotFound: "Жалоба не найдена",
  verificationNotFound: "Заявка на верификацию не найдена",
  executeFailed: "Не удалось выполнить административное действие",
};

export const adminActionsApiCopy = (locale: Locale) => (locale === "ru" ? ru : en);
