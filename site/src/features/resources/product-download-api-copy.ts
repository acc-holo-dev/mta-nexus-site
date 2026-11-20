import type { Locale } from "../../lib/i18n";

const en = {
  authenticationRequired: "Authentication required to download resource builds",
  forbidden: "Forbidden",
  rate: "Too many download requests",
  notFound: "Resource not found",
  libraryRequired: "Add this resource to your library before downloading it",
  invalidBuild: "Invalid requested build",
  noPublishedBuild: "No published build is available",
  notCleared: "Published build is not cleared for delivery",
  cancelled: "Download cancelled",
  artifactMismatch: "Build file does not match its recorded metadata",
  fileUnavailable: "Resource build file is not available",
  deliverFailed: "Failed to deliver resource build",
};

const ru: Record<keyof typeof en, string> = {
  authenticationRequired: "Для загрузки сборок ресурса требуется вход",
  forbidden: "Запрещено",
  rate: "Слишком много запросов на загрузку",
  notFound: "Ресурс не найден",
  libraryRequired: "Добавьте ресурс в библиотеку перед загрузкой",
  invalidBuild: "Некорректная запрошенная сборка",
  noPublishedBuild: "Нет доступной опубликованной сборки",
  notCleared: "Опубликованная сборка не разрешена к выдаче",
  cancelled: "Загрузка отменена",
  artifactMismatch: "Файл сборки не совпадает с записанными метаданными",
  fileUnavailable: "Файл сборки ресурса недоступен",
  deliverFailed: "Не удалось выдать сборку ресурса",
};

export const productDownloadApiCopy = (locale: Locale) => (locale === "ru" ? ru : en);
