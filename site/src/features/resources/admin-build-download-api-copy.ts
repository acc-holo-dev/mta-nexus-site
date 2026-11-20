import type { Locale } from "../../lib/i18n";

const en = {
  moderatorRequired: "Moderator access required",
  rate: "Too many reviewer downloads",
  notFound: "Build not found",
  notAvailableForReview: "Build is not available for moderator evidence review",
  scanProvenanceRequired: "Reviewer download requires a provenance-backed clean malware scan",
  cancelled: "Download cancelled",
  artifactMismatch: "Build file does not match its recorded metadata",
  fileUnavailable: "Resource build file is not available",
  evidenceChanged: "Reviewer access or build evidence changed",
  deliverFailed: "Could not deliver reviewer artifact",
};

const ru: Record<keyof typeof en, string> = {
  moderatorRequired: "Требуется доступ модератора",
  rate: "Слишком много загрузок для ревьюера",
  notFound: "Сборка не найдена",
  notAvailableForReview: "Сборка недоступна для проверки доказательств модератором",
  scanProvenanceRequired:
    "Загрузка для ревьюера требует чистого антивирусного скана с подтверждённым происхождением",
  cancelled: "Загрузка отменена",
  artifactMismatch: "Файл сборки не совпадает с записанными метаданными",
  fileUnavailable: "Файл сборки ресурса недоступен",
  evidenceChanged: "Доступ ревьюера или доказательства сборки изменились",
  deliverFailed: "Не удалось выдать артефакт ревьюеру",
};

export const adminBuildDownloadApiCopy = (locale: Locale) => (locale === "ru" ? ru : en);
