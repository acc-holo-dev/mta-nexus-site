import type { Locale } from "../../lib/i18n";

const en = {
  catalogUnavailable: "Resource catalog is temporarily unavailable",
  authenticationRequired: "Authentication required",
  actorRequired: "Actor precondition required",
  actorChanged: "Actor changed",
  creationLimitExceeded: "Resource creation limit exceeded",
  invalidDetails: "Invalid resource details",
  paidDisabled: "Paid resources are disabled until a payment provider is configured",
  slugExists: "A resource with this slug already exists",
  createFailed: "Could not create resource",
  notFound: "Product not found",
  detailsUnavailable: "Resource details are temporarily unavailable",
};

const ru: Record<keyof typeof en, string> = {
  catalogUnavailable: "Каталог ресурсов временно недоступен",
  authenticationRequired: "Требуется вход",
  actorRequired: "Требуется предусловие актора",
  actorChanged: "Актор изменился",
  creationLimitExceeded: "Превышен лимит создания ресурсов",
  invalidDetails: "Некорректные данные ресурса",
  paidDisabled: "Платные ресурсы отключены, пока не настроен платёжный провайдер",
  slugExists: "Ресурс с таким slug уже существует",
  createFailed: "Не удалось создать ресурс",
  notFound: "Продукт не найден",
  detailsUnavailable: "Детали ресурса временно недоступны",
};

export const productsApiCopy = (locale: Locale) => (locale === "ru" ? ru : en);
