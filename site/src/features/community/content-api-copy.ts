import type { Locale } from "../../lib/i18n";

const en = {
  notFound: "Article not found",
  unavailable: "Article is temporarily unavailable",
  listUnavailable: "Published content is temporarily unavailable",
  authenticationRequired: "Authentication required",
  creationLimitExceeded: "Content creation limit exceeded",
  invalidDetails: "Invalid content details",
  linkedServerNotFound: "Linked server was not found",
  linkedServerNotManaged: "You do not manage the linked server",
  linkedResourceNotFound: "Linked resource was not found",
  linkedResourceNotManaged: "You do not manage the linked resource",
  linkedOrganizationNotFound: "Linked organization was not found",
  organizationNotManaged: "You do not manage this organization",
  creationRetry: "Please retry creating the publication",
  createFailed: "Failed to create content",
};

const ru: Record<keyof typeof en, string> = {
  notFound: "Статья не найдена",
  unavailable: "Статья временно недоступна",
  listUnavailable: "Опубликованный контент временно недоступен",
  authenticationRequired: "Требуется вход",
  creationLimitExceeded: "Превышен лимит создания контента",
  invalidDetails: "Некорректные данные контента",
  linkedServerNotFound: "Связанный сервер не найден",
  linkedServerNotManaged: "Вы не управляете связанным сервером",
  linkedResourceNotFound: "Связанный ресурс не найден",
  linkedResourceNotManaged: "Вы не управляете связанным ресурсом",
  linkedOrganizationNotFound: "Связанная организация не найдена",
  organizationNotManaged: "Вы не управляете этой организацией",
  creationRetry: "Повторите создание публикации",
  createFailed: "Не удалось создать контент",
};

export const contentApiCopy = (locale: Locale) => (locale === "ru" ? ru : en);
