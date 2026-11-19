import type { Locale } from "../../lib/i18n";

const en = {
  forbidden: "Forbidden: Admin or moderator privilege required",
  rate: "Too many admin actions",
  invalidAction: "Invalid moderation action",
  authenticationRequired: "Authentication required",
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
  productNotFound: "Продукт не найден",
  reportNotFound: "Жалоба не найдена",
  verificationNotFound: "Заявка на верификацию не найдена",
  executeFailed: "Не удалось выполнить административное действие",
};

export const adminActionsApiCopy = (locale: Locale) => (locale === "ru" ? ru : en);
